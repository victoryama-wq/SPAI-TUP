import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserSessionService } from '../../../core/auth/user-session.service';
import { AuditLogRepository } from '../../../core/data/audit-log.repository';
import { SystemNotificationsRepository } from '../../../core/data/system-notifications.repository';
import { ConfirmationDialogService } from '../../../shared/confirmation/confirmation-dialog.service';
import {
  AcademicAssignment,
  AssignmentsRepository,
  UpsertAssignmentPayload,
} from '../../assignments/data/assignments.repository';
import { CyclesRepository } from '../../cycles/data/cycles.repository';
import { AcademicGroup, GroupModality, GroupsRepository, GroupShift } from '../../groups/data/groups.repository';
import { ProgramsRepository } from '../../nomenclatures/data/programs.repository';
import {
  SystemRequest,
  SystemRequestsRepository,
  SystemRequestStatus,
} from '../../system-requests/data/system-requests.repository';
import { Subject, SubjectsRepository } from '../../subjects/data/subjects.repository';
import { Teacher, TeachersRepository } from '../../teachers/data/teachers.repository';
import {
  OperationalRequestType,
  RequestActorData,
  SharedClassRequest,
  SharedRequestStatus,
  SharedRequestsRepository,
} from '../data/shared-requests.repository';

type RequestTab = 'RECIBIDAS' | 'ENVIADAS' | 'TODAS';
type RequestStatusFilter = SharedRequestStatus | 'TODOS';
type ResponseAction = 'ACEPTADA' | 'RECHAZADA';
type SystemResponseAction = Exclude<SystemRequestStatus, 'PENDIENTE'>;
type SystemRequestStatusFilter = SystemRequestStatus | 'TODOS';
type SystemRequestTypeFilter = SystemRequest['type'] | 'TODOS';

interface RequestForm {
  requestType: OperationalRequestType;
  sourceAssignmentId: string;
  destinationGroup: string;
  cycle: string;
  program: string;
  reason: string;
  groupFullGroup: string;
  groupCode: string;
  groupSection: string;
  groupModality: GroupModality;
  groupShift: GroupShift;
  groupAcademicArea: string;
  specialSubjectId: string;
  specialMoodleId: string;
  specialTeacherMoodleUser: string;
  specialStudentEnrollments: string;
  message: string;
}

interface ActiveFilterChip {
  label: string;
  value: string;
}

