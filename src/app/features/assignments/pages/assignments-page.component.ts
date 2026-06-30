import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserSessionService } from '../../../core/auth/user-session.service';
import { AuditLogRepository } from '../../../core/data/audit-log.repository';
import { SystemNotificationsRepository } from '../../../core/data/system-notifications.repository';
import { ConfirmationDialogService } from '../../../shared/confirmation/confirmation-dialog.service';
import { AcademicGroup, GroupsRepository } from '../../groups/data/groups.repository';
import { NomenclaturesRepository } from '../../nomenclatures/data/nomenclatures.repository';
import { ProgramsRepository } from '../../nomenclatures/data/programs.repository';
import { Subject, SubjectsRepository } from '../../subjects/data/subjects.repository';
import { Teacher, TeachersRepository } from '../../teachers/data/teachers.repository';
import { CyclesRepository } from '../../cycles/data/cycles.repository';
import {
  AcademicAssignment,
  AssignmentStatus,
  AssignmentType,
  AssignmentsRepository,
  UpsertAssignmentPayload,
} from '../data/assignments.repository';

type AssignmentStatusFilter = AssignmentStatus | 'TODOS';
type AssignmentModeTab = 'Escolarizado' | 'Ejecutivo' | 'Virtual' | 'Salud' | 'Posgrados' | 'Especiales' | 'Inglés';
type AssignmentSearchField = 'program' | 'group' | 'teacher' | 'subject';
type AssignmentComboField = 'subject' | 'teacher' | 'group';
type AssignmentCatalogScope = 'OWN' | 'GLOBAL';
type SpecialAssignmentOption = 'enrollments' | 'group' | 'propedeutic';

const TEMPORARY_TEACHER_USER = 'temporalmente_sin_docente';
const TEMPORARY_TEACHER_NAME = 'TEMPORALMENTE SIN DOCENTE';
const PROPEDEUTIC_MOODLE_ID = 'propedeutico';
const PROPEDEUTIC_MOODLE_LABEL = 'Propedeutico';
const MAX_SHARED_GROUPS = 8;
const MAX_COMBO_OPTIONS = 8;
const MAX_SEARCH_SUGGESTIONS = 8;
const HEALTH_PROGRAM_CODES = new Set(['ENF', 'NUT', 'PSIC', 'EECI', 'EEQX', 'MADH']);
const ENGLISH_PROGRAM_CODES = new Set(['ING', 'ING-FCS', 'INGLES', 'IDIOMAS', 'IDIOMA']);
const HEALTH_TEXT_MARKERS = [
  'facultad de ciencias de la salud',
  'ciencias de la salud',
  'salud',
  'enfermer',
  'nutric',
  'psicolog',
  'hospital',
  'quirurg',
  'odontolog',
  'medic',
  'clinica',
  'cuidados intensivos',
];
const ACTIVE_TEXT_MARKERS = ['activo', 'activa', 'active', 'si', 's', 'true', '1'];
const POSTGRADUATE_TEXT_MARKERS = [
  'maestria',
  'especialidad',
  'especializacion',
  'doctorado',
  'posgrado',
  'postgrado',
  'master',
];
const ENGLISH_TEXT_MARKERS = ['ingles', 'idioma ingles', 'lengua inglesa', 'english'];

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
  specialType: SpecialAssignmentOption;
  propedeutic: boolean;
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
export class AssignmentsPageComponent implements OnDestroy {
  private readonly assignmentsRepository = inject(AssignmentsRepository);
  private readonly auditLogRepository = inject(AuditLogRepository);
  private readonly cyclesRepository = inject(CyclesRepository);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly groupsRepository = inject(GroupsRepository);
  private readonly nomenclaturesRepository = inject(NomenclaturesRepository);
  private readonly programsRepository = inject(ProgramsRepository);
  private readonly subjectsRepository = inject(SubjectsRepository);
  private readonly systemNotificationsRepository = inject(SystemNotificationsRepository);
  private readonly teachersRepository = inject(TeachersRepository);
  private readonly userSessionService = inject(UserSessionService);

  readonly assignments = this.assignmentsRepository.assignments;
  readonly assignmentsReadError = this.assignmentsRepository.readError;
  readonly cycles = this.cyclesRepository.cycles;
  readonly groups = this.groupsRepository.groups;
  readonly nomenclatures = this.nomenclaturesRepository.nomenclatures;
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
  lockedShareGroups = signal<string[]>([]);
  subjectPickerValue = '';
  teacherPickerValue = '';
  groupPickerValue = '';
  activeComboField: AssignmentComboField | null = null;
  isSearchMenuOpen = false;
  private formMessageTimeout: ReturnType<typeof setTimeout> | null = null;

  assignmentForm = this.emptyForm();

  readonly activeCycle = this.cyclesRepository.activeCycle;

  readonly activeCycleCode = computed(() => this.activeCycle()?.code ?? 'Pendiente de configurar');

  ngOnDestroy(): void {
    this.clearFormMessageTimeout();
  }

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
    const programCodes = new Set<string>();

    (appUser?.assignedPrograms ?? [])
      .forEach((program) => this.programAliases(program).forEach((alias) => programCodes.add(alias)));

    this.programs()
      .filter((program) => this.coordinatorMatchesCurrentUser(program.coordinator))
      .forEach((program) => this.programAliases(program.code).forEach((alias) => programCodes.add(alias)));

    return programCodes;
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
      if (!this.isEnrollmentCaptureTab() && !this.destinationGroupOptions().length) {
        messages.push('No hay grupos activos disponibles para tus programas en el ciclo activo.');
      }

