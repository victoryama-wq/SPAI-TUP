import { inject, Injectable } from '@angular/core';
import { orderBy } from 'firebase/firestore';
import { FIREBASE_DB } from '../firebase/firebase.tokens';
import { FirestoreRepository } from './firestore.repository';

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
export class AuditLogRepository extends FirestoreRepository<AuditLogEntry> {
  readonly entries = this.items;
  readonly entriesReadError = this.readError;

  constructor() {
    super(inject(FIREBASE_DB), AUDIT_LOG_COLLECTION, orderBy('createdAt', 'desc'));
  }

  register(payload: CreateAuditLogPayload): void {
    void this.addDocument({
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
