import { Injectable, inject, signal } from '@angular/core';
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
  private readonly configSignal = signal<AssignmentChangeNotificationsConfig>({ enabled: true });
  private readonly readErrorSignal = signal('');

  readonly config = this.configSignal.asReadonly();
  readonly enabled = () => this.configSignal().enabled;
  readonly readError = this.readErrorSignal.asReadonly();

  constructor() {
    onSnapshot(
      doc(this.firestore, 'configuracion', ASSIGNMENT_CHANGE_NOTIFICATIONS_CONFIG_ID),
      (snapshot) => {
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
        console.error('No se pudo leer la configuracion de alertas de asignaciones.', error);
        this.readErrorSignal.set('No se pudo consultar el estado de las alertas.');
      },
    );
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
