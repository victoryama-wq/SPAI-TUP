import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserSessionService } from '../../../core/auth/user-session.service';
import { AuditLogRepository } from '../../../core/data/audit-log.repository';
import { ConfirmationDialogService } from '../../../shared/confirmation/confirmation-dialog.service';
import {
  Subject,
  SubjectStatus,
  SubjectsRepository,
  UpsertSubjectPayload,
} from '../data/subjects.repository';

interface SubjectPreviewRow {
  rowNumber: number;
  subjectId: string;
  name: string;
  activeText: string;
  payload: UpsertSubjectPayload | null;
  observations: string[];
  warnings: string[];
  duplicate: boolean;
}

interface DuplicateSubjectGroup {
  normalizedName: string;
  name: string;
  subjects: Subject[];
}

const SUBJECTS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

@Component({
  selector: 'spai-subjects-page',
  imports: [CommonModule, FormsModule],
  providers: [
    AuditLogRepository,
    SubjectsRepository,
  ],
  templateUrl: './subjects-page.component.html',
  styleUrl: './subjects-page.component.css',
})
export class SubjectsPageComponent {
  private readonly subjectsRepository = inject(SubjectsRepository);
  private readonly auditLogRepository = inject(AuditLogRepository);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly userSessionService = inject(UserSessionService);

  readonly subjects = this.subjectsRepository.subjects;
  readonly subjectsReadError = this.subjectsRepository.readError;
  readonly session = this.userSessionService.session;

  searchInput = signal('');
  appliedSearchTerm = signal('');
  statusFilter = signal<SubjectStatus | 'TODOS'>('TODOS');
  csvImportMessage = '';
  csvImportErrors: string[] = [];
  formMessage = '';
  formErrors: string[] = [];
  previewRows: SubjectPreviewRow[] = [];
  isManualModalOpen = false;
  isDuplicateCleanerOpen = false;
  editingSubjectId: string | null = null;
  selectedDuplicateSubjectIds = signal<Set<string>>(new Set());
  currentPage = 1;
  pageSize = 10;
  readonly pageSizeOptions = SUBJECTS_PAGE_SIZE_OPTIONS;

  manualForm = {
    subjectId: '',
    name: '',
    status: 'Activo' as SubjectStatus,
  };

  readonly activeSubjectsCount = computed(
    () => this.subjects().filter((subject) => this.isActiveSubject(subject)).length,
  );
  readonly inactiveSubjectsCount = computed(
    () => this.subjects().filter((subject) => this.subjectStatusMatches(subject, 'Inactivo')).length,
  );
  readonly suggestedSubjectId = computed(() => this.nextSuggestedSubjectId());
  readonly duplicateSubjectNameMap = computed(() => {
    const subjectsByName = new Map<string, Subject[]>();

    this.subjects().forEach((subject) => {
      const normalizedName = this.normalizeSearchText(subject.normalizedName || subject.name);

      if (!normalizedName) {
        return;
      }

      const subjectsWithSameName = subjectsByName.get(normalizedName) ?? [];
      subjectsWithSameName.push(subject);
      subjectsByName.set(normalizedName, subjectsWithSameName);
    });

    const duplicateNames = new Map<string, Subject[]>();

    subjectsByName.forEach((subjects, normalizedName) => {
      const uniqueSubjectIds = new Set(subjects.map((subject) => subject.subjectId));

      if (uniqueSubjectIds.size > 1) {
        duplicateNames.set(normalizedName, subjects);
      }
    });

    return duplicateNames;
  });
  readonly duplicateSubjectGroups = computed<DuplicateSubjectGroup[]>(() => {
    return Array.from(this.duplicateSubjectNameMap().entries())
      .map(([normalizedName, subjects]) => {
        const sortedSubjects = [...subjects].sort((firstSubject, secondSubject) => {
          return firstSubject.subjectId.localeCompare(secondSubject.subjectId, 'es', { numeric: true });
        });

        return {
          normalizedName,
          name: sortedSubjects[0]?.name ?? normalizedName,
          subjects: sortedSubjects,
        };
      })
      .sort((firstGroup, secondGroup) => firstGroup.name.localeCompare(secondGroup.name, 'es'));
  });
  readonly duplicateSubjectsToReviewCount = computed(() => {
    return this.duplicateSubjectGroups().reduce((total, group) => total + Math.max(0, group.subjects.length - 1), 0);
  });
  readonly selectedDuplicateCount = computed(() => this.selectedDuplicateSubjectIds().size);

