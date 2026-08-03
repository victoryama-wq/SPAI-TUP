import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CustomRolesRepository,
  PermissionLevel,
  RoleTemplate,
} from '../data/custom-roles.repository';
import { ConfirmationDialogService } from '../../../shared/confirmation/confirmation-dialog.service';

interface ModulePermissionOption {
  key: string;
  label: string;
}

const MODULE_OPTIONS: ModulePermissionOption[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'usuarios', label: 'Usuarios' },
  { key: 'ciclos', label: 'Ciclos' },
  { key: 'nomenclaturas', label: 'Nomenclaturas' },
  { key: 'grupos', label: 'Grupos' },
  { key: 'docentes', label: 'Docentes' },
  { key: 'asignaturas', label: 'Asignaturas' },
  { key: 'asignaciones', label: 'Asignaciones' },
  { key: 'solicitudes', label: 'Solicitudes' },
  { key: 'ligasMeet', label: 'Ligas Meet' },
  { key: 'moodle', label: 'Moodle' },
  { key: 'bitacora', label: 'Bitacora' },
];

@Component({
  selector: 'spai-role-manager',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './role-manager.component.html',
  styleUrl: './role-manager.component.css',
})
export class RoleManagerComponent {
  @Input() compact = false;

  private readonly formBuilder = new FormBuilder();
  private readonly customRolesRepository = inject(CustomRolesRepository);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);

  readonly moduleOptions = MODULE_OPTIONS;
  readonly permissionLevels: PermissionLevel[] = ['none', 'view', 'edit'];
  readonly permissionLabels: Record<PermissionLevel, string> = {
    none: 'Sin acceso',
    view: 'Solo consulta',
    edit: 'Consulta y edicion',
  };

  readonly roleForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
  });

  isModalOpen = false;
  editingRoleId: string | null = null;
  saveError = '';
  readonly roleTemplates = this.customRolesRepository.roleTemplates;
  draftPermissions = this.createEmptyPermissions();

  get modalEyebrow(): string {
    return this.editingRoleId ? 'Editar rol' : 'Nuevo rol';
  }

  get modalTitle(): string {
    return this.editingRoleId ? 'Actualizar permisos' : 'Definir permisos';
  }

  get submitLabel(): string {
    return this.editingRoleId ? 'Guardar cambios' : 'Guardar rol';
  }

  openModal(): void {
    this.isModalOpen = true;
    this.editingRoleId = null;
    this.saveError = '';
    this.roleForm.reset({ name: '' });
    this.draftPermissions = this.createEmptyPermissions();
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.editingRoleId = null;
    this.saveError = '';
    this.roleForm.reset({ name: '' });
    this.draftPermissions = this.createEmptyPermissions();
  }

  editRole(role: RoleTemplate): void {
    this.editingRoleId = role.id;
    this.saveError = '';
    this.roleForm.reset({ name: role.name });
    this.draftPermissions = {
      ...this.createEmptyPermissions(),
      ...role.permissions,
    };
    this.isModalOpen = true;
  }

  async saveRole(): Promise<void> {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      return;
    }

    this.saveError = '';
    const cleanName = this.roleForm.getRawValue().name.trim();

    try {
      if (this.editingRoleId) {
        await this.customRolesRepository.updateRole(this.editingRoleId, {
          name: cleanName,
          permissions: this.draftPermissions,
        });
      } else {
        await this.customRolesRepository.createRole({
          name: cleanName,
          permissions: this.draftPermissions,
        });
      }
    } catch (error) {
      this.saveError = `No se pudo guardar el rol. ${this.readFirebaseMessage(error)}`;
      return;
    }

    this.closeModal();
  }

  async deleteRole(role: RoleTemplate): Promise<void> {
    const confirmed = await this.confirmationDialogService.confirm({
      title: 'Eliminar rol personalizado',
      message: `Eliminar el rol ${role.name}?`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.customRolesRepository.deleteRole(role.id);
    } catch (error) {
      await this.confirmationDialogService.alert({
        title: 'No se pudo eliminar',
        message: this.readFirebaseMessage(error),
      });
    }
  }

  updateDraftPermission(moduleKey: string, permission: PermissionLevel): void {
    this.draftPermissions = {
      ...this.draftPermissions,
      [moduleKey]: permission,
    };
  }

  permissionFor(moduleKey: string): PermissionLevel {
    return this.draftPermissions[moduleKey] ?? 'none';
  }

  rolePermissionSummary(role: RoleTemplate): string {
    const editCount = this.moduleOptions.filter((module) => role.permissions[module.key] === 'edit').length;
    const viewCount = this.moduleOptions.filter((module) => role.permissions[module.key] === 'view').length;

    return `${editCount} edicion / ${viewCount} consulta`;
  }

  private readFirebaseMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Revisa permisos de Firebase e intentalo de nuevo.';
  }

  private createEmptyPermissions(): Record<string, PermissionLevel> {
    return this.moduleOptions.reduce<Record<string, PermissionLevel>>(
      (permissions, module) => ({ ...permissions, [module.key]: 'none' }),
      {},
    );
  }
}