      if (this.isEnrollmentCaptureTab() && !this.destinationProgramOptions().length) {
        messages.push('No hay programas disponibles para capturar asignaciones por matricula.');
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
          return this.groupBelongsToCycle(group, activeCycle.code)
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
        return this.isActiveGroup(group)
          && this.groupBelongsToCycle(group, activeCycle.code)
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

        return this.isActiveGroup(group)
          && this.groupBelongsToCycle(group, activeCycle.code)
          && allowedProgram
          && this.groupMatchesModeTab(group, this.modeTab());
      })
      .sort((a, b) => a.fullGroup.localeCompare(b.fullGroup, 'es'));
  });

  sharedGroupOptions(): AcademicGroup[] {
    const activeCycle = this.activeCycle();
    const baseGroup = this.selectedGroup();

    if (!activeCycle) {
      return [];
    }

    return this.groups()
      .filter((group) => {
        return this.isActiveGroup(group)
          && this.groupBelongsToCycle(group, activeCycle.code)
          && this.groupMatchesModeTab(group, this.modeTab())
          && this.canUseSharedGroupOption(group)
          && !this.isSameOperationalGroup(group, baseGroup);
      })
      .sort((a, b) => a.fullGroup.localeCompare(b.fullGroup, 'es'));
  }

  sharedGroupCountOptions(): number[] {
    return Array.from({ length: Math.min(this.sharedGroupOptions().length, MAX_SHARED_GROUPS) }, (_, index) => index + 1);
  }

  readonly destinationProgramOptions = computed(() => {
    const tab = this.modeTab();
    const activePrograms = this.activeNomenclatureProgramOptions()
      .filter((program) => {
        const isEnglishProgram = this.isEnglishProgramCode(program);

        return tab === 'Inglés' ? isEnglishProgram : !isEnglishProgram;
      });

    if (this.canSeeAllAssignments()) {
      return activePrograms;
    }

    return activePrograms
      .filter((program) => this.isAssignedProgram(program));
  });

  private activeNomenclatureProgramOptions(): string[] {
    const programCodes = new Set<string>();

    this.nomenclatures()
      .filter((nomenclature) => nomenclature.status === 'ACTIVA')
      .forEach((nomenclature) => {
        const abbreviation = nomenclature.abbreviation.trim().toUpperCase();

        if (abbreviation) {
          programCodes.add(abbreviation);
        }
      });

    return Array.from(programCodes).sort((a, b) => a.localeCompare(b, 'es'));
  }

  readonly catalogAssignmentsForActiveCycle = computed(() => {
    const activeCycle = this.activeCycle();

    if (!activeCycle || !this.canViewAssignments()) {
      return [];
    }

    return this.assignments().filter((assignment) => {
      return !this.isAssignmentDeleted(assignment)
        && assignment.cycle === activeCycle.code
        && !this.shouldHideLegacySharedDestination(assignment)
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

  readonly reportAssignments = computed(() => {
    const activeCycle = this.activeCycle();

    if (!activeCycle || !this.canViewAssignments()) {
      return [];
    }

    return this.assignments()
      .filter((assignment) => {
        if (this.isAssignmentDeleted(assignment)
          || assignment.cycle !== activeCycle.code
          || this.shouldHideLegacySharedDestination(assignment)) {
          return false;
        }

        if (this.canSeeAllAssignments()) {
          return true;
        }

        return this.wasAssignmentLoadedByCurrentUser(assignment)
          || this.assignmentPrograms(assignment).some((program) => this.isAssignedProgram(program));
      })
      .sort((a, b) => {
        const programComparison = a.program.localeCompare(b.program, 'es');

        if (programComparison !== 0) {
          return programComparison;
        }

        return (a.group || a.subjectName).localeCompare(b.group || b.subjectName, 'es');
      });
  });

  readonly modeTabs = computed(() => {
    const tabs: AssignmentModeTab[] = ['Escolarizado', 'Ejecutivo', 'Virtual', 'Salud', 'Posgrados', 'Especiales', 'Inglés'];

    return tabs.map((tab) => ({
      label: tab,
      value: tab,
      count: this.countAssignmentsForTab(tab),
    }));
  });

  readonly sourceAssignmentOptions = computed(() =>
    this.assignments().filter((assignment) => {
      const allowedOrigin = this.canSeeAllAssignments()
        || this.canModifyAssignment(assignment);

      return !this.isAssignmentDeleted(assignment)
        && assignment.id !== this.editingAssignmentId
        && assignment.cycle === this.assignmentForm.cycle
        && allowedOrigin
        && !assignment.sourceAssignmentId
        && !this.isSpecialAssignment(assignment);
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
    this.lockedShareGroups.set([]);
    this.activeComboField = null;
    this.assignmentForm = this.emptyForm(activeCycle?.code ?? '', this.isEnrollmentCaptureTab());
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
    const sharedGroups = this.assignmentSharedGroups(assignment);
    this.lockedShareGroups.set(this.lockedSharedGroupsForAssignment(assignment, sharedGroups));
    this.assignmentForm = {
      cycle: assignment.cycle,
      program: assignment.program,
      group: assignment.group,
      subjectId: assignment.subjectId,
      moodleId: assignment.moodleId,
      teacherMoodleUser: assignment.teacherMoodleUser,
      status: 'EN_CAPTURA',
      observations: assignment.observations,
      shared: sharedGroups.length > 0,
      sourceAssignmentId: '',
      sharedGroupCount: sharedGroups.length,
      shareGroups: sharedGroups,
      special: this.isSpecialAssignment(assignment),
      specialType: this.specialTypeForAssignment(assignment),
      propedeutic: this.isPropedeuticAssignment(assignment),
      studentEnrollments: assignment.studentEnrollments ?? '',
    };
    this.applyPropedeuticMoodleId();
    this.syncPickerInputsFromForm();
    this.isAssignmentModalOpen = true;
  }

  async deleteAssignment(assignment: AcademicAssignment): Promise<void> {
    if (!this.canDeleteAssignment(assignment)) {
      return;
    }

    if (this.isSharedFromAnotherCoordination(assignment)) {
      await this.removeSharedParticipation(assignment);
      return;
    }

    const assignmentsToDelete = this.assignmentsToDelete(assignment);
    const relatedCount = assignmentsToDelete.length;
    const confirmed = await this.confirmationDialogService.confirm({
      title: relatedCount > 1 ? 'Eliminar clase compartida' : 'Eliminar asignacion',
      message: relatedCount > 1
        ? `Esta asignacion tiene ${relatedCount - 1} grupo(s) compartido(s). Se eliminaran ${relatedCount} registros relacionados.`
        : `Se eliminara la asignacion ${assignment.moodleId} para ${this.isSpecialAssignment(assignment) ? 'caso especial' : assignment.group}.`,
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
      this.showTemporaryFormMessage(relatedCount > 1
        ? `${relatedCount} asignaciones relacionadas eliminadas correctamente.`
        : 'Asignacion eliminada correctamente.');
      this.formErrors = [];

      await this.auditLogRepository.register({
        module: 'Asignaciones',
        action: relatedCount > 1 ? 'ASIGNACIONES_COMPARTIDAS_ELIMINADAS' : 'ASIGNACION_ELIMINADA',
        description: relatedCount > 1
          ? `Se eliminaron ${relatedCount} asignaciones relacionadas con una clase compartida.`
          : `Se elimino la asignacion ${assignment.moodleId} para ${this.isSpecialAssignment(assignment) ? 'caso especial' : assignment.group}.`,
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
    this.lockedShareGroups.set([]);
    this.activeComboField = null;
    this.assignmentForm = this.emptyForm(this.activeCycle()?.code ?? '', this.isEnrollmentCaptureTab());
    this.syncPickerInputsFromForm();
  }

  async saveAssignment(continueAdding = false): Promise<void> {
    this.formMessage = '';
    this.applyPropedeuticMoodleId();
    this.assignmentForm.status = 'EN_CAPTURA';
    this.formErrors = this.validateForm();

    if (this.formErrors.length) {
      return;
    }

    const actor = this.actorData();
    const subject = this.selectedSubject();
    const group = this.assignmentForm.special ? null : this.selectedGroup();
    const shareGroups = this.assignmentForm.shared ? this.selectedShareGroups() : [];
    const lockedShareGroups = this.lockedShareGroups();
    const selectedProgram = this.assignmentForm.special
      ? this.assignmentForm.program.trim().toUpperCase()
      : group?.programAbbreviation ?? '';
    const program = this.programCodeForWrite(selectedProgram);

    if ((!this.assignmentForm.special && !group) || !selectedProgram || !program || !subject || !this.hasValidTeacherSelection()) {
      this.formErrors = ['Selecciona programa/grupo, asignatura y docente validos.'];
      return;
    }

    const currentAssignment = this.editingAssignmentId
      ? this.assignments().find((assignment) => assignment.id === this.editingAssignmentId)
      : null;
    const previousSharedGroups = new Set(currentAssignment ? this.assignmentSharedGroups(currentAssignment) : []);
    const canWriteCurrentAssignment = currentAssignment
      ? this.canModifyAssignment(currentAssignment)
      : this.canUseDestinationProgram(selectedProgram);

    if (!canWriteCurrentAssignment) {
      this.formErrors = ['Solo puedes guardar asignaciones en tus programas asignados.'];
      return;
    }

    try {
      const wasEditing = this.editingAssignmentId !== null;
      const sharedGroupNames = this.assignmentForm.shared
        ? this.mergeSharedGroupNames([
            ...lockedShareGroups,
            ...shareGroups.map((shareGroup) => shareGroup.fullGroup),
          ])
        : [];
      const sharedPrograms = this.assignmentForm.shared
        ? this.sharedProgramsForGroups(sharedGroupNames)
        : [];

      const basePayload: UpsertAssignmentPayload = {
        id: this.editingAssignmentId,
        cycle: this.assignmentForm.cycle,
        program,
        group: this.assignmentForm.special ? '' : group?.fullGroup ?? '',
        subjectId: subject.subjectId,
        subjectName: subject.name,
        moodleId: this.moodleIdForPayload(),
        teacherMoodleUser: this.selectedTeacherMoodleUser(),
        teacherName: this.selectedTeacherName(),
        status: 'EN_CAPTURA',
        observations: this.assignmentForm.observations,
        assignmentType: this.assignmentTypeForForm(),
        shared: sharedGroupNames.length > 0,
        sourceAssignmentId: '',
        sharedGroups: sharedGroupNames,
        sharedPrograms,
        special: this.assignmentForm.special,
        studentEnrollments: this.normalizedStudentEnrollments(),
        ...actor,
      };
      const assignmentId = await this.assignmentsRepository.upsertAssignment(basePayload);
      const createdAssignmentIds = this.editingAssignmentId ? [] : [assignmentId];
      const sharedNotificationTasks: Promise<unknown>[] = [];

      if (this.assignmentForm.shared && !this.assignmentForm.special && shareGroups.length) {
        for (const shareGroup of shareGroups) {
          sharedNotificationTasks.push(
            ...this.notifyAcademicCoordinatorsAboutSharedClass(
              actor,
              assignmentId,
              basePayload.cycle,
              subject.subjectId,
              subject.name,
              group?.fullGroup ?? '',
              shareGroup,
              this.selectedTeacherName(),
              wasEditing,
            ),
          );

          if (!previousSharedGroups.has(shareGroup.fullGroup.trim().toUpperCase())) {
            sharedNotificationTasks.push(
              this.notifySystemsAboutSharedClass(
                actor,
                assignmentId,
                basePayload.cycle,
                subject.subjectId,
                subject.name,
                group?.fullGroup ?? '',
                shareGroup.fullGroup,
                this.selectedTeacherName(),
                wasEditing,
              ),
            );
          }

          this.auditLogRepository.register({
            module: 'Asignaciones',
            action: this.editingAssignmentId ? 'ASIGNACION_COMPARTIDA_EDITADA' : 'ASIGNACION_COMPARTIDA_CREADA',
            description: `Se compartio la asignacion ${subject.subjectId} de ${group?.fullGroup} con ${shareGroup.fullGroup}.`,
            user: actor.createdByName,
            userRole: actor.createdByRole,
            entity: 'asignaciones',
            entityId: assignmentId,
            metadata: {
              cycle: basePayload.cycle,
              program: basePayload.program,
              originalProgram: shareGroup.programAbbreviation,
              group: shareGroup.fullGroup,
              subjectId: basePayload.subjectId,
              moodleId: this.assignmentsRepository.normalizeMoodleId(basePayload.moodleId),
              status: basePayload.status,
              shared: basePayload.shared,
              sharedGroups: basePayload.sharedGroups ?? [],
              sharedPrograms: basePayload.sharedPrograms ?? [],
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
          originalProgram: selectedProgram,
          group: basePayload.group,
          subjectId: basePayload.subjectId,
          moodleId: this.assignmentsRepository.normalizeMoodleId(basePayload.moodleId),
          status: basePayload.status,
          shared: basePayload.shared,
          sharedGroups: basePayload.sharedGroups ?? [],
          sharedPrograms: basePayload.sharedPrograms ?? [],
        },
      });

      const sharedNotificationResults = sharedNotificationTasks.length
        ? await Promise.allSettled(sharedNotificationTasks)
        : [];
      const hasSharedNotificationError = sharedNotificationResults.some((result) => result.status === 'rejected');
      const successMessage = this.editingAssignmentId
        ? 'Asignacion actualizada correctamente.'
        : 'Asignacion guardada correctamente.';

      this.showTemporaryFormMessage(hasSharedNotificationError
        ? `${successMessage} No se pudo enviar una o mas notificaciones de clase compartida.`
        : successMessage);
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

  private async removeSharedParticipation(assignment: AcademicAssignment): Promise<void> {
    const userSharedGroups = this.assignmentSharedGroupsForCurrentUser(assignment);

    if (!userSharedGroups.length) {
      return;
    }

    const confirmed = await this.confirmationDialogService.confirm({
      title: 'Retirar clase compartida',
      message: `Se retirara tu grupo de esta clase compartida.\nGrupo base: ${assignment.group}.\nGrupos a retirar:\n- ${userSharedGroups.join('\n- ')}`,
      confirmLabel: 'Retirar',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    const actor = this.actorData();
    const remainingSharedGroups = this.assignmentSharedGroups(assignment)
      .filter((group) => !userSharedGroups.includes(group));

    try {
      await this.assignmentsRepository.upsertAssignment({
        id: assignment.id,
        cycle: assignment.cycle,
        program: assignment.program,
        group: assignment.group,
        subjectId: assignment.subjectId,
        subjectName: assignment.subjectName,
        moodleId: assignment.moodleId,
        teacherMoodleUser: assignment.teacherMoodleUser,
        teacherName: assignment.teacherName,
        status: assignment.status,
        observations: assignment.observations,
        assignmentType: assignment.assignmentType,
        shared: remainingSharedGroups.length > 0,
        sourceAssignmentId: '',
        sharedGroups: remainingSharedGroups,
        sharedPrograms: this.sharedProgramsForGroups(remainingSharedGroups),
        special: this.isSpecialAssignment(assignment),
        studentEnrollments: assignment.studentEnrollments,
        ...actor,
      });
      this.showTemporaryFormMessage('Clase compartida retirada correctamente.');
      this.formErrors = [];

      await this.auditLogRepository.register({
        module: 'Asignaciones',
        action: 'ASIGNACION_COMPARTIDA_RETIRADA',
        description: `Se retiro la participacion compartida de ${userSharedGroups.join(', ')} en la asignacion ${assignment.subjectId}.`,
        user: actor.createdByName,
        userRole: actor.createdByRole,
        entity: 'asignaciones',
        entityId: assignment.id,
        metadata: {
          cycle: assignment.cycle,
          moodleId: assignment.moodleId,
          removedGroups: userSharedGroups,
          remainingSharedGroups,
        },
      });
    } catch (error) {
      console.error('No se pudo retirar la clase compartida', error);
      this.formMessage = '';
      this.formErrors = [`No se pudo retirar la clase compartida. ${this.readFirebaseMessage(error)}`];
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
    this.clearSubjectIfNotAllowedForCurrentForm();
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

  downloadAssignmentsReport(): void {
    const assignments = this.reportAssignments();

    if (!assignments.length) {
      this.showTemporaryFormMessage('No hay asignaciones disponibles para descargar.');
      return;
    }

    const activeCycle = this.activeCycleCode();
    const rows = [
      ['SPAI TUP - Reporte de asignaciones'],
      ['Ciclo', activeCycle],
      ['Alcance', this.canSeeAllAssignments() ? 'Catalogo global' : 'Capturas propias y clases compartidas con tus programas'],
      ['Generado', this.formatReportDateTime(new Date())],
      [],
      [
        'ID Moodle',
        'ID SPAI',
        'Materia',
        'Docente',
        'Usuario Moodle docente',
        'Carrera',
        'Grupo base',
        'Clase compartida',
        'Comparte con',
        'Participacion de mi coordinacion',
        'Estado',
        'Modalidad',
        'Matricula(s)',
        'Observaciones',
        'Capturado por',
        'Fecha de captura',
        'Ultima actualizacion',
      ],
      ...assignments.map((assignment) => this.assignmentReportRow(assignment)),
    ];
    const workbook = this.buildXlsxWorkbook(rows);
    const blob = new Blob([workbook], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = this.reportFileName(activeCycle);
    anchor.click();
    URL.revokeObjectURL(url);
    this.showTemporaryFormMessage(`Reporte generado con ${assignments.length} asignacion(es).`);
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

  destinationProgramLabel(program: string): string {
    if (this.modeTab() !== 'Inglés') {
      return program;
    }

    const normalizedProgram = program.trim().toUpperCase();

    if (normalizedProgram === 'ING') {
      return 'Campus TUP';
    }

    if (normalizedProgram === 'ING-FCS') {
      return 'Facultad de Ciencias de la Salud';
    }

    return program;
  }

  visibleSubjectPickerOptions(): Subject[] {
    const query = this.normalizeSearch(this.subjectPickerValue);
    const selectableSubjects = this.selectableSubjectsForCurrentForm();

    const subjects = query
      ? selectableSubjects.filter((subject) => this.matchesSearchText(
          `${subject.name} ${subject.subjectId}`,
          query,
        ))
      : [...selectableSubjects].sort((firstSubject, secondSubject) => {
          const dateComparison = this.subjectTimestamp(secondSubject).localeCompare(this.subjectTimestamp(firstSubject));

          return dateComparison || firstSubject.name.localeCompare(secondSubject.name, 'es');
        });

    return subjects.slice(0, MAX_COMBO_OPTIONS);
  }

  subjectPickerEmptyMessage(): string {
    if (!this.activeSubjects().length) {
      return 'Sin asignaturas activas';
    }

    if (this.assignmentForm.propedeutic) {
      return 'Sin cursos propedeuticos TUP -- o FCS -- activos';
    }

    return 'Sin coincidencias';
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

  groupPickerEmptyMessage(): string {
    const activeCycle = this.activeCycle();

    if (!activeCycle) {
      return 'No hay ciclo activo para filtrar grupos.';
    }

    const activeGroupsInCycle = this.groups()
      .filter((group) => this.isActiveGroup(group))
      .filter((group) => this.groupBelongsToCycle(group, activeCycle.code));

    if (!activeGroupsInCycle.length) {
      return `No hay grupos activos registrados para el ciclo ${activeCycle.code}.`;
    }

    if (this.modeTab() === 'Posgrados') {
      return this.postgraduateGroupPickerEmptyMessage(activeGroupsInCycle);
    }

    if (this.modeTab() !== 'Salud') {
      return 'Sin coincidencias para la busqueda actual.';
    }

    const healthGroups = activeGroupsInCycle.filter((group) => this.isHealthGroup(group));

    if (!healthGroups.length) {
      return 'Hay grupos del ciclo, pero ninguno esta clasificado como Facultad de Ciencias de la Salud.';
    }

    const allowedHealthGroups = healthGroups.filter((group) => {
      return this.canSeeAllAssignments() || this.isAssignedProgram(group.programAbbreviation);
    });

    if (!allowedHealthGroups.length) {
      return `Hay ${healthGroups.length} grupo(s) de Salud, pero no estan asignados a tu coordinacion. Revisa Usuarios o Nomenclaturas.`;
    }

    return 'Sin coincidencias para la busqueda actual.';
  }

  private postgraduateGroupPickerEmptyMessage(activeGroupsInCycle: AcademicGroup[]): string {
    const postgraduateGroups = activeGroupsInCycle.filter((group) => this.isPostgraduateGroup(group));

    if (!postgraduateGroups.length) {
      return 'Hay grupos del ciclo, pero ninguno esta identificado como maestria o posgrado.';
    }

    const campusPostgraduateGroups = postgraduateGroups.filter((group) => this.groupMode(group) === 'Posgrados');

    if (!campusPostgraduateGroups.length) {
      const healthPostgraduateGroups = postgraduateGroups.filter((group) => this.isHealthGroup(group));

      if (healthPostgraduateGroups.length) {
        return `Hay ${healthPostgraduateGroups.length} posgrado(s), pero pertenecen a Salud. Revisa la pestana Salud.`;
      }

      return `Hay ${postgraduateGroups.length} posgrado(s), pero no estan clasificados como Campus TUP. Revisa Nomenclaturas.`;
    }

    const allowedPostgraduateGroups = campusPostgraduateGroups.filter((group) => {
      return this.canSeeAllAssignments() || this.isAssignedProgram(group.programAbbreviation);
    });

    if (!allowedPostgraduateGroups.length) {
      return `Hay ${campusPostgraduateGroups.length} posgrado(s) de Campus TUP, pero no estan asignados a tu coordinacion.`;
    }

    return 'Sin coincidencias para la busqueda actual.';
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
      if (this.lockedShareGroups().length) {
        this.assignmentForm.shared = true;
        this.assignmentForm.shareGroups = this.mergeSharedGroupNames([
          ...this.lockedShareGroups(),
          ...this.assignmentForm.shareGroups,
        ]);
        this.assignmentForm.sharedGroupCount = this.normalizeSharedGroupCount(this.assignmentForm.shareGroups.length);
        return;
      }

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
      this.assignmentForm.specialType = this.assignmentForm.propedeutic ? 'propedeutic' : 'enrollments';
      this.assignmentForm.group = '';
      this.assignmentForm.shared = false;
      this.assignmentForm.sourceAssignmentId = '';
      this.assignmentForm.sharedGroupCount = 0;
      this.assignmentForm.shareGroups = [];
      this.shareGroupSearch.set('');
      this.groupPickerValue = '';
      this.activeComboField = null;
      this.applyPropedeuticMoodleId();
      return;
    }

    this.assignmentForm.propedeutic = false;
    this.assignmentForm.specialType = 'group';
    this.assignmentForm.program = '';
    this.clearPropedeuticMoodleId();
  }

  selectSpecialType(type: SpecialAssignmentOption): void {
    this.assignmentForm.specialType = type;
    this.assignmentForm.special = type !== 'group';
    this.assignmentForm.propedeutic = type === 'propedeutic';

    if (this.assignmentForm.special) {
      this.assignmentForm.group = '';
      this.assignmentForm.shared = false;
      this.assignmentForm.sourceAssignmentId = '';
      this.assignmentForm.sharedGroupCount = 0;
      this.assignmentForm.shareGroups = [];
      this.shareGroupSearch.set('');
      this.groupPickerValue = '';
      this.activeComboField = null;
    } else {
      this.assignmentForm.program = '';
    }

    if (type === 'propedeutic') {
      this.applyPropedeuticMoodleId();
      this.clearSubjectIfNotAllowedForCurrentForm();
      return;
    }

    this.clearPropedeuticMoodleId();
    this.clearSubjectIfNotAllowedForCurrentForm();
  }

  onPropedeuticChange(): void {
    if (this.assignmentForm.propedeutic) {
      this.assignmentForm.special = true;
      this.assignmentForm.specialType = 'propedeutic';
      this.applyPropedeuticMoodleId();
      this.clearSubjectIfNotAllowedForCurrentForm();
      return;
    }

    this.assignmentForm.specialType = this.assignmentForm.special ? 'enrollments' : 'group';
    this.clearPropedeuticMoodleId();
    this.clearSubjectIfNotAllowedForCurrentForm();
  }

  private applyPropedeuticMoodleId(): void {
    if (!this.assignmentForm.propedeutic) {
      return;
    }

    this.assignmentForm.special = true;
    this.assignmentForm.moodleId = PROPEDEUTIC_MOODLE_LABEL;
  }

  private clearPropedeuticMoodleId(): void {
    if (this.assignmentsRepository.normalizeMoodleId(this.assignmentForm.moodleId) === PROPEDEUTIC_MOODLE_ID) {
      this.assignmentForm.moodleId = '';
    }
  }

  private moodleIdForPayload(): string {
    return this.assignmentForm.propedeutic ? PROPEDEUTIC_MOODLE_ID : this.assignmentForm.moodleId;
  }

  private assignmentTypeForForm(): AssignmentType {
    if (this.assignmentForm.propedeutic) {
      return 'PROPEDEUTICO';
    }

    if (this.modeTab() === 'Especiales' && this.assignmentForm.specialType === 'group') {
      return 'CURSO_ESPECIAL';
    }

    return this.assignmentForm.special ? 'ESPECIAL' : 'REGULAR';
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
    } else if (this.isShareGroupLocked(normalizedGroup)) {
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
    return this.isShareGroupLocked(group)
      || (
        !this.isShareGroupSelected(group)
        && this.assignmentForm.shareGroups.length >= this.assignmentForm.sharedGroupCount
      );
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
    return this.assignmentSharedGroups(assignment).length > 0;
  }

  sharedAssignmentDetails(assignment: AcademicAssignment): string {
    const baseGroup = assignment.group || 'origen no identificado';
    const destinationGroups = this.assignmentSharedGroups(assignment);

    if (!destinationGroups.length) {
      return `Clase compartida. Grupo base: ${baseGroup}.`;
    }

    return `Grupo base: ${baseGroup}.\nComparte con:\n- ${destinationGroups.join('\n- ')}`;
  }

  async showSharedAssignmentDetails(assignment: AcademicAssignment): Promise<void> {
    await this.confirmationDialogService.alert({
      title: 'Clase compartida',
      message: this.sharedAssignmentDetails(assignment),
    });
  }

  isSharedFromAnotherCoordination(assignment: AcademicAssignment): boolean {
    return !this.canSeeAllAssignments()
      && !this.isAssignedProgram(assignment.program)
      && this.assignmentPrograms(assignment).some((program) => this.isAssignedProgram(program));
  }

  sharedBaseWarning(assignment: AcademicAssignment): string {
    const userGroups = this.assignmentSharedGroupsForCurrentUser(assignment);

    if (!userGroups.length) {
      return 'Grupo base de otra coordinacion.';
    }

    return `Grupo base de otra coordinacion. Tu grupo vinculado: ${userGroups.join(', ')}.`;
  }

  canEditAssignment(assignment: AcademicAssignment): boolean {
    return this.canModifyAssignment(assignment)
      && this.normalizedAssignmentStatus(assignment.status) === 'EN_CAPTURA';
  }

  canDeleteAssignment(assignment: AcademicAssignment): boolean {
    if (!this.canManageAssignments()) {
      return false;
    }

    if (this.canSeeAllAssignments()) {
      return true;
    }

    return this.canManageBaseAssignment(assignment);
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

  private assignmentSharedGroups(assignment: AcademicAssignment): string[] {
    const storedGroups = assignment.sharedGroups ?? [];

    if (storedGroups.length) {
      return Array.from(new Set(storedGroups.map((group) => group.trim().toUpperCase()).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'es'));
    }

    if (assignment.sourceAssignmentId) {
      return [assignment.group].filter(Boolean);
    }

    return this.sharedDestinationAssignments(assignment)
      .map((item) => item.group)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es'));
  }

  private assignmentSharedGroupsForCurrentUser(assignment: AcademicAssignment): string[] {
    return this.assignmentSharedGroups(assignment)
      .filter((fullGroup) => {
        const group = this.groups().find((item) => item.fullGroup === fullGroup);

        return group ? this.isAssignedProgram(group.programAbbreviation) : false;
      });
  }

  private assignmentPrograms(assignment: AcademicAssignment): string[] {
    const programs = new Set<string>([assignment.program]);

    (assignment.sharedPrograms ?? []).forEach((program) => programs.add(program));
    this.assignmentSharedGroups(assignment).forEach((fullGroup) => {
      const group = this.groups().find((item) => item.fullGroup === fullGroup);

      if (group?.programAbbreviation) {
        programs.add(group.programAbbreviation);
      }
    });

    return Array.from(programs).map((program) => program.trim().toUpperCase()).filter(Boolean);
  }

  private shouldHideLegacySharedDestination(assignment: AcademicAssignment): boolean {
    return Boolean(
      assignment.sourceAssignmentId
      && this.assignmentById(assignment.sourceAssignmentId),
    );
  }

  private assignmentsToDelete(assignment: AcademicAssignment): AcademicAssignment[] {
    if (assignment.sharedGroups?.length || assignment.sourceAssignmentId) {
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

  private wasAssignmentLoadedByCurrentUser(assignment: AcademicAssignment): boolean {
    if (this.wasAssignmentCreatedByCurrentUser(assignment)) {
      return true;
    }

    const session = this.session();
    const appUser = session?.appUser;
    const currentUserNames = [
      appUser?.name,
      session?.displayName,
    ].map((value) => this.normalizeSearchText(value ?? '')).filter(Boolean);

    return currentUserNames.includes(this.normalizeSearchText(assignment.createdByName));
  }

  private canModifyAssignment(assignment: AcademicAssignment): boolean {
    return this.canSeeAllAssignments()
      || this.assignmentPrograms(assignment).some((program) => this.isAssignedProgram(program));
  }

  private canManageBaseAssignment(assignment: AcademicAssignment): boolean {
    return this.canSeeAllAssignments()
      || this.isAssignedProgram(assignment.program)
      || this.wasAssignmentCreatedByCurrentUser(assignment);
  }

  private canUseSharedGroupOption(group: AcademicGroup): boolean {
    if (this.canSeeAllAssignments()) {
      return true;
    }

    const currentAssignment = this.editingAssignmentId
      ? this.assignmentById(this.editingAssignmentId)
      : null;

    if (!currentAssignment || this.canManageBaseAssignment(currentAssignment)) {
      return true;
    }

    return this.isAssignedProgram(group.programAbbreviation)
      || this.isShareGroupLocked(group.fullGroup);
  }

  private lockedSharedGroupsForAssignment(assignment: AcademicAssignment, sharedGroups: string[]): string[] {
    if (this.canManageBaseAssignment(assignment)) {
      return [];
    }

    return this.mergeSharedGroupNames(sharedGroups);
  }

  isShareGroupLocked(group: string): boolean {
    const normalizedGroup = group.trim().toUpperCase();

    return this.lockedShareGroups().includes(normalizedGroup);
  }

  private mergeSharedGroupNames(groups: string[]): string[] {
    return Array.from(new Set(
      groups
        .map((group) => group.trim().toUpperCase())
        .filter(Boolean),
    )).sort((a, b) => a.localeCompare(b, 'es'));
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
    const matchesTab = this.assignmentMatchesModeTab(assignment, tab);

    return this.canViewAssignments()
      && matchesCycle
      && this.assignmentMatchesCatalogScope(assignment)
      && matchesTab;
  }

  private assignmentMatchesCatalogScope(assignment: AcademicAssignment): boolean {
    return this.isGlobalCatalogVisible()
      || this.wasAssignmentCreatedByCurrentUser(assignment)
      || this.assignmentPrograms(assignment).some((program) => this.isAssignedProgram(program));
  }

  private groupMatchesCatalogScope(_group: AcademicGroup): boolean {
    return this.isGlobalCatalogVisible();
  }

  private isAssignedProgram(program: string): boolean {
    return Array.from(this.programAliases(program))
      .some((alias) => this.assignedProgramCodes().has(alias));
  }

  private assignmentMatchesSearch(assignment: AcademicAssignment): boolean {
    const query = this.searchQuery();

    if (!this.normalizeSearch(query)) {
      return true;
    }

    if (this.searchField() === 'program') {
      return this.matchesSearchText(this.assignmentProgramSearchText(assignment), query);
    }

    if (this.searchField() === 'group') {
      return this.matchesSearchText([
        assignment.group,
        ...this.assignmentSharedGroups(assignment),
      ].join(' '), query);
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

  assignmentProgramLabel(assignment: AcademicAssignment): string {
    if (this.isSpecialAssignment(assignment)) {
      return assignment.program;
    }

    const group = this.groups().find((item) => item.fullGroup === assignment.group);

    return group?.programAbbreviation || this.programForAssignment(assignment)?.code || assignment.program;
  }

  private assignmentProgramSearchText(assignment: AcademicAssignment): string {
    const group = this.groups().find((item) => item.fullGroup === assignment.group);
    const program = this.programForAssignment(assignment);
    const sharedGroups = this.assignmentSharedGroups(assignment)
      .map((fullGroup) => this.groups().find((item) => item.fullGroup === fullGroup))
      .filter((item): item is AcademicGroup => item !== undefined);

    return [
      assignment.program,
      group?.programAbbreviation,
      group?.programName,
      program?.code,
      program?.name,
      ...(assignment.sharedPrograms ?? []),
      ...sharedGroups.flatMap((sharedGroup) => [
        sharedGroup.programAbbreviation,
        sharedGroup.programName,
      ]),
    ].join(' ');
  }

  private assignmentMatchesModeTab(assignment: AcademicAssignment, tab: AssignmentModeTab): boolean {
    if (this.assignmentMode(assignment) === tab) {
      return true;
    }

    return this.assignmentSharedGroups(assignment).some((fullGroup) => {
      const group = this.groups().find((item) => item.fullGroup === fullGroup);

      return group ? this.groupMatchesModeTab(group, tab) : false;
    });
  }

  private assignmentMode(assignment: AcademicAssignment): AssignmentModeTab {
    if (this.isEnglishAssignment(assignment)) {
      return 'Inglés';
    }

    if (this.isSpecialAssignment(assignment) || this.isSpecialCourseAssignment(assignment)) {
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
      assignment.subjectName,
      program?.name,
      program?.academicArea,
      program?.programType,
      program?.modality,
    ].join(' '));

    if (this.isEnglishProgramCode(assignment.program)
      || this.referencesEnglishProgram(normalizedProgram)) {
      return 'Inglés';
    }

    if (!normalizedGroup || normalizedGroup.endsWith('c.a') || normalizedGroup.endsWith('c a')) {
      return 'Especiales';
    }

    if (this.isHealthProgramCode(assignment.program)
      || this.referencesHealthFaculty(normalizedProgram)) {
      return 'Salud';
    }

    if (normalizedProgram.includes('especialidad') || normalizedProgram.includes('especializacion')) {
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

  private showTemporaryFormMessage(message: string): void {
    this.clearFormMessageTimeout();
    this.formMessage = message;
    this.formMessageTimeout = setTimeout(() => {
      if (this.formMessage === message) {
        this.formMessage = '';
      }

      this.formMessageTimeout = null;
    }, 3500);
  }

  private clearFormMessageTimeout(): void {
    if (!this.formMessageTimeout) {
      return;
    }

    clearTimeout(this.formMessageTimeout);
    this.formMessageTimeout = null;
  }

  private assignmentReportRow(assignment: AcademicAssignment): string[] {
    const sharedGroups = this.assignmentSharedGroups(assignment);

    return [
      this.displayMoodleId(assignment),
      assignment.subjectId,
      assignment.subjectName,
      assignment.teacherName,
      assignment.teacherMoodleUser,
      this.assignmentProgramLabel(assignment),
      this.isSpecialAssignment(assignment) ? 'Caso especial' : assignment.group,
      sharedGroups.length ? 'Si' : 'No',
      sharedGroups.join(', '),
      this.assignmentReportParticipation(assignment),
      this.statusLabel(assignment.status),
      this.assignmentReportMode(assignment),
      assignment.studentEnrollments,
      assignment.observations,
      assignment.createdByName,
      this.formatReportDateTime(assignment.createdAt),
      this.formatReportDateTime(assignment.updatedAt),
    ];
  }

  private assignmentReportMode(assignment: AcademicAssignment): string {
    if (this.isSpecialCourseAssignment(assignment)) {
      return 'Curso especial por grupo';
    }

    return this.isPropedeuticAssignment(assignment) ? PROPEDEUTIC_MOODLE_LABEL : this.assignmentMode(assignment);
  }

  private assignmentReportParticipation(assignment: AcademicAssignment): string {
    if (this.canSeeAllAssignments()) {
      return 'Catalogo global';
    }

    const labels: string[] = [];

    if (this.wasAssignmentLoadedByCurrentUser(assignment)) {
      labels.push('Captura propia');
    }

    if (this.isAssignedProgram(assignment.program)) {
      labels.push('Grupo base de mi coordinacion');
    }

    const sharedGroups = this.assignmentSharedGroupsForCurrentUser(assignment);

    if (sharedGroups.length) {
      labels.push(`Grupo compartido de mi coordinacion: ${sharedGroups.join(', ')}`);
    }

    return labels.length ? labels.join(' / ') : 'Participacion relacionada';
  }

  private buildXlsxWorkbook(rows: string[][]): Uint8Array {
    const files = [
      {
        name: '[Content_Types].xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
      },
      {
        name: '_rels/.rels',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
      },
      {
        name: 'xl/workbook.xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Asignaciones" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
      },
      {
        name: 'xl/_rels/workbook.xml.rels',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
      },
      {
        name: 'xl/styles.xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`,
      },
      {
        name: 'xl/worksheets/sheet1.xml',
        content: this.buildXlsxWorksheet(rows),
      },
    ];

    return this.createZip(files);
  }

  private reportFileName(cycle: string): string {
    const scope = this.canSeeAllAssignments() ? 'catalogo-global' : 'mis-capturas';
    const normalizedCycle = cycle.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    const date = new Date().toISOString().slice(0, 10);

    return `spai-asignaciones-${scope}-${normalizedCycle}-${date}.xlsx`;
  }

  private formatReportDateTime(value: string | Date): string {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  private escapeXml(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private buildXlsxWorksheet(rows: string[][]): string {
    const worksheetRows = rows.map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row.map((cell, columnIndex) => {
        const cellReference = `${this.xlsxColumnName(columnIndex + 1)}${rowNumber}`;

        return `<c r="${cellReference}" t="inlineStr"><is><t xml:space="preserve">${this.escapeXml(cell)}</t></is></c>`;
      }).join('');

      return `<row r="${rowNumber}">${cells}</row>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetData>${worksheetRows}</sheetData>
</worksheet>`;
  }

  private xlsxColumnName(columnNumber: number): string {
    let currentColumn = columnNumber;
    let name = '';

    while (currentColumn > 0) {
      currentColumn -= 1;
      name = String.fromCharCode(65 + (currentColumn % 26)) + name;
      currentColumn = Math.floor(currentColumn / 26);
    }

    return name;
  }

  private createZip(files: { name: string; content: string }[]): Uint8Array {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    const centralDirectoryChunks: Uint8Array[] = [];
    let offset = 0;

    files.forEach((file) => {
      const nameBytes = encoder.encode(file.name);
      const data = encoder.encode(file.content);
      const crc = this.crc32(data);
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const localView = new DataView(localHeader.buffer);

      this.writeZipLocalHeader(localView, crc, data.length, nameBytes.length);
      localHeader.set(nameBytes, 30);
      chunks.push(localHeader, data);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(centralHeader.buffer);

      this.writeZipCentralHeader(centralView, crc, data.length, nameBytes.length, offset);
      centralHeader.set(nameBytes, 46);
      centralDirectoryChunks.push(centralHeader);
      offset += localHeader.length + data.length;
    });

    const centralDirectory = this.concatUint8Arrays(centralDirectoryChunks);
    const endOfCentralDirectory = new Uint8Array(22);
    const endView = new DataView(endOfCentralDirectory.buffer);

    this.writeUint32(endView, 0, 0x06054b50);
    this.writeUint16(endView, 8, files.length);
    this.writeUint16(endView, 10, files.length);
    this.writeUint32(endView, 12, centralDirectory.length);
    this.writeUint32(endView, 16, offset);

    return this.concatUint8Arrays([...chunks, centralDirectory, endOfCentralDirectory]);
  }

  private writeZipLocalHeader(view: DataView, crc: number, size: number, fileNameLength: number): void {
    this.writeUint32(view, 0, 0x04034b50);
    this.writeUint16(view, 4, 20);
    this.writeUint16(view, 6, 0);
    this.writeUint16(view, 8, 0);
    this.writeUint16(view, 10, 0);
    this.writeUint16(view, 12, 0);
    this.writeUint32(view, 14, crc);
    this.writeUint32(view, 18, size);
    this.writeUint32(view, 22, size);
    this.writeUint16(view, 26, fileNameLength);
    this.writeUint16(view, 28, 0);
  }

  private writeZipCentralHeader(view: DataView, crc: number, size: number, fileNameLength: number, offset: number): void {
    this.writeUint32(view, 0, 0x02014b50);
    this.writeUint16(view, 4, 20);
    this.writeUint16(view, 6, 20);
    this.writeUint16(view, 8, 0);
    this.writeUint16(view, 10, 0);
    this.writeUint16(view, 12, 0);
    this.writeUint16(view, 14, 0);
    this.writeUint32(view, 16, crc);
    this.writeUint32(view, 20, size);
    this.writeUint32(view, 24, size);
    this.writeUint16(view, 28, fileNameLength);
    this.writeUint16(view, 30, 0);
    this.writeUint16(view, 32, 0);
    this.writeUint16(view, 34, 0);
    this.writeUint16(view, 36, 0);
    this.writeUint32(view, 38, 0);
    this.writeUint32(view, 42, offset);
  }

  private crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    const table = this.crc32Table();

    data.forEach((byte) => {
      crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
    });

    return (crc ^ 0xffffffff) >>> 0;
  }

  private crc32Table(): number[] {
    return Array.from({ length: 256 }, (_, index) => {
      let value = index;

      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      }

      return value >>> 0;
    });
  }

  private concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
    const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const output = new Uint8Array(totalLength);
    let offset = 0;

    chunks.forEach((chunk) => {
      output.set(chunk, offset);
      offset += chunk.length;
    });

    return output;
  }

  private writeUint16(view: DataView, offset: number, value: number): void {
    view.setUint16(offset, value, true);
  }

  private writeUint32(view: DataView, offset: number, value: number): void {
    view.setUint32(offset, value, true);
  }

  private readFirebaseMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private validateForm(): string[] {
    const errors: string[] = [];
    const activeCycle = this.activeCycle();
    const moodleId = this.assignmentsRepository.normalizeMoodleId(this.moodleIdForPayload());

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
      errors.push(this.modeTab() === 'Inglés'
        ? 'El campus es obligatorio para asignaciones de ingles.'
        : 'El programa es obligatorio para casos especiales.');
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
    const sharesBaseOperationalGroup = this.selectedShareGroups()
      .some((shareGroup) => this.isSameOperationalGroup(shareGroup, selectedGroup));

    if (this.assignmentForm.shared && !this.assignmentForm.special && sharesBaseOperationalGroup) {
      errors.push('Los grupos compartidos no pueden tener el mismo codigo y seccion que el grupo base.');
    }

    const selectedProgram = this.assignmentForm.special
      ? this.assignmentForm.program.trim().toUpperCase()
      : selectedGroup?.programAbbreviation ?? '';

    if (selectedProgram && !this.canUseBaseProgramInForm(selectedProgram)) {
      errors.push('Solo puedes seleccionar grupos de tus programas asignados como destino.');
    }

    if (this.unauthorizedSharedDestinationGroups().length) {
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

    const selectedSubject = this.selectedSubject();

    if (selectedSubject && !this.isSubjectAllowedForCurrentForm(selectedSubject)) {
      errors.push(this.assignmentForm.propedeutic
        ? 'En propedeuticos solo puedes seleccionar cursos TUP -- o FCS --.'
        : 'Los cursos TUP -- y FCS -- solo se usan en propedeuticos.');
    }

    if (!moodleId) {
      errors.push('El ID asignatura es obligatorio.');
    }

    if (!this.assignmentForm.teacherMoodleUser) {
      errors.push('El docente es obligatorio.');
    }

    if (!this.assignmentForm.propedeutic
      && moodleId
      && this.assignmentsRepository.hasMoodleIdConflict(
        this.assignmentForm.cycle,
        moodleId,
        this.assignmentForm.subjectId,
        this.editingAssignmentId,
      )) {
      errors.push('El ID Moodle ya existe para esta materia en este ciclo. Marca clase compartida si corresponde.');
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

    return this.selectableSubjectsForCurrentForm().find((subject) => {
      return [
        this.subjectPickerLabel(subject),
        subject.name,
        subject.subjectId,
      ].some((option) => this.normalizeSearch(option) === normalizedValue);
    }) ?? null;
  }

  private selectableSubjectsForCurrentForm(): Subject[] {
    return this.activeSubjects()
      .filter((subject) => this.isSubjectAllowedForCurrentForm(subject));
  }

  private isSubjectAllowedForCurrentForm(subject: Subject): boolean {
    const isPropedeuticSubject = this.isPropedeuticSubject(subject);

    return this.assignmentForm.propedeutic ? isPropedeuticSubject : !isPropedeuticSubject;
  }

  private isPropedeuticSubject(subject: Subject): boolean {
    return /^(TUP|FCS)\s*--/i.test(subject.name.trim());
  }

  private clearSubjectIfNotAllowedForCurrentForm(): void {
    const subject = this.selectedSubject();

    if (!subject || this.isSubjectAllowedForCurrentForm(subject)) {
      return;
    }

    this.assignmentForm.subjectId = '';
    this.subjectPickerValue = '';
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

  private sharedProgramsForGroups(sharedGroups: string[]): string[] {
    return Array.from(new Set(
      sharedGroups
        .map((fullGroup) => this.groups().find((group) => group.fullGroup === fullGroup)?.programAbbreviation ?? '')
        .map((program) => this.programCodeForWrite(program))
        .filter(Boolean),
    ));
  }

  private canUseDestinationProgram(program: string): boolean {
    const normalizedProgram = program.trim().toUpperCase();

    return this.canSeeAllAssignments()
      || this.isAssignedProgram(normalizedProgram);
  }

  private canUseBaseProgramInForm(program: string): boolean {
    if (this.canUseDestinationProgram(program)) {
      return true;
    }

    const currentAssignment = this.editingAssignmentId
      ? this.assignmentById(this.editingAssignmentId)
      : null;

    return Boolean(
      currentAssignment
        && this.assignmentForm.shared
        && !this.assignmentForm.special
        && this.canModifyAssignment(currentAssignment),
    );
  }

  private unauthorizedSharedDestinationGroups(): AcademicGroup[] {
    if (this.canSeeAllAssignments() || !this.assignmentForm.shared || this.assignmentForm.special) {
      return [];
    }

    const currentAssignment = this.editingAssignmentId
      ? this.assignmentById(this.editingAssignmentId)
      : null;

    if (!currentAssignment || this.canManageBaseAssignment(currentAssignment)) {
      return [];
    }

    const lockedGroups = new Set(this.lockedShareGroups());

    return this.selectedShareGroups()
      .filter((group) => {
        const groupName = group.fullGroup.trim().toUpperCase();

        return !lockedGroups.has(groupName)
          && !this.isAssignedProgram(group.programAbbreviation);
      });
  }

  private programCodeForWrite(program: string): string {
    const normalizedProgram = program.trim().toUpperCase();

    if (!normalizedProgram || this.canSeeAllAssignments()) {
      return normalizedProgram;
    }

    const aliases = this.programAliases(normalizedProgram);
    const assignedProgram = (this.session()?.appUser?.assignedPrograms ?? [])
      .map((item) => item.trim().toUpperCase())
      .find((item) => aliases.has(item));

    if (assignedProgram) {
      return assignedProgram;
    }

    const coordinatedProgram = this.programs()
      .find((item) => aliases.has(item.code.trim().toUpperCase()) && this.coordinatorMatchesCurrentUser(item.coordinator));

    if (coordinatedProgram) {
      return coordinatedProgram.code.trim().toUpperCase();
    }

    const nomenclature = this.nomenclatures()
      .find((item) => {
        return aliases.has(item.abbreviation.trim().toUpperCase())
          || aliases.has(item.programCode.trim().toUpperCase());
      });

    return nomenclature?.programCode.trim().toUpperCase() || normalizedProgram;
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
    const program = this.programForGroup(group);
    const nomenclature = this.nomenclatureForGroup(group);
    const searchText = this.normalizeSearchText([
      program?.programType,
      program?.name,
      group.programName,
      group.programAbbreviation,
      nomenclature?.programName,
      nomenclature?.planName,
      nomenclature?.notes,
    ].join(' '));

    return POSTGRADUATE_TEXT_MARKERS.some((marker) => searchText.includes(marker));
  }

  private groupMatchesModeTab(group: AcademicGroup, tab: AssignmentModeTab): boolean {
    return this.groupMode(group) === tab;
  }

  private groupMode(group: AcademicGroup): AssignmentModeTab | null {
    if (this.isEnglishGroup(group)) {
      return 'Inglés';
    }

    if (this.isSpecialGroup(group)) {
      return 'Especiales';
    }

    if (this.isHealthGroup(group)) {
      return 'Salud';
    }

    if (this.isCampusTupGroup(group) && this.isPostgraduateGroup(group)) {
      return 'Posgrados';
    }

    if (this.isHealthPostgraduateFallback(group)) {
      return 'Salud';
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
    const nomenclature = this.nomenclatureForGroup(group);
    const healthReference = this.normalizeSearchText([
      group.academicArea,
      program?.academicArea,
      group.programName,
      program?.name,
      nomenclature?.notes,
      nomenclature?.programName,
    ].join(' '));

    return this.isHealthProgramCode(group.programAbbreviation)
      || (nomenclature ? this.isHealthProgramCode(nomenclature.programCode) : false)
      || this.referencesHealthFaculty(healthReference);
  }

  private isHealthProgramCode(programCode: string): boolean {
    return HEALTH_PROGRAM_CODES.has(programCode.trim().toUpperCase());
  }

  private isEnglishProgramCode(programCode: string): boolean {
    return ENGLISH_PROGRAM_CODES.has(programCode.trim().toUpperCase());
  }

  private referencesHealthFaculty(value: string): boolean {
    const normalizedValue = this.normalizeSearchText(value);

    return HEALTH_TEXT_MARKERS.some((marker) => normalizedValue.includes(marker));
  }

  private referencesEnglishProgram(value: string): boolean {
    const normalizedValue = this.normalizeSearchText(value);

    return ENGLISH_TEXT_MARKERS.some((marker) => normalizedValue.includes(marker));
  }

  private isEnglishAssignment(assignment: AcademicAssignment): boolean {
    const program = this.programForAssignment(assignment);
    const subject = this.subjects().find((item) => item.subjectId === assignment.subjectId);
    const searchText = this.normalizeSearchText([
      assignment.program,
      assignment.subjectName,
      subject?.name,
      program?.name,
      program?.academicArea,
      program?.programType,
      program?.modality,
    ].join(' '));

    return this.isEnglishProgramCode(assignment.program)
      || this.referencesEnglishProgram(searchText);
  }

  private isEnglishGroup(group: AcademicGroup): boolean {
    const program = this.programForGroup(group);
    const nomenclature = this.nomenclatureForGroup(group);
    const searchText = this.normalizeSearchText([
      group.programAbbreviation,
      group.programName,
      group.academicArea,
      program?.name,
      program?.academicArea,
      program?.programType,
      nomenclature?.abbreviation,
      nomenclature?.programCode,
      nomenclature?.programName,
    ].join(' '));

    return this.isEnglishProgramCode(group.programAbbreviation)
      || (nomenclature ? this.isEnglishProgramCode(nomenclature.abbreviation) : false)
      || (nomenclature ? this.isEnglishProgramCode(nomenclature.programCode) : false)
      || this.referencesEnglishProgram(searchText);
  }

  private isHealthPostgraduateFallback(group: AcademicGroup): boolean {
    if (!this.isPostgraduateGroup(group) || this.isCampusTupGroup(group)) {
      return false;
    }

    const program = this.programForGroup(group);
    const searchText = this.normalizeSearchText([
      program?.programType,
      program?.name,
      group.programName,
    ].join(' '));

    return searchText.includes('especialidad')
      || searchText.includes('especializacion')
      || this.referencesHealthFaculty(searchText);
  }

  private isActiveGroup(group: AcademicGroup): boolean {
    return ACTIVE_TEXT_MARKERS.includes(this.normalizeSearch(String(group.status ?? '')));
  }

  private groupBelongsToCycle(group: AcademicGroup, cycleCode: string): boolean {
    const normalizedCycle = cycleCode.trim().toUpperCase();
    const normalizedGroupCycle = group.cycleCode.trim().toUpperCase();
    const normalizedFullGroup = group.fullGroup.trim().toUpperCase();

    return normalizedGroupCycle === normalizedCycle
      || normalizedFullGroup.startsWith(`${normalizedCycle} `);
  }

  private isCampusTupGroup(group: AcademicGroup): boolean {
    const program = this.programForGroup(group);
    const nomenclature = this.nomenclatureForGroup(group);
    const academicArea = this.normalizeSearchText([
      group.academicArea,
      program?.academicArea,
      nomenclature?.notes,
    ].join(' '));

    return academicArea.includes('campus tup') || academicArea === 'campus';
  }

  private programAliases(program: string): Set<string> {
    const normalizedProgram = program.trim().toUpperCase();
    const normalizedProgramName = this.normalizeSearchText(program);
    const aliases = new Set<string>();

    if (normalizedProgram) {
      aliases.add(normalizedProgram);
    }

    this.nomenclatures().forEach((nomenclature) => {
      const abbreviation = nomenclature.abbreviation.trim().toUpperCase();
      const programCode = nomenclature.programCode.trim().toUpperCase();
      const nomenclatureName = this.normalizeSearchText(nomenclature.programName);
      const knownAliases = [abbreviation, programCode].filter(Boolean);
      const matchesCode = knownAliases.includes(normalizedProgram);
      const matchesName = Boolean(normalizedProgramName) && nomenclatureName === normalizedProgramName;

      if (matchesCode || matchesName) {
        knownAliases.forEach((alias) => aliases.add(alias));
      }
    });

    this.programs().forEach((catalogProgram) => {
      const programCode = catalogProgram.code.trim().toUpperCase();
      const programName = this.normalizeSearchText(catalogProgram.name);
      const matchesCode = programCode === normalizedProgram;
      const matchesName = Boolean(normalizedProgramName) && programName === normalizedProgramName;

      if (!matchesCode && !matchesName) {
        return;
      }

      aliases.add(programCode);
      this.nomenclatures()
        .filter((nomenclature) => nomenclature.programCode.trim().toUpperCase() === programCode)
        .forEach((nomenclature) => aliases.add(nomenclature.abbreviation.trim().toUpperCase()));
    });

    return aliases;
  }

  private nomenclatureForGroup(group: AcademicGroup) {
    const aliases = this.programAliases(group.programAbbreviation);

    return this.nomenclatures().find((nomenclature) => {
      return aliases.has(nomenclature.abbreviation.trim().toUpperCase())
        || aliases.has(nomenclature.programCode.trim().toUpperCase());
    }) ?? null;
  }

  private programForGroup(group: AcademicGroup) {
    const aliases = this.programAliases(group.programAbbreviation);

    return this.programs().find((program) => aliases.has(program.code.trim().toUpperCase())) ?? null;
  }

  private programForAssignment(assignment: AcademicAssignment) {
    const aliases = this.programAliases(assignment.program);

    return this.programs().find((program) => aliases.has(program.code.trim().toUpperCase())) ?? null;
  }

  private hasStudentEnrollments(studentEnrollments?: string): boolean {
    return Boolean(studentEnrollments?.trim());
  }

  isSpecialAssignment(assignment: AcademicAssignment): boolean {
    return !assignment.group?.trim()
      && (
        Boolean(assignment.special)
        || this.hasStudentEnrollments(assignment.studentEnrollments)
        || this.isPropedeuticAssignment(assignment)
      );
  }

  isSpecialCourseAssignment(assignment: AcademicAssignment): boolean {
    return assignment.assignmentType === 'CURSO_ESPECIAL';
  }

  isPropedeuticAssignment(assignment: AcademicAssignment): boolean {
    return assignment.assignmentType === 'PROPEDEUTICO'
      || this.assignmentsRepository.normalizeMoodleId(assignment.moodleId) === PROPEDEUTIC_MOODLE_ID;
  }

  private specialTypeForAssignment(assignment: AcademicAssignment): SpecialAssignmentOption {
    if (this.isPropedeuticAssignment(assignment)) {
      return 'propedeutic';
    }

    if (this.isSpecialCourseAssignment(assignment)) {
      return 'group';
    }

    return this.isSpecialAssignment(assignment) ? 'enrollments' : 'group';
  }

  displayMoodleId(assignment: AcademicAssignment): string {
    return this.isPropedeuticAssignment(assignment) ? PROPEDEUTIC_MOODLE_LABEL : assignment.moodleId;
  }

  assignmentGroupLabel(assignment: AcademicAssignment): string {
    return this.isSpecialAssignment(assignment) ? 'Sin grupo base' : assignment.group;
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
    const session = this.session();
    const appUser = session?.appUser;

    return {
      createdBy: session?.authUid ?? appUser?.id ?? 'sin-usuario',
      createdByName: appUser?.name ?? session?.displayName ?? 'Usuario SPAI',
      createdByRole: appUser?.role ?? 'Sin rol',
      createdByPrograms: Array.from(this.assignedProgramCodes()),
    };
  }

  private coordinatorMatchesCurrentUser(coordinator: string): boolean {
    const session = this.session();
    const appUser = session?.appUser;
    const normalizedCoordinator = this.normalizeSearchText(coordinator);

    if (!normalizedCoordinator) {
      return false;
    }

    return [
      appUser?.name,
      appUser?.email,
      appUser?.id,
      appUser?.authUid,
      session?.email,
      session?.displayName,
      session?.authUid,
    ].some((value) => this.normalizeSearchText(value ?? '') === normalizedCoordinator);
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
    const minimumOptions = Math.min(this.lockedShareGroups().length, availableOptions);

    if (!availableOptions) {
      return 0;
    }

    const numericValue = Math.trunc(Number(value));
    const fallbackValue = Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 1;

    return Math.min(Math.max(fallbackValue, Math.max(minimumOptions, 1)), availableOptions);
  }

  private syncSharedGroups(): void {
    const availableGroups = new Set(this.sharedGroupOptions().map((group) => group.fullGroup));
    const lockedGroups = this.lockedShareGroups()
      .filter((group) => group !== this.assignmentForm.group)
      .filter((group) => availableGroups.has(group));
    const selectedGroups = this.mergeSharedGroupNames([
      ...lockedGroups,
      ...this.assignmentForm.shareGroups,
    ])
      .filter((group) => group !== this.assignmentForm.group)
      .filter((group) => availableGroups.has(group));

    const extraGroups = selectedGroups.filter((group) => !lockedGroups.includes(group));
    const maxGroups = Math.max(this.assignmentForm.sharedGroupCount, lockedGroups.length);

    this.assignmentForm.shareGroups = [
      ...lockedGroups,
      ...extraGroups,
    ].slice(0, maxGroups);

    if (this.assignmentForm.shared) {
      this.assignmentForm.sharedGroupCount = this.normalizeSharedGroupCount(this.assignmentForm.sharedGroupCount);
    }
  }

  private isSameOperationalGroup(candidate: AcademicGroup, baseGroup: AcademicGroup | null): boolean {
    if (!baseGroup) {
      return false;
    }

    const candidateFullGroup = candidate.fullGroup.trim().toUpperCase();
    const baseFullGroup = baseGroup.fullGroup.trim().toUpperCase();
    const candidateGroupCode = candidate.groupCode.trim().toUpperCase();
    const candidateSection = candidate.section.trim().toUpperCase();
    const baseGroupCode = baseGroup.groupCode.trim().toUpperCase();
    const baseSection = baseGroup.section.trim().toUpperCase();
    const hasComparableSignature = !!candidateGroupCode && !!candidateSection && !!baseGroupCode && !!baseSection;

    return candidateFullGroup === baseFullGroup
      || (
        hasComparableSignature
        && candidateGroupCode === baseGroupCode
        && candidateSection === baseSection
      );
  }

  private prepareNextAssignmentForm(): void {
    this.editingAssignmentId = null;
    this.formErrors = [];
    this.shareGroupSearch.set('');
    this.lockedShareGroups.set([]);
    this.activeComboField = null;
    this.assignmentForm = this.emptyForm(this.activeCycle()?.code ?? '', this.isEnrollmentCaptureTab());
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
    wasEditing: boolean,
  ): Promise<unknown> {
    return this.systemNotificationsRepository.create({
      title: wasEditing ? 'Asignacion editada para compartir' : 'Clase compartida asignada',
      message: wasEditing
        ? `${actor.createdByName} edito la asignacion ${subjectId} - ${subjectName} para compartirla de ${sourceGroup} con ${destinationGroup}, docente ${teacherName}, ciclo ${cycle}.`
        : `${actor.createdByName} asigno la clase compartida ${subjectId} - ${subjectName} de ${sourceGroup} con ${destinationGroup}, docente ${teacherName}, ciclo ${cycle}.`,
      type: 'CLASE_COMPARTIDA',
      entity: 'asignaciones',
      entityId: sharedAssignmentId,
      actorId: actor.createdBy,
      actorName: actor.createdByName,
      actorRole: actor.createdByRole,
    });
  }

  private notifyAcademicCoordinatorsAboutSharedClass(
    actor: Pick<UpsertAssignmentPayload, 'createdBy' | 'createdByName' | 'createdByRole' | 'createdByPrograms'>,
    sharedAssignmentId: string,
    cycle: string,
    subjectId: string,
    subjectName: string,
    sourceGroup: string,
    destinationGroup: AcademicGroup,
    teacherName: string,
    wasEditing: boolean,
  ): Promise<unknown>[] {
    const targetProgram = this.sharedNotificationProgramTarget(destinationGroup);

    if (!targetProgram) {
      return [];
    }

    const notificationId = this.sharedAcademicNotificationId(sharedAssignmentId, cycle, targetProgram, destinationGroup.fullGroup);

    return [
      this.firestoreSafeNotificationTask(this.systemNotificationsRepository.createForAcademicCoordinatorOnce(notificationId, {
        title: wasEditing ? 'Clase compartida actualizada' : 'Clase compartida con tu grupo',
        message: wasEditing
          ? `${actor.createdByName} actualizo la clase compartida ${subjectId} - ${subjectName}. Grupo base: ${sourceGroup}. Grupo de tu coordinacion: ${destinationGroup.fullGroup}. Docente ${teacherName}, ciclo ${cycle}.`
          : `${actor.createdByName} compartio la clase ${subjectId} - ${subjectName} con el grupo ${destinationGroup.fullGroup} de tu coordinacion. Grupo base: ${sourceGroup}. Docente ${teacherName}, ciclo ${cycle}.`,
        type: 'CLASE_COMPARTIDA',
        entity: 'asignaciones',
        entityId: sharedAssignmentId,
        targetUserId: targetProgram,
        actorId: actor.createdBy,
        actorName: actor.createdByName,
        actorRole: actor.createdByRole,
      })),
    ];
  }

  private sharedNotificationProgramTarget(group: AcademicGroup): string {
    return group.programAbbreviation.trim().toUpperCase();
  }

  private sharedAcademicNotificationId(assignmentId: string, cycle: string, targetProgram: string, group: string): string {
    return [
      'clase-compartida-destino',
      assignmentId,
      cycle,
      targetProgram,
      group,
    ]
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private firestoreSafeNotificationTask(task: Promise<unknown>): Promise<unknown> {
    return task.catch((error) => {
      console.warn('No se pudo crear una notificacion academica de clase compartida', error);
      return undefined;
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
      specialType: special ? 'enrollments' : 'group',
      propedeutic: false,
      studentEnrollments: '',
    };
  }

  private isEnrollmentCaptureTab(tab = this.modeTab()): boolean {
    return tab === 'Especiales' || tab === 'Inglés';
  }
}