  readonly canManageSubjects = computed(() => {
    const appUser = this.session()?.appUser;

    return appUser?.status === 'Activo'
      && (appUser.role.includes('Sistemas')
        || (appUser.role === 'Auxiliar de Sistemas' && appUser.access?.asignaturas));
  });

  readonly visibleSubjects = computed(() => {
    const query = this.normalizeSearchText(this.appliedSearchTerm());
    const statusFilter = this.statusFilter();

    return this.subjects().filter((subject) => {
      const allowedByRole = this.canManageSubjects() || this.isActiveSubject(subject);
      const matchesStatus = statusFilter === 'TODOS' || this.subjectStatusMatches(subject, statusFilter);
      const searchableName = this.normalizeSearchText([
        subject.normalizedName,
        subject.name,
      ].filter(Boolean).join(' '));
      const searchableSubjectId = this.normalizeSearchText(subject.subjectId);
      const matchesSearch = !query
        || searchableName.includes(query)
        || searchableSubjectId.includes(query);

      return allowedByRole && matchesStatus && matchesSearch;
    }).sort((firstSubject, secondSubject) => this.compareSubjectsByRecentUpdate(firstSubject, secondSubject));
  });

  get duplicatePreviewCount(): number {
    return this.previewRows.filter((row) => row.duplicate).length;
  }

  get errorPreviewCount(): number {
    return this.previewRows.filter((row) => !row.duplicate && row.observations.length > 0).length;
  }

  get validPreviewCount(): number {
    return this.previewRows.filter((row) => row.payload && row.observations.length === 0).length;
  }

  paginatedSubjects(): Subject[] {
    const subjects = this.visibleSubjects();
    const safePage = this.currentSafePage();
    const startIndex = (safePage - 1) * this.pageSize;

    return subjects.slice(startIndex, startIndex + this.pageSize);
  }

  totalSubjectPages(): number {
    return Math.max(1, Math.ceil(this.visibleSubjects().length / this.pageSize));
  }

  currentSafePage(): number {
    return Math.min(this.currentPage, this.totalSubjectPages());
  }

  paginationStart(): number {
    const total = this.visibleSubjects().length;

    if (!total) {
      return 0;
    }

    return (this.currentSafePage() - 1) * this.pageSize + 1;
  }

  paginationEnd(): number {
    return Math.min(this.currentSafePage() * this.pageSize, this.visibleSubjects().length);
  }

  get modalEyebrow(): string {
    return this.editingSubjectId ? 'Edicion de asignatura' : 'Alta manual';
  }

  get modalTitle(): string {
    return this.editingSubjectId ? 'Actualizar asignatura' : 'Nueva asignatura';
  }

  get submitLabel(): string {
    return this.editingSubjectId ? 'Guardar cambios' : 'Guardar asignatura';
  }

  openManualModal(): void {
    this.editingSubjectId = null;
    this.formMessage = '';
    this.formErrors = [];
    this.manualForm = { subjectId: this.nextSuggestedSubjectId(), name: '', status: 'Activo' };
    this.isManualModalOpen = true;
  }

  editSubject(subject: Subject): void {
    if (!this.canManageSubjects()) {
      return;
    }

    this.editingSubjectId = subject.id;
    this.formMessage = '';
    this.formErrors = [];
    this.manualForm = {
      subjectId: subject.subjectId,
      name: subject.name,
      status: subject.status,
    };
    this.isManualModalOpen = true;
  }

