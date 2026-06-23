import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { UserSessionService } from '../../../core/auth/user-session.service';
import { CyclesRepository } from '../../cycles/data/cycles.repository';
import {
  NomenclaturesRepository,
  ProgramNomenclature,
} from '../../nomenclatures/data/nomenclatures.repository';
import { ProgramsRepository } from '../../nomenclatures/data/programs.repository';
import {
  AcademicGroup,
  GroupStatus,
  GroupsRepository,
  UpsertGroupPayload,
} from '../data/groups.repository';
import {
  normalizeFullGroup,
  parseAcademicGroup,
  resolveAcademicArea,
} from '../utils/group-parser';

interface GroupPreviewRow {
  rowNumber: number;
  sourceGroup: string;
  programName: string;
  activeText: string;
  payload: UpsertGroupPayload | null;
  observations: string[];
}

type GroupScopeFilter = 'MIS' | 'TODOS';
const GROUPS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

@Component({
  selector: 'spai-groups-page',
  imports: [CommonModule],
  templateUrl: './groups-page.component.html',
  styleUrl: './groups-page.component.css',
})
export class GroupsPageComponent {
  private readonly groupsRepository = inject(GroupsRepository);
  private readonly cyclesRepository = inject(CyclesRepository);
  private readonly nomenclaturesRepository = inject(NomenclaturesRepository);
  private readonly programsRepository = inject(ProgramsRepository);
  private readonly userSessionService = inject(UserSessionService);

  readonly groups = this.groupsRepository.groups;
  readonly cycles = this.cyclesRepository.cycles;
  readonly nomenclatures = this.nomenclaturesRepository.nomenclatures;
  readonly programs = this.programsRepository.programs;
  readonly activeCycle = this.cyclesRepository.activeCycle;
  readonly canManageGroups = computed(() => {
    const appUser = this.userSessionService.session()?.appUser;

    return (
      appUser?.status === 'Activo' &&
      this.isSystemsRole(appUser.role)
    );
  });
  readonly isConsultationMode = computed(() => !this.canManageGroups());

  readonly activeGroupsCount = computed(
    () => this.groups().filter((group) => group.status === 'Activo').length,
  );
  readonly cycleOptions = computed(() =>
    this.cycles()
      .map((cycle) => cycle.code)
      .sort((a, b) => b.localeCompare(a, 'es')),
  );

  selectedCycleCode = '';
  groupScopeFilter: GroupScopeFilter = 'MIS';
  groupSearchTerm = '';
  csvImportMessage = '';
  csvImportErrors: string[] = [];
  previewRows: GroupPreviewRow[] = [];
  isManualGroupModalOpen = false;
  groupPendingDelete: AcademicGroup | null = null;
  isCycleDeleteModalOpen = false;
  deleteGroupError = '';
  manualGroupForm = this.emptyManualGroupForm();
  manualGroupErrors: string[] = [];
  currentPage = 1;
  pageSize = 10;
  readonly pageSizeOptions = GROUPS_PAGE_SIZE_OPTIONS;
  private readonly tableFiltersVersion = signal(0);

  readonly isAcademicCoordinator = computed(() => {
    const appUser = this.userSessionService.session()?.appUser;
    const role = this.normalizeRole(appUser?.role ?? '');

    return appUser?.status === 'Activo' && role.includes('acad') && !role.includes('sistemas');
  });

  readonly assignedProgramCodes = computed(() => {
    const appUser = this.userSessionService.session()?.appUser;

    if (!appUser) {
      return [];
    }

    const directPrograms = Array.isArray(appUser.assignedPrograms)
      ? appUser.assignedPrograms.map((program) => program.trim().toUpperCase()).filter(Boolean)
      : [];
    const userName = this.normalizeIdentity(appUser.name);
    const userEmail = this.normalizeIdentity(appUser.email);
    const coordinatorPrograms = this.programs()
      .filter((program) => {
        const coordinator = this.normalizeIdentity(program.coordinator);

        return !!coordinator && (coordinator === userName || coordinator === userEmail);
      })
      .map((program) => program.code.trim().toUpperCase())
      .filter(Boolean);

    return Array.from(new Set([...directPrograms, ...coordinatorPrograms])).sort((a, b) => a.localeCompare(b, 'es'));
  });

