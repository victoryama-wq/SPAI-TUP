import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserSessionService } from '../../../core/auth/user-session.service';
import { AuditLogRepository } from '../../../core/data/audit-log.repository';
import { SystemNotificationsRepository } from '../../../core/data/system-notifications.repository';
import { ConfirmationDialogService } from '../../../shared/confirmation/confirmation-dialog.service';
import {
  Teacher,
  TeacherCategory,
  TeacherLocation,
  TeacherPaymentType,
  TeacherStatus,
  TeachersRepository,
  UpsertTeacherPayload,
} from '../data/teachers.repository';
import { ModulePermissionService } from '../../users/data/module-permission.service';
import { AppUser, UsersRepository } from '../../users/data/users.repository';
import { CyclesRepository } from '../../cycles/data/cycles.repository';
import { SystemRequestsRepository } from '../../system-requests/data/system-requests.repository';

interface TeacherPreviewRow {
  rowNumber: number;
  fullName: string;
  moodleUser: string;
  statusText: string;
  email: string;
  paymentType: TeacherPaymentType | '';
  category: TeacherCategory | '';
  phone: string;
  location: TeacherLocation | '';
  coordinators: string[];
  notes: string;
  operation: 'CREAR' | 'ACTUALIZAR' | 'ERROR';
  payload: UpsertTeacherPayload | null;
  observations: string[];
}

type TeacherPanel = 'catalog' | 'mine' | 'csv' | 'pending';
const TEMPORARY_TEACHER_USER = 'temporalmente_sin_docente';
const TEACHERS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const TEACHER_MOODLE_PREFIX = 'tup-d';
const TEACHER_MOODLE_BASE_NUMBER = 1813;
const TEACHER_PAYMENT_OPTIONS: Array<{ value: TeacherPaymentType; label: string }> = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'SANTANDER', label: 'Santander' },
  { value: 'BANORTE', label: 'Banorte' },
];
const TEACHER_CATEGORY_OPTIONS: Array<{ value: TeacherCategory; label: string }> = [
  { value: 'V_35HRS', label: 'V-35hrs' },
  { value: 'M_25HRS', label: 'M-25hrs' },
  { value: 'N_15HRS', label: 'N-15hrs' },
];
const TEACHER_LOCATION_OPTIONS: Array<{ value: TeacherLocation; label: string }> = [
  { value: 'FORANEO', label: 'Foraneo' },
  { value: 'LOCAL', label: 'Local' },
  { value: 'VIRTUAL', label: 'Virtual' },
];

@Component({
  selector: 'spai-teachers-page',
  imports: [CommonModule, FormsModule],
  providers: [
    AuditLogRepository,
    TeachersRepository,
    UsersRepository,
  ],
  templateUrl: './teachers-page.component.html',
  styleUrl: './teachers-page.component.css',
})
export class TeachersPageComponent {
  private readonly teachersRepository = inject(TeachersRepository);
  private readonly auditLogRepository = inject(AuditLogRepository);
  private readonly systemNotificationsRepository = inject(SystemNotificationsRepository);
  private readonly userSessionService = inject(UserSessionService);
  private readonly modulePermissionService = inject(ModulePermissionService);
  private readonly usersRepository = inject(UsersRepository);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly cyclesRepository = inject(CyclesRepository);
  private readonly systemRequestsRepository = inject(SystemRequestsRepository);

  readonly teachers = this.teachersRepository.teachers;
  readonly teachersReadError = this.teachersRepository.teachersReadError;
  readonly users = this.usersRepository.users;
  readonly session = this.userSessionService.session;
  readonly activeTeacherRecords = computed(() => this.teachers().filter((teacher) => this.isRealTeacherRecord(teacher)));

  selectedPanel: TeacherPanel = 'catalog';
  statusFilter: TeacherStatus | 'TODOS' = 'TODOS';
  searchDraft = '';
  searchTerm = '';
  formMessage = '';
  formErrors: string[] = [];
  csvImportMessage = '';
  csvImportErrors: string[] = [];
  previewRows: TeacherPreviewRow[] = [];
  isManualModalOpen = false;
  editModalTeacher: Teacher | null = null;
  assignmentModalTeacher: Teacher | null = null;
  selectedTeacherCoordinatorIds: string[] = [];
  academicShowsGlobalTeachers = true;
  currentPage = 1;
  pageSize = 10;
  readonly pageSizeOptions = TEACHERS_PAGE_SIZE_OPTIONS;
  readonly paymentTypeOptions = TEACHER_PAYMENT_OPTIONS;
  readonly teacherCategoryOptions = TEACHER_CATEGORY_OPTIONS;
  readonly teacherLocationOptions = TEACHER_LOCATION_OPTIONS;

  manualForm = {
    names: '',
    paternalLastName: '',
    maternalLastName: '',
    moodleUser: '',
    email: '',
    paymentType: '' as TeacherPaymentType | '',
    category: '' as TeacherCategory | '',
    phone: '',
    location: '' as TeacherLocation | '',
  };
  manualRetakeTeacher = false;
  editForm = {
    teacherCode: '',
    fullName: '',
    email: '',
    paymentType: '' as TeacherPaymentType | '',
    category: '' as TeacherCategory | '',
    phone: '',
    location: '' as TeacherLocation | '',
    notes: '',
  };

  readonly activeTeachersCount = computed(
    () => this.activeTeacherRecords().filter((teacher) => teacher.status === 'VALIDADO').length,
  );
  readonly pendingTeachersCount = computed(
    () => this.activeTeacherRecords().filter((teacher) => teacher.status === 'PENDIENTE').length,
  );
  readonly inactiveTeachersCount = computed(
    () => this.activeTeacherRecords().filter((teacher) => teacher.status === 'INACTIVO').length,
  );

  readonly canManageTeachers = computed(() => {
    const appUser = this.session()?.appUser;
    return appUser?.status === 'Activo'
      && this.modulePermissionService.canEditModule(appUser, 'docentes')
      && (appUser.role.includes('Sistemas')
        || (appUser.role === 'Auxiliar de Sistemas' && appUser.access?.docentes));
  });

  readonly canDownloadTeacherReport = computed(() => {
    const appUser = this.session()?.appUser;
    return appUser?.status === 'Activo' && Boolean(appUser.access?.docentes || this.canManageTeachers());
  });

  readonly showTeacherActionsColumn = computed(() =>
    this.canManageTeachers()
    || this.visiblePanelTeachers().some((teacher) => this.canDeleteOwnPendingNewTeacher(teacher)),
  );

  readonly isAcademicCoordination = computed(() => {
    const appUser = this.session()?.appUser;
    return appUser?.status === 'Activo' && appUser.role.toLowerCase().includes('acad');
  });

  readonly currentUserName = computed(() => {
    return this.session()?.appUser?.name || this.session()?.displayName || 'Usuario SPAI';
  });

  readonly manualTeacherCoordinatorName = computed(() => {
    const appUser = this.session()?.appUser;

    if (this.isAcademicCoordination() && appUser) {
      return appUser.name;
    }

    return 'Sistemas';
  });
  readonly academicCoordinatorOptions = computed(() =>
    this.users()
      .filter((user) => this.isAcademicCoordinatorUser(user))
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
  );

