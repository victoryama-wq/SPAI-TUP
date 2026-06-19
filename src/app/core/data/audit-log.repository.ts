import { inject, Injectable } from '@angular/core';
import { addDoc, collection } from 'firebase/firestore';
import { FIREBASE_DB } from '../firebase/firebase.tokens';

export interface AuditLogEntry {
  id: string;
  module: string;
  action: string;
  description: string;
  user: string;
  userRole: string;
  entity: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateAuditLogPayload {
  module: string;
  action: string;
  description: string;
  user: string;
  userRole: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export const AUDIT_LOG_COLLECTION = 'bitacora';

@Injectable({ providedIn: 'root' })
export class AuditLogRepository {
  private readonly firestore = inject(FIREBASE_DB);

  register(payload: CreateAuditLogPayload): void {
    void addDoc(collection(this.firestore, AUDIT_LOG_COLLECTION), {
      module: payload.module,
      action: payload.action,
      description: payload.description,
      user: payload.user,
      userRole: payload.userRole,
      entity: payload.entity,
      entityId: payload.entityId,
      metadata: payload.metadata ?? {},
      createdAt: new Date().toISOString(),
    });
  }
}
