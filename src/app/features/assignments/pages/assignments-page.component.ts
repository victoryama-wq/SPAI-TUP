import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserSessionService } from '../../../core/auth/user-session.service';
import { AuditLogRepository } from '../../../core/data/audit-log.repository';
import { SystemNotificationsRepository } from '../../../core/data/system-notifications.repository';
import { ConfirmationDialogService } from '../../../shared/confirmation/confirmation-dialog.service';
import { AcademicGroup, GroupsRepository } from '../../groups/data/groups.repository';
import { ProgramsRepository } from '../../nomenclatures/data/programs.repository';
import { Subject, SubjectsRepository } from '../../subjects/data/subjects.repository';
import { Teacher, TeachersRepository } from '../../teachers/data/teachers.repository';
import { CyclesRepository } from '../../cycles/data/cycles.repository';
import {
  AcademicAssignment,
  AssignmentStatus,
  AssignmentsRepository,
  UpsertAssignmentPayload,
} from '../data/assignments.repository';

type AssignmentStatusFilter = AssignmentStatus | 'TODOS';
type AssignmentModeTab = 'Escolarizado' | 'Ejecutivo' | 'Virtual' | 'Salud' | 'Posgrados' | 'Especiales';
type AssignmentSearchField = 'program' | 'group' | 'teacher' | 'subject';

const TEMPORARY_TEACHER_USER = 'temporalmente_sin_docente';
const TEMPORARY_TEACHER_NAME = 'TEMPORALMENTE SIN DOCENTE';

interface AssignmentFormState {
  cycle: string;
  program: string;
  group: string;
  subjectId: string;
  moodleId: string;
  teacherMoodleUser: string;
  status: AssignmentStatus;
  observations: string;
  shared: boolean;
  sourceAssignmentId: string;
  sharedGroupCount: number;
  shareGroups: string[];
  special: boolean;
  studentEnrollments: string;
}

@Component({
  selector: 'spai-assignments-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './assignments-page.component.html',
  styleUrl: './assignments-page.component.css',
})
export class AssignmentsPageComponent {
  private readonly assignmentsRepository = inject(AssignmentsRepository);
  private readonly auditLogRepository = inject(AuditLogRepository);
  private readonly cyclesRepository = inject(CyclesRepository);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly groupsRepository = inject(GroupsRepository);
  private readonly programsRepository = inject(ProgramsRepository);
  private readonly router = inject(Router);
  private readonly subjectsRepository = inject(SubjectsRepository);
  private readonly systemNotificationsRepository = inject(SystemNotificationsRepository);
  private readonly teachersRepository = inject(TeachersRepository);
  private readonly userSessionService = inject(UserSessionService);

  readonly assignments = this.assignmentsRepository.assignments;
  readonly cycles = this.cyclesRepository.cycles;
  readonly groups = this.groupsRepository.groups;
  readonly programs = this.programsRepository.programs;
  readonly subjects = this.subjectsRepository.subjects;
  readonly teachers = this.teachersRepository.teachers;
  readonly session = this.userSessionService.session;

  statusFilter = signal<AssignmentStatusFilter>('TODOS');
  searchField = signal<AssignmentSearchField>('program');
  searchQuery = signal('');
  modeTab = signal<AssignmentModeTab>('Escolarizado');
  formMessage = '';
  formErrors: string[] = [];
  isAssignmentModalOpen = false;
  editingAssignmentId: string | null = null;
  isReadinessAlertVisible = signal(true);

  assignmentForm = this.emptyForm();

  readonly activeCycle = this.cyclesRepository.activeCycle;

  readonly activeCycleCode = computed(() => this.activeCycle()?.code ?? 'Pendiente de configurar');

  readonly canSeeAllAssignments = computed(() => {
    const appUser = this.session()?.appUser;

    return appUser?.status === 'Activo'
      && (
        this.isSystemsCoordinationRole(appUser.role)
        || (this.isSystemsAssistantRole(appUser.role) && appUser.access?.asignaciones === true)
      );
  });

  readonly canViewAssignments = computed(() => {
    const appUser = this.session()?.appUser;

    return appUser?.status === 'Activo'
      && (
        this.canSeeAllAssignments()
        || this.isAcademicCoordinationRole(appUser.role)
      );
  });

  readonly canManageAssignments = computed(() => {
    const appUser = this.session()?.appUser;

    return appUser?.status === 'Activo'
      && (
        this.canSeeAllAssignments()
        || this.isAcademicCoordinationRole(appUser.role)
      );
  });

  readonly canReviewAssignments = computed(() => this.canSeeAllAssignments());

  readonly canCaptureAssignments = computed(() => this.activeCycle()?.status === 'Captura');

  readonly captureBlockedMessage = computed(() => {
    const activeCycle = this.activeCycle();

    if (!activeCycle) {
      const referenceCycle = this.cycles().find((cycle) => cycle.status === 'Preparacion' || cycle.status === 'Cerrado');

      if (referenceCycle) {
        return `El ciclo ${referenceCycle.code} esta en estado ${referenceCycle.status}. Coordinacion de Sistemas debe abrir un ciclo en Captura para registrar asignaciones.`;
      }

      return 'No hay ciclo activo operativo. Coordinacion de Sistemas debe abrir un ciclo en Captura antes de registrar asignaciones.';
    }

    if (activeCycle.status !== 'Captura') {
      return `El ciclo ${activeCycle.code} esta en estado ${activeCycle.status}. La captura y edicion de asignaciones estan bloqueadas.`;
    }

    return '';
  });

