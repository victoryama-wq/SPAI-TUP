import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
type AssignmentComboField = 'subject' | 'teacher' | 'group';
type AssignmentCatalogScope = 'OWN' | 'GLOBAL';

const TEMPORARY_TEACHER_USER = 'temporalmente_sin_docente';
const TEMPORARY_TEACHER_NAME = 'TEMPORALMENTE SIN DOCENTE';
const MAX_SHARED_GROUPS = 8;
const MAX_COMBO_OPTIONS = 8;
const MAX_SEARCH_SUGGESTIONS = 8;

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

interface TeacherPickerOption {
  moodleUser: string;
  label: string;
  note: string;
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
  private readonly subjectsRepository = inject(SubjectsRepository);
  private readonly systemNotificationsRepository = inject(SystemNotificationsRepository);
  private readonly teachersRepository = inject(TeachersRepository);
  private readonly userSessionService = inject(UserSessionService);

  readonly assignments = this.assignmentsRepository.assignments;
  readonly assignmentsReadError = this.assignmentsRepository.readError;
  readonly cycles = this.cyclesRepository.cycles;
  readonly groups = this.groupsRepository.groups;
  readonly programs = this.programsRepository.programs;
  readonly subjects = this.subjectsRepository.subjects;
  readonly subjectsReadError = this.subjectsRepository.readError;
  readonly teachers = this.teachersRepository.teachers;
  readonly session = this.userSessionService.session;

  statusFilter = signal<AssignmentStatusFilter>('TODOS');
  searchField = signal<AssignmentSearchField>('program');
  searchQuery = signal('');
  catalogScope = signal<AssignmentCatalogScope>('OWN');
  shareGroupSearch = signal('');
  modeTab = signal<AssignmentModeTab>('Escolarizado');
  formMessage = '';
  formErrors: string[] = [];
  isAssignmentModalOpen = false;
  editingAssignmentId: string | null = null;
  isReadinessAlertVisible = signal(true);
  subjectPickerValue = '';
  teacherPickerValue = '';
  groupPickerValue = '';
  activeComboField: AssignmentComboField | null = null;
  isSearchMenuOpen = false;

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

  readonly assignedProgramCodes = computed(() => {
    const appUser = this.session()?.appUser;

    return new Set(
      (appUser?.assignedPrograms ?? [])
        .map((program) => program.trim().toUpperCase())
        .filter(Boolean),
    );
  });

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
      .filter((subject) => this.isActiveSubject(subject))
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
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

    if (!activeCycle || !this.canViewAssignments()) {
      return [];
    }

    const programs = new Set(
      this.groups()
        .filter((group) => {
          return group.cycleCode === activeCycle.code
            && this.groupMatchesCatalogScope(group)
            && this.groupMatchesModeTab(group, this.modeTab());
        })
        .map((group) => group.programAbbreviation),
    );