  readonly myTeachers = computed(() => {
    const session = this.session();
    const appUser = session?.appUser;

    if (!appUser) {
      return [];
    }

    const userIds = new Set(
      [appUser.id, appUser.authUid, session?.authUid]
        .map((id) => id?.trim())
        .filter((id): id is string => Boolean(id)),
    );
    const assignedPrograms = new Set(
      appUser.assignedPrograms.map((program) => program.trim().toUpperCase()).filter(Boolean),
    );
    const normalizedUserName = this.normalizeSearchText(appUser.name);
    const normalizedUserEmail = this.normalizeSearchText(appUser.email);

    return this.activeTeacherRecords().filter((teacher) => {
      const teacherCoordinatorIds = teacher.assignedCoordinatorIds ?? [];
      const teacherCoordinatorNames = teacher.assignedCoordinatorNames ?? [];
      const teacherPrograms = teacher.createdByPrograms.map((program) => program.trim().toUpperCase()).filter(Boolean);
      const coordinatorsFromTeacher = this.resolveTeacherCoordinators(teacher);

      return teacher.createdBy === appUser.id
        || teacher.createdBy === session?.authUid
        || teacherCoordinatorIds.some((id) => userIds.has(id))
        || coordinatorsFromTeacher.some((coordinator) =>
          userIds.has(coordinator.id) || (coordinator.authUid ? userIds.has(coordinator.authUid) : false),
        )
        || teacherCoordinatorNames.some((name) => {
          const normalizedName = this.normalizeSearchText(name);
          return normalizedName === normalizedUserName || normalizedName === normalizedUserEmail;
        })
        || teacherPrograms.some((program) => assignedPrograms.has(program));
    });
  });

  readonly coordinationTeachers = computed(() =>
    this.activeTeacherRecords().filter((teacher) => {
      return teacher.createdByRole.includes('Acad') || teacher.createdByPrograms.length > 0;
    }),
  );

  readonly pendingTeachers = computed(() =>
    this.activeTeacherRecords().filter((teacher) => teacher.status === 'PENDIENTE'),
  );

  visiblePanelTeachers(): Teacher[] {
    if (!this.canManageTeachers()) {
      return this.applyTableFilters(
        this.academicShowsGlobalTeachers ? this.activeTeacherRecords() : this.myTeachers(),
      );
    }

    if (this.selectedPanel === 'mine') {
      return this.applyTableFilters(this.coordinationTeachers());
    }

    if (this.selectedPanel === 'pending') {
      return this.applyTableFilters(this.pendingTeachers());
    }

    return this.applyTableFilters(this.activeTeacherRecords());
  }

  paginatedTeachers(): Teacher[] {
    const teachers = this.visiblePanelTeachers();
    const safePage = this.currentSafePage();
    const startIndex = (safePage - 1) * this.pageSize;

    return teachers.slice(startIndex, startIndex + this.pageSize);
  }

  totalTeacherPages(): number {
    return Math.max(1, Math.ceil(this.visiblePanelTeachers().length / this.pageSize));
  }

  currentSafePage(): number {
    return Math.min(this.currentPage, this.totalTeacherPages());
  }

  paginationStart(): number {
    const total = this.visiblePanelTeachers().length;

    if (!total) {
      return 0;
    }

    return (this.currentSafePage() - 1) * this.pageSize + 1;
  }

  paginationEnd(): number {
    return Math.min(this.currentSafePage() * this.pageSize, this.visiblePanelTeachers().length);
  }

  emptyTeachersTitle(): string {
    if (!this.canManageTeachers() && !this.academicShowsGlobalTeachers && this.activeTeacherRecords().length > 0) {
      return 'Sin docentes asignados';
    }

    return 'Sin docentes registrados';
  }

  emptyTeachersMessage(): string {
    if (!this.canManageTeachers() && !this.academicShowsGlobalTeachers && this.activeTeacherRecords().length > 0) {
      return 'Sistemas debe asignarte docentes para que aparezcan en este subpanel.';
    }

    if (!this.canManageTeachers() && this.academicShowsGlobalTeachers) {
      return 'Sistemas debe cargar docentes para que aparezcan en el catalogo global.';
    }

    return 'Agrega un docente manualmente o espera a que Sistemas lo cargue.';
  }

  get observedPreviewCount(): number {
    return this.previewRows.filter((row) => row.observations.length > 0).length;
  }

  get validPreviewCount(): number {
    return this.previewRows.filter((row) => row.payload && row.observations.length === 0).length;
  }

  selectPanel(panel: TeacherPanel): void {
    this.selectedPanel = panel;
    this.formMessage = '';
    this.formErrors = [];
    this.csvImportMessage = '';
    this.csvImportErrors = [];
    this.resetPagination();
  }

  openCsvPicker(input: HTMLInputElement): void {
    if (!this.canManageTeachers()) {
      return;
    }

    input.click();
  }

  toggleAcademicTeacherView(): void {
    this.academicShowsGlobalTeachers = !this.academicShowsGlobalTeachers;
    this.formMessage = '';
    this.formErrors = [];
    this.searchDraft = '';
    this.searchTerm = '';
    this.statusFilter = 'TODOS';
    this.resetPagination();
  }

  openManualModal(): void {
    this.formMessage = '';
    this.formErrors = [];
    this.resetManualForm();
    this.isManualModalOpen = true;
  }

  closeManualModal(): void {
    this.isManualModalOpen = false;
    this.formMessage = '';
    this.formErrors = [];
    this.resetManualForm();
  }

  openEditModal(teacher: Teacher): void {
    if (!this.canManageTeachers()) {
      return;
    }

    this.editModalTeacher = teacher;
    this.editForm = {
      teacherCode: teacher.teacherCode,
      fullName: teacher.fullName,
      email: teacher.email,
      paymentType: teacher.paymentType ?? '',
      category: teacher.category ?? '',
      phone: teacher.phone ?? '',
      location: teacher.location ?? '',
      notes: teacher.notes,
    };
    this.selectedTeacherCoordinatorIds = this.resolveTeacherCoordinatorIds(teacher);
    this.formMessage = '';
    this.formErrors = [];
  }

  closeEditModal(): void {
    this.editModalTeacher = null;
    this.editForm = {
      teacherCode: '',
      fullName: '',
      email: '',
      paymentType: '',
      category: '',
      phone: '',
      location: '',
      notes: '',
    };
    this.selectedTeacherCoordinatorIds = [];
    this.formErrors = [];
  }