  readonly activeSubjects = computed(() =>
    this.subjects()
      .filter((subject) => subject.status === 'Activo')
      .sort((a, b) => a.subjectId.localeCompare(b.subjectId, 'es')),
  );

  readonly validatedTeachers = computed(() =>
    this.teachers()
      .filter((teacher) => teacher.status === 'VALIDADO')
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es')),
  );

  readonly assignmentReadinessMessages = computed(() => {
    const messages: string[] = [];

    if (!this.canSeeAllAssignments()) {
      return messages;
    }

    if (!this.canViewAssignments()) {
      messages.push('No tienes permisos activos para consultar el modulo Asignaciones.');
      return messages;
    }

    if (this.captureBlockedMessage()) {
      messages.push(this.captureBlockedMessage());
    }

    if (this.canCaptureAssignments() && this.canManageAssignments()) {
      if (this.modeTab() !== 'Especiales' && !this.destinationGroupOptions().length) {
        messages.push('No hay grupos activos disponibles para tus programas en el ciclo activo.');
      }

      if (this.modeTab() === 'Especiales' && !this.destinationProgramOptions().length) {
        messages.push('No hay programas disponibles para capturar casos especiales.');
      }

      if (!this.activeSubjects().length) {
        messages.push('No hay asignaturas activas en el catalogo para seleccionar.');
      }

      if (!this.validatedTeachers().length) {
        messages.push('No hay docentes validados; puedes usar Temporalmente sin Docente mientras se regulariza el catalogo.');
      }
    }

    return messages;
  });

  readonly visibleProgramCodes = computed(() => {
    const activeCycle = this.activeCycle();
    const appUser = this.session()?.appUser;

    if (!activeCycle || !this.canViewAssignments()) {
      return [];
    }

    const programs = new Set(
      this.groups()
        .filter((group) => {
        return group.cycleCode === activeCycle.code
            && this.canUseDestinationProgram(group.programAbbreviation)
            && this.groupMatchesModeTab(group, this.modeTab());
      })
      .map((group) => group.programAbbreviation),
    );

    this.assignments()
      .filter((assignment) => {
        const allowedProgram = this.canSeeAllAssignments()
          || appUser?.assignedPrograms.includes(assignment.program) === true;

        return assignment.cycle === activeCycle.code
          && allowedProgram
          && this.assignmentMode(assignment) === this.modeTab();
      })
      .forEach((assignment) => programs.add(assignment.program));

    return Array.from(programs).sort((a, b) => a.localeCompare(b, 'es'));
  });

  readonly tableGroupOptions = computed(() => {
    const activeCycle = this.activeCycle();

    if (!activeCycle || !this.canViewAssignments()) {
      return [];
    }

    return this.groups()
      .filter((group) => {
        return group.status === 'Activo'
          && group.cycleCode === activeCycle.code
          && this.canUseDestinationProgram(group.programAbbreviation)
          && this.groupMatchesModeTab(group, this.modeTab());
      })
      .sort((a, b) => a.fullGroup.localeCompare(b.fullGroup, 'es'));
  });

  readonly destinationGroupOptions = computed(() => {
    const activeCycle = this.activeCycle();
    const appUser = this.session()?.appUser;

    if (!activeCycle) {
      return [];
    }

    return this.groups()
      .filter((group) => {
        const allowedProgram = this.canSeeAllAssignments()
          || appUser?.assignedPrograms.includes(group.programAbbreviation);

        return group.status === 'Activo'
          && group.cycleCode === activeCycle.code
          && allowedProgram
          && this.groupMatchesModeTab(group, this.modeTab());
      })
      .sort((a, b) => a.fullGroup.localeCompare(b.fullGroup, 'es'));
  });

  readonly sharedGroupOptions = computed(() =>
    this.destinationGroupOptions().filter((group) => group.fullGroup !== this.assignmentForm.group),
  );

  readonly sharedGroupCountOptions = computed(() =>
    Array.from({ length: this.sharedGroupOptions().length }, (_, index) => index + 1),
  );

  readonly destinationProgramOptions = computed(() => {
    const appUser = this.session()?.appUser;

    if (this.canSeeAllAssignments()) {
      return this.programs()
        .filter((program) => program.status === 'Activo')
        .map((program) => program.code)
        .sort((a, b) => a.localeCompare(b, 'es'));
    }

    return (appUser?.assignedPrograms ?? [])
      .map((program) => program.trim().toUpperCase())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es'));
  });

  readonly visibleAssignments = computed(() => {
    return this.assignments().filter((assignment) => {
      const matchesStatus = this.statusFilter() === 'TODOS' || assignment.status === this.statusFilter();

      return this.assignmentInCurrentScope(assignment)
        && matchesStatus
        && this.assignmentMatchesSearch(assignment);
    });
  });

  readonly modeTabs = computed(() => {
    const tabs: AssignmentModeTab[] = ['Escolarizado', 'Ejecutivo', 'Virtual', 'Salud', 'Posgrados', 'Especiales'];

    return tabs.map((tab) => ({
      label: tab,
      value: tab,
      count: this.countAssignmentsForTab(tab),
    }));
  });

  readonly sourceAssignmentOptions = computed(() =>
    this.assignments().filter((assignment) => {
      const appUser = this.session()?.appUser;
      const allowedProgram = this.canSeeAllAssignments()
        || appUser?.assignedPrograms.includes(assignment.program) === true;

      return assignment.id !== this.editingAssignmentId
        && assignment.cycle === this.assignmentForm.cycle
        && allowedProgram
        && !assignment.shared
        && !assignment.special;
    }).sort((a, b) => a.group.localeCompare(b.group, 'es')),
  );

