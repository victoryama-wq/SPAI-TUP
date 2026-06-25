import { Component, computed, inject, signal } from '@angular/core';
import { UserSessionService } from '../../../core/auth/user-session.service';
import { AssignmentsRepository } from '../../assignments/data/assignments.repository';
import { AcademicCycle, CyclesRepository } from '../../cycles/data/cycles.repository';
import { GroupsRepository } from '../../groups/data/groups.repository';
import { NomenclaturesRepository } from '../../nomenclatures/data/nomenclatures.repository';
import { ProgramsRepository } from '../../nomenclatures/data/programs.repository';
import { SharedRequestsRepository } from '../../requests/data/shared-requests.repository';
import { SubjectsRepository } from '../../subjects/data/subjects.repository';
import { TeachersRepository } from '../../teachers/data/teachers.repository';
import { CustomRolesRepository } from '../../users/data/custom-roles.repository';
import { UsersRepository } from '../../users/data/users.repository';
import { SystemNotificationsRepository } from '../../../core/data/system-notifications.repository';
import {
  SystemRequestsRepository,
  SystemRequestStatus,
  SystemRequestType,
} from '../../system-requests/data/system-requests.repository';

interface MetricCard {
  label: string;
  value: string;
  hint: string;
  icon: string;
}

interface RealProgressCard {
  label: string;
  value: string;
  hint: string;
  icon: string;
  tone?: 'success' | 'warning' | 'info';
}

interface DashboardUser {
  greeting: 'Bienvenida' | 'Bienvenido';
  roleTitle: string;
  name: string;
  accessLabel: string;
  lastAccess: string;
}

interface QuickSystemRequestAction {
  type: SystemRequestType;
  label: string;
  description: string;
  placeholder: string;
}

interface RecentSystemRequest {
  title: string;
  detail: string;
  status: SystemRequestStatus;
  statusLabel: string;
  createdLabel: string;
}

@Component({
  selector: 'spai-dashboard-page',
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css',
})
export class DashboardPageComponent {
  private readonly userSessionService = inject(UserSessionService);
  private readonly usersRepository = inject(UsersRepository);
  private readonly customRolesRepository = inject(CustomRolesRepository);
  private readonly cyclesRepository = inject(CyclesRepository);
  private readonly nomenclaturesRepository = inject(NomenclaturesRepository);
  private readonly programsRepository = inject(ProgramsRepository);
  private readonly groupsRepository = inject(GroupsRepository);
  private readonly teachersRepository = inject(TeachersRepository);
  private readonly subjectsRepository = inject(SubjectsRepository);
  private readonly assignmentsRepository = inject(AssignmentsRepository);
  private readonly sharedRequestsRepository = inject(SharedRequestsRepository);
  private readonly systemRequestsRepository = inject(SystemRequestsRepository);
  private readonly systemNotificationsRepository = inject(SystemNotificationsRepository);
  readonly isQuickRequestMenuOpen = signal(false);
  readonly selectedQuickRequest = signal<QuickSystemRequestAction | null>(null);
  readonly quickRequestDetail = signal('');
  readonly quickRequestError = signal('');
  readonly isSavingQuickRequest = signal(false);

  readonly currentUser = computed<DashboardUser>(() => {
    const session = this.userSessionService.session();
    const appUser = session?.appUser;
    const isActiveAppUser = appUser?.status === 'Activo';

    return {
      greeting: this.greetingForUser(appUser?.name ?? '', appUser?.greetingGender),
      roleTitle: isActiveAppUser ? appUser.role : 'SPAI TUP',
      name: isActiveAppUser ? appUser.name : '',
      accessLabel: isActiveAppUser ? 'Panel operativo' : 'Sesion Firebase',
      lastAccess: session ? 'Hoy' : 'Pendiente de iniciar sesion',
    };
  });

  get welcomeMessage(): string {
    const user = this.currentUser();

    return [user.greeting, user.roleTitle, user.name].filter(Boolean).join(' ');
  }