  async saveTeacherDetails(): Promise<void> {
    const teacher = this.editModalTeacher;

    if (!teacher || !this.canManageTeachers()) {
      return;
    }

    this.formErrors = [];
    const phoneError = this.validateTeacherPhone(this.editForm.phone);

    if (!this.editForm.fullName.trim()) {
      this.formErrors = ['El nombre completo es obligatorio.'];
      return;
    }

    if (phoneError) {
      this.formErrors = [phoneError];
      return;
    }

    const actor = this.actorData();
    const selectedCoordinators = this.academicCoordinatorOptions()
      .filter((coordinator) => this.selectedTeacherCoordinatorIds.includes(coordinator.id))
      .map((coordinator) => ({
        id: coordinator.id,
        name: coordinator.name,
        programs: coordinator.assignedPrograms,
      }));

    try {
      await Promise.all([
        this.teachersRepository.updateTeacherDetails(teacher, this.editForm),
        this.teachersRepository.updateCoordinatorAssignments(teacher, selectedCoordinators),
      ]);
      this.auditLogRepository.register({
        module: 'Docentes',
        action: 'DOCENTE_EDITADO',
        description: `Se editaron datos y coordinacion asignada del docente ${teacher.fullName}.`,
        user: actor.createdByName,
        userRole: actor.createdByRole,
        entity: 'docentes',
        entityId: teacher.id,
        metadata: {
          moodleUser: teacher.moodleUser,
          teacherCode: this.editForm.teacherCode,
          coordinators: selectedCoordinators.map((coordinator) => coordinator.name),
        },
      });
      this.formMessage = `Datos actualizados para ${this.editForm.fullName.trim()}.`;
      this.closeEditModal();
    } catch (error) {
      this.formErrors = [`No se pudo guardar el docente. ${this.errorMessage(error)}`];
    }
  }

  selectStatus(event: Event): void {
    this.statusFilter = (event.target as HTMLSelectElement).value as TeacherStatus | 'TODOS';
    this.resetPagination();
  }

  updateSearchDraft(event: Event): void {
    this.searchDraft = (event.target as HTMLInputElement).value;
    this.searchTerm = this.searchDraft;
    this.resetPagination();
  }

  applySearch(): void {
    this.searchTerm = this.searchDraft;
    this.resetPagination();
  }

  updateManualMoodleUser(value: string): void {
    const moodleUser = this.normalizeMoodleAccount(value);

    this.manualForm.moodleUser = moodleUser;
    this.manualForm.email = moodleUser;
  }

  updateManualPhone(value: string): void {
    this.manualForm.phone = this.normalizePhoneInput(value);
  }

  updateEditPhone(value: string): void {
    this.editForm.phone = this.normalizePhoneInput(value);
  }

  toggleManualRetakeTeacher(): void {
    this.manualRetakeTeacher = !this.manualRetakeTeacher;

    if (this.manualRetakeTeacher) {
      this.manualForm.moodleUser = '';
      this.manualForm.email = '';
      return;
    }

    this.assignGeneratedMoodleUser();
  }

  selectPageSize(event: Event): void {
    this.pageSize = Number((event.target as HTMLSelectElement).value) || 10;
    this.resetPagination();
  }

  goToPreviousPage(): void {
    this.currentPage = Math.max(1, this.currentSafePage() - 1);
  }

  goToNextPage(): void {
    this.currentPage = Math.min(this.totalTeacherPages(), this.currentSafePage() + 1);
  }

  dismissFormMessage(): void {
    this.formMessage = '';
    this.formErrors = [];
  }

  dismissCsvFeedback(): void {
    this.csvImportMessage = '';
    this.csvImportErrors = [];
  }

