import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { UserSessionService } from '../auth/user-session.service';
import { FIREBASE_DB } from '../firebase/firebase.tokens';
import { AppUser, UsersRepository } from '../../features/users/data/users.repository';

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  target: 'SISTEMAS' | 'COORDINACION_ACADEMICA';
  targetUserId?: string;
  type: 'DOCENTE_NUEVO' | 'DOCENTE_VALIDADO' | 'ASIGNACIONES_HITO' | 'CLASE_COMPARTIDA' | 'SOLICITUD_SISTEMAS';
  entity: string;
  entityId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  readBy: string[];
  createdAt: string;
}

export interface CreateSystemNotificationPayload {
  title: string;
  message: string;
  type: SystemNotification['type'];
  entity: string;
  entityId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
}

export interface CreateAcademicNotificationPayload extends CreateSystemNotificationPayload {
  targetUserId: string;
}

export const SYSTEM_NOTIFICATIONS_COLLECTION = 'notificaciones';
export const MAIL_COLLECTION = 'mail';

@Injectable({ providedIn: 'root' })
export class SystemNotificationsRepository {
  private readonly firestore = inject(FIREBASE_DB);
  private readonly userSessionService = inject(UserSessionService);
  private readonly usersRepository = inject(UsersRepository);
  private readonly notificationsSignal = signal<SystemNotification[]>([]);
  private readonly locallyReadNotificationIds = signal<ReadonlySet<string>>(new Set());

  readonly notifications = this.notificationsSignal.asReadonly();
  readonly unreadCount = computed(() => {
    const session = this.userSessionService.session();
    const appUser = session?.appUser;

    if (!appUser || !session) {
      return 0;
    }

    return this.notifications().filter((notification) => !this.wasReadByCurrentUser(notification, appUser.id, session.authUid)).length;
  });

  constructor() {
    effect((onCleanup) => {
      const session = this.userSessionService.session();
      const appUser = session?.appUser;

      if (!session || appUser?.status !== 'Activo') {
        this.notificationsSignal.set([]);
        return;
      }

      const notificationsQuery = this.isSystemsUser(appUser.role)
        ? query(
            collection(this.firestore, SYSTEM_NOTIFICATIONS_COLLECTION),
            limit(100),
          )
        : query(
            collection(this.firestore, SYSTEM_NOTIFICATIONS_COLLECTION),
            where('target', '==', 'COORDINACION_ACADEMICA'),
            where('targetUserId', 'in', this.notificationTargetIds(session.authUid, session.email, appUser)),
            limit(25),
          );
      const unsubscribe = onSnapshot(
        notificationsQuery,
        (snapshot) => {
          this.notificationsSignal.set(
            snapshot.docs
              .map((item) => ({ id: item.id, ...item.data() }) as SystemNotification)
              .filter((notification) => this.canSeeNotification(notification, session.authUid, session.email, appUser))
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          );
        },
        (error) => {
          console.error('No se pudieron leer las notificaciones del sistema', error);
          this.notificationsSignal.set([]);
        },
      );

      onCleanup(unsubscribe);
    });
  }

  async create(payload: CreateSystemNotificationPayload): Promise<unknown> {
    const notificationDocument = this.systemNotificationDocument(payload);
    const notificationRef = await addDoc(collection(this.firestore, SYSTEM_NOTIFICATIONS_COLLECTION), notificationDocument);

    void this.queueEmailForNotification(notificationRef.id, notificationDocument);

    return notificationRef;
  }

  async createForAcademicCoordinator(payload: CreateAcademicNotificationPayload): Promise<unknown> {
    const notificationDocument = this.academicNotificationDocument(payload);
    const notificationRef = await addDoc(collection(this.firestore, SYSTEM_NOTIFICATIONS_COLLECTION), notificationDocument);

    void this.queueEmailForNotification(notificationRef.id, notificationDocument);

    return notificationRef;
  }