  readonly metrics = computed<MetricCard[]>(() => {
    const appUser = this.userSessionService.session()?.appUser;
    const isAcademicCoordinator = appUser?.role.toLowerCase().includes('acad') === true;
    const users = this.usersRepository.users();
    const cycles = this.cyclesRepository.cycles();
    const teachers = this.teachersRepository.teachers();
    const activeCycle = this.activeCycle();

    if (isAcademicCoordinator) {
      const assignedPrograms = this.academicProgramCodesForCurrentUser();
      const assignedProgramsCount = assignedPrograms.length;

      return [
        {
          label: 'Docentes registrados',
          value: String(teachers.length),
          hint: 'Catalogo global de docentes',
          icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
        },
        {
          label: 'Ciclos registrados',
          value: String(cycles.length),
          hint: 'Consulta operativa',
          icon: 'M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
        },
        {
          label: 'Ciclo activo',
          value: activeCycle?.code ?? '--',
          hint: this.activeCycleHint(activeCycle),
          icon: 'M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
        },
        {
          label: 'Programas asignados',
          value: String(assignedProgramsCount),
          hint: assignedPrograms.length ? assignedPrograms.join(', ') : 'Sin programas asignados',
          icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z',
        },
      ];
    }

    return [
      {
        label: 'Usuarios activos',
        value: String(users.filter((user) => user.status === 'Activo').length),
        hint: 'Coleccion usuarios',
        icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6',
      },
      {
        label: 'Ciclos registrados',
        value: String(cycles.length),
        hint: 'Coleccion ciclos',
        icon: 'M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
      },
      {
        label: 'Ciclo activo',
        value: activeCycle?.code ?? '--',
        hint: this.activeCycleHint(activeCycle),
        icon: 'M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
      },
      {
        label: 'Roles personalizados',
        value: String(this.customRolesRepository.roleTemplates().length),
        hint: 'Coleccion roles_personalizados',
        icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
      },
    ];
  });

  readonly activeCycle = this.cyclesRepository.activeCycle;
  readonly isAcademicCoordinator = computed(() => {
    const appUser = this.userSessionService.session()?.appUser;

    return appUser?.status === 'Activo' && appUser.role.toLowerCase().includes('acad');
  });
  readonly quickRequestActions: QuickSystemRequestAction[] = [
    {
      type: 'REABRIR_CAPTURA',
      label: 'Reabrir captura',
      description: 'Solicita a Sistemas habilitar captura del ciclo.',
      placeholder: 'Indica que necesitas reabrir y el motivo de la solicitud.',
    },
    {
      type: 'ALTA_GRUPO',
      label: 'Alta de grupo',
      description: 'Pide que Sistemas registre un grupo faltante.',
      placeholder: 'Escribe ciclo, programa, grupo completo y cualquier dato necesario.',
    },
    {
      type: 'CAMBIAR_ID_ASIGNATURA',
      label: 'Cambiar ID de asignatura',
      description: 'Solicita correccion de ID en una asignatura.',
      placeholder: 'Indica grupo, asignatura, ID actual e ID correcto.',
    },
  ];
  readonly recentSystemRequests = computed<RecentSystemRequest[]>(() => {
    const session = this.userSessionService.session();

    if (!session) {
      return [];
    }

    return this.systemRequestsRepository.requests()
      .filter((request) => request.requestedBy === session.authUid)
      .slice(0, 5)
      .map((request) => ({
        title: request.title,
        detail: request.detail,
        status: request.status,
        statusLabel: this.requestStatusLabel(request.status),
        createdLabel: this.shortDate(request.createdAt),
      }));
  });
  readonly activeSystemRequestsCount = computed(() =>
    this.recentSystemRequests().filter((request) => ['PENDIENTE', 'EN_PROCESO'].includes(request.status)).length,
  );

