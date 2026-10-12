import { Injectable } from '@angular/core';
import { AppUser, ModuleAccess } from './users.repository';
import { PermissionLevel } from './custom-roles.repository';
export type ModuleKey = keyof ModuleAccess;
export function hasAccess(user: AppUser | null | undefined, module: ModuleKey, edit = false): boolean {
  if (user?.status !== 'Activo' || user.permissionSchemaVersion !== 2 || user.identityAliasOf) return false;
  if (user.baseRole === 'ADMIN_GENERAL') return true;
  if (module === 'usuarios') return user.baseRole === 'ADMIN_OPERATIVO' && Boolean(user.capabilities?.includes('MANAGE_CUSTOM_ROLES'));
  const value = user.permissions?.[module] ?? 'NONE';
  return edit ? value === 'EDIT' : value === 'VIEW' || value === 'EDIT';
}
@Injectable({ providedIn: 'root' })
export class ModulePermissionService {
  hasModuleAccess = hasAccess;
  canEditModule(user: AppUser | null | undefined, module: ModuleKey): boolean { return hasAccess(user, module, true); }
  customPermissionFor(user: AppUser | null | undefined, module: ModuleKey): PermissionLevel | null {
    return user?.baseRole === 'CUSTOM' ? (user.permissions?.[module]?.toLowerCase() ?? 'none') as PermissionLevel : null;
  }
  isCustomConsultationRole(user: AppUser | null | undefined): boolean {
    return user?.baseRole === 'CUSTOM' && !Object.values(user.permissions ?? {}).includes('EDIT');
  }
}

export function isSystems(user: AppUser | null | undefined): boolean { return user?.status === 'Activo' && !user.identityAliasOf && user.permissionSchemaVersion === 2 && (user.baseRole === 'ADMIN_GENERAL' || user.baseRole === 'ADMIN_OPERATIVO'); }
export function hasCapability(user: AppUser | null | undefined, capability: string): boolean { return isSystems(user) && (user?.baseRole === 'ADMIN_GENERAL' || Boolean(user?.capabilities?.includes(capability))); }