  closeManualModal(): void {
    this.isManualModalOpen = false;
    this.editingSubjectId = null;
    this.formErrors = [];
    this.manualForm = { subjectId: '', name: '', status: 'Activo' };
  }

  openDuplicateCleaner(): void {
    if (!this.canManageSubjects()) {
      return;
    }

    const suggestedIds = new Set<string>();

    this.duplicateSubjectGroups().forEach((group) => {
      group.subjects.slice(1).forEach((subject) => suggestedIds.add(subject.id));
    });

    this.selectedDuplicateSubjectIds.set(suggestedIds);
    this.isDuplicateCleanerOpen = true;
  }

  closeDuplicateCleaner(): void {
    this.isDuplicateCleanerOpen = false;
    this.selectedDuplicateSubjectIds.set(new Set());
  }

  async saveManualSubject(): Promise<void> {
    this.formMessage = '';
    this.formErrors = this.validateManualForm();

    if (this.formErrors.length) {
      return;
    }

    const actor = this.actorData();
    const normalizedSubjectId = this.currentManualSubjectId();
    const normalizedSubjectName = this.normalizeSubjectName(this.manualForm.name);
    const action = this.editingSubjectId ? 'ASIGNATURA_EDITADA' : 'ASIGNATURA_CREADA';
    const previousSubjectId = this.editingSubjectId;

    try {
      await this.subjectsRepository.upsertSubject({
        subjectId: normalizedSubjectId,
        name: normalizedSubjectName,
        status: this.manualForm.status,
        origin: 'MANUAL',
        ...actor,
      });

      if (previousSubjectId && previousSubjectId !== normalizedSubjectId) {
        await this.subjectsRepository.deleteSubject(previousSubjectId);
      }

      await this.auditLogRepository.register({
        module: 'Asignaturas',
        action,
        description: previousSubjectId && previousSubjectId !== normalizedSubjectId
          ? `Se corrigio el ID de asignatura ${previousSubjectId} a ${normalizedSubjectId}.`
          : `Se guardo la asignatura ${normalizedSubjectId} - ${normalizedSubjectName}.`,
        user: actor.createdByName,
        userRole: actor.createdByRole,
        entity: 'asignaturas',
        entityId: normalizedSubjectId,
        metadata: {
          status: this.manualForm.status,
          origin: 'MANUAL',
          previousSubjectId,
          newSubjectId: normalizedSubjectId,
        },
      });

      this.formMessage = this.editingSubjectId
        ? 'Asignatura actualizada correctamente.'
        : 'Asignatura guardada correctamente.';
      this.closeManualModal();
    } catch (error) {
      this.formErrors = [`No se pudo guardar la asignatura. ${this.readFirebaseMessage(error)}`];
    }
  }

  async updateSubjectStatus(subject: Subject, status: SubjectStatus): Promise<void> {
    if (!this.canManageSubjects()) {
      return;
    }

    const actor = this.actorData();
    await this.subjectsRepository.updateStatus(subject, status);
    await this.auditLogRepository.register({
      module: 'Asignaturas',
      action: status === 'Activo' ? 'ASIGNATURA_ACTIVADA' : 'ASIGNATURA_INACTIVADA',
      description: `Se actualizo la asignatura ${subject.subjectId} a estatus ${status}.`,
      user: actor.createdByName,
      userRole: actor.createdByRole,
      entity: 'asignaturas',
      entityId: subject.subjectId,
      metadata: {
        previousStatus: subject.status,
        newStatus: status,
      },
    });
  }