  readonly realProgress = computed<RealProgressCard[]>(() => {
    const appUser = this.userSessionService.session()?.appUser;
    const isAcademicCoordinator = appUser?.role.toLowerCase().includes('acad') === true;
    const activeCycleCode = this.activeCycle()?.code ?? '';
    const users = this.usersRepository.users();
    const nomenclatures = this.nomenclaturesRepository.nomenclatures();
    const groups = this.groupsRepository.groups();
    const teachers = this.teachersRepository.teachers();
    const subjects = this.subjectsRepository.subjects();
    const assignments = this.assignmentsRepository.assignments();
    const requests = this.sharedRequestsRepository.requests();
    const cycleGroups = activeCycleCode
      ? groups.filter((group) => group.cycleCode === activeCycleCode)
      : [];
    const cycleAssignments = activeCycleCode
      ? assignments.filter((assignment) => assignment.cycle === activeCycleCode)
      : [];
    const activeNomenclatures = nomenclatures.filter((item) => item.status === 'ACTIVA').length;
    const activeUsers = users.filter((user) => user.status === 'Activo').length;
    const validatedTeachers = teachers.filter((teacher) => teacher.status === 'VALIDADO').length;
    const pendingTeachers = teachers.filter((teacher) => teacher.status === 'PENDIENTE').length;
    const activeSubjects = subjects.filter((subject) => subject.status === 'Activo').length;
    const pendingRequests = requests.filter((request) => request.status === 'PENDIENTE').length;
    const moodleLoadedAssignments = cycleAssignments
      .filter((assignment) => assignment.status === 'CARGADO_MOODLE' || assignment.status === 'VALIDADO')
      .length;
    const assignedPrograms = this.academicProgramCodesForCurrentUser();
    const assignedProgramsCount = assignedPrograms.length;
    const coordinatorAssignments = isAcademicCoordinator
      ? assignments.filter((assignment) => assignedPrograms.includes(assignment.program.trim().toUpperCase()))
      : [];
    const coordinatorSubjectCount = new Set(coordinatorAssignments.map((assignment) => assignment.subjectId)).size;

    const progressCards: RealProgressCard[] = [
      {
        label: isAcademicCoordinator ? 'Programas asignados' : 'Usuarios registrados',
        value: isAcademicCoordinator ? String(assignedProgramsCount) : String(users.length),
        hint: isAcademicCoordinator ? 'Programas visibles para tu coordinacion' : `${activeUsers} activos en Firestore`,
        icon: isAcademicCoordinator
          ? 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z'
          : 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6',
        tone: isAcademicCoordinator ? (assignedProgramsCount > 0 ? 'success' : 'info') : activeUsers > 0 ? 'success' : 'info',
      },
      ...(
        isAcademicCoordinator
          ? []
          : [
              {
                label: 'Nomenclaturas',
                value: String(nomenclatures.length),
                hint: `${activeNomenclatures} activas`,
                icon: 'M7 7h10M7 12h10M7 17h7M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
                tone: activeNomenclatures > 0 ? 'success' : 'info',
              } satisfies RealProgressCard,
            ]
      ),
      {
        label: 'Grupos del ciclo activo',
        value: String(cycleGroups.length),
        hint: activeCycleCode ? `Ciclo ${activeCycleCode}` : 'Sin ciclo activo',
        icon: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M21 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
        tone: cycleGroups.length > 0 ? 'success' : 'info',
      },
      {
        label: 'Docentes',
        value: String(teachers.length),
        hint: `${validatedTeachers} validados, ${pendingTeachers} pendientes`,
        icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
        tone: pendingTeachers > 0 ? 'warning' : validatedTeachers > 0 ? 'success' : 'info',
      },
      {
        label: 'Asignaturas',
        value: String(isAcademicCoordinator ? coordinatorSubjectCount : subjects.length),
        hint: isAcademicCoordinator
          ? `${coordinatorAssignments.length} asignaciones en tus programas`
          : `${activeSubjects} activas en catalogo`,
        icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z',
        tone: (isAcademicCoordinator ? coordinatorSubjectCount : activeSubjects) > 0 ? 'success' : 'info',
      },
      {
        label: 'Asignaciones del ciclo',
        value: String(cycleAssignments.length),
        hint: `${moodleLoadedAssignments} cargadas en Moodle`,
        icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
        tone: cycleAssignments.length > 0 ? 'success' : 'info',
      },
      {
        label: 'Solicitudes pendientes',
        value: String(pendingRequests),
        hint: `${requests.length} solicitudes registradas`,
        icon: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
        tone: pendingRequests > 0 ? 'warning' : 'success',
      },
    ];

    return progressCards;
  });

  openQuickRequestMenu(): void {
    this.isQuickRequestMenuOpen.set(true);
    this.selectedQuickRequest.set(null);
    this.quickRequestDetail.set('');
    this.quickRequestError.set('');
  }

  openQuickRequest(action: QuickSystemRequestAction): void {
    this.isQuickRequestMenuOpen.set(false);
    this.selectedQuickRequest.set(action);
    this.quickRequestDetail.set('');
    this.quickRequestError.set('');
  }

  closeQuickRequest(): void {
    if (this.isSavingQuickRequest()) {
      return;
    }

    this.isQuickRequestMenuOpen.set(false);
    this.selectedQuickRequest.set(null);
    this.quickRequestDetail.set('');
    this.quickRequestError.set('');
  }

  backToQuickRequestMenu(): void {
    if (this.isSavingQuickRequest()) {
      return;
    }

    this.isQuickRequestMenuOpen.set(true);
    this.selectedQuickRequest.set(null);
    this.quickRequestDetail.set('');
    this.quickRequestError.set('');
  }

  updateQuickRequestDetail(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.quickRequestDetail.set(input.value);
    this.quickRequestError.set('');
  }