  async createForAcademicCoordinatorOnce(
    notificationId: string,
    payload: CreateAcademicNotificationPayload,
  ): Promise<void> {
    const notificationDocument = this.academicNotificationDocument(payload);

    await setDoc(doc(this.firestore, SYSTEM_NOTIFICATIONS_COLLECTION, notificationId), notificationDocument);
    void this.queueEmailForNotification(notificationId, notificationDocument);
  }

  createOnce(notificationId: string, payload: CreateSystemNotificationPayload): Promise<void | undefined> {
    const notificationRef = doc(this.firestore, SYSTEM_NOTIFICATIONS_COLLECTION, notificationId);
    const notificationDocument = this.systemNotificationDocument(payload);

    return setDoc(
      notificationRef,
      notificationDocument,
    )
      .then(() => {
        void this.queueEmailForNotification(notificationId, notificationDocument);
      })
      .catch(() => undefined);
  }

  private systemNotificationDocument(payload: CreateSystemNotificationPayload): Omit<SystemNotification, 'id'> {
    return {
      title: payload.title,
      message: payload.message,
      target: 'SISTEMAS',
      type: payload.type,
      entity: payload.entity,
      entityId: payload.entityId,
      actorId: payload.actorId,
      actorName: payload.actorName,
      actorRole: payload.actorRole,
      readBy: [],
      createdAt: new Date().toISOString(),
    };
  }

  private academicNotificationDocument(payload: CreateAcademicNotificationPayload): Omit<SystemNotification, 'id'> {
    return {
      title: payload.title,
      message: payload.message,
      target: 'COORDINACION_ACADEMICA',
      targetUserId: payload.targetUserId,
      type: payload.type,
      entity: payload.entity,
      entityId: payload.entityId,
      actorId: payload.actorId,
      actorName: payload.actorName,
      actorRole: payload.actorRole,
      readBy: [],
      createdAt: new Date().toISOString(),
    };
  }

  private queueEmailForNotification(notificationId: string, notification: Omit<SystemNotification, 'id'>): Promise<void> | void {
    const recipients = this.emailRecipientsForNotification(notification);

    if (!recipients.length) {
      return;
    }

    const subject = `SPAI TUP - ${notification.title}`;
    const text = `${notification.title}\n\n${notification.message}\n\nIngresa a SPAI TUP para revisar el aviso.`;
    const html = [
      '<div style="font-family:Arial,sans-serif;color:#07163c;line-height:1.45">',
      `<h2 style="margin:0 0 12px">${this.escapeHtml(notification.title)}</h2>`,
      `<p style="margin:0 0 16px">${this.escapeHtml(notification.message)}</p>`,
      '<p style="margin:0;color:#40577a">Ingresa a SPAI TUP para revisar el aviso.</p>',
      '</div>',
    ].join('');

    return setDoc(doc(this.firestore, MAIL_COLLECTION, this.emailQueueId(notificationId)), {
      to: recipients,
      message: {
        subject,
        text,
        html,
      },
      notificationId,
      target: notification.target,
      type: notification.type,
      createdAt: new Date().toISOString(),
    }).catch((error) => {
      console.warn('No se pudo encolar el correo de notificacion', error);
    });
  }

  private emailRecipientsForNotification(notification: Omit<SystemNotification, 'id'>): string[] {
    const activeUsers = this.usersRepository.users().filter((user) => user.status === 'Activo');

    if (notification.target === 'SISTEMAS') {
      return this.uniqueInstitutionalEmails(activeUsers
        .filter((user) => this.isSystemsUser(user.role))
        .map((user) => user.email));
    }

    const targetUserId = notification.targetUserId?.trim();

    if (!targetUserId) {
      return [];
    }

    const targetVariants = new Set([
      targetUserId,
      targetUserId.toLowerCase(),
      targetUserId.toUpperCase(),
    ]);

    return this.uniqueInstitutionalEmails(activeUsers
      .filter((user) => this.notificationTargetIdsForUser(user).some((target) => targetVariants.has(target)))
      .map((user) => user.email));
  }