  readonly captureCount = computed(
    () => this.visibleAssignments().filter((assignment) => assignment.status === 'EN_CAPTURA').length,
  );
  readonly reviewCount = computed(
    () => this.visibleAssignments().filter((assignment) => assignment.status === 'EN_REVISION').length,
  );
  readonly validatedCount = computed(
    () => this.visibleAssignments().filter((assignment) => assignment.status === 'VALIDADO').length,
  );
  readonly observedCount = computed(
    () => this.visibleAssignments().filter((assignment) => assignment.status === 'CON_OBSERVACION').length,
  );

  get modalTitle(): string {
    return this.editingAssignmentId ? 'Editar asignacion' : 'Nueva asignacion';
  }

  get submitLabel(): string {
    return this.editingAssignmentId ? 'Guardar cambios' : 'Guardar asignacion';
  }

  selectedFormProgramLabel(): string {
    if (this.assignmentForm.special) {
      return this.assignmentForm.program || 'Seleccionar carrera';
    }

    const group = this.selectedGroup();

    if (!group) {
      return 'Se autollenara al seleccionar grupo';
    }

    return `${group.programAbbreviation} - ${group.programName}`;
  }

  openAssignmentModal(): void {
    const activeCycle = this.activeCycle();
    if (!this.canCaptureAssignments()) {
      this.formMessage = this.captureBlockedMessage();
      return;
    }

    this.editingAssignmentId = null;
    this.formErrors = [];
    this.formMessage = '';
    this.assignmentForm = this.emptyForm(activeCycle?.code ?? '', this.modeTab() === 'Especiales');
    this.isAssignmentModalOpen = true;
  }

  editAssignment(assignment: AcademicAssignment): void {
    if (!this.canManageAssignments() || !this.canEditAssignment(assignment)) {
      return;
    }

    if (!this.canCaptureAssignments()) {
      this.formMessage = this.captureBlockedMessage();
      return;
    }

    this.editingAssignmentId = assignment.id;
    this.formErrors = [];
    this.formMessage = '';
    const sourceAssignment = assignment.shared ? this.assignmentById(assignment.sourceAssignmentId) : null;
    this.assignmentForm = {
      cycle: assignment.cycle,
      program: assignment.program,
      group: sourceAssignment?.group ?? assignment.group,
      subjectId: assignment.subjectId,
      moodleId: assignment.moodleId,
      teacherMoodleUser: assignment.teacherMoodleUser,
      status: this.canReviewAssignments() ? assignment.status : 'EN_CAPTURA',
      observations: assignment.observations,
      shared: assignment.shared,
      sourceAssignmentId: assignment.sourceAssignmentId,
      sharedGroupCount: assignment.shared ? 1 : 0,
      shareGroups: assignment.shared ? [assignment.group] : [],
      special: assignment.special ?? false,
      studentEnrollments: assignment.studentEnrollments ?? '',
    };
    this.isAssignmentModalOpen = true;
  }

  shareAssignment(assignment: AcademicAssignment): void {
    if (!this.canShareAssignment(assignment)) {
      return;
    }

    void this.router.navigate(['/solicitudes'], { queryParams: { origen: assignment.id } });
  }

  closeAssignmentModal(): void {
    this.isAssignmentModalOpen = false;
    this.editingAssignmentId = null;
    this.formErrors = [];
    this.assignmentForm = this.emptyForm(this.activeCycle()?.code ?? '', this.modeTab() === 'Especiales');
  }

