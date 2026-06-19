import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { UserSessionService } from '../auth/user-session.service';
import { FIREBASE_DB } from '../firebase/firebase.tokens';

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

@Injectable({ providedIn: 'root' })
export class SystemNotificationsRepository {
  private readonly firestore = inject(FIREBASE_DB);
  private readonly userSessionService = inject(UserSessionService);
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
            where('target', '==', 'SISTEMAS'),
            orderBy('createdAt', 'desc'),
            limit(25),
          )
        : query(
            collection(this.firestore, SYSTEM_NOTIFICATIONS_COLLECTION),
            where('target', '==', 'COORDINACION_ACADEMICA'),
            where('targetUserId', '==', session.authUid),
            limit(25),
          );
      const unsubscribe = onSnapshot(
        notificationsQuery,
        (snapshot) => {
          this.notificationsSignal.set(
            snapshot.docs
              .map((item) => ({ id: item.id, ...item.data() }) as SystemNotification)
              .filter((notification) => this.canSeeNotification(notification, session.authUid, appUser.role))
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          );
        },
        () => undefined,
      );

      onCleanup(unsubscribe);
    });
  }

  create(payload: CreateSystemNotificationPayload): Promise<unknown> {
    return addDoc(collection(this.firestore, SYSTEM_NOTIFICATIONS_COLLECTION), {
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
    });
  }

  createForAcademicCoordinator(payload: CreateAcademicNotificationPayload): Promise<unknown> {
    return addDoc(collection(this.firestore, SYSTEM_NOTIFICATIONS_COLLECTION), {
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
    });
  }

  createForAcademicCoordinatorOnce(
    notificationId: string,
    payload: CreateAcademicNotificationPayload,
  ): Promise<void> {
    return setDoc(doc(this.firestore, SYSTEM_NOTIFICATIONS_COLLECTION, notificationId), {
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
    });
  }

  createOnce(notificationId: string, payload: CreateSystemNotificationPayload): Promise<void | undefined> {
    const notificationRef = doc(this.firestore, SYSTEM_NOTIFICATIONS_COLLECTION, notificationId);

    return setDoc(
      notificationRef,
      {
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
      },
    ).catch(() => undefined);
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
    return role.includes('Sistemas');
  }

  private canSeeNotification(notification: SystemNotification, authUid: string, role: string): boolean {
    if (notification.target === 'SISTEMAS') {
      return this.isSystemsUser(role);
    }

    return notification.target === 'COORDINACION_ACADEMICA' && notification.targetUserId === authUid;
  }

  private wasReadByCurrentUser(notification: SystemNotification, appUserId: string, authUid: string): boolean {
    return this.locallyReadNotificationIds().has(notification.id)
      || notification.readBy.includes(appUserId)
      || notification.readBy.includes(authUid);
  }
}