  async saveQuickRequest(): Promise<void> {
    const action = this.selectedQuickRequest();
    const session = this.userSessionService.session();
    const appUser = session?.appUser;
    const detail = this.quickRequestDetail().trim();

    if (!action || !appUser || !session) {
      return;
    }

    if (detail.length < 10) {
      this.quickRequestError.set('Agrega un poco mas de detalle para que Sistemas pueda atender la solicitud.');
      return;
    }

    this.isSavingQuickRequest.set(true);
    this.quickRequestError.set('');

    try {
      const requestedPrograms = this.academicProgramCodesForCurrentUser();
      const requestId = await this.systemRequestsRepository.createRequest({
        type: action.type,
        title: action.label,
        detail,
        cycle: this.activeCycle()?.code ?? 'Sin ciclo activo',
        requestedBy: session.authUid,
        requestedByName: appUser.name,
        requestedByRole: appUser.role,
        requestedByPrograms: requestedPrograms,
      });

      try {
        await this.systemNotificationsRepository.create({
          title: 'Nueva solicitud a Sistemas',
          message: `${appUser.name} envio una solicitud: ${action.label}.`,
          type: 'SOLICITUD_SISTEMAS',
          entity: 'solicitudes_sistemas',
          entityId: requestId,
          actorId: appUser.id,
          actorName: appUser.name,
          actorRole: appUser.role,
        });
      } catch (notificationError) {
        console.warn('La solicitud se guardo, pero no se pudo crear la notificacion auxiliar.', notificationError);
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.quickRequestError.set(
        `No se pudo enviar la solicitud. ${message}. UID: ${session.authUid} | Rol: ${appUser.role} | Estado: ${appUser.status}`,
      );
      return;
    } finally {
      this.isSavingQuickRequest.set(false);
    }

    this.closeQuickRequest();
  }

  private requestStatusLabel(status: SystemRequestStatus): string {
    const labels: Record<SystemRequestStatus, string> = {
      PENDIENTE: 'Pendiente',
      EN_PROCESO: 'En proceso',
      ATENDIDA: 'Atendida',
      RECHAZADA: 'Rechazada',
    };

    return labels[status];
  }

  private activeCycleHint(activeCycle: AcademicCycle | null): string {
    if (!activeCycle) {
      return 'Pendiente de activar';
    }

    if (!activeCycle.tentativeCaptureCloseAt) {
      return `${activeCycle.status} - sin cierre tentativo`;
    }

    return `${activeCycle.status} - cierre tentativo ${this.formatDisplayDate(activeCycle.tentativeCaptureCloseAt)}`;
  }

  private formatDisplayDate(value: string): string {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00`)
      : new Date(value);

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private academicProgramCodesForCurrentUser(): string[] {
    const appUser = this.userSessionService.session()?.appUser;

    if (!appUser) {
      return [];
    }

    const userName = this.normalizeIdentity(appUser.name);
    const userEmail = this.normalizeIdentity(appUser.email);
    const directPrograms = Array.isArray(appUser.assignedPrograms)
      ? appUser.assignedPrograms.map((program) => program.trim().toUpperCase()).filter(Boolean)
      : [];
    const coordinatorPrograms = this.programsRepository.programs()
      .filter((program) => {
        const coordinator = this.normalizeIdentity(program.coordinator);

        return !!coordinator && (coordinator === userName || coordinator === userEmail);
      })
      .map((program) => program.code.trim().toUpperCase())
      .filter(Boolean);

    return Array.from(new Set([...directPrograms, ...coordinatorPrograms]))
      .sort((a, b) => a.localeCompare(b, 'es'));
  }

  private normalizeIdentity(value: string): string {
    return value.trim().toLowerCase();
  }

  private greetingForUser(name: string, greetingGender?: string): 'Bienvenida' | 'Bienvenido' {
    if (greetingGender === 'Femenino') {
      return 'Bienvenida';
    }

    if (greetingGender === 'Masculino') {
      return 'Bienvenido';
    }

    const firstName = name.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    const feminineNames = new Set([
      'lizett',
      'lizet',
      'lizeth',
      'lizbeth',
      'maria',
      'maría',
      'ana',
      'karla',
      'carla',
      'laura',
      'paola',
      'alejandra',
      'guadalupe',
    ]);

    return feminineNames.has(firstName) || firstName.endsWith('a') ? 'Bienvenida' : 'Bienvenido';
  }

  private shortDate(value: string): string {
    if (!value) {
      return 'Sin fecha';
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }
}
