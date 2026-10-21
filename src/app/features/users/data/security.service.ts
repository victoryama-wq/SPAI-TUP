import { inject, Injectable } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { FIREBASE_FUNCTIONS } from '../../../core/firebase/firebase.tokens';
import { AppUser, EffectiveLevel, ModuleAccess } from './users.repository';

export const SECURITY_MODULES: (keyof ModuleAccess)[] = ['dashboard', 'usuarios', 'ciclos', 'nomenclaturas', 'grupos', 'docentes', 'asignaturas', 'asignaciones', 'solicitudes', 'ligasMeet', 'moodle', 'bitacora'];
export interface SecurityRecord {
  approvedBy?: string;
  id: string; revision: number; name?: string; userId?: string; roleId?: string;
  expiresAtMillis?: number;
  status: string; reviewStatus?: string; assignmentId?: string; delegationId?: string;
  permissions?: Partial<Record<keyof ModuleAccess, EffectiveLevel>>;
  scope?: AppUser['scope']; capabilities?: string[];
}
export interface SecurityDirectory {
  usuarios: AppUser[]; roles_personalizados: SecurityRecord[]; delegaciones: SecurityRecord[];
  asignaciones_roles: SecurityRecord[]; revisiones_roles: SecurityRecord[];
}
export interface MigrationPreview {
  previewId: string; userId: string; profileRevision: number; delegationRevision: number;
  previous: Partial<AppUser>; proposed: { permissions: Record<keyof ModuleAccess, EffectiveLevel>; baseRole: string; status: string; unresolved: string[]; scope: AppUser['scope']; capabilities: string[] }; differences: string[];
}
export interface InheritancePreview {
  previewId: string; sourceId: string; targetId: string; sourceName: string; targetName: string;
  replace: boolean; expiresAtMillis: number; sourceRevision: number; targetRevision: number;
  previous: { baseRole: string; permissions: AppUser['permissions']; scope: AppUser['scope']; capabilities: string[]; status: string };
  proposed: { baseRole: string; permissions: AppUser['permissions']; scope: AppUser['scope']; capabilities: string[]; roles: {id:string;name:string;revision:number}[]; expiresAtMillis: number | null; denials: string[] };
  retire: { assignments: {id:string;roleId:string}[]; delegations: string[] }; preserve: string;
}
export interface UserDeletionPreview { token: string; targetId: string; name: string; email: string; expiresAt: number; }
export interface UserDeletionResult { operationId: string; targetId: string; name: string; email: string; status: 'PENDING_AUTH' | 'PROCESSING_AUTH' | 'COMPLETED'; message: string; attempts: number; lastError?: string | null; }
export interface UserDeletionResponse { preview?: UserDeletionPreview; result?: UserDeletionResult; pending?: UserDeletionResult[]; }
export interface SecurityResult { preview?: MigrationPreview; inheritancePreview?: InheritancePreview; operationId: string }
@Injectable({ providedIn: 'root' })
export class SecurityService {
  private readonly functions = inject(FIREBASE_FUNCTIONS);
  private readonly commandCall = httpsCallable<Record<string, unknown>, SecurityResult>(this.functions, 'securityCommand');
  private readonly directoryCall = httpsCallable<Record<string, never>, SecurityDirectory>(this.functions, 'securityDirectory');
  private readonly deletionCall = httpsCallable<Record<string, unknown>, UserDeletionResponse>(this.functions, 'userDeletionCommand');
  async deletion(request: Record<string, unknown>): Promise<UserDeletionResponse> { return (await this.deletionCall(request)).data; }
  async directory(): Promise<SecurityDirectory> { return (await this.directoryCall({})).data; }
  async command(request: Record<string, unknown>): Promise<SecurityResult> { return (await this.commandCall(request)).data; }
}