  saveAssignment(continueAdding = false): void {
    this.formMessage = '';
    this.formErrors = this.validateForm();

    if (this.formErrors.length) {
      return;
    }

    const actor = this.actorData();
    const subject = this.selectedSubject();
    const group = this.assignmentForm.special ? null : this.selectedGroup();
    const shareGroups = this.assignmentForm.shared ? this.selectedShareGroups() : [];
    const program = this.assignmentForm.special ? this.assignmentForm.program.trim().toUpperCase() : group?.programAbbreviation ?? '';

    if ((!this.assignmentForm.special && !group) || !program || !subject || !this.hasValidTeacherSelection()) {
      this.formErrors = ['Selecciona programa/grupo, asignatura y docente validos.'];
      return;
    }

    if (!this.canUseDestinationProgram(program)) {
      this.formErrors = ['Solo puedes guardar asignaciones en tus programas asignados.'];
      return;
    }

    if (shareGroups.some((shareGroup) => !this.canUseDestinationProgram(shareGroup.programAbbreviation))) {
      this.formErrors = ['Solo puedes compartir asignaciones con grupos de tus programas asignados.'];
      return;
    }

    const wasEditing = this.editingAssignmentId !== null;
    const currentAssignment = this.editingAssignmentId
      ? this.assignments().find((assignment) => assignment.id === this.editingAssignmentId)
      : null;

    if (currentAssignment?.shared && this.assignmentForm.shared && shareGroups.length === 1) {
      const shareGroup = shareGroups[0];
      const sharedEditPayload: UpsertAssignmentPayload = {
        id: this.editingAssignmentId,
        cycle: this.assignmentForm.cycle,
        program: shareGroup.programAbbreviation,
        group: shareGroup.fullGroup,
        subjectId: subject.subjectId,
        subjectName: subject.name,
        moodleId: this.assignmentForm.moodleId,
        teacherMoodleUser: this.selectedTeacherMoodleUser(),
        teacherName: this.selectedTeacherName(),
        status: this.assignmentForm.status,
        observations: this.assignmentForm.observations,
        shared: true,
        sourceAssignmentId: this.assignmentForm.sourceAssignmentId,
        special: false,
        studentEnrollments: this.normalizedStudentEnrollments(),
        ...actor,
      };
      const sharedAssignmentId = this.assignmentsRepository.upsertAssignment(sharedEditPayload);

      this.auditLogRepository.register({
        module: 'Asignaciones',
        action: 'ASIGNACION_EDITADA',
        description: `Se actualizo la asignacion compartida ${subject.subjectId} para ${shareGroup.fullGroup}.`,
        user: actor.createdByName,
        userRole: actor.createdByRole,
        entity: 'asignaciones',
        entityId: sharedAssignmentId,
        metadata: {
          cycle: sharedEditPayload.cycle,
          program: sharedEditPayload.program,
          group: sharedEditPayload.group,
          subjectId: sharedEditPayload.subjectId,
          moodleId: this.assignmentsRepository.normalizeMoodleId(sharedEditPayload.moodleId),
          status: sharedEditPayload.status,
          shared: sharedEditPayload.shared,
          sourceAssignmentId: sharedEditPayload.sourceAssignmentId ?? '',
        },
      });

      this.formMessage = 'Asignacion actualizada correctamente.';
      this.closeAssignmentModal();
      return;
    }

    const basePayload: UpsertAssignmentPayload = {
      id: this.editingAssignmentId,
      cycle: this.assignmentForm.cycle,
      program,
      group: this.assignmentForm.special ? '' : group?.fullGroup ?? '',
      subjectId: subject.subjectId,
      subjectName: subject.name,
      moodleId: this.assignmentForm.moodleId,
      teacherMoodleUser: this.selectedTeacherMoodleUser(),
      teacherName: this.selectedTeacherName(),
      status: this.assignmentForm.status,
      observations: this.assignmentForm.observations,
      shared: false,
      sourceAssignmentId: this.assignmentForm.sourceAssignmentId,
      special: this.assignmentForm.special,
      studentEnrollments: this.normalizedStudentEnrollments(),
      ...actor,
    };
    const assignmentId = this.assignmentsRepository.upsertAssignment(basePayload);
    const createdAssignmentIds = this.editingAssignmentId ? [] : [assignmentId];

    if (this.assignmentForm.shared && !this.assignmentForm.special && shareGroups.length) {
      for (const shareGroup of shareGroups) {
        const sharedPayload: UpsertAssignmentPayload = {
          ...basePayload,
          id: null,
          program: shareGroup.programAbbreviation,
          group: shareGroup.fullGroup,
          shared: true,
          sourceAssignmentId: assignmentId,
          special: false,
        };
        const sharedAssignmentId = this.assignmentsRepository.upsertAssignment(sharedPayload);
        createdAssignmentIds.push(sharedAssignmentId);
        this.notifySystemsAboutSharedClass(
          actor,
          sharedAssignmentId,
          sharedPayload.cycle,
          subject.subjectId,
          subject.name,
          group?.fullGroup ?? '',
          shareGroup.fullGroup,
          this.selectedTeacherName(),
        );

        this.auditLogRepository.register({
          module: 'Asignaciones',
          action: 'ASIGNACION_COMPARTIDA_CREADA',
          description: `Se compartio la asignacion ${subject.subjectId} de ${group?.fullGroup} con ${shareGroup.fullGroup}.`,
          user: actor.createdByName,
          userRole: actor.createdByRole,
          entity: 'asignaciones',
          entityId: sharedAssignmentId,
          metadata: {
            cycle: sharedPayload.cycle,
            program: sharedPayload.program,
            group: sharedPayload.group,
            subjectId: sharedPayload.subjectId,
            moodleId: this.assignmentsRepository.normalizeMoodleId(sharedPayload.moodleId),
            status: sharedPayload.status,
            shared: sharedPayload.shared,
            sourceAssignmentId: sharedPayload.sourceAssignmentId ?? '',
          },
        });
      }
    }

    this.auditLogRepository.register({
      module: 'Asignaciones',
      action: this.editingAssignmentId ? 'ASIGNACION_EDITADA' : 'ASIGNACION_CREADA',
      description: `Se guardo la asignacion ${subject.subjectId} para ${this.assignmentForm.special ? 'caso especial' : group?.fullGroup}.`,
      user: actor.createdByName,
      userRole: actor.createdByRole,
      entity: 'asignaciones',
      entityId: assignmentId,
      metadata: {
        cycle: basePayload.cycle,
        program: basePayload.program,
        group: basePayload.group,
        subjectId: basePayload.subjectId,
        moodleId: this.assignmentsRepository.normalizeMoodleId(basePayload.moodleId),
        status: basePayload.status,
        shared: basePayload.shared,
        sourceAssignmentId: basePayload.sourceAssignmentId ?? '',
      },
    });

    this.formMessage = this.editingAssignmentId
      ? 'Asignacion actualizada correctamente.'
      : 'Asignacion guardada correctamente.';
    this.notifySystemsAboutAssignmentMilestones(actor, basePayload.cycle, createdAssignmentIds);

    if (continueAdding && !wasEditing) {
      this.prepareNextAssignmentForm();
      return;
    }

    this.closeAssignmentModal();
  }

  selectSearchField(event: Event): void {
    this.searchField.set((event.target as HTMLSelectElement).value as AssignmentSearchField);
    this.searchQuery.set('');
  }

