import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserSessionService } from '../../../core/auth/user-session.service';
import {
  NomenclatureStatus,
  NomenclaturesRepository,
  ProgramNomenclature,
} from '../data/nomenclatures.repository';
import { ProgramStatus, ProgramsRepository } from '../data/programs.repository';
import { AppUser, UsersRepository } from '../../users/data/users.repository';
import { ConfirmationDialogService } from '../../../shared/confirmation/confirmation-dialog.service';
import { CyclesRepository } from '../../cycles/data/cycles.repository';

interface CoordinatorOption {
  label: string;
  value: string;
}

interface CsvNomenclatureRow {
  abbreviation: string;
  programName: string;
  programStatus: ProgramStatus;
  planName: string;
  status: NomenclatureStatus;
  coordinator: string;
  notes: string;
}

const DEFAULT_PLAN_NAME = 'Plan 2023-2026';
const DEFAULT_INSTITUTIONAL_AREA = 'Campus TUP';
const NOMENCLATURES_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

@Component({
  selector: 'spai-nomenclatures-page',
  imports: [CommonModule, ReactiveFormsModule],
  providers: [
    NomenclaturesRepository,
    ProgramsRepository,
    UsersRepository,
  ],
  templateUrl: './nomenclatures-page.component.html',
  styleUrl: './nomenclatures-page.component.css',
})
export class NomenclaturesPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly nomenclaturesRepository = inject(NomenclaturesRepository);
  private readonly programsRepository = inject(ProgramsRepository);
  private readonly usersRepository = inject(UsersRepository);
  private readonly userSessionService = inject(UserSessionService);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly cyclesRepository = inject(CyclesRepository);

  readonly nomenclatures = this.nomenclaturesRepository.nomenclatures;
  readonly activeCycle = this.cyclesRepository.activeCycle;
  readonly programs = this.programsRepository.programs;
  readonly users = this.usersRepository.users;
  readonly nomenclatureStatuses: NomenclatureStatus[] = ['ACTIVA', 'INACTIVA'];
  readonly programStatuses: ProgramStatus[] = ['Activo', 'Inactivo'];
  readonly institutionalAreas = [DEFAULT_INSTITUTIONAL_AREA, 'Facultad de Ciencias de la Salud'];

  readonly activeNomenclaturesCount = computed(
    () => this.nomenclatures().filter((item) => item.status === 'ACTIVA').length,
  );
  readonly inactiveNomenclaturesCount = computed(
    () => this.nomenclatures().filter((item) => item.status === 'INACTIVA').length,
  );
  readonly usedNomenclaturesCount = computed(
    () => this.nomenclatures().filter((item) => item.usageCount > 0).length,
  );
  readonly registeredProgramsCount = computed(() => {
    const programCodes = new Set(
      this.nomenclatures()
        .map((item) => (item.programCode || item.abbreviation).trim().toUpperCase())
        .filter(Boolean),
    );

    return programCodes.size;
  });
  readonly canManageNomenclatures = computed(() => {
    const appUser = this.userSessionService.session()?.appUser;

    return (
      appUser?.status === 'Activo' &&
      this.isSystemsRole(appUser.role)
    );
  });
  readonly isConsultationMode = computed(() => !this.canManageNomenclatures());
  readonly tableColumnCount = computed(() => (this.canManageNomenclatures() ? 8 : 7));
  readonly coordinatorOptions = computed<CoordinatorOption[]>(() => {
    const currentCoordinator = this.form.controls.coordinator.value.trim();
    const options = this.users()
      .filter((user) => this.isActiveCoordinator(user))
      .map((user) => ({
        label: `${user.name} - ${user.email}`,
        value: user.name,
      }));

    if (currentCoordinator && !options.some((option) => option.value === currentCoordinator)) {
      options.unshift({
        label: `${currentCoordinator} - registro previo`,
        value: currentCoordinator,
      });
    }

    return options.sort((a, b) => a.label.localeCompare(b.label, 'es'));
  });
  readonly coordinatorsByProgramCode = computed(() => {
    const index = new Map<string, Map<string, string>>();
    const addCoordinator = (programCode: string, coordinatorName: string) => {
      const code = programCode.trim().toUpperCase();
      const name = coordinatorName.trim();

      if (!code || !name) {
        return;
      }

      const normalizedName = this.normalizeSearchValue(name);
      const currentCoordinators = index.get(code) ?? new Map<string, string>();

      currentCoordinators.set(normalizedName, name);
      index.set(code, currentCoordinators);
    };

    this.programs().forEach((program) => {
      addCoordinator(program.code, program.coordinator);
    });

    this.users()
      .filter((user) => this.isActiveCoordinator(user))
      .forEach((user) => {
        user.assignedPrograms.forEach((program) => {
          addCoordinator(program, user.name);
        });
      });

    return new Map(
      Array.from(index.entries()).map(([programCode, coordinators]) => [
        programCode,
        Array.from(coordinators.values()).sort((a, b) => a.localeCompare(b, 'es')),
      ]),
    );
  });

  readonly form = this.formBuilder.nonNullable.group({
    abbreviation: ['', [Validators.required, Validators.minLength(2)]],
    programCode: [''],
    programName: ['', [Validators.required, Validators.minLength(3)]],
    academicArea: ['Pendiente de clasificar'],
    programType: ['Licenciatura'],
    modality: ['Escolarizada'],
    coordinator: [''],
    programStatus: this.formBuilder.nonNullable.control<ProgramStatus>('Activo', Validators.required),
    planName: [DEFAULT_PLAN_NAME, [Validators.required, Validators.minLength(3)]],
    planCode: [''],
    status: this.formBuilder.nonNullable.control<NomenclatureStatus>('ACTIVA', Validators.required),
    notes: [DEFAULT_INSTITUTIONAL_AREA, Validators.required],
  });

  isFormOpen = false;
  editingNomenclatureId: string | null = null;
  duplicateAbbreviation = false;
  saveError = '';
  csvImportMessage = '';
  csvImportErrors: string[] = [];
  readonly searchDraft = signal('');
  readonly searchText = signal('');
  currentPage = 1;
  pageSize = 10;
  readonly pageSizeOptions = NOMENCLATURES_PAGE_SIZE_OPTIONS;

  readonly filteredNomenclatures = computed(() => {
    const query = this.normalizeSearchValue(this.searchText());

    if (!query) {
      return this.nomenclatures();
    }

    return this.nomenclatures().filter((nomenclature) => {
      const searchableText = [
        nomenclature.abbreviation,
        nomenclature.programName,
        this.programStatusFor(nomenclature),
        nomenclature.planName,
        nomenclature.status,
        this.coordinatorFor(nomenclature),
      ]
        .map((value) => this.normalizeSearchValue(value))
        .join(' ');

      return searchableText.includes(query);
    });
  });

  paginatedNomenclatures(): ProgramNomenclature[] {
    const startIndex = (this.currentSafePage() - 1) * this.pageSize;

    return this.filteredNomenclatures().slice(startIndex, startIndex + this.pageSize);
  }

  constructor() {
    this.form.controls.abbreviation.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.duplicateAbbreviation = false;
    });
  }

  get modalEyebrow(): string {
    return this.editingNomenclatureId ? 'Edicion de nomenclatura' : 'Alta de nomenclatura';
  }

  get modalTitle(): string {
    return this.editingNomenclatureId ? 'Actualizar abreviatura' : 'Datos de programa y plan';
  }

  get submitLabel(): string {
    return this.editingNomenclatureId ? 'Guardar cambios' : 'Guardar nomenclatura';
  }

  openForm(): void {
    if (!this.canManageNomenclatures()) {
      return;
    }

    this.editingNomenclatureId = null;
    this.duplicateAbbreviation = false;
    this.saveError = '';
    this.resetForm();
    this.isFormOpen = true;
  }

  editNomenclature(nomenclature: ProgramNomenclature): void {
    if (!this.canManageNomenclatures()) {
      return;
    }

    const program = this.programs().find((item) => item.code === nomenclature.programCode);

    this.editingNomenclatureId = nomenclature.id;
    this.duplicateAbbreviation = false;
    this.saveError = '';
    this.form.reset({
      abbreviation: nomenclature.abbreviation,
      programCode: nomenclature.programCode,
      programName: nomenclature.programName,
      academicArea: program?.academicArea ?? '',
      programType: program?.programType ?? 'Licenciatura',
      modality: program?.modality ?? 'Escolarizada',
      coordinator: program?.coordinator ?? '',
      programStatus: program?.status ?? 'Activo',
      planName: nomenclature.planName,
      planCode: nomenclature.planCode,
      status: nomenclature.status,
      notes: this.resolveInstitutionalArea(nomenclature.notes),
    });
    this.isFormOpen = true;
  }

  closeForm(): void {
    this.isFormOpen = false;
    this.editingNomenclatureId = null;
    this.duplicateAbbreviation = false;
    this.saveError = '';
    this.resetForm();
  }

  async saveNomenclature(): Promise<void> {
    if (!this.canManageNomenclatures()) {
      return;
    }

    this.saveError = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.form.getRawValue();
    this.duplicateAbbreviation = this.nomenclaturesRepository.hasAbbreviation(
      payload.abbreviation,
      this.editingNomenclatureId,
    );

    if (this.duplicateAbbreviation) {
      return;
    }

    const programCode = this.resolveProgramCode(payload.programCode, payload.abbreviation);

    const nomenclaturePayload = {
      ...payload,
      programCode,
      planCode: this.resolvePlanCode(payload.planCode, payload.abbreviation),
    };

    try {
      if (this.editingNomenclatureId) {
        await this.nomenclaturesRepository.updateNomenclature(this.editingNomenclatureId, nomenclaturePayload);
      } else {
        await this.nomenclaturesRepository.createNomenclature(nomenclaturePayload);
      }
    } catch (error) {
      this.saveError = `No se pudo guardar la nomenclatura. ${this.readFirebaseMessage(error)} ${this.currentAccessDiagnostic()}`;
      return;
    }

    try {
      await this.programsRepository.upsertProgram({
        code: programCode,
        name: payload.programName,
        academicArea: payload.academicArea || 'Pendiente de clasificar',
        programType: payload.programType || 'Licenciatura',
        modality: payload.modality || 'Escolarizada',
        coordinator: payload.coordinator,
        status: payload.programStatus,
      });
      await this.usersRepository.assignProgramToCoordinator(payload.coordinator, programCode);
    } catch (error) {
      this.csvImportMessage = `Nomenclatura guardada. No se pudo actualizar el programa o coordinador automaticamente: ${this.readFirebaseMessage(error)}`;
    }

    this.closeForm();
  }

  toggleStatus(nomenclature: ProgramNomenclature): void {
    if (!this.canManageNomenclatures()) {
      return;
    }

    this.nomenclaturesRepository.toggleStatus(nomenclature.id);
  }

  async deleteNomenclature(nomenclature: ProgramNomenclature): Promise<void> {
    if (!this.canManageNomenclatures()) {
      return;
    }

    if (!this.canDelete(nomenclature)) {
      await this.confirmationDialogService.alert({
        title: 'No se puede eliminar',
        message: 'Esta abreviatura ya tiene uso operativo. Debe conservarse inactiva para historico.',
      });
      return;
    }

    const confirmed = await this.confirmationDialogService.confirm({
      title: 'Eliminar abreviatura',
      message: `Eliminar la abreviatura ${nomenclature.abbreviation}?`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (confirmed) {
      this.nomenclaturesRepository.deleteIfUnused(nomenclature.id);
    }
  }

  importCsv(event: Event): void {
    if (!this.canManageNomenclatures()) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    this.csvImportMessage = '';
    this.csvImportErrors = [];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = async () => {
      const content = String(reader.result ?? '');
      const rows = this.parseCsvRows(content);
      const parsedRows = this.parseCsvNomenclatures(rows);

      if (!parsedRows.length) {
        this.csvImportMessage = '';
        input.value = '';
        return;
      }

      let createdCount = 0;
      let updatedCount = 0;

      try {
        for (const row of parsedRows) {
          const programCode = row.abbreviation;

          await this.programsRepository.upsertProgram({
            code: programCode,
            name: row.programName,
            academicArea: 'Pendiente de clasificar',
            programType: 'Licenciatura',
            modality: 'Escolarizada',
            coordinator: row.coordinator,
            status: row.programStatus,
          });
          await this.usersRepository.assignProgramToCoordinator(row.coordinator, programCode);

          const result = await this.nomenclaturesRepository.upsertNomenclature({
            abbreviation: row.abbreviation,
            programCode,
            programName: row.programName,
            planName: row.planName,
            planCode: row.abbreviation,
            status: row.status,
            notes: row.notes,
          });

          if (result === 'created') {
            createdCount++;
          } else {
            updatedCount++;
          }
        }

        this.csvImportMessage = `${parsedRows.length} nomenclaturas procesadas: ${createdCount} creadas y ${updatedCount} actualizadas.`;
      } catch (error) {
        this.csvImportMessage = '';
        this.csvImportErrors = [`No se importo el CSV. ${this.readFirebaseMessage(error)}`];
      }
      input.value = '';
    };

    reader.onerror = () => {
      this.csvImportErrors = ['No se pudo leer el archivo CSV.'];
      input.value = '';
    };

    reader.readAsText(file, 'utf-8');
  }

  downloadCsvTemplate(): void {
    const headers = [
      'abreviatura',
      'nombre_programa',
      'estado_programa',
      'nombre_plan',
      'estado_abreviatura',
      'coordinador_responsable',
      'observaciones',
    ];
    const exampleRow = [
      'ADEM',
      'Administracion de Empresas',
      'Activo',
      DEFAULT_PLAN_NAME,
      'ACTIVA',
      '',
      DEFAULT_INSTITUTIONAL_AREA,
    ];
    const csvContent = `${headers.join(',')}\n${exampleRow.map((value) => this.escapeCsvValue(value)).join(',')}\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'plantilla-nomenclaturas.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  canDelete(nomenclature: ProgramNomenclature): boolean {
    return nomenclature.usageCount === 0;
  }

  statusActionLabel(nomenclature: ProgramNomenclature): string {
    return nomenclature.status === 'ACTIVA' ? 'Inhabilitar' : 'Activar';
  }

  programStatusFor(nomenclature: ProgramNomenclature): ProgramStatus {
    return this.programs().find((program) => program.code === nomenclature.programCode)?.status ?? 'Activo';
  }

  coordinatorFor(nomenclature: ProgramNomenclature): string {
    const nomenclatureCodes = [
      nomenclature.abbreviation,
      nomenclature.programCode,
    ]
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean);
    const coordinatorNames = new Map<string, string>();

    nomenclatureCodes.forEach((programCode) => {
      (this.coordinatorsByProgramCode().get(programCode) ?? []).forEach((coordinatorName) => {
        coordinatorNames.set(this.normalizeSearchValue(coordinatorName), coordinatorName);
      });
    });

    const assignedCoordinators = Array.from(coordinatorNames.values()).sort((a, b) => a.localeCompare(b, 'es'));

    return assignedCoordinators.length ? assignedCoordinators.join(', ') : 'Sin asignar';
  }

  updateSearchDraft(event: Event): void {
    const value = (event.target as HTMLInputElement).value;

    this.searchDraft.set(value);
    this.searchText.set(value);
    this.resetPagination();
  }

  applySearch(): void {
    this.searchText.set(this.searchDraft());
    this.resetPagination();
  }

  clearSearch(): void {
    this.searchDraft.set('');
    this.searchText.set('');
    this.resetPagination();
  }

  formatCycleDate(value: string | null | undefined): string {
    if (!value) {
      return 'PENDIENTE';
    }

    const date = new Date(`${value.slice(0, 10)}T12:00:00`);

    return Number.isNaN(date.getTime())
      ? 'PENDIENTE'
      : new Intl.DateTimeFormat('es-MX', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }).format(date).replace('.', '').toUpperCase();
  }

  selectPageSize(event: Event): void {
    this.pageSize = Number((event.target as HTMLSelectElement).value) || 10;
    this.resetPagination();
  }

  goToPreviousPage(): void {
    this.currentPage = Math.max(1, this.currentSafePage() - 1);
  }

  goToNextPage(): void {
    this.currentPage = Math.min(this.totalNomenclaturePages(), this.currentSafePage() + 1);
  }

  totalNomenclaturePages(): number {
    return Math.max(1, Math.ceil(this.filteredNomenclatures().length / this.pageSize));
  }

  currentSafePage(): number {
    return Math.min(this.currentPage, this.totalNomenclaturePages());
  }

  paginationStart(): number {
    const total = this.filteredNomenclatures().length;

    if (!total) {
      return 0;
    }

    return (this.currentSafePage() - 1) * this.pageSize + 1;
  }

  paginationEnd(): number {
    return Math.min(this.currentSafePage() * this.pageSize, this.filteredNomenclatures().length);
  }

  private isActiveCoordinator(user: AppUser): boolean {
    const role = this.normalizeRole(user.role);

    return user.status === 'Activo'
      && role.includes('acad')
      && !role.includes('sistemas');
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

  private parseCsvNomenclatures(rows: string[][]): CsvNomenclatureRow[] {
    if (rows.length < 2) {
      this.csvImportErrors = ['El CSV debe incluir encabezados y al menos una fila de datos.'];
      return [];
    }

    const headers = rows[0].map((header) => this.normalizeCsvHeader(header));
    const headerIndex = new Map(headers.map((header, index) => [header, index]));
    const requiredHeaders = ['abreviatura', 'nombre_programa'];
    const missingHeaders = requiredHeaders.filter((header) => !headerIndex.has(header));

    if (missingHeaders.length) {
      this.csvImportErrors = [
        'El CSV debe incluir las columnas abreviatura y nombre_programa. Tambien se acepta carrera_actual en lugar de nombre_programa.',
      ];
      return [];
    }

    const fileAbbreviations = new Set<string>();
    const activeCoordinators = new Set(
      this.users()
        .filter((user) => this.isActiveCoordinator(user))
        .map((user) => user.name.trim().toLowerCase()),
    );

    const validRows: CsvNomenclatureRow[] = [];
    const errors: string[] = [];

    rows.slice(1).forEach((row, index) => {
      const rowNumber = index + 2;
      const abbreviation = this.getCsvValue(row, headerIndex, 'abreviatura').toUpperCase();
      const programName = this.getCsvValue(row, headerIndex, 'nombre_programa');
      const coordinator = this.getCsvValue(row, headerIndex, 'coordinador_responsable');

      if (!abbreviation && !programName && !coordinator) {
        return;
      }

      if (!abbreviation || !programName) {
        errors.push(`Fila ${rowNumber}: abreviatura y nombre_programa son obligatorios.`);
        return;
      }

      if (fileAbbreviations.has(abbreviation)) {
        errors.push(`Fila ${rowNumber}: la abreviatura ${abbreviation} esta duplicada en el CSV.`);
        return;
      }

      if (coordinator && !activeCoordinators.has(coordinator.toLowerCase())) {
        errors.push(`Fila ${rowNumber}: el coordinador "${coordinator}" no esta registrado como coordinador activo.`);
        return;
      }

      fileAbbreviations.add(abbreviation);
      validRows.push({
        abbreviation,
        programName,
        programStatus: this.parseProgramStatus(this.getCsvValue(row, headerIndex, 'estado_programa')),
        planName: this.getCsvValue(row, headerIndex, 'nombre_plan') || DEFAULT_PLAN_NAME,
        status: this.parseNomenclatureStatus(this.getCsvValue(row, headerIndex, 'estado_abreviatura')),
        coordinator,
        notes: this.getCsvValue(row, headerIndex, 'observaciones'),
      });
    });

    this.csvImportErrors = errors;
    return errors.length ? [] : validRows;
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

  private escapeCsvValue(value: string): string {
    return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }

  private normalizeCsvHeader(header: string): string {
    const normalizedHeader = header
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_');

    if (['carrera_actual', 'nombre_del_programa', 'programa'].includes(normalizedHeader)) {
      return 'nombre_programa';
    }

    if (['estado_de_programa'].includes(normalizedHeader)) {
      return 'estado_programa';
    }

    if (['plan', 'nombre_del_plan'].includes(normalizedHeader)) {
      return 'nombre_plan';
    }

    if (['estado', 'estado_de_abreviatura'].includes(normalizedHeader)) {
      return 'estado_abreviatura';
    }

    if (['coordinador', 'coordinador_responsable'].includes(normalizedHeader)) {
      return 'coordinador_responsable';
    }

    return normalizedHeader;
  }

  private getCsvValue(row: string[], headerIndex: Map<string, number>, header: string): string {
    const index = headerIndex.get(header);
    return index === undefined ? '' : (row[index] ?? '').trim();
  }

  private parseProgramStatus(value: string): ProgramStatus {
    return value.trim().toLowerCase() === 'inactivo' ? 'Inactivo' : 'Activo';
  }

  private parseNomenclatureStatus(value: string): NomenclatureStatus {
    return value.trim().toLowerCase() === 'inactiva' ? 'INACTIVA' : 'ACTIVA';
  }

  private resolveProgramCode(programCode: string, abbreviation: string): string {
    return (programCode || abbreviation).trim().toUpperCase();
  }

  private resolvePlanCode(planCode: string, abbreviation: string): string {
    return (planCode || abbreviation).trim().toUpperCase();
  }

  private normalizeSearchValue(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
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
      `Acceso nomenclaturas: ${appUser.access?.nomenclaturas === true ? 'SI' : 'NO'}`,
    ].join(' | ');
  }

  private resetForm(): void {
    this.form.reset({
      abbreviation: '',
      programCode: '',
      programName: '',
      academicArea: 'Pendiente de clasificar',
      programType: 'Licenciatura',
      modality: 'Escolarizada',
      coordinator: '',
      programStatus: 'Activo',
      planName: DEFAULT_PLAN_NAME,
      planCode: '',
      status: 'ACTIVA',
      notes: DEFAULT_INSTITUTIONAL_AREA,
    });
  }

  private resetPagination(): void {
    this.currentPage = 1;
  }

  private resolveInstitutionalArea(value: string): string {
    const normalizedValue = this.normalizeSearchValue(value);

    if (normalizedValue.includes('facultad') || normalizedValue.includes('salud')) {
      return 'Facultad de Ciencias de la Salud';
    }

    return DEFAULT_INSTITUTIONAL_AREA;
  }
}
