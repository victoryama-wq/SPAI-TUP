import { inject, Injectable } from '@angular/core';
import { orderBy } from 'firebase/firestore';
import { FirestoreRepository } from '../../../core/data/firestore.repository';
import { FIREBASE_DB } from '../../../core/firebase/firebase.tokens';

export type UserRole = string;
export type UserStatus = 'Activo' | 'Inactivo';
export type UserGreetingGender = 'Femenino' | 'Masculino';

export interface ModuleAccess {
  dashboard: boolean;
  usuarios: boolean;
  ciclos: boolean;
  nomenclaturas: boolean;
  grupos: boolean;
  docentes: boolean;
  asignaturas: boolean;
  asignaciones: boolean;
  solicitudes: boolean;
  ligasMeet: boolean;
  moodle: boolean;
  bitacora: boolean;
}

export interface AppUser {
  id: string;
  authUid: string | null;
  name: string;
  email: string;
  role: UserRole;
  greetingGender?: UserGreetingGender;
  assignedPrograms: string[];
  access: ModuleAccess;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  role: UserRole;
  greetingGender: UserGreetingGender;
  assignedPrograms: string[];
  access: ModuleAccess;
  status: UserStatus;
}

export type UpdateUserPayload = CreateUserPayload;

export const USERS_COLLECTION = 'usuarios';

export const FULL_MODULE_ACCESS: ModuleAccess = {
  dashboard: true,
  usuarios: true,
  ciclos: true,
  nomenclaturas: true,
  grupos: true,
  docentes: true,
  asignaturas: true,
  asignaciones: true,
  solicitudes: true,
  ligasMeet: true,
  moodle: true,
  bitacora: true,
};

export const ACADEMIC_COORDINATION_ACCESS: ModuleAccess = {
  dashboard: true,
  usuarios: false,
  ciclos: false,
  nomenclaturas: true,
  grupos: true,
  docentes: true,
  asignaturas: true,
  asignaciones: true,
  solicitudes: true,
  ligasMeet: false,
  moodle: false,
  bitacora: false,
};

@Injectable({ providedIn: 'root' })
export class UsersRepository extends FirestoreRepository<AppUser> {
  readonly users = this.items;
  readonly usersReadError = this.readError;

  constructor() {
    super(inject(FIREBASE_DB), USERS_COLLECTION, orderBy('createdAt', 'desc'));
  }

  createUser(payload: CreateUserPayload): Promise<unknown> {
    const timestamp = new Date().toISOString();
    const user: Omit<AppUser, 'id'> = {
      authUid: null,
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      role: payload.role,
      greetingGender: payload.greetingGender,
      assignedPrograms: payload.assignedPrograms,
      access: payload.access,
      status: payload.status,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return this.addDocument(this.toFirestoreDocument(user));
  }

  toggleStatus(userId: string): Promise<void> | void {
    const user = this.users().find((item) => item.id === userId);

    if (!user) {
      return;
    }

    return this.updateDocument(userId, {
      status: user.status === 'Activo' ? 'Inactivo' : 'Activo',
      updatedAt: new Date().toISOString(),
    });
  }

  updateUser(userId: string, payload: UpdateUserPayload): Promise<void> {
    return this.updateDocument(userId, {
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      role: payload.role,
      greetingGender: payload.greetingGender,
      assignedPrograms: payload.assignedPrograms,
      access: payload.access,
      status: payload.status,
      updatedAt: new Date().toISOString(),
    });
  }

  async assignProgramToCoordinator(coordinatorName: string, programCode: string): Promise<void> {
    const normalizedCoordinator = coordinatorName.trim().toLowerCase();
    const normalizedProgram = programCode.trim().toUpperCase();

    if (!normalizedCoordinator || !normalizedProgram) {
      return;
    }

    const matchingUsers = this.users().filter((user) => {
      const role = user.role.toLowerCase();

      return user.status === 'Activo'
        && role.includes('acad')
        && !role.includes('sistemas')
        && user.name.trim().toLowerCase() === normalizedCoordinator;
    });

    await Promise.all(
      matchingUsers.map((user) => {
        const assignedPrograms = Array.from(new Set([
          ...user.assignedPrograms.map((program) => program.trim().toUpperCase()).filter(Boolean),
          normalizedProgram,
        ])).sort((a, b) => a.localeCompare(b, 'es'));

        return this.updateDocument(user.id, {
          assignedPrograms,
          updatedAt: new Date().toISOString(),
        });
      }),
    );
  }

  deleteUserAccess(userId: string): Promise<void> {
    return this.deleteDocument(userId);
  }

  toFirestoreDocument(user: Omit<AppUser, 'id'>): Record<string, unknown> {
    return {
      authUid: user.authUid,
      name: user.name,
      email: user.email,
      role: user.role,
      greetingGender: user.greetingGender ?? 'Femenino',
      assignedPrograms: user.assignedPrograms,
      access: user.access,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
