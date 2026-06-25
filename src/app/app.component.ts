import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import {
  SystemNotification,
  SystemNotificationsRepository,
} from './core/data/system-notifications.repository';
import { UserSessionService } from './core/auth/user-session.service';
import { LoginPageComponent } from './features/auth/pages/login-page/login-page.component';
import { CyclesRepository } from './features/cycles/data/cycles.repository';
import { SystemRequestsRepository } from './features/system-requests/data/system-requests.repository';
import { AppUser, ModuleAccess } from './features/users/data/users.repository';
import { ConfirmationDialogComponent } from './shared/confirmation/confirmation-dialog.component';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  moduleKey: keyof ModuleAccess;
}

const ACADEMIC_COORDINATION_NAV_MODULES: ReadonlyArray<keyof ModuleAccess> = [
  'dashboard',
  'nomenclaturas',
  'grupos',
  'docentes',
  'asignaturas',
  'asignaciones',
];

@Component({
  selector: 'spai-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LoginPageComponent, ConfirmationDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly cyclesRepository = inject(CyclesRepository);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly systemNotificationsRepository = inject(SystemNotificationsRepository);
  private readonly systemRequestsRepository = inject(SystemRequestsRepository);
  private readonly userSessionService = inject(UserSessionService);
  private readonly isHeaderCollapsedSignal = signal(false);
  private readonly isProfileMenuOpenSignal = signal(false);
  private readonly isNotificationsMenuOpenSignal = signal(false);

  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly hasActiveAccess = computed(
    () => this.isAuthenticated() && this.userSessionService.session()?.appUser?.status === 'Activo',
  );
  readonly isHeaderCollapsed = this.isHeaderCollapsedSignal.asReadonly();
  readonly isProfileMenuOpen = this.isProfileMenuOpenSignal.asReadonly();
  readonly isNotificationsMenuOpen = this.isNotificationsMenuOpenSignal.asReadonly();
  readonly systemNotifications = this.systemNotificationsRepository.notifications;
  readonly unreadSystemNotifications = computed(() => {
    const session = this.userSessionService.session();
    const appUser = session?.appUser;

    if (!appUser || !session) {
      return [];
    }

    const storedNotifications = this.systemNotifications().filter((notification) =>
      !this.systemNotificationsRepository.isReadByUser(notification, appUser.id, session.authUid),
    );
    const role = appUser.role.toLowerCase();
    const requestNotifications = role.includes('sistemas')
      ? this.systemRequestsRepository.requests()
          .filter((request) => request.status === 'PENDIENTE')
          .map((request): SystemNotification => ({
            id: `solicitud-${request.id}`,
            title: 'Nueva solicitud a Sistemas',
            message: `${request.requestedByName} envio una solicitud: ${request.title}.`,
            target: 'SISTEMAS',
            type: 'SOLICITUD_SISTEMAS',
            entity: 'solicitudes_sistemas',
            entityId: request.id,
            actorId: request.requestedBy,
            actorName: request.requestedByName,
            actorRole: request.requestedByRole,
            readBy: [],
            createdAt: request.createdAt,
          }))
          .filter((notification) =>
            !this.systemNotificationsRepository.isReadByUser(notification, appUser.id, session.authUid),
          )
      : [];

    return [...storedNotifications, ...requestNotifications]
      .filter((notification, index, notifications) =>
        notifications.findIndex((item) => item.entityId === notification.entityId && item.type === notification.type) === index,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
  readonly unreadSystemNotificationsCount = computed(() => this.unreadSystemNotifications().length);
  readonly visibleNavItems = computed(() => {
    const appUser = this.userSessionService.session()?.appUser;

    if (!appUser || appUser.status !== 'Activo') {
      return [];
    }

    const role = appUser.role.toLowerCase();
    const isSystemsUser = role.includes('sistemas');
    const isAcademicCoordinator = role.includes('acad');

    return this.navItems.filter((item) => {
      if (item.moduleKey === 'dashboard') {
        return true;
      }

      if (isSystemsUser) {
        return true;
      }

      if (isAcademicCoordinator) {
        return this.canAcademicCoordinatorAccessModule(item.moduleKey);
      }

      return appUser.access?.[item.moduleKey] === true;
    });
  });
  readonly userInitials = computed(() => {
    const session = this.userSessionService.session();
    const source = session?.appUser?.name ?? session?.displayName ?? 'Usuario SPAI';

    return source
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase();
  });
  readonly userDisplayName = computed(() => {
    const session = this.userSessionService.session();
    const name = session?.appUser?.name ?? session?.displayName ?? 'Usuario SPAI';

    return name;
  });
  readonly userRoleLabel = computed(() => {
    const role = this.userSessionService.session()?.appUser?.role ?? 'Usuario';

    return role;
  });
  readonly activeCycle = this.cyclesRepository.activeCycle;

  constructor() {
    effect(() => {
      const appUser = this.userSessionService.session()?.appUser;

      if (appUser?.status !== 'Activo') {
        return;
      }

      if (!this.canAccessPath(this.router.url, appUser)) {
        void this.router.navigate(['/']);
      }
    });
  }

  get activeCycleLabel(): string {
    const cycle = this.activeCycle();

    if (!cycle) {
      return 'Pendiente de configurar';
    }

    if (!cycle.tentativeCaptureCloseAt) {
      return cycle.code;
    }

    return `${cycle.code} - cierre de captura ${this.formatCycleDate(cycle.tentativeCaptureCloseAt)}`;
  }

  private formatCycleDate(value: string): string {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00`)
      : new Date(value);

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  isAssignmentsRoute(): boolean {
    return this.router.url.split('?')[0].replace(/\/+$/, '') === '/asignaciones';
  }

  async toggleSession(): Promise<void> {
    this.isProfileMenuOpenSignal.set(false);
    this.isNotificationsMenuOpenSignal.set(false);
    await this.authService.signOut();
    void this.router.navigate(['/']);
  }

  toggleHeader(): void {
    this.isHeaderCollapsedSignal.update((isCollapsed) => !isCollapsed);
    this.isProfileMenuOpenSignal.set(false);
    this.isNotificationsMenuOpenSignal.set(false);
  }

  toggleProfileMenu(): void {
    this.isProfileMenuOpenSignal.update((isOpen) => !isOpen);
    this.isNotificationsMenuOpenSignal.set(false);
  }

  toggleNotificationsMenu(): void {
    this.isNotificationsMenuOpenSignal.update((isOpen) => !isOpen);
    this.isProfileMenuOpenSignal.set(false);
  }

  markNotificationAsRead(notification: SystemNotification): void {
    void this.systemNotificationsRepository.markAsRead(notification.id);
  }

  markAllNotificationsAsRead(): void {
    this.unreadSystemNotifications().forEach((notification) => {
      this.markNotificationAsRead(notification);
    });
  }

  openNotification(notification: SystemNotification): void {
    this.markNotificationAsRead(notification);
    this.isNotificationsMenuOpenSignal.set(false);

    if (notification.type === 'DOCENTE_NUEVO' || notification.type === 'DOCENTE_VALIDADO' || notification.entity === 'docentes') {
      const appUser = this.userSessionService.session()?.appUser;

      if (appUser && !this.canAccessPath('/docentes', appUser)) {
        void this.router.navigate(['/']);
        return;
      }

      void this.router.navigate(['/docentes']);
      return;
    }

    if (notification.type === 'SOLICITUD_SISTEMAS' || notification.entity === 'solicitudes_sistemas') {
      const appUser = this.userSessionService.session()?.appUser;

      if (appUser && !this.canAccessPath('/solicitudes', appUser)) {
        void this.router.navigate(['/']);
        return;
      }

      void this.router.navigate(['/solicitudes'], {
        queryParams: { solicitud: notification.entityId },
      });
    }
  }

  isNotificationUnread(notification: SystemNotification): boolean {
    const session = this.userSessionService.session();
    const appUser = session?.appUser;

    return !!appUser
      && !!session
      && !this.systemNotificationsRepository.isReadByUser(notification, appUser.id, session.authUid);
  }

  navBadgeCount(item: NavItem): number {
    return 0;
  }

  private canAccessPath(url: string, appUser: AppUser): boolean {
    const path = url.split('?')[0].replace(/\/+$/, '') || '/';
    const navItem = this.navItems.find((item) => item.path === path);

    if (!navItem) {
      return true;
    }

    if (navItem.moduleKey === 'dashboard') {
      return true;
    }

    const role = appUser.role.toLowerCase();
    const isSystemsUser = role.includes('sistemas');
    const isAcademicCoordinator = role.includes('acad');

    if (isSystemsUser) {
      return true;
    }

    if (isAcademicCoordinator) {
      return this.canAcademicCoordinatorAccessModule(navItem.moduleKey);
    }

    return appUser.access?.[navItem.moduleKey] === true;
  }

  private canAcademicCoordinatorAccessModule(moduleKey: keyof ModuleAccess): boolean {
    return ACADEMIC_COORDINATION_NAV_MODULES.includes(moduleKey);
  }

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/', moduleKey: 'dashboard', icon: 'M3 11.5 12 4l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
    { label: 'Usuarios', path: '/usuarios', moduleKey: 'usuarios', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6' },
    { label: 'Ciclos', path: '/ciclos', moduleKey: 'ciclos', icon: 'M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01' },
    { label: 'Nomenclaturas', path: '/nomenclaturas', moduleKey: 'nomenclaturas', icon: 'M7 7h10M7 12h10M7 17h7M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z' },
    { label: 'Grupos', path: '/grupos', moduleKey: 'grupos', icon: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M21 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
    { label: 'Docentes', path: '/docentes', moduleKey: 'docentes', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8' },
    { label: 'Asignaturas', path: '/asignaturas', moduleKey: 'asignaturas', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z' },
    { label: 'Asignaciones', path: '/asignaciones', moduleKey: 'asignaciones', icon: 'M9 5h6M9 13h6M9 17h4M8 3h8l1 3h3v15H4V6h3z' },
    { label: 'Solicitudes', path: '/solicitudes', moduleKey: 'solicitudes', icon: 'M22 2 11 13M22 2l-7 20-4-9-9-4z' },
    { label: 'Ligas Meet', path: '/ligas-meet', moduleKey: 'ligasMeet', icon: 'M15 10l5-3v10l-5-3v4H4V6h11z' },
    { label: 'Moodle', path: '/moodle', moduleKey: 'moodle', icon: 'M3 9l9-5 9 5-9 5zM7 12v4c3 2 7 2 10 0v-4' },
    { label: 'Bitacora', path: '/bitacora', moduleKey: 'bitacora', icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
  ];
}
