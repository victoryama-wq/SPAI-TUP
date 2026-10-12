import { inject, Injectable } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { FIREBASE_FUNCTIONS } from '../../../core/firebase/firebase.tokens';
import { AppUser, EffectiveLevel, ModuleAccess } from './users.repository';

export const SECURITY_MODULES: (keyof ModuleAccess)[] = ['dashboard', 'usuarios', 'ciclos', 'nomenclaturas', 'grupos', 'docentes', 'asignaturas', 'asignaciones', 'solicitudes', 'ligasMeet', 'moodle', 'bitacora'];
export interface SecurityRecord {
  id: string; revision: number; name?: string; userId?: string; roleId?: string;
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
export interface SecurityResult { preview?: MigrationPreview; operationId: string }
@Injectable({ providedIn: 'root' })
export class SecurityService {
  private readonly functions = inject(FIREBASE_FUNCTIONS);
  private readonly commandCall = httpsCallable<Record<string, unknown>, SecurityResult>(this.functions, 'securityCommand');
  private readonly directoryCall = httpsCallable<Record<string, never>, SecurityDirectory>(this.functions, 'securityDirectory');
  async directory(): Promise<SecurityDirectory> { return (await this.directoryCall({})).data; }
  async command(request: Record<string, unknown>): Promise<SecurityResult> { return (await this.commandCall(request)).data; }
}