@Component({
  selector: 'spai-requests-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './requests-page.component.html',
  styleUrl: './requests-page.component.css',
})
export class RequestsPageComponent {
  private readonly assignmentsRepository = inject(AssignmentsRepository);
  private readonly auditLogRepository = inject(AuditLogRepository);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly cyclesRepository = inject(CyclesRepository);
  private readonly groupsRepository = inject(GroupsRepository);
  private readonly programsRepository = inject(ProgramsRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sharedRequestsRepository = inject(SharedRequestsRepository);
  private readonly systemNotificationsRepository = inject(SystemNotificationsRepository);
  private readonly systemRequestsRepository = inject(SystemRequestsRepository);
  private readonly subjectsRepository = inject(SubjectsRepository);
  private readonly teachersRepository = inject(TeachersRepository);
  private readonly userSessionService = inject(UserSessionService);

  readonly assignments = this.assignmentsRepository.assignments;
  readonly cycles = this.cyclesRepository.cycles;
  readonly groups = this.groupsRepository.groups;
  readonly programs = this.programsRepository.programs;
  readonly requests = this.sharedRequestsRepository.requests;
  readonly systemRequests = this.systemRequestsRepository.requests;
  readonly subjects = this.subjectsRepository.subjects;
  readonly teachers = this.teachersRepository.teachers;
  readonly session = this.userSessionService.session;

  readonly activeTab = signal<RequestTab>('RECIBIDAS');
  readonly programFilter = signal('TODOS');
  readonly groupFilter = signal('TODOS');
  readonly subjectFilter = signal('TODOS');
  readonly teacherFilter = signal('TODOS');
  readonly statusFilter = signal<RequestStatusFilter>('TODOS');
  readonly searchTerm = signal('');
  readonly sourceSearchTerm = signal('');
  readonly systemSearchTerm = signal('');
  readonly systemStatusFilter = signal<SystemRequestStatusFilter>('TODOS');
  readonly systemTypeFilter = signal<SystemRequestTypeFilter>('TODOS');
  readonly requestForm = signal<RequestForm>(this.emptyRequestForm(''));

  formMessage = '';
  formErrors: string[] = [];
  responseErrors: string[] = [];
  isFiltersModalOpen = false;
  isRequestModalOpen = false;
  isResponseModalOpen = false;
  isSystemResponseModalOpen = false;
  selectedRequestId: string | null = null;
  selectedSystemRequestId: string | null = null;
  responseAction: ResponseAction = 'ACEPTADA';
  systemResponseAction: SystemResponseAction = 'EN_PROCESO';
  responseObservations = '';
  systemResponseObservations = '';

  readonly activeCycle = this.cyclesRepository.activeCycle;

  readonly activeCycleCode = computed(() => this.activeCycle()?.code ?? 'Pendiente de configurar');

  readonly requestTypeOptions: Array<{ value: OperationalRequestType; label: string }> = [
    { value: 'COMPARTIR_CLASE', label: 'Compartir clase' },
    { value: 'REABRIR_CAPTURA', label: 'Reabrir captura' },
    { value: 'ALTA_GRUPO', label: 'Alta de grupo' },
    { value: 'ASIGNACION_ESPECIAL', label: 'Asignacion especial' },
  ];

  readonly cycleRequestOptions = computed(() =>
    this.cycles()
      .map((cycle) => cycle.code)
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a, 'es')),
  );

  readonly requestProgramOptions = computed(() => {
    if (this.canSeeAllRequests()) {
      return this.programs()
        .filter((program) => program.status === 'Activo')
        .map((program) => program.code)
        .sort((a, b) => a.localeCompare(b, 'es'));
    }

    return this.userPrograms().sort((a, b) => a.localeCompare(b, 'es'));
  });

  readonly canSeeAllRequests = computed(() => {
    const appUser = this.session()?.appUser;
    return appUser?.status === 'Activo' && this.userRole().includes('Sistemas');
  });

  readonly canUseRequests = computed(() => {
    const appUser = this.session()?.appUser;

    return appUser?.status === 'Activo'
      && (
        this.userRole().includes('Sistemas')
        || this.userRole().includes('Acad')
        || appUser.access?.solicitudes === true
      );
  });

  readonly destinationGroupOptions = computed(() => {
    const activeCycle = this.activeCycle();

    if (!activeCycle || !this.canUseRequests()) {
      return [];
    }

    return this.groups()
      .filter((group) => {
        return group.status === 'Activo'
          && group.cycleCode === activeCycle.code
          && this.canUseDestinationProgram(group.programAbbreviation);
      })
      .sort((a, b) => a.fullGroup.localeCompare(b.fullGroup, 'es'));
  });

  readonly selectedSourceAssignment = computed(() => {
    return this.assignments().find((assignment) => assignment.id === this.requestForm().sourceAssignmentId) ?? null;
  });

  readonly selectedDestinationGroup = computed(() => {
    return this.groups().find((group) => group.fullGroup === this.requestForm().destinationGroup) ?? null;
  });

  readonly selectedSpecialSubject = computed(() => {
    return this.subjects().find((subject) => subject.subjectId === this.requestForm().specialSubjectId) ?? null;
  });

  readonly selectedSpecialTeacher = computed(() => {
    return this.teachers().find((teacher) => teacher.moodleUser === this.requestForm().specialTeacherMoodleUser) ?? null;
  });

  readonly sourceAssignmentOptions = computed(() => {
    const activeCycle = this.activeCycle();
    const search = this.normalizeSearch(this.sourceSearchTerm());

    if (!activeCycle || !this.canUseRequests()) {
      return [];
    }

    return this.assignments()
      .filter((assignment) => {
        const searchable = this.normalizeSearch([
          assignment.group,
          assignment.program,
          assignment.subjectId,
          assignment.subjectName,
          assignment.teacherName,
          assignment.teacherMoodleUser,
          assignment.moodleId,
        ].join(' '));

        return assignment.cycle === activeCycle.code
          && !assignment.sourceAssignmentId
          && !(assignment.special ?? false)
          && (!search || searchable.includes(search));
      })
      .sort((a, b) => a.group.localeCompare(b.group, 'es'));
  });

  readonly accessibleRequests = computed(() => {
    return this.requests().filter((request) => this.canAccessRequest(request));
  });

  readonly visibleRequests = computed(() => {
    const search = this.normalizeSearch(this.searchTerm());
    const program = this.programFilter();
    const group = this.groupFilter();
    const status = this.statusFilter();

    return this.accessibleRequests().filter((request) => {
      const searchable = this.normalizeSearch([
        request.cycle,
        this.requestTypeLabel(this.requestTypeFor(request)),
        request.sourceProgram,
        request.destinationProgram,
        request.requestedProgram ?? '',
        request.sourceGroup,
        request.destinationGroup,
        request.groupFullGroup ?? '',
        request.subjectId,
        request.specialSubjectId ?? '',
        request.subjectName,
        request.specialSubjectName ?? '',
        request.teacherName,
        request.specialTeacherName ?? '',
        request.teacherMoodleUser,
        request.specialTeacherMoodleUser ?? '',
        request.moodleId,
        request.specialMoodleId ?? '',
        request.requestedByName,
      ].join(' '));

      const matchesTab = this.matchesTab(request, this.activeTab());
      const matchesProgram = program === 'TODOS'
        || request.sourceProgram === program
        || request.destinationProgram === program
        || request.requestedProgram === program;
      const matchesGroup = group === 'TODOS'
        || request.sourceGroup === group
        || request.destinationGroup === group
        || request.groupFullGroup === group;
      const matchesStatus = status === 'TODOS' || request.status === status;
      const matchesSearch = !search || searchable.includes(search);

      return matchesTab
        && matchesProgram
        && matchesGroup
        && matchesStatus
        && matchesSearch;
    });
  });

  readonly requestTabs = computed(() => {
    const tabs: RequestTab[] = this.canSeeAllRequests()
      ? ['RECIBIDAS', 'ENVIADAS', 'TODAS']
      : ['RECIBIDAS', 'ENVIADAS'];

    return tabs.map((tab) => ({
      label: this.tabLabel(tab),
      value: tab,
      count: this.accessibleRequests().filter((request) => this.matchesTab(request, tab)).length,
    }));
  });

  readonly programOptions = computed(() => {
    const programs = new Set<string>();

    this.accessibleRequests().forEach((request) => {
      programs.add(request.sourceProgram);
      programs.add(request.destinationProgram);
      programs.add(request.requestedProgram ?? '');
    });

    return Array.from(programs).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
  });

  readonly groupOptions = computed(() => {
    const groups = new Set<string>();

    this.accessibleRequests().forEach((request) => {
      groups.add(request.sourceGroup);
      groups.add(request.destinationGroup);
      groups.add(request.groupFullGroup ?? '');
    });

    return Array.from(groups).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
  });

  readonly subjectOptions = computed(() => {
    const subjects = new Map<string, string>();

    this.accessibleRequests().forEach((request) => subjects.set(request.subjectId, request.subjectName));
    this.accessibleRequests().forEach((request) => {
      if (request.specialSubjectId) {
        subjects.set(request.specialSubjectId, request.specialSubjectName ?? '');
      }
    });

    return Array.from(subjects.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.id.localeCompare(b.id, 'es'));
  });

  readonly teacherOptions = computed(() => {
    const teachers = new Map<string, string>();

    this.accessibleRequests().forEach((request) => teachers.set(request.teacherMoodleUser, request.teacherName));
    this.accessibleRequests().forEach((request) => {
      if (request.specialTeacherMoodleUser) {
        teachers.set(request.specialTeacherMoodleUser, request.specialTeacherName ?? '');
      }
    });

    return Array.from(teachers.entries())
      .map(([moodleUser, name]) => ({ moodleUser, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });

  readonly activeFilterChips = computed(() => {
    const chips: ActiveFilterChip[] = [];

    if (this.searchTerm().trim()) {
      chips.push({ label: 'Busqueda', value: this.searchTerm().trim() });
    }

    if (this.programFilter() !== 'TODOS') {
      chips.push({ label: 'Programa', value: this.programFilter() });
    }

    if (this.groupFilter() !== 'TODOS') {
      chips.push({ label: 'Grupo', value: this.groupFilter() });
    }

    if (this.statusFilter() !== 'TODOS') {
      chips.push({ label: 'Estado', value: this.statusLabel(this.statusFilter() as SharedRequestStatus) });
    }

    return chips;
  });

  readonly pendingCount = computed(
    () => this.accessibleRequests().filter((request) => request.status === 'PENDIENTE').length,
  );

  readonly acceptedCount = computed(
    () => this.accessibleRequests().filter((request) => request.status === 'ACEPTADA').length,
  );

  readonly rejectedCount = computed(
    () => this.accessibleRequests().filter((request) => request.status === 'RECHAZADA').length,
  );

  readonly sentCount = computed(
    () => this.accessibleRequests().filter((request) => this.matchesTab(request, 'ENVIADAS')).length,
  );

  readonly pendingSystemRequestsCount = computed(
    () => this.systemRequests().filter((request) => request.status === 'PENDIENTE').length,
  );

  readonly inProgressSystemRequestsCount = computed(
    () => this.systemRequests().filter((request) => request.status === 'EN_PROCESO').length,
  );

  readonly closedSystemRequestsCount = computed(
    () => this.systemRequests().filter((request) => ['ATENDIDA', 'RECHAZADA'].includes(request.status)).length,
  );

  readonly visibleSystemRequests = computed(() => {
    const search = this.normalizeSearch(this.systemSearchTerm());
    const status = this.systemStatusFilter();
    const type = this.systemTypeFilter();

    return this.systemRequests().filter((request) => {
      const searchable = this.normalizeSearch([
        request.title,
        request.detail,
        request.cycle,
        request.requestedByName,
        request.requestedByRole,
        request.requestedByPrograms.join(' '),
      ].join(' '));

      return (status === 'TODOS' || request.status === status)
        && (type === 'TODOS' || request.type === type)
        && (!search || searchable.includes(search));
    });
  });

  readonly requestTypeSummary = computed(() =>
    this.quickSystemRequestTypes().map((type) => ({
      label: this.systemRequestTypeLabel(type),
      value: this.systemRequests().filter((request) => request.type === type).length,
    })),
  );

  readonly nextSystemAction = computed(() => {
    if (this.pendingSystemRequestsCount() > 0) {
      return 'Revisa primero las solicitudes pendientes y marca en proceso las que ya estes atendiendo.';
    }

    if (this.inProgressSystemRequestsCount() > 0) {
      return 'Cierra las solicitudes en proceso cuando la accion ya haya quedado aplicada.';
    }

    return 'No hay solicitudes pendientes por atender en este momento.';
  });

  constructor() {
    effect(() => {
      const appUser = this.session()?.appUser;

      if (appUser?.status === 'Activo' && !this.canSeeAllRequests() && this.activeTab() === 'RECIBIDAS') {
        queueMicrotask(() => this.activeTab.set('ENVIADAS'));
      }
    });

    this.route.queryParamMap.subscribe((params) => {
      const sourceAssignmentId = params.get('origen') ?? params.get('sourceAssignmentId');

      if (!sourceAssignmentId) {
        return;
      }

      this.openRequestModal(sourceAssignmentId);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { origen: null, sourceAssignmentId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  get responseModalTitle(): string {
    return this.responseAction === 'ACEPTADA' ? 'Aceptar solicitud' : 'Rechazar solicitud';
  }

  selectTab(tab: RequestTab): void {
    this.activeTab.set(tab);
  }

  openFiltersModal(): void {
    this.isFiltersModalOpen = true;
  }

  closeFiltersModal(): void {
    this.isFiltersModalOpen = false;
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.programFilter.set('TODOS');
    this.groupFilter.set('TODOS');
    this.statusFilter.set('TODOS');
  }

  selectProgramFilter(event: Event): void {
    this.programFilter.set((event.target as HTMLSelectElement).value);
    this.groupFilter.set('TODOS');
  }

  selectGroupFilter(event: Event): void {
    this.groupFilter.set((event.target as HTMLSelectElement).value);
  }

  selectSubjectFilter(event: Event): void {
    this.subjectFilter.set((event.target as HTMLSelectElement).value);
  }

  selectTeacherFilter(event: Event): void {
    this.teacherFilter.set((event.target as HTMLSelectElement).value);
  }

  selectStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as RequestStatusFilter);
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  setSourceSearchTerm(value: string): void {
    this.sourceSearchTerm.set(value);
  }

  setSystemSearchTerm(value: string): void {
    this.systemSearchTerm.set(value);
  }

  selectSystemStatusFilter(event: Event): void {
    this.systemStatusFilter.set((event.target as HTMLSelectElement).value as SystemRequestStatusFilter);
  }

  selectSystemTypeFilter(event: Event): void {
    this.systemTypeFilter.set((event.target as HTMLSelectElement).value as SystemRequestTypeFilter);
  }

  clearSystemFilters(): void {
    this.systemSearchTerm.set('');
    this.systemStatusFilter.set('TODOS');
    this.systemTypeFilter.set('TODOS');
  }

  updateRequestForm(patch: Partial<RequestForm>): void {
    this.requestForm.update((form) => ({ ...form, ...patch }));
  }

  selectRequestType(event: Event): void {
    const requestType = (event.target as HTMLSelectElement).value as OperationalRequestType;
    const activeCycle = this.activeCycle()?.code ?? '';

    this.requestForm.set({
      ...this.emptyRequestForm(),
      requestType,
      cycle: requestType === 'COMPARTIR_CLASE' ? activeCycle : activeCycle,
    });
    this.formErrors = [];
  }

  onRequestProgramChange(event: Event): void {
    const program = (event.target as HTMLSelectElement).value;
    const programInfo = this.programs().find((item) => item.code === program);

    this.updateRequestForm({
      program,
      groupAcademicArea: programInfo?.academicArea ?? '',
    });
  }

  openRequestModal(sourceAssignmentId = ''): void {
    this.formErrors = [];
    this.formMessage = '';
    this.sourceSearchTerm.set('');
    this.requestForm.set({
      ...this.emptyRequestForm(),
      sourceAssignmentId,
    });
    this.isRequestModalOpen = true;
  }

  closeRequestModal(): void {
    this.isRequestModalOpen = false;
    this.formErrors = [];
    this.requestForm.set(this.emptyRequestForm());
  }

  createRequest(): void {
    this.formMessage = '';
    this.formErrors = this.validateRequestForm();

    if (this.formErrors.length) {
      return;
    }

    if (this.requestForm().requestType !== 'COMPARTIR_CLASE') {
      this.createOperationalRequest();
      return;
    }

    const source = this.selectedSourceAssignment();
    const destinationGroup = this.selectedDestinationGroup();

    if (!source || !destinationGroup) {
      this.formErrors = ['Selecciona una asignacion origen y un grupo destino validos.'];
      return;
    }

    const actor = this.requestActorData();
    const requestId = this.sharedRequestsRepository.createRequest({
      cycle: source.cycle,
      sourceAssignmentId: source.id,
      sourceCoordination: this.programCoordinator(source.program),
      destinationCoordination: this.programCoordinator(destinationGroup.programAbbreviation),
      sourceProgram: source.program,
      destinationProgram: destinationGroup.programAbbreviation,
      sourceGroup: source.group,
      destinationGroup: destinationGroup.fullGroup,
      subjectId: source.subjectId,
      subjectName: source.subjectName,
      moodleId: source.moodleId,
      teacherMoodleUser: source.teacherMoodleUser,
      teacherName: source.teacherName,
      requestMessage: this.requestForm().message,
      actor,
    });

    this.auditLogRepository.register({
      module: 'Solicitudes',
      action: 'SOLICITUD_CREADA',
      description: `Se solicito compartir ${source.subjectId} de ${source.group} con ${destinationGroup.fullGroup}.`,
      user: actor.userName,
      userRole: actor.userRole,
      entity: 'solicitudes_compartidas',
      entityId: requestId,
      metadata: {
        cycle: source.cycle,
        sourceAssignmentId: source.id,
        sourceProgram: source.program,
        sourceGroup: source.group,
        destinationProgram: destinationGroup.programAbbreviation,
        destinationGroup: destinationGroup.fullGroup,
        moodleId: source.moodleId,
      },
    });

    this.formMessage = 'Solicitud creada correctamente.';
    this.closeRequestModal();
  }

  private createOperationalRequest(): void {
    const actor = this.requestActorData();
    const form = this.requestForm();
    const program = form.program.trim().toUpperCase();
    const subject = this.selectedSpecialSubject();
    const teacher = this.selectedSpecialTeacher();
    const requestId = this.sharedRequestsRepository.createRequest({
      requestType: form.requestType,
      cycle: form.cycle,
      targetCycle: form.cycle,
      requestedProgram: program,
      reason: form.reason,
      groupFullGroup: form.groupFullGroup,
      groupCode: form.groupCode,
      groupSection: form.groupSection,
      groupProgramName: this.programName(program),
      groupModality: form.groupModality,
      groupShift: form.groupShift,
      groupAcademicArea: form.groupAcademicArea,
      specialSubjectId: subject?.subjectId,
      specialSubjectName: subject?.name,
      specialMoodleId: form.specialMoodleId,
      specialTeacherMoodleUser: form.specialTeacherMoodleUser,
      specialTeacherName: form.specialTeacherMoodleUser === 'temporalmente_sin_docente'
        ? 'TEMPORALMENTE SIN DOCENTE'
        : teacher?.fullName,
      specialStudentEnrollments: this.normalizedStudentEnrollments(form.specialStudentEnrollments),
      requestMessage: form.message,
      actor,
    });

    this.auditLogRepository.register({
      module: 'Solicitudes',
      action: 'SOLICITUD_CREADA',
      description: `Se creo solicitud operativa ${this.requestTypeLabel(form.requestType)} para ${program}.`,
      user: actor.userName,
      userRole: actor.userRole,
      entity: 'solicitudes_compartidas',
      entityId: requestId,
      metadata: {
        requestType: form.requestType,
        cycle: form.cycle,
        program,
        groupFullGroup: form.groupFullGroup,
        specialSubjectId: subject?.subjectId ?? '',
      },
    });

    this.formMessage = 'Solicitud creada correctamente.';
    this.closeRequestModal();
  }

  openResponseModal(request: SharedClassRequest, action: ResponseAction): void {
    if (!this.canRespondRequest(request)) {
      return;
    }

    this.selectedRequestId = request.id;
    this.responseAction = action;
    this.responseObservations = '';
    this.responseErrors = [];
    this.isResponseModalOpen = true;
  }

  closeResponseModal(): void {
    this.isResponseModalOpen = false;
    this.selectedRequestId = null;
    this.responseErrors = [];
    this.responseObservations = '';
  }

  saveResponse(): void {
    const request = this.selectedRequest();

    if (!request) {
      this.responseErrors = ['No se encontro la solicitud seleccionada.'];
      return;
    }

    this.responseErrors = this.validateResponse(request);

    if (this.responseErrors.length) {
      return;
    }

    if (this.responseAction === 'ACEPTADA') {
      this.acceptRequest(request);
      return;
    }

    this.rejectRequest(request);
  }

  cancelRequest(request: SharedClassRequest): void {
    if (!this.canCancelRequest(request)) {
      return;
    }

    const actor = this.requestActorData();

    this.sharedRequestsRepository.cancelRequest(request.id, actor);
    this.auditLogRepository.register({
      module: 'Solicitudes',
      action: 'SOLICITUD_CANCELADA',
      description: `Se cancelo la solicitud para compartir ${request.subjectId} con ${request.destinationGroup}.`,
      user: actor.userName,
      userRole: actor.userRole,
      entity: 'solicitudes_compartidas',
      entityId: request.id,
      metadata: {
        cycle: request.cycle,
        sourceAssignmentId: request.sourceAssignmentId,
        destinationGroup: request.destinationGroup,
      },
    });
    this.formMessage = 'Solicitud cancelada.';
  }

  openSystemResponseModal(request: SystemRequest, action: SystemResponseAction): void {
    if (!this.canRespondSystemRequest(request)) {
      return;
    }

    this.selectedSystemRequestId = request.id;
    this.systemResponseAction = action;
    this.systemResponseObservations = '';
    this.responseErrors = [];
    this.isSystemResponseModalOpen = true;
  }

  closeSystemResponseModal(): void {
    this.isSystemResponseModalOpen = false;
    this.selectedSystemRequestId = null;
    this.systemResponseObservations = '';
    this.responseErrors = [];
  }

  async saveSystemResponse(): Promise<void> {
    const request = this.selectedSystemRequest();
    const session = this.session();
    const appUser = session?.appUser;

    if (!request || !appUser || !session) {
      this.responseErrors = ['No se encontro la solicitud seleccionada.'];
      return;
    }

    if (this.systemResponseAction === 'RECHAZADA' && !this.systemResponseObservations.trim()) {
      this.responseErrors = ['Captura el motivo del rechazo.'];
      return;
    }

    try {
      await this.systemRequestsRepository.updateRequestStatus(request.id, {
        status: this.systemResponseAction,
        systemResponse: this.systemResponseObservations,
        respondedBy: appUser.id || session.authUid,
        respondedByName: appUser.name,
        respondedByRole: appUser.role,
      });

      let notificationWarning = '';

      try {
        await this.systemNotificationsRepository.createForAcademicCoordinatorOnce(
          this.systemRequestStatusNotificationId(request, this.systemResponseAction),
          {
            title: 'Actualizacion de solicitud',
            message: this.academicSystemRequestNotificationMessage(request, this.systemResponseAction),
            type: 'SOLICITUD_SISTEMAS',
            entity: 'solicitudes_sistemas',
            entityId: request.id,
            targetUserId: request.requestedBy,
            actorId: appUser.id || session.authUid,
            actorName: appUser.name,
            actorRole: appUser.role,
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        notificationWarning = ` No se pudo enviar la notificacion a Coordinacion Academica: ${message}`;
      }

      this.auditLogRepository.register({
        module: 'Solicitudes',
        action: 'SOLICITUD_SISTEMAS_ACTUALIZADA',
        description: `Se actualizo solicitud a Sistemas ${request.title} a ${this.systemRequestStatusLabel(this.systemResponseAction)}.`,
        user: appUser.name,
        userRole: appUser.role,
        entity: 'solicitudes_sistemas',
        entityId: request.id,
        metadata: {
          cycle: request.cycle,
          status: this.systemResponseAction,
          requestedBy: request.requestedByName,
        },
      });

      this.formMessage = `Solicitud a Sistemas actualizada correctamente.${notificationWarning}`;
      this.closeSystemResponseModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.responseErrors = [`No se pudo actualizar la solicitud. ${message}`];
    }
  }

  async deleteSystemRequest(request: SystemRequest): Promise<void> {
    const session = this.session();
    const appUser = session?.appUser;

    if (!appUser || !this.canDeleteSystemRequest()) {
      return;
    }

    const confirmed = await this.confirmationDialogService.confirm({
      title: 'Eliminar solicitud de prueba',
      message: `Se eliminara la solicitud "${request.title}" de la bandeja de Sistemas. Esta accion no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Conservar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.systemRequestsRepository.removeRequest(request.id, appUser.id || session.authUid);

      this.auditLogRepository.register({
        module: 'Solicitudes',
        action: 'SOLICITUD_SISTEMAS_ELIMINADA',
        description: `Se elimino solicitud a Sistemas ${request.title}.`,
        user: appUser.name,
        userRole: appUser.role,
        entity: 'solicitudes_sistemas',
        entityId: request.id,
        metadata: {
          cycle: request.cycle,
          status: request.status,
          requestedBy: request.requestedByName,
        },
      });

      this.formMessage = 'Solicitud de prueba eliminada correctamente.';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.formMessage = `No se pudo eliminar la solicitud. ${message}`;
    }
  }

  private academicSystemRequestNotificationMessage(
    request: SystemRequest,
    status: Exclude<SystemRequestStatus, 'PENDIENTE'>,
  ): string {
    const statusLabel = this.systemRequestStatusLabel(status).toLowerCase();
    const response = this.systemResponseObservations.trim();

    if (response) {
      return `Tu solicitud "${request.title}" fue marcada como ${statusLabel}. Respuesta de Sistemas: ${response}`;
    }

    return `Tu solicitud "${request.title}" fue marcada como ${statusLabel} por Sistemas.`;
  }

  private systemRequestStatusNotificationId(
    request: SystemRequest,
    status: Exclude<SystemRequestStatus, 'PENDIENTE'>,
  ): string {
    return ['SOLICITUD_SISTEMAS', request.id, status]
      .join('_')
      .toUpperCase()
      .replace(/[^A-Z0-9._-]+/g, '_');
  }

  selectedRequest(): SharedClassRequest | null {
    return this.requests().find((request) => request.id === this.selectedRequestId) ?? null;
  }

  selectedSystemRequest(): SystemRequest | null {
    return this.systemRequests().find((request) => request.id === this.selectedSystemRequestId) ?? null;
  }

  sourceAssignmentFor(request: SharedClassRequest): AcademicAssignment | null {
    return this.assignments().find((assignment) => assignment.id === request.sourceAssignmentId) ?? null;
  }

  canRespondRequest(request: SharedClassRequest): boolean {
    const requestType = this.requestTypeFor(request);

    if (requestType !== 'COMPARTIR_CLASE') {
      return request.status === 'PENDIENTE' && this.canSeeAllRequests();
    }

    return request.status === 'PENDIENTE'
      && this.canUseRequests()
      && (
        this.canSeeAllRequests()
        || this.userHasProgram(request.sourceProgram)
      );
  }

  canCancelRequest(request: SharedClassRequest): boolean {
    const actorId = this.session()?.appUser?.id ?? this.session()?.authUid;

    return request.status === 'PENDIENTE'
      && this.canUseRequests()
      && (
        this.canSeeAllRequests()
        || request.requestedBy === actorId
        || this.userHasProgram(request.destinationProgram)
      );
  }

  canRespondSystemRequest(request: SystemRequest): boolean {
    return this.canSeeAllRequests() && !['ATENDIDA', 'RECHAZADA'].includes(request.status);
  }

  canDeleteSystemRequest(): boolean {
    return this.canSeeAllRequests();
  }

  statusClass(status: SharedRequestStatus): string {
    return status.toLowerCase();
  }

  statusLabel(status: SharedRequestStatus): string {
    return status.charAt(0) + status.slice(1).toLowerCase();
  }

  systemRequestTypeLabel(type: SystemRequest['type']): string {
    const labels: Record<SystemRequest['type'], string> = {
      REABRIR_CAPTURA: 'Reabrir captura',
      ALTA_GRUPO: 'Alta de grupo',
      CAMBIAR_ID_ASIGNATURA: 'Cambiar ID de asignatura',
      DOCENTE_NUEVO: 'Nuevo docente',
    };

    return labels[type];
  }

  quickSystemRequestTypes(): SystemRequest['type'][] {
    return ['REABRIR_CAPTURA', 'ALTA_GRUPO', 'CAMBIAR_ID_ASIGNATURA', 'DOCENTE_NUEVO'];
  }

  systemRequestStatusLabel(status: SystemRequestStatus): string {
    const labels: Record<SystemRequestStatus, string> = {
      PENDIENTE: 'Pendiente',
      EN_PROCESO: 'En proceso',
      ATENDIDA: 'Atendida',
      RECHAZADA: 'Rechazada',
    };

    return labels[status];
  }

  systemRequestStatusClass(status: SystemRequestStatus): string {
    return status.toLowerCase().replace('_', '-');
  }

  private async acceptRequest(request: SharedClassRequest): Promise<void> {
    if (this.requestTypeFor(request) !== 'COMPARTIR_CLASE') {
      await this.acceptOperationalRequest(request);
      return;
    }

    const actor = this.requestActorData();
    const source = this.sourceAssignmentFor(request);
    const destinationGroup = this.groups().find((group) => group.fullGroup === request.destinationGroup);

    if (!source || !destinationGroup) {
      this.responseErrors = ['No se encontro la asignacion origen o el grupo destino.'];
      return;
    }

    const sharedGroups = Array.from(new Set([
      ...(source.sharedGroups ?? []),
      request.destinationGroup,
    ].map((group) => group.trim().toUpperCase()).filter(Boolean)));
    const sharedPrograms = Array.from(new Set([
      ...(source.sharedPrograms ?? []),
      request.destinationProgram,
    ].map((program) => program.trim().toUpperCase()).filter(Boolean)));
    const destinationAssignmentId = await this.assignmentsRepository.upsertAssignment({
      id: source.id,
      cycle: source.cycle,
      program: source.program,
      group: source.group,
      subjectId: source.subjectId,
      subjectName: source.subjectName,
      moodleId: source.moodleId,
      teacherMoodleUser: source.teacherMoodleUser,
      teacherName: source.teacherName,
      status: 'EN_CAPTURA',
      observations: source.observations,
      shared: sharedGroups.length > 0,
      sourceAssignmentId: '',
      sharedGroups,
      sharedPrograms,
      special: source.special,
      studentEnrollments: source.studentEnrollments,
      ...this.assignmentActorData(),
    });

    this.sharedRequestsRepository.acceptRequest(
      request.id,
      destinationAssignmentId,
      this.responseObservations,
      actor,
    );
    this.auditLogRepository.register({
      module: 'Solicitudes',
      action: 'SOLICITUD_ACEPTADA',
      description: `Se acepto compartir ${request.subjectId} con ${request.destinationGroup}.`,
      user: actor.userName,
      userRole: actor.userRole,
      entity: 'solicitudes_compartidas',
      entityId: request.id,
      metadata: {
        cycle: request.cycle,
        sourceAssignmentId: request.sourceAssignmentId,
        destinationAssignmentId,
        sourceGroup: request.sourceGroup,
        destinationGroup: request.destinationGroup,
        moodleId: source.moodleId,
      },
    });

    this.formMessage = 'Solicitud aceptada y asignacion destino vinculada.';
    this.closeResponseModal();
  }

  private async acceptOperationalRequest(request: SharedClassRequest): Promise<void> {
    const actor = this.requestActorData();
    const requestType = this.requestTypeFor(request);
    let createdEntityId = '';
    let description = `Se acepto la solicitud ${this.requestTypeLabel(requestType)}.`;

    if (requestType === 'REABRIR_CAPTURA') {
      const cycle = this.cycles().find((item) => item.code === (request.targetCycle || request.cycle));

      if (!cycle) {
        this.responseErrors = ['No se encontro el ciclo solicitado.'];
        return;
      }

      this.cyclesRepository.reopenCapture(cycle.id);
      createdEntityId = cycle.id;
      description = `Se acepto reabrir captura del ciclo ${cycle.code}.`;
    }

    if (requestType === 'ALTA_GRUPO') {
      const fullGroup = request.groupFullGroup ?? '';

      if (!fullGroup || !request.requestedProgram) {
        this.responseErrors = ['La solicitud no tiene datos suficientes del grupo.'];
        return;
      }

      this.groupsRepository.upsertGroup({
        fullGroup,
        cycleCode: request.targetCycle || request.cycle,
        programAbbreviation: request.requestedProgram,
        groupCode: request.groupCode ?? '',
        section: request.groupSection ?? '',
        programName: request.groupProgramName || this.programName(request.requestedProgram),
        modality: this.asGroupModality(request.groupModality),
        shift: this.asGroupShift(request.groupShift),
        academicArea: request.groupAcademicArea ?? '',
        status: 'Activo',
      });
      createdEntityId = this.groupsRepository.createGroupId(fullGroup);
      description = `Se acepto alta del grupo ${fullGroup}.`;
    }

    if (requestType === 'ASIGNACION_ESPECIAL') {
      if (!request.requestedProgram || !request.specialSubjectId || !request.specialMoodleId) {
        this.responseErrors = ['La solicitud no tiene datos suficientes de la asignacion especial.'];
        return;
      }

      createdEntityId = await this.assignmentsRepository.upsertAssignment({
        id: null,
        cycle: request.targetCycle || request.cycle,
        program: request.requestedProgram,
        group: '',
        subjectId: request.specialSubjectId,
        subjectName: request.specialSubjectName ?? '',
        moodleId: request.specialMoodleId,
        teacherMoodleUser: request.specialTeacherMoodleUser ?? 'temporalmente_sin_docente',
        teacherName: request.specialTeacherName || 'TEMPORALMENTE SIN DOCENTE',
        status: 'EN_CAPTURA',
        observations: `Asignacion especial aprobada desde solicitud ${request.id}.`,
        shared: false,
        sourceAssignmentId: '',
        special: true,
        studentEnrollments: request.specialStudentEnrollments ?? '',
        ...this.assignmentActorData(),
      });
      description = `Se acepto asignacion especial ${request.specialSubjectId} para ${request.requestedProgram}.`;
    }

    this.sharedRequestsRepository.acceptRequest(
      request.id,
      requestType === 'ASIGNACION_ESPECIAL' ? createdEntityId : '',
      this.responseObservations,
      actor,
      createdEntityId,
    );
    this.auditLogRepository.register({
      module: 'Solicitudes',
      action: 'SOLICITUD_ACEPTADA',
      description,
      user: actor.userName,
      userRole: actor.userRole,
      entity: 'solicitudes_compartidas',
      entityId: request.id,
      metadata: {
        requestType,
        cycle: request.targetCycle || request.cycle,
        program: request.requestedProgram ?? '',
        createdEntityId,
      },
    });

    this.formMessage = 'Solicitud aceptada y accion aplicada por Sistemas.';
    this.closeResponseModal();
  }

  private rejectRequest(request: SharedClassRequest): void {
    const actor = this.requestActorData();

    this.sharedRequestsRepository.rejectRequest(request.id, this.responseObservations, actor);
    this.auditLogRepository.register({
      module: 'Solicitudes',
      action: 'SOLICITUD_RECHAZADA',
      description: `Se rechazo la solicitud para compartir ${request.subjectId} con ${request.destinationGroup}.`,
      user: actor.userName,
      userRole: actor.userRole,
      entity: 'solicitudes_compartidas',
      entityId: request.id,
      metadata: {
        cycle: request.cycle,
        sourceAssignmentId: request.sourceAssignmentId,
        destinationGroup: request.destinationGroup,
        responseObservations: this.responseObservations.trim(),
      },
    });

    this.formMessage = 'Solicitud rechazada.';
    this.closeResponseModal();
  }

  private validateRequestForm(): string[] {
    const errors: string[] = [];
    const activeCycle = this.activeCycle();
    const source = this.selectedSourceAssignment();
    const destinationGroup = this.selectedDestinationGroup();
    const form = this.requestForm();

    if (!this.canUseRequests()) {
      errors.push('No tienes permisos para gestionar solicitudes.');
    }

    if (form.requestType !== 'COMPARTIR_CLASE') {
      return [...errors, ...this.validateOperationalRequestForm()];
    }

    if (!activeCycle) {
      errors.push('No hay un ciclo activo configurado.');
    }

    if (activeCycle?.status !== 'Captura') {
      errors.push('El ciclo activo debe estar abierto en Captura para crear solicitudes.');
    }

    if (!source) {
      errors.push('Selecciona la asignacion origen.');
    }

    if (source && source.cycle !== activeCycle?.code) {
      errors.push('Solo se pueden solicitar asignaciones del ciclo activo.');
    }

    if (source?.sourceAssignmentId || source?.special) {
      errors.push('La asignacion origen no puede ser una asignacion destino ni especial.');
    }

    if (!destinationGroup) {
      errors.push('Selecciona un grupo destino.');
    }

    if (destinationGroup && destinationGroup.cycleCode !== activeCycle?.code) {
      errors.push('El grupo destino debe pertenecer al ciclo activo.');
    }

    if (destinationGroup && !this.canUseDestinationProgram(destinationGroup.programAbbreviation)) {
      errors.push('Solo puedes solicitar para grupos de tus programas asignados.');
    }

    if (source && destinationGroup && source.group === destinationGroup.fullGroup) {
      errors.push('El grupo destino debe ser diferente al grupo origen.');
    }

    if (source && destinationGroup && this.sharedRequestsRepository.hasPendingDuplicate(source.id, destinationGroup.fullGroup)) {
      errors.push('Ya existe una solicitud pendiente para esta asignacion origen y grupo destino.');
    }

    if (source && destinationGroup && this.hasExistingSharedDestination(source, destinationGroup)) {
      errors.push('El grupo destino ya tiene una asignacion compartida vinculada a esta clase.');
    }

    return errors;
  }

  private validateOperationalRequestForm(): string[] {
    const errors: string[] = [];
    const form = this.requestForm();
    const program = form.program.trim().toUpperCase();

    if (!form.cycle) {
      errors.push('Selecciona el ciclo de la solicitud.');
    }

    if (!program) {
      errors.push('Selecciona el programa relacionado.');
    }

    if (program && !this.canUseDestinationProgram(program)) {
      errors.push('Solo puedes solicitar para tus programas asignados.');
    }

    if (!form.reason.trim()) {
      errors.push('Captura el motivo de la solicitud.');
    }

    if (form.requestType === 'ALTA_GRUPO') {
      if (!form.groupFullGroup.trim()) {
        errors.push('Captura el grupo completo a solicitar.');
      }

      if (form.groupFullGroup && this.groupsRepository.hasFullGroup(form.groupFullGroup)) {
        errors.push('Ese grupo ya existe en el catalogo.');
      }
    }

    if (form.requestType === 'ASIGNACION_ESPECIAL') {
      if (!this.selectedSpecialSubject()) {
        errors.push('Selecciona una asignatura activa.');
      }

      if (!form.specialMoodleId.trim()) {
        errors.push('Captura el ID asignatura para Moodle.');
      }

      if (!form.specialTeacherMoodleUser) {
        errors.push('Selecciona docente o Temporalmente sin Docente.');
      }

      if (form.specialTeacherMoodleUser !== 'temporalmente_sin_docente' && !this.selectedSpecialTeacher()) {
        errors.push('Selecciona un docente validado.');
      }

      if (!this.normalizedStudentEnrollments(form.specialStudentEnrollments)) {
        errors.push('Captura al menos una matricula para la asignacion especial.');
      }
    }

    return errors;
  }

  private validateResponse(request: SharedClassRequest): string[] {
    const errors: string[] = [];
    const activeCycle = this.activeCycle();

    if (!this.canRespondRequest(request)) {
      errors.push('No tienes permisos para responder esta solicitud.');
    }

    if (request.status !== 'PENDIENTE') {
      errors.push('Solo se pueden responder solicitudes pendientes.');
    }

    if (this.requestTypeFor(request) !== 'COMPARTIR_CLASE') {
      if (!this.canSeeAllRequests()) {
        errors.push('Solo Sistemas puede responder solicitudes operativas.');
      }

      if (this.responseAction === 'RECHAZADA' && !this.responseObservations.trim()) {
        errors.push('Captura el motivo u observacion del rechazo.');
      }

      return errors;
    }

    if (this.responseAction === 'ACEPTADA') {
      if (activeCycle?.code !== request.cycle || activeCycle?.status !== 'Captura') {
        errors.push('La solicitud solo puede aceptarse durante la Captura del ciclo activo.');
      }

      if (!this.sourceAssignmentFor(request)) {
        errors.push('La asignacion origen ya no esta disponible.');
      }

      if (!this.groups().some((group) => group.fullGroup === request.destinationGroup && group.status === 'Activo')) {
        errors.push('El grupo destino ya no esta activo.');
      }
    }

    if (this.responseAction === 'RECHAZADA' && !this.responseObservations.trim()) {
      errors.push('Captura el motivo u observacion del rechazo.');
    }

    return errors;
  }

  private hasExistingSharedDestination(source: AcademicAssignment, destinationGroup: AcademicGroup): boolean {
    if ((source.sharedGroups ?? []).includes(destinationGroup.fullGroup)) {
      return true;
    }

    return this.assignments().some((assignment) => {
      return assignment.cycle === source.cycle
        && assignment.group === destinationGroup.fullGroup
        && assignment.shared
        && assignment.sourceAssignmentId === source.id;
    });
  }

  private canAccessRequest(request: SharedClassRequest): boolean {
    const appUser = this.session()?.appUser;
    const requestType = this.requestTypeFor(request);

    if (requestType !== 'COMPARTIR_CLASE') {
      return this.canSeeAllRequests()
        || request.requestedBy === appUser?.id
        || this.userHasProgram(request.requestedProgram ?? '');
    }

    return this.canSeeAllRequests()
      || this.userHasProgram(request.sourceProgram)
      || this.userHasProgram(request.destinationProgram)
      || request.requestedBy === appUser?.id;
  }

  private matchesTab(request: SharedClassRequest, tab: RequestTab): boolean {
    const appUser = this.session()?.appUser;
    const requestType = this.requestTypeFor(request);

    if (tab === 'TODAS') {
      return this.canSeeAllRequests();
    }

    if (requestType !== 'COMPARTIR_CLASE') {
      return tab === 'RECIBIDAS'
        ? this.canSeeAllRequests() && request.status === 'PENDIENTE'
        : request.requestedBy === appUser?.id
          || this.userHasProgram(request.requestedProgram ?? '');
    }

    if (tab === 'RECIBIDAS') {
      return this.canSeeAllRequests()
        || this.userHasProgram(request.sourceProgram);
    }

    return request.requestedBy === appUser?.id
      || this.userHasProgram(request.destinationProgram);
  }

  private canUseDestinationProgram(program: string): boolean {
    const normalizedProgram = program.trim().toUpperCase();

    return this.canSeeAllRequests()
      || this.userHasProgram(normalizedProgram);
  }

  private programCoordinator(programCode: string): string {
    const normalizedCode = programCode.trim().toUpperCase();
    const program = this.programs().find((item) => item.code === normalizedCode);

    return program?.coordinator || normalizedCode;
  }

  private requestActorData(): RequestActorData {
    const session = this.session();
    const appUser = session?.appUser;

    return {
      userId: appUser?.id ?? session?.authUid ?? 'sin-usuario',
      userName: appUser?.name ?? session?.displayName ?? 'Usuario SPAI',
      userRole: appUser?.role ?? 'Sin rol',
    };
  }

  private assignmentActorData(): Pick<
    UpsertAssignmentPayload,
    'createdBy' | 'createdByName' | 'createdByRole' | 'createdByPrograms'
  > {
    const session = this.session();
    const appUser = session?.appUser;

    return {
      createdBy: appUser?.id ?? session?.authUid ?? 'sin-usuario',
      createdByName: appUser?.name ?? session?.displayName ?? 'Usuario SPAI',
      createdByRole: appUser?.role ?? 'Sin rol',
      createdByPrograms: this.userPrograms(),
    };
  }

  private userRole(): string {
    return this.session()?.appUser?.role ?? '';
  }

  private userPrograms(): string[] {
    const programs = this.session()?.appUser?.assignedPrograms;

    return Array.isArray(programs)
      ? programs.map((program) => program.trim().toUpperCase()).filter(Boolean)
      : [];
  }

  private userHasProgram(program: string): boolean {
    const normalizedProgram = program.trim().toUpperCase();

    return !!normalizedProgram && this.userPrograms().includes(normalizedProgram);
  }

  private tabLabel(tab: RequestTab): string {
    const labels: Record<RequestTab, string> = {
      RECIBIDAS: 'Recibidas',
      ENVIADAS: 'Enviadas',
      TODAS: 'Todas',
    };

    return labels[tab];
  }

  requestTypeFor(request: SharedClassRequest): OperationalRequestType {
    return request.requestType ?? 'COMPARTIR_CLASE';
  }

  requestTypeLabel(requestType: OperationalRequestType): string {
    const labels: Record<OperationalRequestType, string> = {
      COMPARTIR_CLASE: 'Compartir clase',
      REABRIR_CAPTURA: 'Reabrir captura',
      ALTA_GRUPO: 'Alta de grupo',
      ASIGNACION_ESPECIAL: 'Asignacion especial',
    };

    return labels[requestType];
  }

  requestMatterLabel(request: SharedClassRequest): string {
    const requestType = this.requestTypeFor(request);

    if (requestType === 'ALTA_GRUPO') {
      return request.groupFullGroup || 'Alta de grupo';
    }

    if (requestType === 'REABRIR_CAPTURA') {
      return `Reabrir captura ${request.targetCycle || request.cycle}`;
    }

    if (requestType === 'ASIGNACION_ESPECIAL') {
      return request.specialSubjectId || 'Asignacion especial';
    }

    return request.subjectId || 'Compartir clase';
  }

  requestDetailLabel(request: SharedClassRequest): string {
    const requestType = this.requestTypeFor(request);

    if (requestType === 'ALTA_GRUPO') {
      return `${request.requestedProgram ?? ''} - ${request.groupProgramName ?? ''}`.trim();
    }

    if (requestType === 'REABRIR_CAPTURA') {
      return request.reason || 'Solicitud dirigida a Sistemas';
    }

    if (requestType === 'ASIGNACION_ESPECIAL') {
      return request.specialSubjectName ?? '';
    }

    return request.subjectName;
  }

  requestMatterMeta(request: SharedClassRequest): string {
    const requestType = this.requestTypeFor(request);

    if (requestType === 'COMPARTIR_CLASE') {
      return [
        request.teacherName,
        request.teacherMoodleUser,
        request.moodleId,
      ].filter(Boolean).join(' - ') || 'Clase compartida';
    }

    if (requestType === 'ASIGNACION_ESPECIAL') {
      return [
        request.specialTeacherName,
        request.specialTeacherMoodleUser,
        request.specialMoodleId,
      ].filter(Boolean).join(' - ') || 'Materia especial';
    }

    if (requestType === 'ALTA_GRUPO') {
      return [
        request.requestedProgram,
        request.groupModality,
        request.groupShift,
      ].filter(Boolean).join(' - ') || 'Solicitud dirigida a Sistemas';
    }

    return request.requestedProgram || 'Solicitud dirigida a Sistemas';
  }

  requestProgramLabel(request: SharedClassRequest): string {
    return this.requestTypeFor(request) === 'COMPARTIR_CLASE'
      ? `${request.sourceProgram} -> ${request.destinationProgram}`
      : request.requestedProgram ?? '';
  }

  programName(programCode: string): string {
    return this.programs().find((program) => program.code === programCode)?.name ?? programCode;
  }

  private asGroupModality(value?: string): GroupModality {
    return value === 'Escolarizado' || value === 'Ejecutivo' || value === 'Virtual' || value === 'No identificada'
      ? value
      : 'No identificada';
  }

  private asGroupShift(value?: string): GroupShift {
    return value === 'Matutino' || value === 'Vespertino' || value === 'Nocturno' || value === 'No identificado'
      ? value
      : 'No identificado';
  }

  private normalizedStudentEnrollments(value: string): string {
    return value
      .split(/[\n,;]+/)
      .map((enrollment) => enrollment.trim().toUpperCase())
      .filter(Boolean)
      .join(', ');
  }

  private teacherFilterLabel(): string {
    return this.teacherOptions().find((teacher) => teacher.moodleUser === this.teacherFilter())?.name
      ?? this.teacherFilter();
  }

  private normalizeSearch(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  private emptyRequestForm(cycle = this.activeCycle()?.code ?? ''): RequestForm {
    return {
      requestType: 'COMPARTIR_CLASE',
      sourceAssignmentId: '',
      destinationGroup: '',
      cycle,
      program: '',
      reason: '',
      groupFullGroup: '',
      groupCode: '',
      groupSection: '',
      groupModality: 'No identificada',
      groupShift: 'No identificado',
      groupAcademicArea: '',
      specialSubjectId: '',
      specialMoodleId: '',
      specialTeacherMoodleUser: '',
      specialStudentEnrollments: '',
      message: '',
    };
  }
}