  readonly cycleGroups = computed(() => {
    this.tableFiltersVersion();

    const allowedPrograms = this.assignedProgramCodes();
    const scopedGroups =
      this.isAcademicCoordinator() && this.groupScopeFilter === 'MIS'
        ? this.groups().filter((group) => allowedPrograms.includes(group.programAbbreviation.trim().toUpperCase()))
        : this.groups();

    if (!this.selectedCycleCode) {
      return scopedGroups;
    }

    return scopedGroups.filter((group) => group.cycleCode === this.selectedCycleCode);
  });

  readonly visibleGroups = computed(() => {
    this.tableFiltersVersion();

    const searchTerm = this.normalizeSearchText(this.groupSearchTerm);

    if (!searchTerm) {
      return this.cycleGroups();
    }

    return this.cycleGroups().filter((group) => {
      const searchableText = this.normalizeSearchText(
        [
          group.fullGroup,
          group.cycleCode,
          group.programAbbreviation,
          group.programName,
          group.groupCode,
          group.section,
          group.modality,
          group.shift,
          group.academicArea,
          group.status,
        ].join(' '),
      );

      return searchableText.includes(searchTerm);
    });
  });

  get observedPreviewCount(): number {
    return this.previewRows.filter((row) => row.observations.length > 0).length;
  }

  get validPreviewCount(): number {
    return this.previewRows.filter((row) => row.payload && row.observations.length === 0).length;
  }

  get selectedCycleGroupsCount(): number {
    return this.selectedCycleCode ? this.cycleGroups().length : 0;
  }

  hasSelectedCycleFilter(): boolean {
    return Boolean(this.selectedCycleCode) && this.cycleOptions().includes(this.selectedCycleCode);
  }

  canDeleteSelectedCycleGroups(): boolean {
    return this.canManageGroups()
      && this.hasSelectedCycleFilter()
      && this.selectedCycleGroupsCount > 0;
  }

  deleteCycleGroupsActionTitle(): string {
    if (!this.hasSelectedCycleFilter()) {
      return 'Selecciona un ciclo para habilitar esta accion.';
    }

    if (this.selectedCycleGroupsCount === 0) {
      return 'No hay grupos registrados en el ciclo seleccionado.';
    }

    return `Eliminar grupos del ciclo ${this.selectedCycleCode}`;
  }

  paginatedGroups(): AcademicGroup[] {
    const startIndex = (this.currentSafePage() - 1) * this.pageSize;

    return this.visibleGroups().slice(startIndex, startIndex + this.pageSize);
  }

  totalGroupPages(): number {
    return Math.max(1, Math.ceil(this.visibleGroups().length / this.pageSize));
  }

  currentSafePage(): number {
    return Math.min(this.currentPage, this.totalGroupPages());
  }

  paginationStart(): number {
    const total = this.visibleGroups().length;

    if (!total) {
      return 0;
    }

    return (this.currentSafePage() - 1) * this.pageSize + 1;
  }

  paginationEnd(): number {
    return Math.min(this.currentSafePage() * this.pageSize, this.visibleGroups().length);
  }

  importCsv(event: Event): void {
    if (!this.canManageGroups()) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    this.csvImportMessage = '';
    this.csvImportErrors = [];
    this.previewRows = [];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const rows = this.parseCsvRows(String(reader.result ?? ''));
      this.previewRows = this.createPreviewRows(rows);

      if (!this.previewRows.length && !this.csvImportErrors.length) {
        this.csvImportErrors = ['El CSV no contiene filas para previsualizar.'];
      }

      input.value = '';
    };

    reader.onerror = () => {
      this.csvImportErrors = ['No se pudo leer el archivo CSV.'];
      input.value = '';
    };