  private notificationTargetIdsForUser(user: AppUser): string[] {
    return Array.from(new Set([
      user.id,
      user.authUid ?? '',
      user.email.trim().toLowerCase(),
      ...((Array.isArray(user.assignedPrograms) ? user.assignedPrograms : [])
        .map((program) => program.trim().toUpperCase())),
    ].map((value) => value.trim()).filter(Boolean)));
  }

  private uniqueInstitutionalEmails(emails: string[]): string[] {
    return Array.from(new Set(emails
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.endsWith('@tecplayacar.edu.mx'))));
  }

  private emailQueueId(notificationId: string): string {
    return `notificacion-${notificationId}`
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  markAsRead(notificationId: string): Promise<void> | void {
    const session = this.userSessionService.session();
    const appUser = session?.appUser;

    if (!appUser || !session) {
      return;
    }

    const readIds = Array.from(new Set([appUser.id, session.authUid]));

    this.locallyReadNotificationIds.update((notificationIds) => {
      const nextNotificationIds = new Set(notificationIds);
      nextNotificationIds.add(notificationId);

      return nextNotificationIds;
    });

    this.notificationsSignal.update((notifications) =>
      notifications.map((notification) => {
        if (notification.id !== notificationId || this.wasReadByCurrentUser(notification, appUser.id, session.authUid)) {
          return notification;
        }

        return {
          ...notification,
          readBy: Array.from(new Set([...notification.readBy, ...readIds])),
        };
      }),
    );

    return updateDoc(doc(this.firestore, SYSTEM_NOTIFICATIONS_COLLECTION, notificationId), {
      readBy: arrayUnion(...readIds),
    }).catch(() => undefined);
  }

  markAllAsRead(): void {
    const session = this.userSessionService.session();
    const appUser = session?.appUser;

    if (!appUser || !session) {
      return;
    }

    this.notifications()
      .filter((notification) => !this.wasReadByCurrentUser(notification, appUser.id, session.authUid))
      .forEach((notification) => {
      void this.markAsRead(notification.id);
    });
  }

  isReadByUser(notification: SystemNotification, appUserId: string, authUid: string): boolean {
    return this.wasReadByCurrentUser(notification, appUserId, authUid);
  }

  private isSystemsUser(role: string): boolean {
    return this.normalizeRole(role).includes('sistemas');
  }

  private canSeeNotification(
    notification: SystemNotification,
    authUid: string,
    email: string,
    appUser: { id: string; authUid: string | null; email: string; role: string; assignedPrograms: string[] },
  ): boolean {
    if (notification.target === 'SISTEMAS') {
      return this.isSystemsUser(appUser.role);
    }

    return notification.target === 'COORDINACION_ACADEMICA'
      && this.notificationTargetIds(authUid, email, appUser).includes(notification.targetUserId ?? '');
  }

  private notificationTargetIds(
    authUid: string,
    email: string,
    appUser: { id: string; authUid: string | null; email: string; assignedPrograms: string[] },
  ): string[] {
    const assignedProgramTargets = (Array.isArray(appUser.assignedPrograms) ? appUser.assignedPrograms : [])
      .map((program) => program.trim().toUpperCase())
      .filter(Boolean);

    return Array.from(new Set([
      authUid,
      email.trim().toLowerCase(),
      appUser.email.trim().toLowerCase(),
      ...assignedProgramTargets,
    ].map((value) => value.trim()).filter(Boolean))).slice(0, 10);
  }

  private wasReadByCurrentUser(notification: SystemNotification, appUserId: string, authUid: string): boolean {
    const readBy = Array.isArray(notification.readBy) ? notification.readBy : [];

    return this.locallyReadNotificationIds().has(notification.id)
      || readBy.includes(appUserId)
      || readBy.includes(authUid);
  }

  private normalizeRole(role: string): string {
    return role
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