  async deleteSubject(subject: Subject): Promise<void> {
    if (!this.canManageSubjects()) {
      return;
    }

    const confirmed = await this.confirmationDialogService.confirm({
      title: 'Eliminar asignatura',
      message: `Eliminar la asignatura ${subject.subjectId}? Esta accion quitara el registro del catalogo de asignaturas.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    const actor = this.actorData();

    try {
      await this.subjectsRepository.deleteSubject(subject.id);
      await this.auditLogRepository.register({
        module: 'Asignaturas',
        action: 'ASIGNATURA_ELIMINADA',
        description: `Se elimino la asignatura ${subject.subjectId} - ${subject.name}.`,
        user: actor.createdByName,
        userRole: actor.createdByRole,
        entity: 'asignaturas',
        entityId: subject.subjectId,
        metadata: {
          status: subject.status,
          origin: subject.origin,
        },
      });
      this.formMessage = `Asignatura ${subject.subjectId} eliminada correctamente.`;
      this.formErrors = [];
    } catch (error) {
      this.formMessage = '';
      this.formErrors = [`No se pudo eliminar la asignatura. ${this.readFirebaseMessage(error)}`];
    }
  }

  isDuplicateSubjectSelected(subject: Subject): boolean {
    return this.selectedDuplicateSubjectIds().has(subject.id);
  }

  toggleDuplicateSubject(subject: Subject, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const nextSelection = new Set(this.selectedDuplicateSubjectIds());

    if (checked) {
      nextSelection.add(subject.id);
    } else {
      nextSelection.delete(subject.id);
    }

    this.selectedDuplicateSubjectIds.set(nextSelection);
  }

  selectDuplicateGroupForCleanup(group: DuplicateSubjectGroup): void {
    const nextSelection = new Set(this.selectedDuplicateSubjectIds());

    group.subjects.slice(1).forEach((subject) => nextSelection.add(subject.id));
    this.selectedDuplicateSubjectIds.set(nextSelection);
  }

  clearDuplicateGroupSelection(group: DuplicateSubjectGroup): void {
    const nextSelection = new Set(this.selectedDuplicateSubjectIds());

    group.subjects.forEach((subject) => nextSelection.delete(subject.id));
    this.selectedDuplicateSubjectIds.set(nextSelection);
  }

  async deleteSelectedDuplicateSubjects(): Promise<void> {
    if (!this.canManageSubjects() || !this.selectedDuplicateCount()) {
      return;
    }

    const selectedIds = this.selectedDuplicateSubjectIds();
    const subjectsToDelete = this.subjects().filter((subject) => selectedIds.has(subject.id));
    const confirmed = await this.confirmationDialogService.confirm({
      title: 'Eliminar asignaturas duplicadas',
      message: `Eliminar ${subjectsToDelete.length} asignaturas seleccionadas? Esta accion quitara esos registros del catalogo.`,
      confirmLabel: 'Eliminar seleccionadas',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    const actor = this.actorData();

    try {
      await Promise.all(subjectsToDelete.map((subject) => this.subjectsRepository.deleteSubject(subject.id)));
      this.closeDuplicateCleaner();
      this.formMessage = `${subjectsToDelete.length} asignaturas duplicadas eliminadas correctamente.`;
      this.formErrors = [];

      try {
        await this.auditLogRepository.register({
          module: 'Asignaturas',
          action: 'ASIGNATURAS_DUPLICADAS_DEPURADAS',
          description: `Se eliminaron ${subjectsToDelete.length} asignaturas con nombre duplicado.`,
          user: actor.createdByName,
          userRole: actor.createdByRole,
          entity: 'asignaturas',
          entityId: 'duplicados',
          metadata: {
            deletedSubjectIds: subjectsToDelete.map((subject) => subject.subjectId),
            deletedCount: subjectsToDelete.length,
          },
        });
      } catch {
        // La depuracion ya se ejecuto; la bitacora no debe mantener abierto el modal.
      }
    } catch (error) {
      this.formMessage = '';
      this.formErrors = [`No se pudieron eliminar las asignaturas duplicadas. ${this.readFirebaseMessage(error)}`];
    }
  }

  importCsv(event: Event): void {
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
    const validSubjects = this.previewRows
      .filter((row): row is SubjectPreviewRow & { payload: UpsertSubjectPayload } => {
        return row.payload !== null && row.observations.length === 0;
      })
      .map((row) => row.payload);

    if (!validSubjects.length) {
      this.csvImportErrors = ['No hay registros validos para guardar.'];
      return;
    }

    this.csvImportErrors = [];

    await this.subjectsRepository.importSubjects(validSubjects);
    await this.auditLogRepository.register({
      module: 'Asignaturas',
      action: 'ASIGNATURAS_CSV_IMPORTADO',
      description: `Se importaron ${validSubjects.length} asignaturas desde CSV.`,
      user: this.actorData().createdByName,
      userRole: this.actorData().createdByRole,
      entity: 'asignaturas',
      entityId: 'csv',
      metadata: {
        validRows: validSubjects.length,
        duplicateRows: this.duplicatePreviewCount,
        errorRows: this.errorPreviewCount,
      },
    });
    this.csvImportMessage = `${validSubjects.length} asignaturas guardadas correctamente.`;
    this.csvImportErrors = [];
    this.previewRows = [];
  }

  dismissCsvFeedback(): void {
    this.csvImportMessage = '';
    this.csvImportErrors = [];
  }

  dismissFormMessage(): void {
    this.formMessage = '';
    this.formErrors = [];
  }

  cancelPreview(): void {
    this.previewRows = [];
    this.csvImportMessage = '';
    this.csvImportErrors = [];
  }

  updateSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;

    this.searchInput.set(value);
    this.appliedSearchTerm.set(value.trim());
    this.resetPagination();
  }

  searchSubjects(): void {
    this.appliedSearchTerm.set(this.searchInput().trim());
    this.resetPagination();
  }

  clearSearch(): void {
    this.searchInput.set('');
    this.appliedSearchTerm.set('');
    this.resetPagination();
  }

  selectStatus(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as SubjectStatus | 'TODOS');
    this.resetPagination();
  }

  selectPageSize(event: Event): void {
    this.pageSize = Number((event.target as HTMLSelectElement).value) || 10;
    this.resetPagination();
  }

  goToPreviousPage(): void {
    this.currentPage = Math.max(1, this.currentSafePage() - 1);
  }

  goToNextPage(): void {
    this.currentPage = Math.min(this.totalSubjectPages(), this.currentSafePage() + 1);
  }

  private readFirebaseMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  downloadCsvTemplate(): void {
    const csvContent = [
      ['nombre_asignatura', 'activo'],
      ['DERECHO TRIBUTARIO SUSTANTIVO', 'SI'],
      ['DISENO Y EVALUACION DE RECURSOS EDUCATIVOS VIRTUALES', 'SI'],
    ]
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
      .join('\n');
    const blob = new Blob([`${csvContent}\n`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'plantilla-asignaturas.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  statusClass(status: SubjectStatus): string {
    return status === 'Activo' ? 'activo' : 'inactivo';
  }

  hasDuplicateSubjectName(subject: Subject): boolean {
    return this.duplicateSubjectIds(subject).length > 0;
  }

  duplicateSubjectIds(subject: Subject): string[] {
    const normalizedName = this.normalizeSearchText(subject.normalizedName || subject.name);

    return (this.duplicateSubjectNameMap().get(normalizedName) ?? [])
      .map((duplicateSubject) => duplicateSubject.subjectId)
      .filter((subjectId) => subjectId !== subject.subjectId)
      .sort((firstSubjectId, secondSubjectId) => firstSubjectId.localeCompare(secondSubjectId, 'es'));
  }

  private validateManualForm(): string[] {
    const errors: string[] = [];
    const normalizedSubjectId = this.currentManualSubjectId();

    if (!normalizedSubjectId) {
      errors.push('El ID de asignatura es obligatorio.');
    }

    if (normalizedSubjectId && !this.subjectsRepository.isValidSubjectId(normalizedSubjectId)) {
      errors.push('El ID de asignatura solo puede contener letras, numeros, punto, guion y guion bajo.');
    }

    if (!this.manualForm.name.trim()) {
      errors.push('El nombre de asignatura es obligatorio.');
    }

    if (normalizedSubjectId && this.subjectsRepository.hasSubjectId(normalizedSubjectId, this.editingSubjectId)) {
      errors.push('Ese ID de asignatura ya existe.');
    }

    return errors;
  }

  private currentManualSubjectId(): string {
    return this.subjectsRepository.normalizeSubjectId(this.manualForm.subjectId || this.suggestedSubjectId());
  }

  private nextSuggestedSubjectId(): string {
    return this.nextSubjectIdFromIds(this.subjects().map((subject) => subject.subjectId || subject.id));
  }

  private nextSubjectIdFromIds(subjectIds: Iterable<string>): string {
    const parsedSubjectIds = Array.from(subjectIds)
      .map((subjectId) => String(subjectId || '').trim().toUpperCase())
      .map((subjectId) => {
        const match = subjectId.match(/^([A-Z]+)?(\d+)$/);

        if (!match) {
          return null;
        }

        return {
          prefix: match[1] ?? '',
          numericPart: match[2],
          value: Number.parseInt(match[2], 10),
        };
      })
      .filter((subjectId): subjectId is { prefix: string; numericPart: string; value: number } => {
        return subjectId !== null && Number.isFinite(subjectId.value);
      });

    const preferredSubjectIds = parsedSubjectIds.filter((subjectId) => subjectId.prefix === 'TUP');
    const sourceSubjectIds = preferredSubjectIds.length ? preferredSubjectIds : parsedSubjectIds;

    if (!sourceSubjectIds.length) {
      return 'TUP0001';
    }

    const lastSubjectId = sourceSubjectIds.reduce((currentMax, subjectId) => {
      return subjectId.value > currentMax.value ? subjectId : currentMax;
    });
    const nextValue = String(lastSubjectId.value + 1).padStart(lastSubjectId.numericPart.length, '0');

    return `${lastSubjectId.prefix}${nextValue}`;
  }

  private nextCsvSubjectId(usedSubjectIds: Set<string>): string {
    const nextSubjectId = this.nextSubjectIdFromIds(usedSubjectIds);

    usedSubjectIds.add(nextSubjectId);
    return nextSubjectId;
  }

  private createPreviewRows(rows: string[][]): SubjectPreviewRow[] {
    if (!this.canManageSubjects()) {
      this.csvImportErrors = ['Solo Sistemas puede importar asignaturas.'];
      return [];
    }

    if (rows.length < 2) {
      this.csvImportErrors = ['El CSV debe incluir encabezados y al menos una fila de datos.'];
      return [];
    }

    const headers = rows[0].map((header) => this.normalizeCsvHeader(header));
    const headerIndex = new Map(headers.map((header, index) => [header, index]));
    const missingHeaders = ['nombre_asignatura'].filter((header) => !headerIndex.has(header));

    if (missingHeaders.length) {
      this.csvImportErrors = ['El CSV debe incluir la columna nombre_asignatura.'];
      return [];
    }

    const actor = this.actorData();
    const fileSubjectIds = new Set<string>();
    const fileNames = new Map<string, string>();
    const existingSubjectIds = new Set(this.subjects().map((subject) => subject.subjectId));
    const existingSubjectsById = new Map(this.subjects().map((subject) => [subject.subjectId, subject]));
    const usedSubjectIds = new Set(existingSubjectIds);
    const existingNames = new Map<string, Subject[]>();

    this.subjects().forEach((subject) => {
      const normalizedName = this.normalizeSearchText(subject.normalizedName || subject.name);
      const subjectsWithName = existingNames.get(normalizedName) ?? [];

      subjectsWithName.push(subject);
      existingNames.set(normalizedName, subjectsWithName);
    });

    return rows.slice(1).flatMap((row, index) => {
      const rowNumber = index + 2;
      const explicitSubjectId = this.subjectsRepository.normalizeSubjectId(
        this.getCsvValue(row, headerIndex, 'id_asignatura'),
      );
      const name = this.normalizeSubjectName(this.getCsvValue(row, headerIndex, 'nombre_asignatura'));
      const activeText = this.getCsvValue(row, headerIndex, 'activo');

      if (!explicitSubjectId && !name && !activeText) {
        return [];
      }

      const normalizedName = this.normalizeSearchText(name);
      const existingSubjectByName = normalizedName
        ? [...(existingNames.get(normalizedName) ?? [])].sort((firstSubject, secondSubject) => {
            return firstSubject.subjectId.localeCompare(secondSubject.subjectId, 'es', { numeric: true });
          })[0]
        : undefined;
      const existingSubjectIdInFile = normalizedName ? fileNames.get(normalizedName) : undefined;
      const subjectId = explicitSubjectId
        || existingSubjectByName?.subjectId
        || existingSubjectIdInFile
        || this.nextCsvSubjectId(usedSubjectIds);

      usedSubjectIds.add(subjectId);

      return [
        this.validatePreviewRow({
          rowNumber,
          subjectId,
          name,
          activeText,
          explicitSubjectId: Boolean(explicitSubjectId),
          actor,
          fileSubjectIds,
          fileNames,
          existingSubjectIds,
          existingSubjectsById,
          existingNames,
        }),
      ];
    });
  }

  private validatePreviewRow(context: {
    rowNumber: number;
    subjectId: string;
    name: string;
    activeText: string;
    explicitSubjectId: boolean;
    actor: Pick<UpsertSubjectPayload, 'createdBy' | 'createdByName' | 'createdByRole'>;
    fileSubjectIds: Set<string>;
    fileNames: Map<string, string>;
    existingSubjectIds: Set<string>;
    existingSubjectsById: Map<string, Subject>;
    existingNames: Map<string, Subject[]>;
  }): SubjectPreviewRow {
    const observations: string[] = [];
    const warnings: string[] = [];
    const repeatedInFile = context.subjectId ? context.fileSubjectIds.has(context.subjectId) : false;
    const existsInCatalog = context.subjectId ? context.existingSubjectIds.has(context.subjectId) : false;
    const currentSubject = context.subjectId ? context.existingSubjectsById.get(context.subjectId) : undefined;
    const status = this.parseStatus(context.activeText);
    const normalizedName = this.normalizeSearchText(context.name);
    const fileSubjectIdWithSameName = normalizedName ? context.fileNames.get(normalizedName) : undefined;
    const repeatedNameInFileWithOtherId = Boolean(
      fileSubjectIdWithSameName && fileSubjectIdWithSameName !== context.subjectId,
    );
    const sameNameWithOtherId = normalizedName
      ? (context.existingNames.get(normalizedName) ?? []).filter((subject) => subject.subjectId !== context.subjectId)
      : [];
    const duplicate = repeatedInFile || repeatedNameInFileWithOtherId || sameNameWithOtherId.length > 0;
    const payloadName = this.preferredSubjectName(currentSubject?.name, context.name);

    if (context.subjectId && !this.subjectsRepository.isValidSubjectId(context.subjectId)) {
      observations.push('El ID de asignatura tiene formato invalido.');
    }

    if (!context.name) {
      observations.push('El nombre de asignatura es obligatorio.');
    }

    if (!status) {
      observations.push('El campo activo debe ser SI o NO cuando tenga valor.');
    }

    if (repeatedInFile) {
      observations.push('El ID de asignatura esta duplicado dentro del CSV.');
    }

    if (repeatedNameInFileWithOtherId) {
      observations.push(`El nombre ya aparece en este CSV con el ID ${fileSubjectIdWithSameName}. No se importara duplicado.`);
    }

    if (existsInCatalog && !repeatedInFile && context.explicitSubjectId) {
      warnings.push('El ID ya existe en el catalogo; se actualizara con los datos del CSV.');
    }

    if (!context.explicitSubjectId && currentSubject) {
      warnings.push(`El nombre ya existe; se actualizara el registro ${currentSubject.subjectId}.`);
    }

    if (!context.explicitSubjectId && !currentSubject && context.subjectId) {
      warnings.push(`SPAI asigno automaticamente el ID interno ${context.subjectId}.`);
    }

    if (sameNameWithOtherId.length) {
      const ids = sameNameWithOtherId.map((subject) => subject.subjectId).join(', ');
      if (context.explicitSubjectId) {
        observations.push(`El nombre ya existe en el catalogo con otro ID: ${ids}. No se importara duplicado.`);
      } else {
        observations.push(`El nombre ya tiene duplicados en el catalogo con ID: ${ids}. Depura primero para actualizarlo.`);
      }
    }

    if (currentSubject && currentSubject.name !== payloadName) {
      warnings.push(`Se conservara el nombre con mejor acentuacion: ${payloadName}.`);
    }

    if (context.subjectId) {
      context.fileSubjectIds.add(context.subjectId);
    }

    if (normalizedName && context.subjectId && !context.fileNames.has(normalizedName)) {
      context.fileNames.set(normalizedName, context.subjectId);
    }

    return {
      rowNumber: context.rowNumber,
      subjectId: context.subjectId,
      name: context.name,
      activeText: context.activeText,
      duplicate,
      payload: context.subjectId && context.name && status && observations.length === 0
        ? {
            subjectId: context.subjectId,
            name: payloadName,
            status,
            origin: 'CSV',
            ...context.actor,
          }
        : null,
      observations,
      warnings,
    };
  }

  private resetPagination(): void {
    this.currentPage = 1;
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

  private parseStatus(value: string): SubjectStatus | null {
    const normalizedValue = value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (!normalizedValue || ['si', 's', 'activo', 'true', '1'].includes(normalizedValue)) {
      return 'Activo';
    }

    if (['no', 'n', 'inactivo', 'false', '0'].includes(normalizedValue)) {
      return 'Inactivo';
    }

    return null;
  }

  isActiveSubject(subject: Subject): boolean {
    return this.subjectStatusMatches(subject, 'Activo');
  }

  private subjectStatusMatches(subject: Subject, status: SubjectStatus): boolean {
    const normalizedStatus = this.normalizeSearchText(String(subject.status ?? ''));

    if (status === 'Activo') {
      return ['activo', 'activa', 'active', 'si', 's', 'true', '1'].includes(normalizedStatus);
    }

    return ['inactivo', 'inactiva', 'inactive', 'no', 'n', 'false', '0'].includes(normalizedStatus);
  }

  private compareSubjectsByRecentUpdate(firstSubject: Subject, secondSubject: Subject): number {
    const dateComparison = this.subjectTimestamp(secondSubject).localeCompare(this.subjectTimestamp(firstSubject));

    return dateComparison || firstSubject.subjectId.localeCompare(secondSubject.subjectId, 'es', { numeric: true });
  }

  private subjectTimestamp(subject: Subject): string {
    return subject.updatedAt || subject.createdAt || '';
  }

  normalizeSubjectName(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toUpperCase();
  }

  private preferredSubjectName(currentName: string | undefined, incomingName: string): string {
    const normalizedIncomingName = this.normalizeSearchText(incomingName);

    if (!currentName || this.normalizeSearchText(currentName) !== normalizedIncomingName) {
      return this.normalizeSubjectName(incomingName);
    }

    const normalizedCurrentName = this.normalizeSubjectName(currentName);
    const normalizedIncomingDisplayName = this.normalizeSubjectName(incomingName);

    if (this.hasDiacritics(incomingName) || !this.hasDiacritics(currentName)) {
      return normalizedIncomingDisplayName;
    }

    return normalizedCurrentName;
  }

  private hasDiacritics(value: string): boolean {
    return value.normalize('NFD') !== value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  private actorData(): Pick<UpsertSubjectPayload, 'createdBy' | 'createdByName' | 'createdByRole'> {
    const appUser = this.session()?.appUser;

    return {
      createdBy: appUser?.id ?? this.session()?.authUid ?? 'sin-usuario',
      createdByName: appUser?.name ?? this.session()?.displayName ?? 'Usuario SPAI',
      createdByRole: appUser?.role ?? 'Sin rol',
    };
  }

  private normalizeSearchText(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  private escapeCsvValue(value: string): string {
    return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }
}
