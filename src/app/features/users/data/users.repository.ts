import { computed, inject, Injectable } from '@angular/core';
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
  readonly users = computed(() => this.deduplicateUsers(this.items()));
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

  private deduplicateUsers(users: AppUser[]): AppUser[] {
    const groupedUsers = new Map<string, AppUser[]>();

    users.forEach((user) => {
      const key = this.userIdentityKey(user);
      const currentUsers = groupedUsers.get(key) ?? [];
      currentUsers.push(user);
      groupedUsers.set(key, currentUsers);
    });

    return Array.from(groupedUsers.values())
      .map((group) => this.canonicalUser(group))
      .sort((a, b) => this.timestampValue(b.createdAt) - this.timestampValue(a.createdAt));
  }

  private canonicalUser(users: AppUser[]): AppUser {
    const preferredUser = [...users].sort((a, b) => this.userPriority(b) - this.userPriority(a))[0];
    const programsSource = [...users].sort((a, b) => b.assignedPrograms.length - a.assignedPrograms.length)[0];
    const accessSource = [...users].sort((a, b) => this.enabledAccessCount(b.access) - this.enabledAccessCount(a.access))[0];

    return {
      ...preferredUser,
      assignedPrograms: preferredUser.assignedPrograms.length
        ? preferredUser.assignedPrograms
        : programsSource.assignedPrograms,
      access: this.enabledAccessCount(preferredUser.access)
        ? preferredUser.access
        : accessSource.access,
    };
  }

  private userPriority(user: AppUser): number {
    return [
      user.status === 'Activo' ? 10000 : 0,
      user.authUid && user.id === user.authUid ? 5000 : 0,
      user.authUid ? 1000 : 0,
      user.assignedPrograms.length * 10,
      this.enabledAccessCount(user.access),
      this.timestampValue(user.updatedAt) / 10000000000000,
    ].reduce((total, value) => total + value, 0);
  }

  private userIdentityKey(user: AppUser): string {
    const email = user.email.trim().toLowerCase();

    if (email) {
      return `email:${email}`;
    }

    if (user.authUid) {
      return `auth:${user.authUid}`;
    }

    return `id:${user.id}`;
  }

  private enabledAccessCount(access: ModuleAccess): number {
    return Object.values(access).filter(Boolean).length;
  }

  private timestampValue(timestamp: string): number {
    const value = Date.parse(timestamp);

    return Number.isFinite(value) ? value : 0;
  }
}