  async saveManualTeacher(): Promise<void> {
    this.formMessage = '';
    this.formErrors = this.validateManualForm();

    if (this.formErrors.length) {
      return;
    }

    const actor = this.actorData();
    const teacherFullName = this.manualTeacherFullName();
    const status: TeacherStatus = this.canManageTeachers() ? 'VALIDADO' : 'PENDIENTE';
    const isAcademicTeacher = this.isAcademicCoordination();

    try {
      const normalizedMoodleUser = await this.teachersRepository.upsertTeacher({
        fullName: teacherFullName,
        moodleUser: this.normalizeMoodleAccount(this.manualForm.moodleUser),
        status,
        lifecycleStatus: this.manualRetakeTeacher ? 'RETOMO' : 'NUEVO',
        origin: 'MANUAL',
        email: this.buildInstitutionalEmail(this.manualForm.moodleUser),
        paymentType: this.manualForm.paymentType,
        category: this.manualForm.category,
        phone: this.manualForm.phone,
        location: this.manualForm.location,
        notes: '',
        assignedCoordinatorIds: isAcademicTeacher ? [actor.createdBy] : [],
        assignedCoordinatorNames: isAcademicTeacher ? [actor.createdByName] : [],
        ...actor,
      }, {
        reserveMoodleUser: !this.manualRetakeTeacher,
      });
      const teacherEmail = this.buildInstitutionalEmail(normalizedMoodleUser);

      this.auditLogRepository.register({
        module: 'Docentes',
        action: 'DOCENTE_CREADO',
        description: `Se registro el docente ${teacherFullName} con usuario Moodle ${normalizedMoodleUser}.`,
        user: actor.createdByName,
        userRole: actor.createdByRole,
        entity: 'docentes',
        entityId: normalizedMoodleUser,
        metadata: { status, origin: 'MANUAL' },
      });

      this.resetManualForm();
      this.isManualModalOpen = false;
      this.formMessage = status === 'VALIDADO'
        ? 'Docente guardado y validado correctamente.'
        : 'Docente guardado como pendiente de validacion.';

      if (isAcademicTeacher) {
        const notificationTask = this.notifySystemsAboutAcademicTeacher(normalizedMoodleUser, teacherFullName, teacherEmail);

        if (notificationTask) {
          void notificationTask
            .then(() => {
              this.formMessage = 'Docente guardado como pendiente de validacion y enviado a revision de Sistemas.';
            })
            .catch((notificationError) => {
              this.formMessage = `Docente guardado como pendiente, pero no se pudo notificar a Sistemas. ${this.errorMessage(notificationError)}`;
            });
        }
      }
    } catch (error) {
      this.formErrors = [`No se pudo guardar el docente. ${this.errorMessage(error)}`];
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

    this.selectPanel('csv');

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
    const validRows = this.previewRows
      .filter((row): row is TeacherPreviewRow & { payload: UpsertTeacherPayload } => {
        return row.payload !== null && row.observations.length === 0;
      });

    if (!validRows.length) {
      this.csvImportErrors = ['No hay filas validas para guardar.'];
      return;
    }

    const validTeachers = validRows.map((row) => row.payload);
    const createdRows = validRows.filter((row) => row.operation === 'CREAR').length;
    const updatedRows = validRows.filter((row) => row.operation === 'ACTUALIZAR').length;

    try {
      await this.teachersRepository.importTeachers(validTeachers);
      this.auditLogRepository.register({
        module: 'Docentes',
        action: 'DOCENTES_CSV_IMPORTADO',
        description: `Se procesaron ${validTeachers.length} docentes desde CSV.`,
        user: this.currentUserName(),
        userRole: this.session()?.appUser?.role ?? 'Sin rol',
        entity: 'docentes',
        entityId: 'csv',
        metadata: {
          validRows: validTeachers.length,
          createdRows,
          updatedRows,
          observedRows: this.observedPreviewCount,
        },
      });
      this.csvImportMessage = `${createdRows} docentes creados y ${updatedRows} actualizados correctamente.`;
      this.csvImportErrors = [];
      this.previewRows = [];
    } catch (error) {
      this.csvImportErrors = [`No se pudieron guardar los docentes. ${this.errorMessage(error)}`];
    }
  }

  cancelPreview(): void {
    this.previewRows = [];
    this.csvImportMessage = '';
    this.csvImportErrors = [];
  }

  openAssignmentModal(teacher: Teacher): void {
    if (!this.canManageTeachers()) {
      return;
    }

    this.assignmentModalTeacher = teacher;
    this.selectedTeacherCoordinatorIds = this.resolveTeacherCoordinatorIds(teacher);
    this.formMessage = '';
    this.formErrors = [];
  }

  closeAssignmentModal(): void {
    this.assignmentModalTeacher = null;
    this.selectedTeacherCoordinatorIds = [];
  }

  toggleTeacherCoordinator(coordinatorId: string): void {
    this.selectedTeacherCoordinatorIds = this.selectedTeacherCoordinatorIds.includes(coordinatorId)
      ? this.selectedTeacherCoordinatorIds.filter((id) => id !== coordinatorId)
      : [...this.selectedTeacherCoordinatorIds, coordinatorId].sort((a, b) => a.localeCompare(b, 'es'));
  }

  isTeacherCoordinatorSelected(coordinatorId: string): boolean {
    return this.selectedTeacherCoordinatorIds.includes(coordinatorId);
  }

  teacherCoordinatorNames(teacher: Teacher): string {
    const names = teacher.assignedCoordinatorNames ?? [];

    return names.length ? names.join(', ') : 'Sin asignar';
  }

  async saveTeacherCoordinators(): Promise<void> {
    const teacher = this.assignmentModalTeacher;

    if (!teacher || !this.canManageTeachers()) {
      return;
    }

    const actor = this.actorData();
    const selectedCoordinators = this.academicCoordinatorOptions()
      .filter((coordinator) => this.selectedTeacherCoordinatorIds.includes(coordinator.id))
      .map((coordinator) => ({
        id: coordinator.id,
        name: coordinator.name,
        programs: coordinator.assignedPrograms,
      }));

    try {
      await this.teachersRepository.updateCoordinatorAssignments(teacher, selectedCoordinators);
      this.auditLogRepository.register({
        module: 'Docentes',
        action: 'DOCENTE_COORDINACION_ASIGNADA',
        description: `Se actualizo la coordinacion asignada al docente ${teacher.fullName}.`,
        user: actor.createdByName,
        userRole: actor.createdByRole,
        entity: 'docentes',
        entityId: teacher.id,
        metadata: {
          moodleUser: teacher.moodleUser,
          coordinators: selectedCoordinators.map((coordinator) => coordinator.name),
          programs: selectedCoordinators.flatMap((coordinator) => coordinator.programs),
        },
      });
      this.formMessage = `Coordinacion actualizada para ${teacher.fullName}.`;
      this.closeAssignmentModal();
    } catch (error) {
      this.formErrors = [`No se pudo actualizar la coordinacion del docente. ${this.errorMessage(error)}`];
    }
  }

  async updateTeacherStatus(teacher: Teacher, status: TeacherStatus): Promise<void> {
    const actor = this.actorData();

    try {
      await this.teachersRepository.updateStatus(teacher, status, actor.createdBy);
      this.auditLogRepository.register({
        module: 'Docentes',
        action: this.auditActionForStatus(status),
        description: `Se actualizo el docente ${teacher.fullName} a estatus ${status}.`,
        user: actor.createdByName,
        userRole: actor.createdByRole,
        entity: 'docentes',
        entityId: teacher.id,
        metadata: {
          previousStatus: teacher.status,
          newStatus: status,
          moodleUser: teacher.moodleUser,
        },
      });

      this.formMessage = status === 'VALIDADO'
        ? `Docente ${teacher.fullName} activado correctamente.`
        : `Docente ${teacher.fullName} actualizado a ${this.statusLabel(status)}.`;
      this.formErrors = [];

      if (status === 'VALIDADO' && teacher.status !== 'VALIDADO') {
        try {
          await this.notifyAcademicTeacherValidated(teacher, actor);
        } catch (notificationError) {
          this.formMessage = `Docente ${teacher.fullName} activado correctamente, pero no se pudo notificar a la coordinacion. ${this.errorMessage(notificationError)}`;
        }
      }
    } catch (error) {
      this.formErrors = [`No se pudo actualizar el docente. ${this.errorMessage(error)}`];
    }
  }

  async deleteTeacher(teacher: Teacher): Promise<void> {
    if (!this.canDeleteTeacher(teacher)) {
      return;
    }

    const releasesMoodleUser = this.canDeleteOwnPendingNewTeacher(teacher);
    const confirmed = await this.confirmationDialogService.confirm({
      title: 'Eliminar docente',
      message: releasesMoodleUser
        ? `Eliminar la solicitud de ${teacher.fullName}? El usuario Moodle ${teacher.moodleUser} quedara disponible para el siguiente docente nuevo.`
        : `Eliminar a ${teacher.fullName}? Esta accion quitara el registro del catalogo de docentes.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    const actor = this.actorData();

    try {
      const result = await this.teachersRepository.deleteTeacher(teacher, actor);
      this.auditLogRepository.register({
        module: 'Docentes',
        action: 'DOCENTE_ELIMINADO',
        description: `Se elimino el docente ${teacher.fullName}.`,
        user: actor.createdByName,
        userRole: actor.createdByRole,
        entity: 'docentes',
        entityId: teacher.id,
        metadata: {
          moodleUser: teacher.moodleUser,
          previousStatus: teacher.status,
          releasedMoodleUser: result.releasedMoodleUser,
          releasedMoodleNumber: result.releasedMoodleNumber ?? '',
        },
      });
      this.formMessage = result.releasedMoodleUser
        ? `Docente ${teacher.fullName} eliminado correctamente. El usuario Moodle ${teacher.moodleUser} queda disponible nuevamente.`
        : `Docente ${teacher.fullName} eliminado correctamente.`;
      this.formErrors = [];
    } catch (error) {
      this.formErrors = [`No se pudo eliminar el docente. ${this.errorMessage(error)}`];
    }
  }

  canDeleteTeacher(teacher: Teacher): boolean {
    return (this.canManageTeachers() && teacher.status === 'INACTIVO')
      || this.canDeleteOwnPendingNewTeacher(teacher);
  }

  private canDeleteOwnPendingNewTeacher(teacher: Teacher): boolean {
    const session = this.session();
    const appUser = session?.appUser;

    if (!appUser || appUser.status !== 'Activo') {
      return false;
    }

    if (!appUser.access?.docentes && !this.modulePermissionService.canEditModule(appUser, 'docentes')) {
      return false;
    }

    if (teacher.status !== 'PENDIENTE' || teacher.origin !== 'MANUAL' || teacher.lifecycleStatus !== 'NUEVO') {
      return false;
    }

    const actorIds = new Set(
      [appUser.id, appUser.authUid, session?.authUid]
        .map((id) => id?.trim())
        .filter((id): id is string => Boolean(id)),
    );

    return actorIds.has(teacher.createdBy);
  }

  downloadCsvTemplate(): void {
    const csvContent = [
      ['id_docente', 'nombre_completo', 'usuario_moodle', 'estatus', 'correo', 'tipo_pago', 'categoria', 'telefono', 'ubicacion', 'coordinador_responsable', 'observaciones'],
      ['DOC-0001', 'JUAN PEREZ LOPEZ', 'jperez', 'ACTIVO', 'juan.perez@tecplayacar.edu.mx', '1', 'V', '9841234567', 'LOCAL', 'Nombre o correo de coordinacion academica', ''],
      ['DOC-0002', 'MARIA TORRES GARCIA', 'mtorres', 'ACTIVO', 'maria.torres@tecplayacar.edu.mx', '2', 'M', '9847654321', 'FORANEO', 'coord1@tecplayacar.edu.mx; coord2@tecplayacar.edu.mx', ''],
      ['', '', 'usuario.existente', 'INACTIVO', '', '3', 'N', '', 'VIRTUAL', '', 'Ejemplo para actualizar un docente existente'],
    ]
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
      .join('\n');
    const blob = new Blob([`${csvContent}\n`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'plantilla-docentes.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  downloadTeachersCoordinationReport(): void {
    if (!this.canDownloadTeacherReport()) {
      return;
    }

    const headers = [
      'coordinacion_asignada',
      'programas_asignados',
      'docente',
      'usuario_moodle',
      'correo',
      'tipo_pago',
      'categoria',
      'telefono',
      'ubicacion',
      'estatus',
      'origen',
      'alta_por',
      'rol_alta',
      'actualizacion',
    ];
    const rows = this.activeTeacherRecords()
      .slice()
      .sort((a, b) => {
        const coordinatorCompare = this.teacherCoordinatorNames(a).localeCompare(this.teacherCoordinatorNames(b), 'es');

        return coordinatorCompare || a.fullName.localeCompare(b.fullName, 'es');
      })
      .map((teacher) => [
        this.teacherCoordinatorNames(teacher),
        teacher.createdByPrograms.length ? teacher.createdByPrograms.join('; ') : 'Sin programas asignados',
        teacher.fullName,
        teacher.moodleUser,
        teacher.email || '',
        this.paymentTypeReportCode(teacher.paymentType),
        this.teacherCategoryLabel(teacher.category),
        teacher.phone || '',
        this.teacherLocationLabel(teacher.location),
        this.statusLabel(teacher.status),
        teacher.origin,
        teacher.createdByName,
        teacher.createdByRole,
        this.formatCsvDate(teacher.updatedAt || teacher.createdAt),
      ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
      .join('\n');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([`\uFEFF${csvContent}\n`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `docentes-por-coordinacion-${dateStamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  downloadPendingTeachersMoodleCsv(): void {
    if (!this.canManageTeachers()) {
      return;
    }

    const pendingTeachers = this.activeTeacherRecords()
      .filter((teacher) => teacher.status === 'PENDIENTE')
      .slice()
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));

    if (!pendingTeachers.length) {
      this.formMessage = 'No hay docentes pendientes de validacion para exportar a Moodle.';
      return;
    }

    const headers = ['username', 'password', 'email', 'firstname', 'lastname', 'cohort1', 'auth'];
    const rows = pendingTeachers.map((teacher) => {
      const username = this.normalizeMoodleAccount(teacher.moodleUser || teacher.normalizedMoodleUser);
      const { firstname, lastname } = this.splitTeacherNameForMoodle(teacher.fullName);

      return [
        username,
        '#Tecplayacar2019',
        teacher.email?.trim() || this.buildInstitutionalEmail(username),
        firstname,
        lastname,
        '',
        'oauth2',
      ];
    });
    const csvContent = [headers, ...rows]
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
      .join('\n');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([`\uFEFF${csvContent}\n`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `docentes-pendientes-moodle-${dateStamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  statusClass(status: TeacherStatus): string {
    return status.toLowerCase();
  }

  teacherStatusClass(teacher: Teacher): string {
    if (teacher.status === 'INACTIVO') {
      return this.statusClass(teacher.status);
    }

    if (teacher.lifecycleStatus === 'NUEVO') {
      return 'nuevo-activo';
    }

    if (teacher.lifecycleStatus === 'RETOMO') {
      return 'retomo-activo';
    }

    return 'vigente-activo';
  }

  statusLabel(status: TeacherStatus): string {
    if (status === 'VALIDADO') {
      return 'Activo';
    }

    if (status === 'PENDIENTE') {
      return 'Pendiente';
    }

    return 'Inactivo';
  }

  teacherStatusLabel(teacher: Teacher): string {
    if (teacher.status === 'INACTIVO') {
      return 'Inactivo';
    }

    if (teacher.lifecycleStatus === 'RETOMO') {
      return 'Reingreso';
    }

    if (teacher.lifecycleStatus === 'NUEVO') {
      return 'Nuevo';
    }

    return 'Vigente';
  }

  paymentTypeLabel(value?: TeacherPaymentType | ''): string {
    const option = this.paymentTypeOptions.find((paymentType) => paymentType.value === value);
    return option?.label ?? 'Sin registrar';
  }

  private paymentTypeReportCode(value?: TeacherPaymentType | ''): string {
    switch (value) {
      case 'SANTANDER':
        return '1';
      case 'BANORTE':
        return '2';
      case 'EFECTIVO':
        return '3';
      default:
        return '';
    }
  }

  teacherCategoryLabel(value?: TeacherCategory | ''): string {
    if (value === 'VIP_35HRS') {
      return 'V-35hrs';
    }

    const option = this.teacherCategoryOptions.find((category) => category.value === value);
    return option?.label ?? 'Sin registrar';
  }

  teacherLocationLabel(value?: TeacherLocation | ''): string {
    const option = this.teacherLocationOptions.find((location) => location.value === value);
    return option?.label ?? 'Sin registrar';
  }

  private validateManualForm(): string[] {
    const errors: string[] = [];
    const moodleUser = this.normalizeMoodleAccount(this.manualForm.moodleUser);
    const phoneError = this.validateTeacherPhone(this.manualForm.phone);

    if (!this.manualForm.names.trim()) {
      errors.push('El nombre es obligatorio.');
    }

    if (!this.manualForm.paternalLastName.trim()) {
      errors.push('El apellido paterno es obligatorio.');
    }

    if (!moodleUser) {
      errors.push('El usuario Moodle es obligatorio.');
    }

    if (moodleUser && !this.teachersRepository.isValidMoodleUser(moodleUser)) {
      errors.push('El usuario Moodle solo puede contener letras, numeros, punto, guion y guion bajo.');
    }

    if (this.manualRetakeTeacher && moodleUser && this.teachersRepository.hasMoodleUser(moodleUser)) {
      errors.push('Este usuario Moodle ya existe en el catalogo global.');
    }

    if (phoneError) {
      errors.push(phoneError);
    }

    return errors;
  }

  private resetManualForm(): void {
    this.manualRetakeTeacher = false;
    this.manualForm = {
      names: '',
      paternalLastName: '',
      maternalLastName: '',
      moodleUser: '',
      email: '',
      paymentType: '',
      category: '',
      phone: '',
      location: '',
    };
    this.assignGeneratedMoodleUser();
  }

  private manualTeacherFullName(): string {
    return [
      this.manualForm.names,
      this.manualForm.paternalLastName,
      this.manualForm.maternalLastName,
    ]
      .map((value) => value.trim().replace(/\s+/g, ' '))
      .filter(Boolean)
      .join(' ')
      .toUpperCase();
  }

  private assignGeneratedMoodleUser(): void {
    const nextMoodleUser = this.nextMoodleUser();

    this.manualForm.moodleUser = nextMoodleUser;
    this.manualForm.email = nextMoodleUser;
  }

  private nextMoodleUser(): string {
    const maxNumber = this.activeTeacherRecords().reduce((max, teacher) => {
      const value = this.normalizeMoodleAccount(teacher.moodleUser || teacher.normalizedMoodleUser || teacher.id);
      const match = value.match(/^tup-d(\d+)$/);

      if (!match) {
        return max;
      }

      return Math.max(max, Number(match[1]));
    }, TEACHER_MOODLE_BASE_NUMBER);

    return `${TEACHER_MOODLE_PREFIX}${maxNumber + 1}`;
  }

  private isRealTeacherRecord(teacher: Teacher): boolean {
    const normalizedMoodleUser = this.teachersRepository.normalizeMoodleUser(
      teacher.normalizedMoodleUser || teacher.moodleUser || teacher.id,
    );

    return !teacher.deletedAt
      && normalizedMoodleUser !== TEMPORARY_TEACHER_USER
      && teacher.fullName.trim().toUpperCase() !== 'TEMPORALMENTE SIN DOCENTE';
  }

  private resetPagination(): void {
    this.currentPage = 1;
  }

  private applyTableFilters(teachers: Teacher[]): Teacher[] {
    const query = this.normalizeSearchText(this.searchTerm);

    return teachers.filter((teacher) => {
      const matchesStatus = this.statusFilter === 'TODOS' || teacher.status === this.statusFilter;
      const searchableText = this.normalizeSearchText([
        teacher.fullName,
        teacher.normalizedName,
        teacher.moodleUser,
        teacher.normalizedMoodleUser,
        teacher.teacherCode,
        teacher.email,
        teacher.paymentType,
        this.paymentTypeLabel(teacher.paymentType),
        teacher.category,
        this.teacherCategoryLabel(teacher.category),
        teacher.phone,
        teacher.location,
        this.teacherLocationLabel(teacher.location),
        teacher.status,
        this.statusLabel(teacher.status),
        teacher.origin,
        teacher.createdByName,
        teacher.createdByRole,
        teacher.createdByPrograms.join(' '),
        (teacher.assignedCoordinatorNames ?? []).join(' '),
      ].join(' '));
      const matchesSearch = !query || searchableText.includes(query);

      return matchesStatus && matchesSearch;
    });
  }

  private createPreviewRows(rows: string[][]): TeacherPreviewRow[] {
    if (!this.canManageTeachers()) {
      this.csvImportErrors = ['Solo Sistemas o auxiliares autorizados pueden importar docentes.'];
      return [];
    }

    if (rows.length < 2) {
      this.csvImportErrors = ['El CSV debe incluir encabezados y al menos una fila de datos.'];
      return [];
    }

    const headers = rows[0].map((header) => this.normalizeCsvHeader(header));
    const headerIndex = new Map(headers.map((header, index) => [header, index]));
    const missingHeaders = ['nombre_completo', 'usuario_moodle'].filter((header) => !headerIndex.has(header));

    if (missingHeaders.length) {
      this.csvImportErrors = ['El CSV debe incluir las columnas nombre_completo y usuario_moodle.'];
      return [];
    }

    const fileMoodleUsers = new Set<string>();
    const existingTeachersByMoodleUser = new Map(
      this.activeTeacherRecords().map((teacher) => [teacher.normalizedMoodleUser, teacher]),
    );
    const actor = this.actorData();
    const importId = `docentes-${Date.now()}`;

    return rows.slice(1).flatMap((row, index) => {
      const rowNumber = index + 2;
      const teacherCode = this.getCsvValue(row, headerIndex, 'id_docente');
      const fullName = this.getCsvValue(row, headerIndex, 'nombre_completo');
      const moodleUser = this.getCsvValue(row, headerIndex, 'usuario_moodle');
      const statusText = this.getCsvValue(row, headerIndex, 'estatus');
      const email = this.getCsvValue(row, headerIndex, 'correo');
      const paymentTypeText = this.getCsvAliasValue(row, headerIndex, ['tipo_pago', 'pago', 'forma_pago']);
      const categoryText = this.getCsvAliasValue(row, headerIndex, ['categoria', 'categoria_docente']);
      const phone = this.getCsvAliasValue(row, headerIndex, ['telefono', 'telefono_docente', 'celular']);
      const locationText = this.getCsvAliasValue(row, headerIndex, ['ubicacion', 'ubicacion_docente', 'modalidad_docente']);
      const coordinators = this.parseCoordinatorNames(
        this.getCsvValue(row, headerIndex, 'coordinador_responsable')
        || this.getCsvValue(row, headerIndex, 'coordinadores'),
      );
      const notes = this.getCsvValue(row, headerIndex, 'observaciones');

      if (
        !teacherCode
        && !fullName
        && !moodleUser
        && !statusText
        && !email
        && !paymentTypeText
        && !categoryText
        && !phone
        && !locationText
        && !coordinators.length
        && !notes
      ) {
        return [];
      }

      return [
        this.validatePreviewRow({
          rowNumber,
          teacherCode,
          fullName,
          moodleUser,
          statusText,
          email,
          paymentTypeText,
          categoryText,
          phone,
          locationText,
          coordinators,
          notes,
          fileMoodleUsers,
          existingTeachersByMoodleUser,
          actor,
          importId,
        }),
      ];
    });
  }

  private validatePreviewRow(context: {
    rowNumber: number;
    teacherCode: string;
    fullName: string;
    moodleUser: string;
    statusText: string;
    email: string;
    paymentTypeText: string;
    categoryText: string;
    phone: string;
    locationText: string;
    coordinators: string[];
    notes: string;
    fileMoodleUsers: Set<string>;
    existingTeachersByMoodleUser: Map<string, Teacher>;
    actor: Pick<UpsertTeacherPayload, 'createdBy' | 'createdByName' | 'createdByRole' | 'createdByPrograms'>;
    importId: string;
  }): TeacherPreviewRow {
    const observations: string[] = [];
    const normalizedMoodleUser = this.teachersRepository.normalizeMoodleUser(context.moodleUser);
    const status = this.parseStatus(context.statusText || 'VALIDADO');
    const paymentType = this.parsePaymentType(context.paymentTypeText);
    const category = this.parseTeacherCategory(context.categoryText);
    const normalizedPhone = this.normalizePhoneInput(context.phone);
    const phoneError = this.validateTeacherPhone(context.phone);
    const location = this.parseTeacherLocation(context.locationText);
    const existingTeacher = context.existingTeachersByMoodleUser.get(normalizedMoodleUser);
    const operation: TeacherPreviewRow['operation'] = existingTeacher ? 'ACTUALIZAR' : 'CREAR';
    const coordinatorAssignments = this.resolveCsvCoordinatorAssignments(context.coordinators);

    if (!context.fullName && !existingTeacher) {
      observations.push('El nombre completo es obligatorio.');
    }

    if (!normalizedMoodleUser) {
      observations.push('El usuario Moodle es obligatorio.');
    }

    if (normalizedMoodleUser && !this.teachersRepository.isValidMoodleUser(normalizedMoodleUser)) {
      observations.push('El usuario Moodle tiene formato invalido.');
    }

    if (!status) {
      observations.push('El estatus debe ser ACTIVO, PENDIENTE, VALIDADO o INACTIVO.');
    }

    if (paymentType === null) {
      observations.push('El tipo de pago debe ser 1/SANTANDER, 2/BANORTE o 3/EFECTIVO.');
    }

    if (category === null) {
      observations.push('La categoria debe ser V/V-35hrs, M/M-25hrs o N/N-15hrs.');
    }

    if (phoneError) {
      observations.push(phoneError);
    }

    if (location === null) {
      observations.push('La ubicacion debe ser FORANEO, LOCAL o VIRTUAL.');
    }

    if (existingTeacher && !context.statusText) {
      observations.push('Para actualizar un docente existente, el CSV debe indicar estatus.');
    }

    if (normalizedMoodleUser && context.fileMoodleUsers.has(normalizedMoodleUser)) {
      observations.push('El usuario Moodle esta duplicado dentro del CSV.');
    }

    if (context.coordinators.length && coordinatorAssignments.length !== context.coordinators.length) {
      observations.push('Uno o mas coordinadores no estan registrados como coordinacion academica activa.');
    }

    if (normalizedMoodleUser) {
      context.fileMoodleUsers.add(normalizedMoodleUser);
    }

    return {
      rowNumber: context.rowNumber,
      fullName: context.fullName,
      moodleUser: normalizedMoodleUser,
      statusText: context.statusText,
      email: context.email,
      paymentType: paymentType ?? '',
      category: category ?? '',
      phone: normalizedPhone,
      location: location ?? '',
      coordinators: context.coordinators,
      notes: context.notes,
      operation: observations.length ? 'ERROR' : operation,
      payload: (context.fullName || existingTeacher) && normalizedMoodleUser && status
        ? {
            teacherCode: context.teacherCode || existingTeacher?.teacherCode,
            fullName: context.fullName || existingTeacher?.fullName || '',
            moodleUser: normalizedMoodleUser,
            status,
            origin: 'CSV',
            email: context.email || existingTeacher?.email,
            paymentType: paymentType || existingTeacher?.paymentType || '',
            category: category || existingTeacher?.category || '',
            phone: normalizedPhone || existingTeacher?.phone,
            location: location || existingTeacher?.location || '',
            notes: context.notes || existingTeacher?.notes,
            createdByPrograms: coordinatorAssignments.length
              ? Array.from(new Set(coordinatorAssignments.flatMap((coordinator) => coordinator.assignedPrograms)))
              : context.actor.createdByPrograms,
            assignedCoordinatorIds: coordinatorAssignments.map((coordinator) => coordinator.id),
            assignedCoordinatorNames: coordinatorAssignments.map((coordinator) => coordinator.name),
            importId: context.importId,
            createdBy: context.actor.createdBy,
            createdByName: context.actor.createdByName,
            createdByRole: context.actor.createdByRole,
          }
        : null,
      observations,
    };
  }

  private actorData(): Pick<UpsertTeacherPayload, 'createdBy' | 'createdByName' | 'createdByRole' | 'createdByPrograms'> {
    const appUser = this.session()?.appUser;
    const authUid = this.session()?.authUid;

    return {
      createdBy: authUid ?? appUser?.authUid ?? appUser?.id ?? 'sin-usuario',
      createdByName: appUser?.name ?? this.session()?.displayName ?? 'Usuario SPAI',
      createdByRole: appUser?.role ?? 'Sin rol',
      createdByPrograms: appUser?.assignedPrograms ?? [],
    };
  }

  private auditActionForStatus(status: TeacherStatus): string {
    if (status === 'VALIDADO') {
      return 'DOCENTE_VALIDADO';
    }

    if (status === 'INACTIVO') {
      return 'DOCENTE_INACTIVADO';
    }

    return 'DOCENTE_REACTIVADO';
  }

  private notifySystemsAboutAcademicTeacher(
    normalizedMoodleUser: string,
    teacherName: string,
    teacherEmail: string,
  ): Promise<unknown[]> | void {
    if (!this.isAcademicCoordination()) {
      return;
    }

    const actor = this.actorData();
    const cycle = this.cyclesRepository.activeCycle()?.code ?? 'Sin ciclo activo';
    const emailDetail = teacherEmail ? ` Correo: ${teacherEmail}.` : '';

    return Promise.all([
      this.systemNotificationsRepository.create({
        title: 'Nuevo docente registrado',
        message: `La coordinacion academica correspondiente a ${actor.createdByName} agrego un nuevo docente: ${teacherName}.`,
        type: 'DOCENTE_NUEVO',
        entity: 'docentes',
        entityId: normalizedMoodleUser,
        actorId: actor.createdBy,
        actorName: actor.createdByName,
        actorRole: actor.createdByRole,
      }),
      this.systemRequestsRepository.createRequest({
        type: 'DOCENTE_NUEVO',
        title: 'Validar docente nuevo',
        detail: `Validar docente ${teacherName} con usuario Moodle ${normalizedMoodleUser}.${emailDetail}`,
        cycle,
        requestedBy: actor.createdBy,
        requestedByName: actor.createdByName,
        requestedByRole: actor.createdByRole,
        requestedByPrograms: actor.createdByPrograms,
      }),
    ]);
  }

  private async notifyAcademicTeacherValidated(
    teacher: Teacher,
    actor: Pick<UpsertTeacherPayload, 'createdBy' | 'createdByName' | 'createdByRole'>,
  ): Promise<void> {
    const targets = this.academicNotificationTargetsForTeacher(teacher);

    if (!targets.length) {
      return;
    }

    await Promise.all(targets.map((target) =>
      this.systemNotificationsRepository.createForAcademicCoordinator({
        title: 'Docente validado',
        message: `Sistemas valido al docente ${teacher.fullName} (${teacher.moodleUser}). Ya esta disponible en el catalogo.`,
        type: 'DOCENTE_VALIDADO',
        entity: 'docentes',
        entityId: teacher.id,
        targetUserId: target.authUid,
        actorId: actor.createdBy,
        actorName: actor.createdByName,
        actorRole: actor.createdByRole,
      }),
    ));
  }

  private academicNotificationTargetsForTeacher(teacher: Teacher): Array<AppUser & { authUid: string }> {
    const assignedIds = new Set([
      teacher.createdBy,
      ...(teacher.assignedCoordinatorIds ?? []),
    ].filter(Boolean));
    const assignedNames = new Set([
      teacher.createdByName,
      ...(teacher.assignedCoordinatorNames ?? []),
    ].map((name) => this.normalizeSearchText(name)).filter(Boolean));
    const assignedEmails = new Set([
      teacher.createdByName,
      ...(teacher.assignedCoordinatorNames ?? []),
    ].map((value) => this.normalizeSearchText(value)).filter(Boolean));

    return this.academicCoordinatorOptions()
      .filter((coordinator): coordinator is AppUser & { authUid: string } => Boolean(coordinator.authUid))
      .filter((coordinator) => {
        return assignedIds.has(coordinator.id)
          || assignedIds.has(coordinator.authUid)
          || assignedNames.has(this.normalizeSearchText(coordinator.name))
          || assignedEmails.has(this.normalizeSearchText(coordinator.email));
      });
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
      .replace(/^\uFEFF/, '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_');
  }

  private getCsvValue(row: string[], headerIndex: Map<string, number>, header: string): string {
    const index = headerIndex.get(header);
    return index === undefined ? '' : (row[index] ?? '').trim();
  }

  private getCsvAliasValue(row: string[], headerIndex: Map<string, number>, headers: string[]): string {
    for (const header of headers) {
      const value = this.getCsvValue(row, headerIndex, header);

      if (value) {
        return value;
      }
    }

    return '';
  }

  private parseStatus(value: string): TeacherStatus | null {
    const normalizedValue = value
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (normalizedValue === 'ACTIVO' || normalizedValue === 'ACTIVA') {
      return 'VALIDADO';
    }

    if (['PENDIENTE', 'VALIDADO', 'INACTIVO'].includes(normalizedValue)) {
      return normalizedValue as TeacherStatus;
    }

    return null;
  }

  private parsePaymentType(value: string): TeacherPaymentType | '' | null {
    const normalizedValue = this.normalizeCatalogValue(value);

    if (!normalizedValue) {
      return '';
    }

    if (normalizedValue === '3' || normalizedValue === 'EFECTIVO') {
      return 'EFECTIVO';
    }

    if (normalizedValue === '1' || normalizedValue === 'SANTANDER') {
      return 'SANTANDER';
    }

    if (normalizedValue === '2' || normalizedValue === 'BANORTE') {
      return 'BANORTE';
    }

    return null;
  }

  private parseTeacherCategory(value: string): TeacherCategory | '' | null {
    const normalizedValue = this.normalizeCatalogValue(value).replace(/-/g, '_');

    if (!normalizedValue) {
      return '';
    }

    if (['V', 'V_35HRS', 'V_35_HRS', 'V35HRS', 'VIP_35HRS', 'VIP_35_HRS', 'VIP35HRS'].includes(normalizedValue)) {
      return 'V_35HRS';
    }

    if (['M', 'M_25HRS', 'M_25_HRS', 'M25HRS'].includes(normalizedValue)) {
      return 'M_25HRS';
    }

    if (['N', 'N_15HRS', 'N_15_HRS', 'N15HRS'].includes(normalizedValue)) {
      return 'N_15HRS';
    }

    return null;
  }

  private parseTeacherLocation(value: string): TeacherLocation | '' | null {
    const normalizedValue = this.normalizeCatalogValue(value);
    const compactValue = normalizedValue.replace(/[^A-Z0-9_]/g, '');

    if (!normalizedValue) {
      return '';
    }

    if (['FORANEO', 'FORANEA', 'FORNEO', 'FORNEA'].includes(compactValue)) {
      return 'FORANEO';
    }

    if (normalizedValue === 'LOCAL') {
      return 'LOCAL';
    }

    if (normalizedValue === 'VIRTUAL') {
      return 'VIRTUAL';
    }

    return null;
  }

  private normalizeCatalogValue(value: string): string {
    return value
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_');
  }

  private normalizePhoneInput(value: string): string {
    return value.replace(/\D/g, '').slice(0, 10);
  }

  private validateTeacherPhone(value: string): string {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return '';
    }

    if (!/^\d+$/.test(trimmedValue) || trimmedValue.length !== 10) {
      return 'El telefono debe tener 10 digitos numericos.';
    }

    return '';
  }

  private parseCoordinatorNames(value: string): string[] {
    return Array.from(new Set(
      value
        .split(/[|;,]/)
        .map((coordinator) => coordinator.trim())
        .filter(Boolean),
    )).sort((a, b) => a.localeCompare(b, 'es'));
  }

  private resolveTeacherCoordinatorIds(teacher: Teacher): string[] {
    return this.resolveTeacherCoordinators(teacher).map((coordinator) => coordinator.id);
  }

  private resolveTeacherCoordinators(teacher: Teacher): AppUser[] {
    const assignedIds = teacher.assignedCoordinatorIds ?? [];

    if (assignedIds.length) {
      const assignedIdSet = new Set(assignedIds);
      return this.academicCoordinatorOptions().filter((coordinator) =>
        assignedIdSet.has(coordinator.id) || (coordinator.authUid ? assignedIdSet.has(coordinator.authUid) : false),
      );
    }

    const assignedNames = new Set((teacher.assignedCoordinatorNames ?? []).map((name) => this.normalizeSearchText(name)));

    if (assignedNames.size) {
      return this.academicCoordinatorOptions().filter((coordinator) =>
        assignedNames.has(this.normalizeSearchText(coordinator.name))
        || assignedNames.has(this.normalizeSearchText(coordinator.email)),
      );
    }

    const teacherPrograms = new Set(teacher.createdByPrograms.map((program) => program.trim().toUpperCase()));

    return this.academicCoordinatorOptions()
      .filter((coordinator) => coordinator.assignedPrograms.some((program) => teacherPrograms.has(program)))
      ;
  }

  private resolveCsvCoordinatorAssignments(coordinators: string[]): AppUser[] {
    const normalizedCoordinators = coordinators.map((coordinator) => this.normalizeSearchText(coordinator));

    return this.academicCoordinatorOptions().filter((user) => {
      const normalizedName = this.normalizeSearchText(user.name);
      const normalizedEmail = this.normalizeSearchText(user.email);
      const normalizedAuthUid = this.normalizeSearchText(user.authUid ?? '');
      const normalizedId = this.normalizeSearchText(user.id);

      return normalizedCoordinators.some((coordinator) =>
        coordinator === normalizedName
        || coordinator === normalizedEmail
        || coordinator === normalizedAuthUid
        || coordinator === normalizedId,
      );
    });
  }

  private isAcademicCoordinatorUser(user: AppUser): boolean {
    const role = user.role.toLowerCase();

    return user.status === 'Activo'
      && role.includes('acad')
      && !role.includes('sistemas');
  }

  private normalizeSearchText(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  private buildInstitutionalEmail(value: string): string {
    const normalizedValue = this.normalizeMoodleAccount(value);

    if (!normalizedValue) {
      return '';
    }

    return `${normalizedValue}@tecplayacar.edu.mx`;
  }

  private normalizeMoodleAccount(value: string): string {
    return this.teachersRepository.normalizeMoodleUser(value)
      .replace(/@tecplayacar[.]edu[.]mx$/i, '')
      .replace(/@.*$/i, '')
      .trim();
  }

  private splitTeacherNameForMoodle(fullName: string): { firstname: string; lastname: string } {
    const parts = fullName
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(Boolean);

    if (parts.length >= 3) {
      return {
        firstname: parts.slice(0, -2).join(' '),
        lastname: parts.slice(-2).join(' '),
      };
    }

    if (parts.length === 2) {
      return {
        firstname: parts[0],
        lastname: parts[1],
      };
    }

    return {
      firstname: parts[0] || 'DOCENTE',
      lastname: 'SPAI',
    };
  }

  private formatCsvDate(value: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Intentalo de nuevo.';
  }

  private escapeCsvValue(value: string): string {
    return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }
}
