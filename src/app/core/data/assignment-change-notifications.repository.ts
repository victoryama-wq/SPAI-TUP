import { Injectable, inject, signal, effect } from '@angular/core';
import { UserSessionService } from '../auth/user-session.service';
import { hasAccess, isSystems } from '../../features/users/data/module-permission.service';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { FIREBASE_DB } from '../firebase/firebase.tokens';

export interface AssignmentChangeNotificationsConfig {
  enabled: boolean;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface UpdateAssignmentChangeNotificationsPayload {
  enabled: boolean;
  updatedBy: string;
  updatedByName: string;
}

export const ASSIGNMENT_CHANGE_NOTIFICATIONS_CONFIG_ID = 'notificaciones_asignaciones';

@Injectable({ providedIn: 'root' })
export class AssignmentChangeNotificationsRepository {
  private readonly firestore = inject(FIREBASE_DB);
  private readonly session = inject(UserSessionService);
  private readonly configSignal = signal<AssignmentChangeNotificationsConfig>({ enabled: true });
  private readonly readErrorSignal = signal('');

  readonly config = this.configSignal.asReadonly();
  readonly enabled = () => this.configSignal().enabled;
  readonly readError = this.readErrorSignal.asReadonly();

  constructor() {
    effect(onCleanup => {
    const owner = this.session.session();
    this.configSignal.set({ enabled: true }); this.readErrorSignal.set('');
    if (!isSystems(owner?.appUser) || !hasAccess(owner?.appUser, 'bitacora')) return;
    let disposed = false;
    const unsubscribe = onSnapshot(
      doc(this.firestore, 'configuracion', ASSIGNMENT_CHANGE_NOTIFICATIONS_CONFIG_ID),
      (snapshot) => {
        if (disposed || owner !== this.session.session()) return;
        const data = snapshot.data();

        this.configSignal.set({
          enabled: data?.['enabled'] !== false,
          updatedAt: typeof data?.['updatedAt'] === 'string' ? data['updatedAt'] : undefined,
          updatedBy: typeof data?.['updatedBy'] === 'string' ? data['updatedBy'] : undefined,
          updatedByName: typeof data?.['updatedByName'] === 'string' ? data['updatedByName'] : undefined,
        });
        this.readErrorSignal.set('');
      },
      (error) => {
        if (disposed || owner !== this.session.session()) return;
        console.error('No se pudo leer la configuracion de alertas de asignaciones.', error);
        this.readErrorSignal.set('No se pudo consultar el estado de las alertas.');
      },
    );
    onCleanup(() => { disposed = true; unsubscribe(); this.configSignal.set({enabled:true}); });
    });
  }

  setEnabled(payload: UpdateAssignmentChangeNotificationsPayload): Promise<void> {
    return setDoc(
      doc(this.firestore, 'configuracion', ASSIGNMENT_CHANGE_NOTIFICATIONS_CONFIG_ID),
      {
        enabled: payload.enabled,
        updatedAt: new Date().toISOString(),
        updatedBy: payload.updatedBy,
        updatedByName: payload.updatedByName,
      },
      { merge: true },
    );
  }
}