    reader.readAsText(file, 'utf-8');
  }

  async savePreview(): Promise<void> {
    if (!this.canManageGroups()) {
      return;
    }

    const validGroups = this.previewRows
      .filter((row): row is GroupPreviewRow & { payload: UpsertGroupPayload } => {
        return row.payload !== null && row.observations.length === 0;
      })
      .map((row) => row.payload);

    if (!validGroups.length) {
      this.csvImportErrors = ['No hay filas validas para guardar.'];
      return;
    }

    try {
      await this.groupsRepository.importGroups(validGroups);
      this.csvImportMessage = `${validGroups.length} grupos guardados o actualizados correctamente.`;
      this.csvImportErrors = [];
      this.previewRows = [];
    } catch (error) {
      this.csvImportMessage = '';
      this.csvImportErrors = [
        `No se pudieron guardar los grupos. ${this.readFirebaseMessage(error)} ${this.currentAccessDiagnostic()}`,
      ];
    }
  }

  cancelPreview(): void {
    this.previewRows = [];
    this.csvImportMessage = '';
    this.csvImportErrors = [];
  }

  openManualGroupForm(): void {
    if (!this.canManageGroups()) {
      return;
    }

    this.manualGroupForm = this.emptyManualGroupForm();
    this.manualGroupErrors = [];
    this.isManualGroupModalOpen = true;
  }

  closeManualGroupForm(): void {
    this.isManualGroupModalOpen = false;
    this.manualGroupForm = this.emptyManualGroupForm();
    this.manualGroupErrors = [];
  }

  askDeleteGroup(group: AcademicGroup): void {
    if (!this.canManageGroups()) {
      return;
    }

    this.groupPendingDelete = group;
    this.deleteGroupError = '';
  }

  cancelDeleteGroup(): void {
    this.groupPendingDelete = null;
    this.deleteGroupError = '';
  }

  askDeleteCycleGroups(): void {
    if (!this.canDeleteSelectedCycleGroups()) {
      return;
    }

    this.isCycleDeleteModalOpen = true;
    this.deleteGroupError = '';
  }

  cancelDeleteCycleGroups(): void {
    this.isCycleDeleteModalOpen = false;
    this.deleteGroupError = '';
  }

  async deleteSelectedGroup(): Promise<void> {
    if (!this.canManageGroups() || !this.groupPendingDelete) {
      return;
    }

    const group = this.groupPendingDelete;

    try {
      await this.groupsRepository.deleteGroup(group.id);
      this.csvImportMessage = `Grupo ${group.fullGroup} eliminado correctamente.`;
      this.csvImportErrors = [];
      this.cancelDeleteGroup();
    } catch (error) {
      this.deleteGroupError =
        `No se pudo eliminar el grupo. ${this.readFirebaseMessage(error)} ${this.currentAccessDiagnostic()}`;
    }
  }

  async deleteSelectedCycleGroups(): Promise<void> {
    if (!this.canManageGroups() || !this.selectedCycleCode) {
      return;
    }

    const groupsToDelete = this.cycleGroups();

    if (!groupsToDelete.length) {
      this.deleteGroupError = 'No hay grupos para eliminar en el ciclo seleccionado.';
      return;
    }

    try {
      await this.groupsRepository.deleteGroups(groupsToDelete.map((group) => group.id));
      this.csvImportMessage = `${groupsToDelete.length} grupos del ciclo ${this.selectedCycleCode} eliminados correctamente.`;
      this.csvImportErrors = [];
      this.cancelDeleteCycleGroups();
    } catch (error) {
      this.deleteGroupError =
        `No se pudieron eliminar los grupos. ${this.readFirebaseMessage(error)} ${this.currentAccessDiagnostic()}`;
    }
  }

  updateManualGroupField(field: keyof ReturnType<GroupsPageComponent['emptyManualGroupForm']>, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    this.manualGroupForm = {
      ...this.manualGroupForm,
      [field]: target.value,
    };
    this.manualGroupErrors = [];
  }

  async saveManualGroup(): Promise<void> {
    if (!this.canManageGroups()) {
      return;
    }

    const result = this.buildManualGroupPayload();

    if (result.errors.length) {
      this.manualGroupErrors = result.errors;
      return;
    }

    if (!result.payload) {
      this.manualGroupErrors = ['No se pudo preparar el grupo para guardar.'];
      return;
    }

    try {
      await this.groupsRepository.upsertGroup(result.payload);
      this.csvImportMessage = `Grupo ${result.payload.fullGroup} guardado correctamente.`;
      this.csvImportErrors = [];
      this.closeManualGroupForm();
    } catch (error) {
      this.manualGroupErrors = [
        `No se pudo guardar el grupo. ${this.readFirebaseMessage(error)} ${this.currentAccessDiagnostic()}`,
      ];
    }
  }

  selectCycle(event: Event): void {
    this.selectedCycleCode = (event.target as HTMLSelectElement).value;
    this.resetPagination();
    this.tableFiltersVersion.update((version) => version + 1);
  }

  updateGroupSearch(event: Event): void {
    this.groupSearchTerm = (event.target as HTMLInputElement).value;
    this.resetPagination();
    this.tableFiltersVersion.update((version) => version + 1);
  }

  updateGroupScope(event: Event): void {
    this.groupScopeFilter = (event.target as HTMLSelectElement).value as GroupScopeFilter;
    this.resetPagination();
    this.tableFiltersVersion.update((version) => version + 1);
  }

  selectPageSize(event: Event): void {
    this.pageSize = Number((event.target as HTMLSelectElement).value) || 10;
    this.resetPagination();
  }

  goToPreviousPage(): void {
    this.currentPage = Math.max(1, this.currentSafePage() - 1);
  }

  goToNextPage(): void {
    this.currentPage = Math.min(this.totalGroupPages(), this.currentSafePage() + 1);
  }

  downloadCsvTemplate(): void {
    if (!this.canManageGroups()) {
      return;
    }

    const csvContent = [
      ['grupo', 'activo'],
      ['26-3 DER 53 01A', 'SI'],
      ['26-3 ENF 11 01A', 'SI'],
      ['27-1 CRIMYCRI 11 03 C.A', 'SI'],
    ]
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
      .join('\n');
    const blob = new Blob([`${csvContent}\n`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'plantilla-grupos.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  statusClass(status: GroupStatus): string {
    return status === 'Activo' ? 'active' : 'inactive';
  }

  cycleLabel(cycleCode: string): string {
    const cycle = this.cycles().find((item) => item.code === cycleCode);
    return cycle ? `${cycle.code} - ${cycle.label}` : cycleCode;
  }

  manualGroupCycleCode(): string {
    return this.activeCycle()?.code ?? this.selectedCycleCode;
  }

  manualGroupCycleLabel(): string {
    return this.manualGroupCycleCode() || 'Pendiente de configurar';
  }

  private buildManualGroupPayload(): { payload: UpsertGroupPayload | null; errors: string[] } {
    const errors: string[] = [];
    const manualGroupValue = this.manualGroupForm.fullGroup.trim();
    const manualCycleCode = this.manualGroupCycleCode();
    const fullGroup = this.buildManualFullGroup(manualGroupValue, manualCycleCode);
    const parsedGroup = parseAcademicGroup(fullGroup);
    const normalizedGroup = normalizeFullGroup(fullGroup);
    const status = this.parseStatus(this.manualGroupForm.status);
    const nomenclature = this.nomenclatures().find((item) => {
      return item.abbreviation.toUpperCase() === parsedGroup.programAbbreviation;
    });
    const program = this.programs().find((item) => item.code === parsedGroup.programAbbreviation);
    const programName = nomenclature?.programName || program?.name || '';

    errors.push(...parsedGroup.observations);

    if (!manualCycleCode) {
      errors.push('No hay ciclo activo para asignar el grupo.');
    }

    if (!manualGroupValue) {
      errors.push('El grupo es obligatorio.');
    }

    if (manualGroupValue && this.hasManualCyclePrefix(manualGroupValue) && parsedGroup.cycleCode !== manualCycleCode) {
      errors.push(`El alta individual solo permite grupos del ciclo activo ${manualCycleCode}.`);
    }

    if (parsedGroup.cycleCode && !this.cycles().some((cycle) => cycle.code === parsedGroup.cycleCode)) {
      errors.push(`El ciclo ${parsedGroup.cycleCode} no existe en el catalogo de ciclos.`);
    }

    if (normalizedGroup && this.groupsRepository.hasFullGroup(normalizedGroup)) {
      errors.push('El grupo completo ya existe.');
    }

    if (parsedGroup.programAbbreviation && !nomenclature) {
      errors.push(`La abreviatura ${parsedGroup.programAbbreviation} no existe en Nomenclaturas.`);
    }

    if (nomenclature?.status === 'INACTIVA') {
      errors.push(`La abreviatura ${parsedGroup.programAbbreviation} esta inactiva.`);
    }

    if (!programName) {
      errors.push('No se pudo resolver el nombre del programa. Capturalo manualmente o revisa Nomenclaturas.');
    }

    if (!status) {
      errors.push('El estado debe ser Activo o Inactivo.');
    }

    if (errors.length || !status) {
      return { payload: null, errors };
    }

    return {
      payload: {
        fullGroup: parsedGroup.fullGroup,
        cycleCode: parsedGroup.cycleCode,
        programAbbreviation: parsedGroup.programAbbreviation,
        groupCode: parsedGroup.groupCode,
        section: parsedGroup.section,
        programName,
        modality: parsedGroup.modality,
        shift: parsedGroup.shift,
        academicArea: resolveAcademicArea(
          parsedGroup.programAbbreviation,
          program?.academicArea ?? '',
          nomenclature?.notes ?? '',
        ),
        status,
      },
      errors,
    };
  }

  private createPreviewRows(rows: string[][]): GroupPreviewRow[] {
    if (rows.length < 2) {
      this.csvImportErrors = ['El CSV debe incluir encabezados y al menos una fila de datos.'];
      return [];
    }

    const headers = rows[0].map((header) => this.normalizeCsvHeader(header));
    const headerIndex = new Map(headers.map((header, index) => [header, index]));
    const missingHeaders = ['grupo', 'activo'].filter((header) => !headerIndex.has(header));

    if (missingHeaders.length) {
      this.csvImportErrors = ['El CSV debe incluir las columnas grupo y activo.'];
      return [];
    }

    const fileGroups = new Set<string>();
    const nomenclaturesByAbbreviation = new Map(
      this.nomenclatures().map((nomenclature) => [nomenclature.abbreviation.toUpperCase(), nomenclature]),
    );
    const existingGroups = new Set(this.groups().map((group) => normalizeFullGroup(group.fullGroup)));
    const existingCycles = new Set(this.cycles().map((cycle) => cycle.code));

    return rows.slice(1).flatMap((row, index) => {
      const rowNumber = index + 2;
      const sourceGroup = this.getCsvValue(row, headerIndex, 'grupo');
      const programName = this.getCsvValue(row, headerIndex, 'programa');
      const activeText = this.getCsvValue(row, headerIndex, 'activo');

      if (!sourceGroup && !programName && !activeText) {
        return [];
      }

      return [
        this.validatePreviewRow({
          rowNumber,
          sourceGroup,
          programName,
          activeText,
          fileGroups,
          existingGroups,
          existingCycles,
          nomenclaturesByAbbreviation,
        }),
      ];
    });
  }

  private validatePreviewRow(context: {
    rowNumber: number;
    sourceGroup: string;
    programName: string;
    activeText: string;
    fileGroups: Set<string>;
    existingGroups: Set<string>;
    existingCycles: Set<string>;
    nomenclaturesByAbbreviation: Map<string, ProgramNomenclature>;
  }): GroupPreviewRow {
    const observations: string[] = [];
    const parsedGroup = parseAcademicGroup(context.sourceGroup);
    observations.push(...parsedGroup.observations);

    if (!context.sourceGroup) {
      observations.push('El grupo es obligatorio.');
    }

    if (!context.activeText) {
      observations.push('El campo activo es obligatorio.');
    }

    const status = this.parseStatus(context.activeText);
    if (!status && context.activeText) {
      observations.push('El campo activo debe ser SI o NO.');
    }

    if (parsedGroup.cycleCode && !context.existingCycles.has(parsedGroup.cycleCode)) {
      observations.push(`El ciclo ${parsedGroup.cycleCode} no existe en el catalogo de ciclos.`);
    }

    if (parsedGroup.fullGroup && context.fileGroups.has(parsedGroup.fullGroup)) {
      observations.push('El grupo completo esta duplicado dentro del CSV.');
    }

    const nomenclature = context.nomenclaturesByAbbreviation.get(parsedGroup.programAbbreviation);

    if (parsedGroup.programAbbreviation && !nomenclature) {
      observations.push(`La abreviatura ${parsedGroup.programAbbreviation} no existe en Nomenclaturas.`);
    }

    if (nomenclature?.status === 'INACTIVA') {
      observations.push(`La abreviatura ${parsedGroup.programAbbreviation} esta inactiva.`);
    }

    const resolvedProgramName = context.programName || nomenclature?.programName || '';

    if (parsedGroup.programAbbreviation && !resolvedProgramName) {
      observations.push(`No se pudo resolver el programa para ${parsedGroup.programAbbreviation}. Revisa Nomenclaturas.`);
    }

    if (parsedGroup.fullGroup) {
      context.fileGroups.add(parsedGroup.fullGroup);
    }

    const program = this.programs().find((item) => item.code === parsedGroup.programAbbreviation);
    const payload =
      parsedGroup.cycleCode && parsedGroup.programAbbreviation && status
        ? {
            fullGroup: parsedGroup.fullGroup,
            cycleCode: parsedGroup.cycleCode,
            programAbbreviation: parsedGroup.programAbbreviation,
            groupCode: parsedGroup.groupCode,
            section: parsedGroup.section,
            programName: resolvedProgramName,
            modality: parsedGroup.modality,
            shift: parsedGroup.shift,
            academicArea: resolveAcademicArea(
              parsedGroup.programAbbreviation,
              program?.academicArea ?? '',
              nomenclature?.notes ?? '',
            ),
            status,
          }
        : null;

    return {
      rowNumber: context.rowNumber,
      sourceGroup: context.sourceGroup,
      programName: resolvedProgramName || context.programName,
      activeText: context.activeText,
      payload,
      observations,
    };
  }

  private parseCsvRows(content: string): string[][] {
    const rows: string[][] = [];
    let currentValue = '';
    let currentRow: string[] = [];
    let insideQuotes = false;

    for (let index = 0; index < content.length; index++) {
      const char = content[index];
      const nextChar = content[index + 1];

      if (char === '"' && insideQuotes && nextChar === '"') {
        currentValue += '"';
        index++;
      } else if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentValue.trim());
        currentValue = '';
      } else if ((char === '\n' || char === '\r') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          index++;
        }
        currentRow.push(currentValue.trim());
        if (currentRow.some((value) => value.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentValue = '';
      } else {
        currentValue += char;
      }
    }

    currentRow.push(currentValue.trim());
    if (currentRow.some((value) => value.length > 0)) {
      rows.push(currentRow);
    }

    return rows;
  }

  private normalizeCsvHeader(header: string): string {
    return header
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_');
  }

  private getCsvValue(row: string[], headerIndex: Map<string, number>, header: string): string {
    const index = headerIndex.get(header);
    return index === undefined ? '' : (row[index] ?? '').trim();
  }

  private parseStatus(value: string): GroupStatus | null {
    const normalizedValue = value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (['si', 's', 'activo', 'true', '1'].includes(normalizedValue)) {
      return 'Activo';
    }

    if (['no', 'n', 'inactivo', 'false', '0'].includes(normalizedValue)) {
      return 'Inactivo';
    }

    return null;
  }

  private escapeCsvValue(value: string): string {
    return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }

  private normalizeSearchText(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private normalizeIdentity(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  private normalizeRole(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private isSystemsRole(role: string): boolean {
    return this.normalizeRole(role).includes('sistemas');
  }

  private readFirebaseMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Revisa permisos de Firebase e intentalo de nuevo.';
  }

  private currentAccessDiagnostic(): string {
    const session = this.userSessionService.session();
    const appUser = session?.appUser;

    if (!session) {
      return '';
    }

    if (!appUser) {
      return `UID: ${session.authUid} | Sin documento de usuario activo.`;
    }

    return [
      `UID: ${session.authUid}`,
      `Rol: ${appUser.role}`,
      `Estado: ${appUser.status}`,
      `Acceso grupos: ${appUser.access?.grupos === true ? 'SI' : 'NO'}`,
    ].join(' | ');
  }

  private emptyManualGroupForm(): { fullGroup: string; status: GroupStatus } {
    return {
      fullGroup: '',
      status: 'Activo',
    };
  }

  private buildManualFullGroup(groupValue: string, cycleCode: string): string {
    if (!groupValue || this.hasManualCyclePrefix(groupValue)) {
      return groupValue;
    }

    return `${cycleCode} ${groupValue}`.trim();
  }

  private hasManualCyclePrefix(groupValue: string): boolean {
    return /^\d{2}-\d\s+/i.test(groupValue.trim());
  }

  private resetPagination(): void {
    this.currentPage = 1;
  }
}