  updateSearchQuery(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  selectPredictedSearch(value: string): void {
    this.searchQuery.set(value);
  }

  selectStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as AssignmentStatusFilter);
  }

  selectModeTab(tab: AssignmentModeTab): void {
    this.modeTab.set(tab);
    this.searchQuery.set('');
  }

  dismissReadinessAlert(): void {
    this.isReadinessAlertVisible.set(false);
  }

  searchFieldLabel(): string {
    const labels: Record<AssignmentSearchField, string> = {
      program: 'Programa',
      group: 'Grupo',
      teacher: 'Docente',
      subject: 'Materia',
    };

    return labels[this.searchField()];
  }

  searchPlaceholder(): string {
    const placeholders: Record<AssignmentSearchField, string> = {
      program: 'Escribe la carrera o programa',
      group: 'Escribe el grupo',
      teacher: 'Escribe nombre o usuario Moodle',
      subject: 'Escribe clave o nombre de materia',
    };

    return placeholders[this.searchField()];
  }

  searchSuggestions(): string[] {
    const query = this.normalizeSearch(this.searchQuery());
    const options = new Set<string>();
    const scopedAssignments = this.assignments().filter((assignment) => {
      const matchesStatus = this.statusFilter() === 'TODOS' || assignment.status === this.statusFilter();

      return this.assignmentInCurrentScope(assignment) && matchesStatus;
    });

    if (this.searchField() === 'program') {
      this.visibleProgramCodes().forEach((program) => options.add(program));
    }

    if (this.searchField() === 'group') {
      this.tableGroupOptions().forEach((group) => options.add(group.fullGroup));
      scopedAssignments
        .filter((assignment) => assignment.group)
        .forEach((assignment) => options.add(assignment.group));
    }

    if (this.searchField() === 'teacher') {
      scopedAssignments
        .forEach((assignment) => options.add(`${assignment.teacherName} - ${assignment.teacherMoodleUser}`));
    }

    if (this.searchField() === 'subject') {
      scopedAssignments
        .forEach((assignment) => options.add(`${assignment.subjectId} - ${assignment.subjectName}`));
    }

    return Array.from(options)
      .filter((option) => !query || this.normalizeSearch(option).includes(query))
      .sort((a, b) => a.localeCompare(b, 'es'))
      .slice(0, 30);
  }

  predictedSearchSuggestions(): string[] {
    const query = this.normalizeSearch(this.searchQuery());

    if (query.length < 2) {
      return [];
    }

    return this.searchSuggestions()
      .filter((option) => this.normalizeSearch(option) !== query)
      .slice(0, 4);
  }

  onGroupChange(): void {
    const group = this.selectedGroup();
    this.assignmentForm.cycle = this.activeCycle()?.code ?? group?.cycleCode ?? this.assignmentForm.cycle;

    this.syncSharedGroups();
  }

  onSharedChange(): void {
    if (!this.assignmentForm.shared) {
      this.assignmentForm.sourceAssignmentId = '';
      this.assignmentForm.sharedGroupCount = 0;
      this.assignmentForm.shareGroups = [];
      return;
    }

    this.assignmentForm.sharedGroupCount = this.normalizeSharedGroupCount(this.assignmentForm.sharedGroupCount || 1);
    this.syncSharedGroups();
  }

  onSpecialChange(): void {
    if (this.assignmentForm.special) {
      this.assignmentForm.group = '';
      this.assignmentForm.shared = false;
      this.assignmentForm.sourceAssignmentId = '';
      this.assignmentForm.sharedGroupCount = 0;
      this.assignmentForm.shareGroups = [];
      return;
    }

    this.assignmentForm.program = '';
  }

  onSharedGroupCountChange(value: number | string): void {
    this.assignmentForm.sharedGroupCount = this.normalizeSharedGroupCount(value);
    this.syncSharedGroups();
  }

  toggleShareGroup(group: string, checked: boolean): void {
    const normalizedGroup = group.trim().toUpperCase();
    const selectedGroups = new Set(this.assignmentForm.shareGroups);

    if (checked) {
      selectedGroups.add(normalizedGroup);
    } else {
      selectedGroups.delete(normalizedGroup);
    }

    this.assignmentForm.shareGroups = Array.from(selectedGroups);
    this.syncSharedGroups();
  }

  isShareGroupSelected(group: string): boolean {
    return this.assignmentForm.shareGroups.includes(group);
  }

  isShareGroupDisabled(group: string): boolean {
    return !this.isShareGroupSelected(group)
      && this.assignmentForm.shareGroups.length >= this.assignmentForm.sharedGroupCount;
  }

  applySourceAssignment(): void {
    const source = this.assignments().find((assignment) => assignment.id === this.assignmentForm.sourceAssignmentId);

    if (!source) {
      return;
    }

    this.assignmentForm.moodleId = source.moodleId;
    this.assignmentForm.teacherMoodleUser = source.teacherMoodleUser;
    this.assignmentForm.subjectId = source.subjectId;
  }

  statusClass(status: AssignmentStatus): string {
    return status.toLowerCase();
  }

  statusLabel(status: AssignmentStatus): string {
    const labels: Record<AssignmentStatus, string> = {
      EN_CAPTURA: 'En captura',
      EN_REVISION: 'En revision',
      VALIDADO: 'Validado',
      CON_OBSERVACION: 'Con observacion',
    };

    return labels[status];
  }

  assignmentById(id: string): AcademicAssignment | null {
    return this.assignments().find((assignment) => assignment.id === id) ?? null;
  }

  sharedAssignmentDetails(assignment: AcademicAssignment): string {
    const sourceAssignment = this.assignmentById(assignment.sourceAssignmentId);
    const sourceGroup = sourceAssignment?.group || assignment.sourceAssignmentId || 'origen no identificado';

    return `Clase compartida con grupo ${assignment.group}. Origen: ${sourceGroup}.`;
  }

  async showSharedAssignmentDetails(assignment: AcademicAssignment): Promise<void> {
    await this.confirmationDialogService.alert({
      title: 'Clase compartida',
      message: this.sharedAssignmentDetails(assignment),
    });
  }

  canEditAssignment(assignment: AcademicAssignment): boolean {
    const appUser = this.session()?.appUser;

    return this.canSeeAllAssignments()
      || appUser?.assignedPrograms.includes(assignment.program) === true;
  }

  canShareAssignment(assignment: AcademicAssignment): boolean {
    const activeCycle = this.activeCycle();

    return this.canManageAssignments()
      && this.canEditAssignment(assignment)
      && !assignment.shared
      && !(assignment.special ?? false)
      && activeCycle?.code === assignment.cycle
      && activeCycle.status === 'Captura';
  }

  private countAssignmentsForTab(tab: AssignmentModeTab): number {
    return this.assignments().filter((assignment) => {
      const matchesStatus = this.statusFilter() === 'TODOS' || assignment.status === this.statusFilter();

      return this.assignmentInCurrentScope(assignment, tab)
        && matchesStatus
        && this.assignmentMatchesSearch(assignment);
    }).length;
  }

  private assignmentInCurrentScope(assignment: AcademicAssignment, tab = this.modeTab()): boolean {
    const appUser = this.session()?.appUser;
    const activeCycle = this.activeCycle();
    const matchesCycle = activeCycle ? assignment.cycle === activeCycle.code : false;
    const allowedProgram = this.canSeeAllAssignments()
      || appUser?.assignedPrograms.includes(assignment.program) === true;
    const matchesTab = this.assignmentMode(assignment) === tab;

    return this.canViewAssignments()
      && matchesCycle
      && allowedProgram
      && matchesTab;
  }

  private assignmentMatchesSearch(assignment: AcademicAssignment): boolean {
    const query = this.normalizeSearch(this.searchQuery());

    if (!query) {
      return true;
    }

    if (this.searchField() === 'program') {
      return this.normalizeSearch(assignment.program).includes(query);
    }

    if (this.searchField() === 'group') {
      return this.normalizeSearch(assignment.group).includes(query);
    }

    if (this.searchField() === 'teacher') {
      return this.normalizeSearch(`${assignment.teacherName} ${assignment.teacherMoodleUser}`).includes(query);
    }

    return this.normalizeSearch(`${assignment.subjectId} ${assignment.subjectName}`).includes(query);
  }

  private normalizeSearch(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private assignmentMode(assignment: AcademicAssignment): AssignmentModeTab | null {
    if (assignment.special || this.hasStudentEnrollments(assignment.studentEnrollments)) {
      return 'Especiales';
    }

    const group = this.groups().find((item) => item.fullGroup === assignment.group);

    return group ? this.groupMode(group) : null;
  }

  private validateForm(): string[] {
    const errors: string[] = [];
    const activeCycle = this.activeCycle();
    const moodleId = this.assignmentsRepository.normalizeMoodleId(this.assignmentForm.moodleId);

    if (!this.canManageAssignments()) {
      errors.push('No tienes permisos para guardar asignaciones.');
    }

    if (!activeCycle) {
      errors.push('No hay ciclo activo operativo para capturar asignaciones.');
    }

    if (activeCycle && activeCycle.status !== 'Captura') {
      errors.push(`El ciclo activo esta en estado ${activeCycle.status}; solo se puede capturar o editar en estado Captura.`);
    }

    if (this.assignmentForm.special && !this.assignmentForm.program) {
      errors.push('El programa es obligatorio para casos especiales.');
    }

    if (!this.assignmentForm.special && !this.assignmentForm.group) {
      errors.push(`El ${this.assignmentForm.shared ? 'grupo base' : 'grupo'} es obligatorio.`);
    }

    if (this.assignmentForm.shared && !this.assignmentForm.special && !this.assignmentForm.shareGroups.length) {
      errors.push('Selecciona al menos un grupo para compartir.');
    }

    if (this.assignmentForm.shared
      && !this.assignmentForm.special
      && this.assignmentForm.shareGroups.length !== this.assignmentForm.sharedGroupCount) {
      errors.push('Selecciona la cantidad exacta de grupos compartidos indicada.');
    }

    if (this.assignmentForm.shared
      && !this.assignmentForm.special
      && this.assignmentForm.group
      && this.assignmentForm.shareGroups.includes(this.assignmentForm.group)) {
      errors.push('El grupo a compartir debe ser diferente al grupo base.');
    }

    const selectedGroup = this.selectedGroup();
    const selectedProgram = this.assignmentForm.special
      ? this.assignmentForm.program.trim().toUpperCase()
      : selectedGroup?.programAbbreviation ?? '';

    if (selectedProgram && !this.canUseDestinationProgram(selectedProgram)) {
      errors.push('Solo puedes seleccionar grupos de tus programas asignados como destino.');
    }

    if (this.assignmentForm.special && !this.normalizedStudentEnrollments()) {
      errors.push('Captura al menos una matricula para el caso especial.');
    }

    if (!this.canReviewAssignments() && this.assignmentForm.status !== 'EN_CAPTURA') {
      errors.push('Coordinacion Academica solo puede guardar asignaciones en estado En captura.');
    }

    if (!this.assignmentForm.subjectId) {
      errors.push('La asignatura es obligatoria.');
    }

    if (!moodleId) {
      errors.push('El ID asignatura es obligatorio.');
    }

    if (!this.assignmentForm.teacherMoodleUser) {
      errors.push('El docente es obligatorio.');
    }

    if (this.assignmentForm.shared && !this.assignmentForm.sourceAssignmentId) {
      const isCreatingSharedFromBase = !this.editingAssignmentId
        && !this.assignmentForm.special
        && this.assignmentForm.group
        && this.assignmentForm.shareGroups.length > 0;

      if (!isCreatingSharedFromBase) {
        errors.push('Selecciona la asignacion origen de la clase compartida.');
      }
    }

    const currentAssignment = this.editingAssignmentId
      ? this.assignments().find((assignment) => assignment.id === this.editingAssignmentId)
      : null;

    if (currentAssignment?.shared && this.assignmentForm.shared && this.assignmentForm.shareGroups.length !== 1) {
      errors.push('Al editar una asignacion compartida selecciona solo un grupo destino.');
    }

    const shouldValidateBaseMoodleId = !this.assignmentForm.shared || !this.assignmentForm.sourceAssignmentId;

    if (shouldValidateBaseMoodleId
      && moodleId
      && this.assignmentsRepository.hasMoodleIdConflict(
        this.assignmentForm.cycle,
        moodleId,
        this.editingAssignmentId,
      )) {
      errors.push('El ID asignatura ya existe en este ciclo. Marca clase compartida y vincula el origen si corresponde.');
    }

    if (this.assignmentForm.shared) {
      const source = this.assignments().find((assignment) => assignment.id === this.assignmentForm.sourceAssignmentId);
      if (source && source.normalizedMoodleId !== moodleId) {
        errors.push('La asignacion compartida debe conservar el mismo ID asignatura que la asignacion origen.');
      }
    }

    return errors;
  }

  private selectedGroup(): AcademicGroup | null {
    return this.groups().find((group) => group.fullGroup === this.assignmentForm.group) ?? null;
  }

  private selectedShareGroups(): AcademicGroup[] {
    return this.assignmentForm.shareGroups
      .map((fullGroup) => this.groups().find((group) => group.fullGroup === fullGroup) ?? null)
      .filter((group): group is AcademicGroup => group !== null);
  }

  private canUseDestinationProgram(program: string): boolean {
    const appUser = this.session()?.appUser;
    const normalizedProgram = program.trim().toUpperCase();

    return this.canSeeAllAssignments()
      || appUser?.assignedPrograms.includes(normalizedProgram) === true;
  }

  private isSystemsCoordinationRole(role: string): boolean {
    return role.includes('Sistemas') && !role.includes('Auxiliar');
  }

  private isSystemsAssistantRole(role: string): boolean {
    return role.includes('Sistemas') && role.includes('Auxiliar');
  }

  private isAcademicCoordinationRole(role: string): boolean {
    return role.includes('Acad');
  }

  private isPostgraduateGroup(group: AcademicGroup): boolean {
    const program = this.programs().find((item) => item.code === group.programAbbreviation);
    const searchText = this.normalizeSearchText([
      program?.programType,
      program?.name,
      group.programName,
      group.programAbbreviation,
    ].join(' '));

    return searchText.includes('maestria')
      || searchText.includes('especialidad')
      || searchText.includes('doctorado')
      || searchText.includes('posgrado');
  }

  private groupMatchesModeTab(group: AcademicGroup, tab: AssignmentModeTab): boolean {
    return this.groupMode(group) === tab;
  }

  private groupMode(group: AcademicGroup): AssignmentModeTab | null {
    if (this.isSpecialGroup(group)) {
      return 'Especiales';
    }

    if (this.isHealthGroup(group)) {
      return 'Salud';
    }

    if (this.isCampusTupGroup(group) && this.isPostgraduateGroup(group)) {
      return 'Posgrados';
    }

    if (group.modality === 'Escolarizado' && !this.isHealthGroup(group)) {
      return 'Escolarizado';
    }

    if (group.modality === 'Ejecutivo' || group.modality === 'Virtual') {
      return group.modality;
    }

    return null;
  }

  private isSpecialGroup(group: AcademicGroup): boolean {
    const section = this.normalizeSearchText(group.section);
    const fullGroup = this.normalizeSearchText(group.fullGroup);

    return section.endsWith('c.a') || fullGroup.endsWith('c.a');
  }

  private isHealthGroup(group: AcademicGroup): boolean {
    const program = this.programForGroup(group);
    const searchText = this.normalizeSearchText([
      group.academicArea,
      program?.academicArea,
      program?.name,
      group.programName,
      group.programAbbreviation,
    ].join(' '));

    return searchText.includes('salud');
  }

  private isCampusTupGroup(group: AcademicGroup): boolean {
    const program = this.programForGroup(group);
    const academicArea = this.normalizeSearchText([
      group.academicArea,
      program?.academicArea,
    ].join(' '));

    return academicArea.includes('campus tup') || academicArea === 'campus';
  }

  private programForGroup(group: AcademicGroup) {
    return this.programs().find((program) => program.code === group.programAbbreviation) ?? null;
  }

  private hasStudentEnrollments(studentEnrollments?: string): boolean {
    return Boolean(studentEnrollments?.trim());
  }

  private normalizeSearchText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private selectedSubject(): Subject | null {
    return this.subjects().find((subject) => subject.subjectId === this.assignmentForm.subjectId) ?? null;
  }

  private selectedTeacher(): Teacher | null {
    return this.teachers().find((teacher) => teacher.moodleUser === this.assignmentForm.teacherMoodleUser) ?? null;
  }

  private hasValidTeacherSelection(): boolean {
    return this.assignmentForm.teacherMoodleUser === TEMPORARY_TEACHER_USER || this.selectedTeacher() !== null;
  }

  private selectedTeacherMoodleUser(): string {
    return this.assignmentForm.teacherMoodleUser === TEMPORARY_TEACHER_USER
      ? TEMPORARY_TEACHER_USER
      : this.selectedTeacher()?.moodleUser ?? '';
  }

  private selectedTeacherName(): string {
    return this.assignmentForm.teacherMoodleUser === TEMPORARY_TEACHER_USER
      ? TEMPORARY_TEACHER_NAME
      : this.selectedTeacher()?.fullName ?? '';
  }

  private actorData(): Pick<
    UpsertAssignmentPayload,
    'createdBy' | 'createdByName' | 'createdByRole' | 'createdByPrograms'
  > {
    const appUser = this.session()?.appUser;

    return {
      createdBy: appUser?.id ?? this.session()?.authUid ?? 'sin-usuario',
      createdByName: appUser?.name ?? this.session()?.displayName ?? 'Usuario SPAI',
      createdByRole: appUser?.role ?? 'Sin rol',
      createdByPrograms: appUser?.assignedPrograms ?? [],
    };
  }

  private normalizedStudentEnrollments(): string {
    return this.assignmentForm.studentEnrollments
      .split(/[\n,;]+/)
      .map((enrollment) => enrollment.trim().toUpperCase())
      .filter(Boolean)
      .join(', ');
  }

  private normalizeSharedGroupCount(value: number | string): number {
    const availableOptions = this.sharedGroupOptions().length;

    if (!availableOptions) {
      return 0;
    }

    const numericValue = Math.trunc(Number(value));
    const fallbackValue = Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 1;

    return Math.min(Math.max(fallbackValue, 1), availableOptions);
  }

  private syncSharedGroups(): void {
    const availableGroups = new Set(this.sharedGroupOptions().map((group) => group.fullGroup));

    this.assignmentForm.shareGroups = this.assignmentForm.shareGroups
      .filter((group) => group !== this.assignmentForm.group)
      .filter((group) => availableGroups.has(group))
      .slice(0, this.assignmentForm.sharedGroupCount);

    if (this.assignmentForm.shared) {
      this.assignmentForm.sharedGroupCount = this.normalizeSharedGroupCount(this.assignmentForm.sharedGroupCount);
    }
  }

  private prepareNextAssignmentForm(): void {
    this.editingAssignmentId = null;
    this.formErrors = [];
    this.assignmentForm = this.emptyForm(this.activeCycle()?.code ?? '', this.modeTab() === 'Especiales');
  }

  private notifySystemsAboutAssignmentMilestones(
    actor: Pick<UpsertAssignmentPayload, 'createdBy' | 'createdByName' | 'createdByRole' | 'createdByPrograms'>,
    cycle: string,
    createdAssignmentIds: string[],
  ): void {
    if (!this.isAcademicCoordinationRole(actor.createdByRole) || !createdAssignmentIds.length) {
      return;
    }

    const existingAssignmentsCount = this.assignments().filter((assignment) => {
      return assignment.cycle === cycle && assignment.createdBy === actor.createdBy;
    }).length;
    const previousCount = existingAssignmentsCount;
    const currentCount = existingAssignmentsCount + createdAssignmentIds.length;

    for (let milestone = 5; milestone <= currentCount; milestone += 5) {
      if (milestone <= previousCount) {
        continue;
      }

      const notificationId = [
        'asignaciones-hito',
        cycle,
        actor.createdBy,
        milestone,
      ]
        .join('-')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-');

      void this.systemNotificationsRepository.createOnce(notificationId, {
        title: `Hito de ${milestone} asignaciones`,
        message: `La coordinacion academica correspondiente a ${actor.createdByName} ya lleva ${milestone} asignaciones en el ciclo ${cycle}.`,
        type: 'ASIGNACIONES_HITO',
        entity: 'asignaciones',
        entityId: notificationId,
        actorId: actor.createdBy,
        actorName: actor.createdByName,
        actorRole: actor.createdByRole,
      });
    }
  }

  private notifySystemsAboutSharedClass(
    actor: Pick<UpsertAssignmentPayload, 'createdBy' | 'createdByName' | 'createdByRole' | 'createdByPrograms'>,
    sharedAssignmentId: string,
    cycle: string,
    subjectId: string,
    subjectName: string,
    sourceGroup: string,
    destinationGroup: string,
    teacherName: string,
  ): void {
    const notificationId = [
      'clase-compartida',
      cycle,
      sharedAssignmentId,
    ]
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-');

    void this.systemNotificationsRepository.createOnce(notificationId, {
      title: 'Clase compartida asignada',
      message: `${actor.createdByName} asigno la clase compartida ${subjectId} - ${subjectName} de ${sourceGroup} con ${destinationGroup}, docente ${teacherName}, ciclo ${cycle}.`,
      type: 'CLASE_COMPARTIDA',
      entity: 'asignaciones',
      entityId: sharedAssignmentId,
      actorId: actor.createdBy,
      actorName: actor.createdByName,
      actorRole: actor.createdByRole,
    });
  }

  private emptyForm(cycle = '', special = false): AssignmentFormState {
    return {
      cycle,
      program: '',
      group: '',
      subjectId: '',
      moodleId: '',
      teacherMoodleUser: '',
      status: 'EN_CAPTURA',
      observations: '',
      shared: false,
      sourceAssignmentId: '',
      sharedGroupCount: 0,
      shareGroups: [],
      special,
      studentEnrollments: '',
    };
  }
}