    this.assignments()
      .filter((assignment) => {
        return assignment.cycle === activeCycle.code
          && this.assignmentMatchesCatalogScope(assignment)
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
          && this.groupMatchesCatalogScope(group)
          && this.groupMatchesModeTab(group, this.modeTab());
      })
      .sort((a, b) => a.fullGroup.localeCompare(b.fullGroup, 'es'));
  });

  readonly destinationGroupOptions = computed(() => {
    const activeCycle = this.activeCycle();

    if (!activeCycle) {
      return [];
    }

    return this.groups()
      .filter((group) => {
        const allowedProgram = this.canSeeAllAssignments()
          || this.isAssignedProgram(group.programAbbreviation);

        return group.status === 'Activo'
          && group.cycleCode === activeCycle.code
          && allowedProgram
          && this.groupMatchesModeTab(group, this.modeTab());
      })
      .sort((a, b) => a.fullGroup.localeCompare(b.fullGroup, 'es'));
  });

  sharedGroupOptions(): AcademicGroup[] {
    return this.destinationGroupOptions().filter((group) => group.fullGroup !== this.assignmentForm.group);
  }

  sharedGroupCountOptions(): number[] {
    return Array.from({ length: Math.min(this.sharedGroupOptions().length, MAX_SHARED_GROUPS) }, (_, index) => index + 1);
  }

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

  readonly catalogAssignmentsForActiveCycle = computed(() => {
    const activeCycle = this.activeCycle();

    if (!activeCycle || !this.canViewAssignments()) {
      return [];
    }

    return this.assignments().filter((assignment) => {
      return !this.isAssignmentDeleted(assignment)
        && assignment.cycle === activeCycle.code
        && this.assignmentMatchesCatalogScope(assignment);
    });
  });

  readonly assignmentsForCurrentTab = computed(() =>
    this.catalogAssignmentsForActiveCycle()
      .filter((assignment) => this.assignmentMode(assignment) === this.modeTab()),
  );

  readonly visibleAssignments = computed(() =>
    this.assignmentsForCurrentTab().filter((assignment) => {
      return this.assignmentStatusMatchesFilter(assignment)
        && this.assignmentMatchesSearch(assignment);
    }),
  );

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
      const allowedOrigin = this.canSeeAllAssignments()
        || this.wasAssignmentCreatedByCurrentUser(assignment);

      return !this.isAssignmentDeleted(assignment)
        && assignment.id !== this.editingAssignmentId
        && assignment.cycle === this.assignmentForm.cycle
        && allowedOrigin
        && !assignment.shared
        && !assignment.special;
    }).sort((a, b) => a.group.localeCompare(b.group, 'es')),
  );

  readonly captureCount = computed(
    () => this.visibleAssignments().filter((assignment) => assignment.status === 'EN_CAPTURA').length,
  );
  readonly reviewCount = computed(
    () => this.visibleAssignments().filter((assignment) => this.normalizedAssignmentStatus(assignment.status) === 'EN_REVISION').length,
  );
  readonly moodleLoadedCount = computed(
    () => this.visibleAssignments().filter((assignment) => this.normalizedAssignmentStatus(assignment.status) === 'CARGADO_MOODLE').length,
  );

  readonly nextAssignmentAction = computed(() => {
    if (this.reviewCount() > 0) {
      return 'Hay asignaciones en revision listas para seguimiento desde el panel Moodle.';
    }

    if (this.captureCount() > 0) {
      return 'Hay asignaciones en captura; confirma ID Moodle, materia, docente y grupo antes de enviarlas a revision.';
    }

    if (this.moodleLoadedCount() > 0) {
      return 'Hay asignaciones cargadas en Moodle; revisa el panel Moodle para dar seguimiento operativo.';
    }

    return 'No hay asignaciones pendientes en la vista actual.';
  });

  readonly emptyAssignmentsTitle = computed(() => {
    if (!this.canViewAssignments()) {
      return 'Sin permisos para consultar asignaciones';
    }

    if (!this.activeCycle()) {
      return 'Sin ciclo activo';
    }

    if (!this.catalogAssignmentsForActiveCycle().length) {
      return this.isGlobalCatalogVisible()
        ? 'Sin asignaciones en el catalogo global'
        : 'Sin asignaciones propias';
    }

    if (!this.assignmentsForCurrentTab().length) {
      return 'Sin asignaciones en esta pestana';
    }

    return 'Sin coincidencias con los filtros';
  });

  readonly emptyAssignmentsMessage = computed(() => {
    const activeCycleCode = this.activeCycleCode();

    if (!this.canViewAssignments()) {
      return 'Tu usuario no tiene permiso activo para consultar el modulo Asignaciones.';
    }

    if (!this.activeCycle()) {
      return 'Configura un ciclo activo para consultar asignaciones operativas.';
    }

    if (!this.catalogAssignmentsForActiveCycle().length) {
      return this.isGlobalCatalogVisible()
        ? `No hay asignaciones registradas en el ciclo ${activeCycleCode}.`
        : `No hay asignaciones propias en el ciclo ${activeCycleCode}. Activa Catalogo global para consultar las demas coordinaciones.`;
    }

    if (!this.assignmentsForCurrentTab().length) {
      return `Hay ${this.catalogAssignmentsForActiveCycle().length} asignacion(es) del ciclo ${activeCycleCode} en ${this.isGlobalCatalogVisible() ? 'Catalogo global' : 'Mis programas'}, pero ninguna corresponde a la pestana ${this.modeTab()}.`;
    }

    return `Hay ${this.assignmentsForCurrentTab().length} asignacion(es) en ${this.modeTab()}, pero ninguna coincide con el estado o la busqueda actual.`;
  });

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
    this.shareGroupSearch.set('');
    this.activeComboField = null;
    this.assignmentForm = this.emptyForm(activeCycle?.code ?? '', this.modeTab() === 'Especiales');
    this.syncPickerInputsFromForm();
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
    this.shareGroupSearch.set('');
    this.activeComboField = null;
    const sourceAssignment = assignment.shared ? this.assignmentById(assignment.sourceAssignmentId) : null;
    this.assignmentForm = {
      cycle: assignment.cycle,
      program: assignment.program,
      group: sourceAssignment?.group ?? assignment.group,
      subjectId: assignment.subjectId,
      moodleId: assignment.moodleId,
      teacherMoodleUser: assignment.teacherMoodleUser,
      status: 'EN_CAPTURA',
      observations: assignment.observations,
      shared: assignment.shared,
      sourceAssignmentId: assignment.sourceAssignmentId,
      sharedGroupCount: assignment.shared ? 1 : 0,
      shareGroups: assignment.shared ? [assignment.group] : [],
      special: assignment.special ?? false,
      studentEnrollments: assignment.studentEnrollments ?? '',
    };
    this.syncPickerInputsFromForm();
    this.isAssignmentModalOpen = true;
  }

  async deleteAssignment(assignment: AcademicAssignment): Promise<void> {
    if (!this.canDeleteAssignment(assignment)) {
      return;
    }

    const assignmentsToDelete = this.assignmentsToDelete(assignment);
    const relatedCount = assignmentsToDelete.length;
    const confirmed = await this.confirmationDialogService.confirm({
      title: relatedCount > 1 ? 'Eliminar clase compartida' : 'Eliminar asignacion',
      message: relatedCount > 1
        ? `Esta asignacion tiene ${relatedCount - 1} grupo(s) compartido(s). Se eliminaran ${relatedCount} registros relacionados.`
        : `Se eliminara la asignacion ${assignment.moodleId} para ${assignment.special ? 'caso especial' : assignment.group}.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    const actor = this.actorData();

    try {
      await this.assignmentsRepository.deleteAssignments(
        assignmentsToDelete.map((item) => item.id),
        {
          deletedBy: actor.createdBy,
          deletedByName: actor.createdByName,
          deletedByRole: actor.createdByRole,
        },
      );
      this.formMessage = relatedCount > 1
        ? `${relatedCount} asignaciones relacionadas eliminadas correctamente.`
        : 'Asignacion eliminada correctamente.';
      this.formErrors = [];

      await this.auditLogRepository.register({
        module: 'Asignaciones',
        action: relatedCount > 1 ? 'ASIGNACIONES_COMPARTIDAS_ELIMINADAS' : 'ASIGNACION_ELIMINADA',
        description: relatedCount > 1
          ? `Se eliminaron ${relatedCount} asignaciones relacionadas con una clase compartida.`
          : `Se elimino la asignacion ${assignment.moodleId} para ${assignment.special ? 'caso especial' : assignment.group}.`,
        user: actor.createdByName,
        userRole: actor.createdByRole,
        entity: 'asignaciones',
        entityId: assignment.id,
        metadata: {
          deletedAssignmentIds: assignmentsToDelete.map((item) => item.id),
          cycle: assignment.cycle,
          moodleId: assignment.moodleId,
          shared: this.isSharedInTable(assignment),
        },
      });
    } catch (error) {
      console.error('No se pudo eliminar la asignacion', error);
      this.formMessage = '';
      this.formErrors = ['No se pudo eliminar la asignacion. Revisa permisos e intenta de nuevo.'];
    }
  }

  closeAssignmentModal(): void {
    this.isAssignmentModalOpen = false;
    this.editingAssignmentId = null;
    this.formErrors = [];
    this.shareGroupSearch.set('');
    this.activeComboField = null;
    this.assignmentForm = this.emptyForm(this.activeCycle()?.code ?? '', this.modeTab() === 'Especiales');
    this.syncPickerInputsFromForm();
  }

  async saveAssignment(continueAdding = false): Promise<void> {
    this.formMessage = '';
    this.assignmentForm.status = 'EN_CAPTURA';
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

    try {
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
          status: 'EN_CAPTURA',
          observations: this.assignmentForm.observations,
          shared: true,
          sourceAssignmentId: this.assignmentForm.sourceAssignmentId,
          special: false,
          studentEnrollments: this.normalizedStudentEnrollments(),
          ...actor,
        };
        const sharedAssignmentId = await this.assignmentsRepository.upsertAssignment(sharedEditPayload);

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
        status: 'EN_CAPTURA',
        observations: this.assignmentForm.observations,
        shared: false,
        sourceAssignmentId: this.assignmentForm.sourceAssignmentId,
        special: this.assignmentForm.special,
        studentEnrollments: this.normalizedStudentEnrollments(),
        ...actor,
      };
      const assignmentId = await this.assignmentsRepository.upsertAssignment(basePayload);
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
          const sharedAssignmentId = await this.assignmentsRepository.upsertAssignment(sharedPayload);
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
    } catch (error) {
      console.error('No se pudo guardar la asignacion', error);
      this.formMessage = '';
      this.formErrors = [`No se pudo guardar la asignacion. ${this.readFirebaseMessage(error)}`];
    }
  }

  selectSearchField(event: Event): void {
    this.searchField.set((event.target as HTMLSelectElement).value as AssignmentSearchField);
    this.searchQuery.set('');
    this.isSearchMenuOpen = false;
  }

  updateSearchQuery(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.isSearchMenuOpen = true;
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.isSearchMenuOpen = false;
  }

  selectPredictedSearch(value: string): void {
    this.searchQuery.set(value);
    this.isSearchMenuOpen = false;
  }

  selectStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as AssignmentStatusFilter);
  }

  selectModeTab(tab: AssignmentModeTab): void {
    this.modeTab.set(tab);
    this.searchQuery.set('');
    this.isSearchMenuOpen = false;
  }

  canToggleGlobalCatalog(): boolean {
    const appUser = this.session()?.appUser;

    return appUser?.status === 'Activo'
      && this.isAcademicCoordinationRole(appUser.role)
      && !this.canSeeAllAssignments();
  }

  isGlobalCatalogVisible(): boolean {
    return this.canSeeAllAssignments()
      || (this.canToggleGlobalCatalog() && this.catalogScope() === 'GLOBAL');
  }

  toggleCatalogScope(): void {
    this.catalogScope.update((scope) => scope === 'GLOBAL' ? 'OWN' : 'GLOBAL');
    this.searchQuery.set('');
    this.isSearchMenuOpen = false;
  }

  catalogScopeLabel(): string {
    if (this.canSeeAllAssignments()) {
      return 'Vista Sistemas - Catalogo global';
    }

    return this.catalogScope() === 'GLOBAL'
      ? 'Vista Coordinacion - Catalogo global'
      : 'Vista Coordinacion - Mis asignaciones';
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
    const query = this.searchQuery();
    const options = new Map<string, string>();
    const addOption = (value: string, searchableText = value): void => {
      if (!value) {
        return;
      }

      const currentSearchableText = options.get(value);
      options.set(value, currentSearchableText ? `${currentSearchableText} ${searchableText}` : searchableText);
    };
    const scopedAssignments = this.assignments().filter((assignment) => {
      const matchesStatus = this.assignmentStatusMatchesFilter(assignment);

      return !this.isAssignmentDeleted(assignment)
        && this.assignmentInCurrentScope(assignment)
        && matchesStatus;
    });

    if (this.searchField() === 'program') {
      this.visibleProgramCodes().forEach((program) => addOption(program));
    }

    if (this.searchField() === 'group') {
      this.tableGroupOptions().forEach((group) => addOption(group.fullGroup, `${group.fullGroup} ${group.programName}`));
      scopedAssignments
        .filter((assignment) => assignment.group)
        .forEach((assignment) => addOption(assignment.group, `${assignment.group} ${assignment.program}`));
    }

    if (this.searchField() === 'teacher') {
      scopedAssignments
        .forEach((assignment) => addOption(`${assignment.teacherName} - ${assignment.teacherMoodleUser}`));
      this.validatedTeachers()
        .forEach((teacher) => addOption(`${teacher.fullName} - ${teacher.moodleUser}`));
      addOption('TEMPORALMENTE SIN DOCENTE - temporalmente_sin_docente');
    }

    if (this.searchField() === 'subject') {
      scopedAssignments
        .forEach((assignment) => addOption(
          assignment.subjectName,
          `${assignment.subjectId} ${assignment.subjectName}`,
        ));
      this.activeSubjects()
        .forEach((subject) => addOption(subject.name, `${subject.subjectId} ${subject.name}`));
    }

    return Array.from(options.entries())
      .filter(([, searchableText]) => this.matchesSearchText(searchableText, query))
      .sort(([firstOption], [secondOption]) => firstOption.localeCompare(secondOption, 'es'))
      .map(([option]) => option)
      .slice(0, 30);
  }

  visibleSearchSuggestions(): string[] {
    const query = this.normalizeSearch(this.searchQuery());

    if (query.length < 2) {
      return [];
    }

    return this.searchSuggestions()
      .filter((option) => this.normalizeSearch(option) !== query)
      .slice(0, MAX_SEARCH_SUGGESTIONS);
  }

  openSearchSuggestions(): void {
    this.isSearchMenuOpen = true;
  }

  closeSearchSuggestions(): void {
    this.isSearchMenuOpen = false;
  }

  shouldShowSearchSuggestions(): boolean {
    return this.isSearchMenuOpen && this.visibleSearchSuggestions().length > 0;
  }

  openCombo(field: AssignmentComboField): void {
    this.activeComboField = field;
  }

  toggleCombo(field: AssignmentComboField): void {
    this.activeComboField = this.activeComboField === field ? null : field;
  }

  closeCombo(field: AssignmentComboField): void {
    if (this.activeComboField === field) {
      this.activeComboField = null;
    }
  }

  isComboOpen(field: AssignmentComboField): boolean {
    return this.activeComboField === field;
  }

  subjectPickerLabel(subject: Subject): string {
    return subject.name;
  }

  teacherPickerLabel(teacher: Teacher): string {
    return `${teacher.fullName} - ${teacher.moodleUser}`;
  }

  temporaryTeacherPickerLabel(): string {
    return `${TEMPORARY_TEACHER_NAME} - ${TEMPORARY_TEACHER_USER}`;
  }

  groupPickerLabel(group: AcademicGroup): string {
    return `${group.fullGroup} - ${group.programName}`;
  }

  visibleSubjectPickerOptions(): Subject[] {
    const query = this.normalizeSearch(this.subjectPickerValue);

    const subjects = query
      ? this.activeSubjects().filter((subject) => this.matchesSearchText(
          `${subject.name} ${subject.subjectId}`,
          query,
        ))
      : [...this.activeSubjects()].sort((firstSubject, secondSubject) => {
          const dateComparison = this.subjectTimestamp(secondSubject).localeCompare(this.subjectTimestamp(firstSubject));

          return dateComparison || firstSubject.name.localeCompare(secondSubject.name, 'es');
        });

    return subjects.slice(0, MAX_COMBO_OPTIONS);
  }

  visibleTeacherPickerOptions(): TeacherPickerOption[] {
    const query = this.normalizeSearch(this.teacherPickerValue);
    const options: TeacherPickerOption[] = [
      {
        moodleUser: TEMPORARY_TEACHER_USER,
        label: TEMPORARY_TEACHER_NAME,
        note: TEMPORARY_TEACHER_USER,
      },
      ...this.validatedTeachers().map((teacher) => ({
        moodleUser: teacher.moodleUser,
        label: teacher.fullName,
        note: teacher.moodleUser,
      })),
    ];

    return options
      .filter((option) => !query || this.matchesSearchText(
        `${option.label} ${option.note}`,
        query,
      ))
      .slice(0, MAX_COMBO_OPTIONS);
  }

  visibleGroupPickerOptions(): AcademicGroup[] {
    const query = this.normalizeSearch(this.groupPickerValue);

    return this.destinationGroupOptions()
      .filter((group) => !query || this.matchesSearchText(
        `${group.fullGroup} ${group.programAbbreviation} ${group.programName}`,
        query,
      ))
      .slice(0, MAX_COMBO_OPTIONS);
  }

  updateSubjectPicker(value: string): void {
    this.subjectPickerValue = value;
    this.openCombo('subject');
    const subject = this.subjectFromPickerValue(value);
    this.assignmentForm.subjectId = subject?.subjectId ?? '';
  }

  commitSubjectPicker(): void {
    const subject = this.subjectFromPickerValue(this.subjectPickerValue);
    this.assignmentForm.subjectId = subject?.subjectId ?? '';
    this.subjectPickerValue = subject ? this.subjectPickerLabel(subject) : this.subjectPickerValue;
    this.closeCombo('subject');
  }

  selectSubjectOption(subject: Subject): void {
    this.assignmentForm.subjectId = subject.subjectId;
    this.subjectPickerValue = this.subjectPickerLabel(subject);
    this.closeCombo('subject');
  }

  updateTeacherPicker(value: string): void {
    this.teacherPickerValue = value;
    this.openCombo('teacher');
    const teacherSelection = this.teacherFromPickerValue(value);
    this.assignmentForm.teacherMoodleUser = teacherSelection;
  }

  commitTeacherPicker(): void {
    const teacherSelection = this.teacherFromPickerValue(this.teacherPickerValue);
    this.assignmentForm.teacherMoodleUser = teacherSelection;
    this.teacherPickerValue = this.teacherPickerLabelFromUser(teacherSelection) || this.teacherPickerValue;
    this.closeCombo('teacher');
  }

  selectTeacherOption(option: TeacherPickerOption): void {
    this.assignmentForm.teacherMoodleUser = option.moodleUser;
    this.teacherPickerValue = this.teacherPickerLabelFromUser(option.moodleUser);
    this.closeCombo('teacher');
  }

  updateGroupPicker(value: string): void {
    this.groupPickerValue = value;
    this.openCombo('group');
    const group = this.groupFromPickerValue(value);
    this.assignmentForm.group = group?.fullGroup ?? '';
    this.onGroupChange();
  }

  commitGroupPicker(): void {
    const group = this.groupFromPickerValue(this.groupPickerValue);
    this.assignmentForm.group = group?.fullGroup ?? '';
    this.groupPickerValue = group ? this.groupPickerLabel(group) : this.groupPickerValue;
    this.onGroupChange();
    this.closeCombo('group');
  }

  selectGroupOption(group: AcademicGroup): void {
    this.assignmentForm.group = group.fullGroup;
    this.groupPickerValue = this.groupPickerLabel(group);
    this.onGroupChange();
    this.closeCombo('group');
  }

  onGroupChange(): void {
    const group = this.selectedGroup();
    this.assignmentForm.cycle = this.activeCycle()?.code ?? group?.cycleCode ?? this.assignmentForm.cycle;
    this.shareGroupSearch.set('');

    this.syncSharedGroups();
  }

  onSharedChange(): void {
    this.shareGroupSearch.set('');

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
      this.shareGroupSearch.set('');
      this.groupPickerValue = '';
      this.activeComboField = null;
      return;
    }

    this.assignmentForm.program = '';
  }

  onSharedGroupCountChange(value: number | string): void {
    this.assignmentForm.sharedGroupCount = this.normalizeSharedGroupCount(value);
    this.syncSharedGroups();
  }

  updateShareGroupSearch(value: string): void {
    this.shareGroupSearch.set(value);
  }

  clearShareGroupSearch(): void {
    this.shareGroupSearch.set('');
  }

  visibleSharedGroupOptions(): AcademicGroup[] {
    const query = this.normalizeSearch(this.shareGroupSearch());
    const selectedGroups = new Set(this.assignmentForm.shareGroups);
    const selectedOptions = this.sharedGroupOptions()
      .filter((group) => selectedGroups.has(group.fullGroup));

    if (query.length < 2) {
      return selectedOptions.slice(0, MAX_SHARED_GROUPS);
    }

    const matchingOptions = this.sharedGroupOptions()
      .filter((group) => !selectedGroups.has(group.fullGroup))
      .filter((group) => this.matchesSearchText(
        `${group.fullGroup} ${group.programAbbreviation} ${group.programName}`,
        query,
      ));

    return [...selectedOptions, ...matchingOptions].slice(0, MAX_SHARED_GROUPS);
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
    const source = this.assignmentById(this.assignmentForm.sourceAssignmentId);

    if (!source) {
      return;
    }

    this.assignmentForm.moodleId = source.moodleId;
    this.assignmentForm.teacherMoodleUser = source.teacherMoodleUser;
    this.assignmentForm.subjectId = source.subjectId;
    this.syncPickerInputsFromForm();
  }

  statusClass(status: AssignmentStatus): string {
    return this.normalizedAssignmentStatus(status).toLowerCase();
  }

  isAssignmentDeleted(assignment: AcademicAssignment): boolean {
    return Boolean(assignment.deletedAt);
  }

  statusLabel(status: AssignmentStatus): string {
    const labels: Record<AssignmentStatus, string> = {
      EN_CAPTURA: 'En captura',
      EN_REVISION: 'En revision',
      CARGADO_MOODLE: 'Cargado en Moodle',
      VALIDADO: 'Cargado en Moodle',
      CON_OBSERVACION: 'En revision',
    };

    return labels[status];
  }

  assignmentById(id: string): AcademicAssignment | null {
    return this.assignments().find((assignment) => assignment.id === id && !this.isAssignmentDeleted(assignment)) ?? null;
  }

  isSharedInTable(assignment: AcademicAssignment): boolean {
    return assignment.shared || this.sharedDestinationAssignments(assignment).length > 0;
  }

  sharedAssignmentDetails(assignment: AcademicAssignment): string {
    const baseId = this.sharedBaseAssignmentId(assignment);
    const baseAssignment = this.assignmentById(baseId);
    const baseGroup = baseAssignment?.group || (!assignment.shared ? assignment.group : 'origen no identificado');
    const destinationGroups = this.sharedDestinationAssignments(assignment)
      .map((item) => item.group)
      .filter(Boolean);

    if (!destinationGroups.length) {
      return `Clase compartida. Grupo base: ${baseGroup}.`;
    }

    return `Grupo base: ${baseGroup}. Comparte con: ${destinationGroups.join(', ')}.`;
  }

  async showSharedAssignmentDetails(assignment: AcademicAssignment): Promise<void> {
    await this.confirmationDialogService.alert({
      title: 'Clase compartida',
      message: this.sharedAssignmentDetails(assignment),
    });
  }

  canEditAssignment(assignment: AcademicAssignment): boolean {
    const allowedAssignment = this.canSeeAllAssignments()
      || this.wasAssignmentCreatedByCurrentUser(assignment);

    return allowedAssignment && this.normalizedAssignmentStatus(assignment.status) === 'EN_CAPTURA';
  }

  canDeleteAssignment(assignment: AcademicAssignment): boolean {
    if (!this.canManageAssignments()) {
      return false;
    }

    if (this.canSeeAllAssignments()) {
      return true;
    }

    return this.assignmentsToDelete(assignment)
      .every((item) => this.wasAssignmentCreatedByCurrentUser(item));
  }

  private sharedBaseAssignmentId(assignment: AcademicAssignment): string {
    return assignment.shared && assignment.sourceAssignmentId
      ? assignment.sourceAssignmentId
      : assignment.id;
  }

  private sharedDestinationAssignments(assignment: AcademicAssignment): AcademicAssignment[] {
    const baseId = this.sharedBaseAssignmentId(assignment);

    return this.assignments()
      .filter((item) => !this.isAssignmentDeleted(item) && item.shared && item.sourceAssignmentId === baseId)
      .sort((a, b) => a.group.localeCompare(b.group, 'es'));
  }

  private assignmentsToDelete(assignment: AcademicAssignment): AcademicAssignment[] {
    if (assignment.shared) {
      return [assignment];
    }

    const sharedDestinations = this.sharedDestinationAssignments(assignment);

    return sharedDestinations.length ? [assignment, ...sharedDestinations] : [assignment];
  }

  private wasAssignmentCreatedByCurrentUser(assignment: AcademicAssignment): boolean {
    const session = this.session();
    const appUser = session?.appUser;
    const currentUserIds = new Set([
      session?.authUid,
      appUser?.id,
      appUser?.authUid,
    ].filter((value): value is string => Boolean(value)));

    return currentUserIds.has(assignment.createdBy);
  }

  private assignmentStatusMatchesFilter(assignment: AcademicAssignment): boolean {
    const statusFilter = this.statusFilter();

    return statusFilter === 'TODOS'
      || this.normalizedAssignmentStatus(assignment.status) === statusFilter;
  }

  private normalizedAssignmentStatus(status: AssignmentStatus): Exclude<AssignmentStatus, 'VALIDADO' | 'CON_OBSERVACION'> {
    if (status === 'VALIDADO') {
      return 'CARGADO_MOODLE';
    }

    if (status === 'CON_OBSERVACION') {
      return 'EN_REVISION';
    }

    return status;
  }

  private countAssignmentsForTab(tab: AssignmentModeTab): number {
    return this.assignments().filter((assignment) => {
      const matchesStatus = this.assignmentStatusMatchesFilter(assignment);

      return !this.isAssignmentDeleted(assignment)
        && this.assignmentInCurrentScope(assignment, tab)
        && matchesStatus
        && this.assignmentMatchesSearch(assignment);
    }).length;
  }

  private assignmentInCurrentScope(assignment: AcademicAssignment, tab = this.modeTab()): boolean {
    const activeCycle = this.activeCycle();
    const matchesCycle = activeCycle ? assignment.cycle === activeCycle.code : false;
    const matchesTab = this.assignmentMode(assignment) === tab;

    return this.canViewAssignments()
      && matchesCycle
      && this.assignmentMatchesCatalogScope(assignment)
      && matchesTab;
  }

  private assignmentMatchesCatalogScope(assignment: AcademicAssignment): boolean {
    return this.isGlobalCatalogVisible()
      || this.wasAssignmentCreatedByCurrentUser(assignment);
  }

  private groupMatchesCatalogScope(_group: AcademicGroup): boolean {
    return this.isGlobalCatalogVisible();
  }

  private isAssignedProgram(program: string): boolean {
    return this.assignedProgramCodes().has(program.trim().toUpperCase());
  }

  private assignmentMatchesSearch(assignment: AcademicAssignment): boolean {
    const query = this.searchQuery();

    if (!this.normalizeSearch(query)) {
      return true;
    }

    if (this.searchField() === 'program') {
      return this.matchesSearchText(assignment.program, query);
    }

    if (this.searchField() === 'group') {
      return this.matchesSearchText(assignment.group, query);
    }

    if (this.searchField() === 'teacher') {
      return this.matchesSearchText(`${assignment.teacherName} ${assignment.teacherMoodleUser}`, query);
    }

    return this.matchesSearchText(`${assignment.subjectId} ${assignment.subjectName}`, query);
  }

  private matchesSearchText(text: string, query: string): boolean {
    const normalizedText = this.normalizeSearch(text);
    const normalizedQuery = this.normalizeSearch(query);

    if (!normalizedQuery) {
      return true;
    }

    return normalizedText.includes(normalizedQuery)
      || normalizedQuery.split(' ').every((token) => normalizedText.includes(token));
  }

  private normalizeSearch(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private assignmentMode(assignment: AcademicAssignment): AssignmentModeTab {
    if (assignment.special || this.hasStudentEnrollments(assignment.studentEnrollments)) {
      return 'Especiales';
    }

    const group = this.groups().find((item) => item.fullGroup === assignment.group);

    if (group) {
      return this.groupMode(group) ?? this.assignmentModeFromStoredData(assignment);
    }

    return this.assignmentModeFromStoredData(assignment);
  }

  private assignmentModeFromStoredData(assignment: AcademicAssignment): AssignmentModeTab {
    const normalizedGroup = this.normalizeSearchText(assignment.group);
    const program = this.programForAssignment(assignment);
    const normalizedProgram = this.normalizeSearchText([
      assignment.program,
      program?.name,
      program?.academicArea,
      program?.programType,
      program?.modality,
    ].join(' '));

    if (!normalizedGroup || normalizedGroup.endsWith('c.a') || normalizedGroup.endsWith('c a')) {
      return 'Especiales';
    }

    if (normalizedProgram.includes('facultad de ciencias de la salud') || normalizedProgram.includes('salud')) {
      return 'Salud';
    }

    if (normalizedProgram.includes('maestria')
      || normalizedProgram.includes('especialidad')
      || normalizedProgram.includes('doctorado')
      || normalizedProgram.includes('posgrado')) {
      return 'Posgrados';
    }

    const groupCode = this.assignmentGroupCode(assignment.group);

    if (groupCode === '53') {
      return 'Virtual';
    }

    if (groupCode === '23' || groupCode === '24') {
      return 'Ejecutivo';
    }

    return 'Escolarizado';
  }

  private assignmentGroupCode(group: string): string {
    const match = group.trim().toUpperCase().match(/\s(11|12|23|24|53)\s/);

    return match?.[1] ?? '';
  }

  private readFirebaseMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
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
        this.assignmentForm.subjectId,
        this.editingAssignmentId,
      )) {
      errors.push('El ID Moodle ya existe para esta materia en este ciclo. Marca clase compartida si corresponde.');
    }

    if (this.assignmentForm.shared) {
      const source = this.assignmentById(this.assignmentForm.sourceAssignmentId);
      if (source && source.normalizedMoodleId !== moodleId) {
        errors.push('La asignacion compartida debe conservar el mismo ID asignatura que la asignacion origen.');
      }
    }

    return errors;
  }

  private selectedGroup(): AcademicGroup | null {
    return this.groups().find((group) => group.fullGroup === this.assignmentForm.group) ?? null;
  }

  private syncPickerInputsFromForm(): void {
    this.subjectPickerValue = this.subjectPickerLabelFromId(this.assignmentForm.subjectId);
    this.teacherPickerValue = this.teacherPickerLabelFromUser(this.assignmentForm.teacherMoodleUser);
    this.groupPickerValue = this.groupPickerLabelFromFullGroup(this.assignmentForm.group);
  }

  private subjectPickerLabelFromId(subjectId: string): string {
    const subject = this.subjects().find((item) => item.subjectId === subjectId);

    return subject ? this.subjectPickerLabel(subject) : '';
  }

  private teacherPickerLabelFromUser(moodleUser: string): string {
    if (moodleUser === TEMPORARY_TEACHER_USER) {
      return this.temporaryTeacherPickerLabel();
    }

    const teacher = this.teachers().find((item) => item.moodleUser === moodleUser);

    return teacher ? this.teacherPickerLabel(teacher) : '';
  }

  private groupPickerLabelFromFullGroup(fullGroup: string): string {
    const group = this.groups().find((item) => item.fullGroup === fullGroup);

    return group ? this.groupPickerLabel(group) : '';
  }

  private subjectFromPickerValue(value: string): Subject | null {
    const normalizedValue = this.normalizeSearch(value);

    if (!normalizedValue) {
      return null;
    }

    return this.activeSubjects().find((subject) => {
      return [
        this.subjectPickerLabel(subject),
        subject.name,
        subject.subjectId,
      ].some((option) => this.normalizeSearch(option) === normalizedValue);
    }) ?? null;
  }

  private isActiveSubject(subject: Subject): boolean {
    const normalizedStatus = this.normalizeSearch(String(subject.status ?? ''));

    return ['activo', 'activa', 'active', 'si', 's', 'true', '1'].includes(normalizedStatus);
  }

  private subjectTimestamp(subject: Subject): string {
    return subject.updatedAt || subject.createdAt || '';
  }

  private teacherFromPickerValue(value: string): string {
    const normalizedValue = this.normalizeSearch(value);

    if (!normalizedValue) {
      return '';
    }

    if ([this.temporaryTeacherPickerLabel(), TEMPORARY_TEACHER_NAME, TEMPORARY_TEACHER_USER]
      .some((option) => this.normalizeSearch(option) === normalizedValue)) {
      return TEMPORARY_TEACHER_USER;
    }

    const teacher = this.validatedTeachers().find((item) => {
      return [
        this.teacherPickerLabel(item),
        item.fullName,
        item.moodleUser,
      ].some((option) => this.normalizeSearch(option) === normalizedValue);
    });

    return teacher?.moodleUser ?? '';
  }

  private groupFromPickerValue(value: string): AcademicGroup | null {
    const normalizedValue = this.normalizeSearch(value);

    if (!normalizedValue) {
      return null;
    }

    return this.destinationGroupOptions().find((group) => {
      return [
        this.groupPickerLabel(group),
        group.fullGroup,
        group.programName,
      ].some((option) => this.normalizeSearch(option) === normalizedValue);
    }) ?? null;
  }

  private selectedShareGroups(): AcademicGroup[] {
    return this.assignmentForm.shareGroups
      .map((fullGroup) => this.groups().find((group) => group.fullGroup === fullGroup) ?? null)
      .filter((group): group is AcademicGroup => group !== null);
  }

  private canUseDestinationProgram(program: string): boolean {
    const normalizedProgram = program.trim().toUpperCase();

    return this.canSeeAllAssignments()
      || this.isAssignedProgram(normalizedProgram);
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
    const academicArea = this.normalizeSearchText([
      group.academicArea,
      program?.academicArea,
    ].join(' '));

    return academicArea.includes('facultad de ciencias de la salud')
      || academicArea.includes('salud');
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

  private programForAssignment(assignment: AcademicAssignment) {
    return this.programs().find((program) => program.code === assignment.program) ?? null;
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
    const availableOptions = Math.min(this.sharedGroupOptions().length, MAX_SHARED_GROUPS);

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
    this.shareGroupSearch.set('');
    this.activeComboField = null;
    this.assignmentForm = this.emptyForm(this.activeCycle()?.code ?? '', this.modeTab() === 'Especiales');
    this.syncPickerInputsFromForm();
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
      return !this.isAssignmentDeleted(assignment)
        && assignment.cycle === cycle
        && assignment.createdBy === actor.createdBy;
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
