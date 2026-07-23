import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { InactivityLogoutService } from './core/auth/inactivity-logout.service';
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

interface RouteContext {
  kicker: string;
  title: string;
  description: string;
  metrics?: RouteMetric[];
}

interface RouteMetric {
  value: number;
  label: string;
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
  private readonly inactivityLogoutService = inject(InactivityLogoutService);
  private readonly router = inject(Router);
  private readonly systemNotificationsRepository = inject(SystemNotificationsRepository);
  private readonly systemRequestsRepository = inject(SystemRequestsRepository);
  private readonly userSessionService = inject(UserSessionService);
  private readonly isHeaderCollapsedSignal = signal(false);
  private readonly isProfileMenuOpenSignal = signal(false);
  private readonly isNotificationsMenuOpenSignal = signal(false);
  private readonly captureCloseAlertDismissedSignal = signal(false);
  private readonly captureCloseAlertStoragePrefix = 'spai:capture-close-alert:';

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
  readonly captureCloseAlertVisible = computed(() => {
    const session = this.userSessionService.session();
    const appUser = session?.appUser;
    const cycle = this.activeCycle();
    this.captureCloseAlertDismissedSignal();

    if (!appUser || appUser.status !== 'Activo' || !cycle?.tentativeCaptureCloseAt) {
      return false;
    }

    if (!this.isAcademicCoordinationUser(appUser)) {
      return false;
    }

    const closeDate = this.parseCycleDate(cycle.tentativeCaptureCloseAt);

    if (!closeDate) {
      return false;
    }

    const daysUntilClose = this.daysUntilDate(closeDate);

    if (daysUntilClose < 0 || daysUntilClose > 4) {
      return false;
    }

    const alertKey = this.captureCloseAlertKey(cycle.code, cycle.tentativeCaptureCloseAt);

    return !this.isCaptureCloseAlertDismissed(alertKey);
  });

  constructor() {
    void this.inactivityLogoutService;

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

    return `${cycle.code} - Cierre de Captura ${this.formatCycleDate(cycle.tentativeCaptureCloseAt)}`;
  }

  get activeCycleCodeLabel(): string {
    return this.activeCycle()?.code ?? 'Pendiente';
  }

  get activeCycleCaptureCloseLabel(): string {
    const captureCloseAt = this.activeCycle()?.tentativeCaptureCloseAt;

    return captureCloseAt ? this.formatCycleDate(captureCloseAt).toUpperCase() : '';
  }

  get captureCloseAlertDateLabel(): string {
    const captureCloseAt = this.activeCycle()?.tentativeCaptureCloseAt;

    return captureCloseAt ? this.formatCycleDate(captureCloseAt) : 'la fecha configurada';
  }

  get compactRouteContext(): RouteContext | null {
    const path = this.router.url.split('?')[0].replace(/\/+$/, '') || '/';

    if (path === '/moodle') {
      return {
        kicker: 'Operacion Moodle',
        title: 'Panel Moodle',
        description: 'Configura categorias, plantillas y lotes para crear cursos.',
      };
    }

    if (path === '/ligas-meet') {
      return {
        kicker: 'Clases virtuales',
        title: 'Ligas Meet',
        description: 'Concentra clases virtuales y evita duplicar clases compartidas.',
      };
    }

    return null;
  }

  dismissCaptureCloseAlert(): void {
    const cycle = this.activeCycle();

    if (!cycle?.tentativeCaptureCloseAt) {
      this.captureCloseAlertDismissedSignal.set(true);
      return;
    }

    this.rememberCaptureCloseAlertDismissed(
      this.captureCloseAlertKey(cycle.code, cycle.tentativeCaptureCloseAt),
    );
    this.captureCloseAlertDismissedSignal.set(true);
  }

  private parseCycleDate(value: string): Date | null {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00`)
      : new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  private formatCycleDate(value: string): string {
    const date = this.parseCycleDate(value) ?? new Date();

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private daysUntilDate(date: Date): number {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

    return Math.ceil((target - today) / 86_400_000);
  }

  private isAcademicCoordinationUser(appUser: AppUser): boolean {
    const role = appUser.role.toLowerCase();

    return role.includes('acad') && !role.includes('sistemas');
  }

  private captureCloseAlertKey(cycleCode: string, closeAt: string): string {
    return `${this.captureCloseAlertStoragePrefix}${cycleCode}:${closeAt}`;
  }

  private isCaptureCloseAlertDismissed(alertKey: string): boolean {
    try {
      return window.sessionStorage.getItem(alertKey) === 'dismissed';
    } catch {
      return false;
    }
  }

  private rememberCaptureCloseAlertDismissed(alertKey: string): void {
    try {
      window.sessionStorage.setItem(alertKey, 'dismissed');
    } catch {
      return;
    }
  }

  private clearCaptureCloseAlertSession(): void {
    this.captureCloseAlertDismissedSignal.set(false);

    try {
      for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = window.sessionStorage.key(index);

        if (key?.startsWith(this.captureCloseAlertStoragePrefix)) {
          window.sessionStorage.removeItem(key);
        }
      }
    } catch {
      return;
    }
  }

  isAssignmentsRoute(): boolean {
    return this.router.url.split('?')[0].replace(/\/+$/, '') === '/asignaciones';
  }

  isMoodleRoute(): boolean {
    return this.router.url.split('?')[0].replace(/\/+$/, '') === '/moodle';
  }

  activeMoodleRouteTab(): 'catalogos' | 'lotes' {
    return this.router.parseUrl(this.router.url).queryParams['tab'] === 'lotes' ? 'lotes' : 'catalogos';
  }

  setMoodleRouteTab(tab: 'catalogos' | 'lotes'): void {
    void this.router.navigate(['/moodle'], { queryParams: { tab } });
  }

  async toggleSession(): Promise<void> {
    this.isProfileMenuOpenSignal.set(false);
    this.isNotificationsMenuOpenSignal.set(false);
    this.clearCaptureCloseAlertSession();
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
