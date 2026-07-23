import { Injectable, inject } from '@angular/core';
import { CustomRolesRepository, PermissionLevel } from './custom-roles.repository';
import { AppUser, ModuleAccess } from './users.repository';

export type ModuleKey = keyof ModuleAccess;

@Injectable({ providedIn: 'root' })
export class ModulePermissionService {
  private readonly customRolesRepository = inject(CustomRolesRepository);

  customPermissionFor(appUser: AppUser | null | undefined, module: ModuleKey): PermissionLevel | null {
    const role = this.customRoleFor(appUser);

    return role ? (role.permissions[module] ?? 'none') : null;
  }

  hasModuleAccess(appUser: AppUser | null | undefined, module: ModuleKey): boolean {
    return appUser?.status === 'Activo' && appUser.access?.[module] === true;
  }

  canEditModule(appUser: AppUser | null | undefined, module: ModuleKey): boolean {
    if (appUser?.status !== 'Activo') {
      return false;
    }

    const customPermission = this.customPermissionFor(appUser, module);

    return customPermission === null ? true : customPermission === 'edit';
  }

  isCustomConsultationRole(appUser: AppUser | null | undefined): boolean {
    const role = this.customRoleFor(appUser);

    if (!role) {
      return false;
    }

    const permissions = Object.values(role.permissions);

    return permissions.some((permission) => permission === 'view')
      && !permissions.some((permission) => permission === 'edit');
  }

  private customRoleFor(appUser: AppUser | null | undefined) {
    if (appUser?.status !== 'Activo') {
      return null;
    }

    const normalizedUserRole = this.normalizeIdentity(appUser.role);

    return this.customRolesRepository.roleTemplates()
      .find((role) => this.normalizeIdentity(role.name) === normalizedUserRole)
      ?? null;
  }

  private normalizeIdentity(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }
}
