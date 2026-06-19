import { effect, inject, Injectable, signal } from '@angular/core';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, QueryConstraint, setDoc, updateDoc, where } from 'firebase/firestore';
import { UserSessionService } from '../../../core/auth/user-session.service';
import { FIREBASE_DB } from '../../../core/firebase/firebase.tokens';

export type SystemRequestType = 'REABRIR_CAPTURA' | 'ALTA_GRUPO' | 'CAMBIAR_ID_ASIGNATURA' | 'DOCENTE_NUEVO';
export type SystemRequestStatus = 'PENDIENTE' | 'EN_PROCESO' | 'ATENDIDA' | 'RECHAZADA';

export interface SystemRequest {
  id: string;
  type: SystemRequestType;
  title: string;
  detail: string;
  cycle: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  requestedByPrograms: string[];
  status: SystemRequestStatus;
  systemResponse: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface CreateSystemRequestPayload {
  type: SystemRequestType;
  title: string;
  detail: string;
  cycle: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  requestedByPrograms: string[];
}

export interface UpdateSystemRequestStatusPayload {
  status: Exclude<SystemRequestStatus, 'PENDIENTE'>;
  systemResponse: string;
  respondedBy: string;
  respondedByName: string;
  respondedByRole: string;
}

export const SYSTEM_REQUESTS_COLLECTION = 'solicitudes_sistemas';

@Injectable({ providedIn: 'root' })
export class SystemRequestsRepository {
  private readonly firestore = inject(FIREBASE_DB);
  private readonly userSessionService = inject(UserSessionService);
  private readonly requestsSignal = signal<SystemRequest[]>([]);

  readonly requests = this.requestsSignal.asReadonly();

  constructor() {
    effect((onCleanup) => {
      const session = this.userSessionService.session();
      const appUser = session?.appUser;

      if (!session) {
        this.requestsSignal.set([]);
        return;
      }

      if (!appUser) {
        return;
      }

      if (appUser.status !== 'Activo') {
        this.requestsSignal.set([]);
        return;
      }

      const constraints: QueryConstraint[] = appUser.role.toLowerCase().includes('sistemas')
        ? [orderBy('createdAt', 'desc')]
        : [where('requestedBy', '==', session.authUid)];
      const requestsQuery = query(collection(this.firestore, SYSTEM_REQUESTS_COLLECTION), ...constraints);
      const unsubscribe = onSnapshot(
        requestsQuery,
        (snapshot) => {
          this.requestsSignal.set(
            snapshot.docs
              .map((item) => ({ id: item.id, ...item.data() }) as SystemRequest)
              .filter((request) => !request.deletedAt)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          );
        },
        () => undefined,
      );

      onCleanup(unsubscribe);
    });
  }

  async createRequest(payload: CreateSystemRequestPayload): Promise<string> {
    const timestamp = new Date().toISOString();
    const requestId = this.createRequestId(payload);

    await setDoc(doc(this.firestore, SYSTEM_REQUESTS_COLLECTION, requestId), {
      type: payload.type,
      title: payload.title.trim(),
      detail: payload.detail.trim(),
      cycle: payload.cycle.trim(),
      requestedBy: payload.requestedBy,
      requestedByName: payload.requestedByName.trim(),
      requestedByRole: payload.requestedByRole.trim(),
      requestedByPrograms: payload.requestedByPrograms,
      status: 'PENDIENTE',
      systemResponse: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return requestId;
  }

  async updateRequestStatus(requestId: string, payload: UpdateSystemRequestStatusPayload): Promise<void> {
    const timestamp = new Date().toISOString();

    await updateDoc(doc(this.firestore, SYSTEM_REQUESTS_COLLECTION, requestId), {
      status: payload.status,
      systemResponse: payload.systemResponse.trim(),
      respondedBy: payload.respondedBy,
      respondedByName: payload.respondedByName.trim(),
      respondedByRole: payload.respondedByRole.trim(),
      respondedAt: timestamp,
      updatedAt: timestamp,
    });
  }

  async removeRequest(requestId: string, deletedBy: string): Promise<void> {
    const requestRef = doc(this.firestore, SYSTEM_REQUESTS_COLLECTION, requestId);

    try {
      await deleteDoc(requestRef);
      return;
    } catch {
      const timestamp = new Date().toISOString();

      await updateDoc(requestRef, {
        deletedAt: timestamp,
        deletedBy,
        updatedAt: timestamp,
      });
    }
  }

  private createRequestId(payload: CreateSystemRequestPayload): string {
    return [
      'SIS',
      payload.type,
      payload.cycle,
      payload.requestedBy,
      Date.now().toString(36),
    ]
      .join('_')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9._-]+/g, '_');
  }
}
