import { inject, Injectable } from '@angular/core';
import { orderBy } from 'firebase/firestore';
import { FirestoreRepository } from '../../../core/data/firestore.repository';
import { FIREBASE_DB } from '../../../core/firebase/firebase.tokens';

export type PermissionLevel = 'none' | 'view' | 'edit';

export interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  permissions: Record<string, PermissionLevel>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRolePayload {
  name: string;
  permissions: Record<string, PermissionLevel>;
}

export type UpdateRolePayload = CreateRolePayload;

export const CUSTOM_ROLES_COLLECTION = 'roles_personalizados';

@Injectable({ providedIn: 'root' })
export class CustomRolesRepository extends FirestoreRepository<RoleTemplate> {
  readonly roleTemplates = this.items;

  constructor() {
    super(inject(FIREBASE_DB), CUSTOM_ROLES_COLLECTION, orderBy('createdAt', 'desc'));
  }

  createRole(payload: CreateRolePayload): Promise<unknown> {
    const timestamp = new Date().toISOString();

    return this.addDocument({
      name: payload.name.trim(),
      description: 'Rol personalizado.',
      permissions: payload.permissions,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  updateRole(id: string, payload: UpdateRolePayload): Promise<void> {
    return this.updateDocument(id, {
      name: payload.name.trim(),
      permissions: payload.permissions,
      updatedAt: new Date().toISOString(),
    });
  }

  deleteRole(id: string): Promise<void> {
    return this.deleteDocument(id);
  }
}
