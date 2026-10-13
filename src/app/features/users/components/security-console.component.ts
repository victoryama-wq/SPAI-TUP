import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserSessionService } from '../../../core/auth/user-session.service';
import { ConfirmationDialogService } from '../../../shared/confirmation/confirmation-dialog.service';
import { AppUser, EffectiveLevel, ModuleAccess } from '../data/users.repository';
import { SecurityService, SecurityDirectory, SecurityRecord, SECURITY_MODULES, MigrationPreview } from '../data/security.service';

@Component({
  selector: 'spai-security-console', imports: [CommonModule, FormsModule],
  templateUrl: './security-console.component.html', styleUrl: './security-console.component.css',
})
export class SecurityConsoleComponent {
  private readonly service = inject(SecurityService);
  private readonly session = inject(UserSessionService);
  private readonly confirm = inject(ConfirmationDialogService);
  readonly directory = signal<SecurityDirectory | null>(null);
  readonly general = computed(() => this.session.session()?.appUser?.baseRole === 'ADMIN_GENERAL');
  readonly modules = SECURITY_MODULES;
  readonly baseRoles = ['COORDINACION_ACADEMICA', 'ALTA_DOCENTES', 'ADMIN_OPERATIVO', 'ADMIN_GENERAL', 'CUSTOM'] as const;
  readonly roleLabels: Record<string, string> = { COORDINACION_ACADEMICA: 'Coordinación Académica', ALTA_DOCENTES: 'Alta de Docentes', ADMIN_OPERATIVO: 'Auxiliar de Sistemas', ADMIN_GENERAL: 'Administración de Sistemas', CUSTOM: 'Acceso personalizado' };
  readonly capabilities = ['MANAGE_CUSTOM_ROLES', 'VALIDATE_TEACHERS', 'MANAGE_CYCLES', 'CONFIRM_MOODLE_UPDATE', 'MANAGE_MOODLE_TEMPLATES', 'RECOVER_DELETED_RECORDS', 'PURGE_CYCLE', 'OPERATE_EXCEPTIONAL_CHANGE', 'REQUEST_TEACHER_MOODLE_IDENTITY'];
  readonly capabilityLabels: Record<string, string> = { MANAGE_CUSTOM_ROLES: 'Asignar roles preaprobados', VALIDATE_TEACHERS: 'Validar docentes', MANAGE_CYCLES: 'Administrar ciclos', CONFIRM_MOODLE_UPDATE: 'Confirmar actualización Moodle', MANAGE_MOODLE_TEMPLATES: 'Administrar plantillas Moodle', RECOVER_DELETED_RECORDS: 'Recuperar registros (flujo posterior)', PURGE_CYCLE: 'Depurar ciclos (flujo posterior)', OPERATE_EXCEPTIONAL_CHANGE: 'Corrección extraordinaria', REQUEST_TEACHER_MOODLE_IDENTITY: 'Solicitar corrección de identidad docente (flujo posterior)' };
  busy = false; error = ''; message = ''; reason = '';
  mode: 'user' | 'role' | 'delegation' | null = null;
  targetId = ''; expectedRevision = 0; name = ''; email = ''; baseRole: AppUser['baseRole'] = 'COORDINACION_ACADEMICA'; status = 'Activo';
  programs = ''; cycles = ''; teachers = ''; fields = '';
  permissions: Partial<Record<keyof ModuleAccess, EffectiveLevel>> = {};
  selectedCapabilities: string[] = [];
  selectedUserId = ''; selectedRoleId = ''; mappingRole = 'COORDINACION_ACADEMICA';
  preview: MigrationPreview | null = null;
  private pendingRequest: Record<string, unknown> | null = null;
  area = '';
  greetingGender: AppUser['greetingGender'] = 'Femenino';
  roleDirectory = false;
  readonly editorDialog = viewChild<ElementRef<HTMLDialogElement>>('editorDialog');
  showDialog(): void { setTimeout(() => { const dialog = this.editorDialog()?.nativeElement; if ((this.mode || this.roleDirectory) && dialog && !dialog.open) dialog.showModal(); }); }
  closeEditor(): void { this.editorDialog()?.nativeElement.close(); this.mode = null; this.roleDirectory = false; }
  openRoles(): void { this.mode = null; this.roleDirectory = true; this.showDialog(); }
  private sessionGeneration = 0;
  private directoryRequest = 0;
  constructor() {
    effect(() => {
      const user = this.session.session()?.appUser;
      this.sessionGeneration++;
      this.directory.set(null); this.preview = null; this.closeEditor();
      if (user?.status === 'Activo' && (user.baseRole === 'ADMIN_GENERAL' || user.capabilities?.includes('MANAGE_CUSTOM_ROLES'))) void this.reload();
    });
  }
  async reload(): Promise<void> {
    const generation = this.sessionGeneration;
    const request = ++this.directoryRequest;
    try { const data = await this.service.directory(); if (generation === this.sessionGeneration && request === this.directoryRequest) this.directory.set(data); }
    catch (e) { if (generation === this.sessionGeneration && request === this.directoryRequest) { this.directory.set(null); this.error = this.errorText(e); } }
  }
  userName(id?: string): string { const user = this.directory()?.usuarios.find(u => u.id === id); return user ? `${user.name} (${user.email})` : 'Perfil fuera de esta vista'; }
  roleName(id?: string): string { return this.directory()?.roles_personalizados.find(r => r.id === id)?.name ?? 'Rol conservado en historial'; }
  open(mode: 'user' | 'role' | 'delegation', record?: AppUser | SecurityRecord): void {
    this.roleDirectory = false; this.mode = mode; this.showDialog(); this.targetId = record?.id ?? crypto.randomUUID(); this.expectedRevision = record?.revision ?? 0;
    this.name = record?.name ?? ''; this.email = (record as AppUser)?.email ?? '';
    this.area = (record as AppUser)?.area ?? '';
    this.greetingGender = (record as AppUser)?.greetingGender ?? 'Femenino';
    this.baseRole = (record as AppUser)?.baseRole ?? 'COORDINACION_ACADEMICA'; this.status = record?.status ?? 'Activo';
    this.permissions = { ...(record?.permissions ?? {}) }; this.selectedCapabilities = [...(record?.capabilities ?? [])];
    this.programs = record?.scope?.programs.join(', ') ?? (record as AppUser)?.assignedPrograms?.join(', ') ?? '';
    this.cycles = record?.scope?.cycles.join(', ') ?? ''; this.teachers = record?.scope?.teachers.join(', ') ?? ''; this.fields = record?.scope?.fields.join(', ') ?? '';
    this.reason = ''; this.error = ''; this.pendingRequest = null;
  }
  setPermission(key: keyof ModuleAccess, edit: boolean, checked: boolean): void {
    const previous = this.permissions[key] ?? 'NONE';
    this.permissions = { ...this.permissions, [key]: edit ? (checked ? 'EDIT' : previous === 'EDIT' ? 'VIEW' : previous) : checked ? previous === 'EDIT' ? 'EDIT' : 'VIEW' : 'NONE' };
  }
  quickPermissions(all: boolean): void { this.permissions = Object.fromEntries(this.modules.map(k => [k, all && !['usuarios', 'ciclos', 'moodle', 'bitacora'].includes(k) ? 'VIEW' : 'NONE'])); }
  toggleCapability(cap: string, checked: boolean): void { this.selectedCapabilities = checked ? [...new Set([...this.selectedCapabilities, cap])] : this.selectedCapabilities.filter(c => c !== cap); }
  private values(value: string): string[] { return [...new Set(value.split(',').map(v => v.trim()).filter(Boolean))]; }
  async save(): Promise<void> {
    const scope = { programs: this.values(this.programs), cycles: this.values(this.cycles), teachers: this.values(this.teachers), fields: this.values(this.fields) };
    await this.run({ action: this.mode === 'user' ? 'saveUser' : this.mode === 'role' ? 'saveRole' : 'grantDelegation', targetId: this.targetId, expectedRevision: this.expectedRevision, value: { greetingGender: this.greetingGender, area: this.area.trim(), name: this.name, email: this.email.trim().toLowerCase(), role: this.roleLabels[this.baseRole ?? 'CUSTOM'], baseRole: this.baseRole, status: this.status, permissions: this.permissions, capabilities: this.selectedCapabilities, scope, assignedPrograms: scope.programs } });
  }
  async assign(): Promise<void> {
    const user = this.directory()?.usuarios.find(u => u.id === this.selectedUserId); const role = this.directory()?.roles_personalizados.find(r => r.id === this.selectedRoleId);
    if (!user || !role) { this.error = 'Selecciona usuario y rol.'; return; }
    await this.run({ action: 'assignRole', targetId: user.id, expectedRevision: user.revision ?? 0, roleId: role.id, roleRevision: role.revision });
  }
  async action(action: string, item: SecurityRecord, decision?: string): Promise<void> {
    await this.run({ action, targetId: item.id, expectedRevision: item.revision, ...(decision ? { decision } : {}) });
  }
  async replaceReview(item: SecurityRecord): Promise<void> {
    const role = this.directory()?.roles_personalizados.find(r => r.id === this.selectedRoleId);
    if (!role) { this.error = 'Selecciona el rol de sustitución en el selector de roles.'; return; }
    await this.run({ action: 'resolveReview', targetId: item.id, expectedRevision: item.revision, decision: 'REPLACE', roleId: role.id, roleRevision: role.revision });
  }
  async migration(action: string): Promise<void> {
    const user = this.directory()?.usuarios.find(u => u.id === this.selectedUserId);
    if (!user) { this.error = 'Selecciona un perfil.'; return; }
    await this.run({ action, targetId: user.id, expectedRevision: user.revision ?? 0, baseRole: this.mappingRole, ...(action === 'applyMigration' ? { previewId: this.preview?.previewId } : {}) });
  }
  async run(request: Record<string, unknown>): Promise<void> {
    if (this.busy) return;
    if (this.reason.trim().length < 4) { this.error = 'Escribe un motivo antes de revisar y confirmar.'; return; }
    const command = { ...request, reason: this.reason.trim() };
    const generation = this.sessionGeneration;
    const editorWasOpen = Boolean(this.editorDialog()?.nativeElement.open);
    this.editorDialog()?.nativeElement.close();
    if (!await this.confirm.confirm({ title: 'Confirmar cambio de acceso', message: `Operación: ${request['action']}. Motivo: ${this.reason}. Se comprobarán nuevamente permisos y revisiones en servidor.`, confirmLabel: 'Confirmar', cancelLabel: 'Volver' })) { if (editorWasOpen) this.showDialog(); return; }
    const serialized = JSON.stringify(command);
    if (!this.pendingRequest || this.pendingRequest['draft'] !== serialized) this.pendingRequest = { draft: serialized, operationId: crypto.randomUUID() };
    this.busy = true; this.error = ''; this.message = '';
    try {
      const result = await this.service.command({ ...command, operationId: this.pendingRequest['operationId'] });
      if (generation !== this.sessionGeneration) return;
      this.preview = result.preview ?? (request['action'] === 'applyMigration' ? null : this.preview);
      this.pendingRequest = null; this.closeEditor(); await this.reload(); this.message = 'Operación confirmada y auditada.';
    } catch (e) { this.error = this.errorText(e); if (editorWasOpen) this.showDialog(); }
    finally { this.busy = false; }
  }
  private errorText(e: unknown): string { return e instanceof Error ? e.message : 'No se confirmó la operación. Conserva los datos y vuelve a consultar.'; }
}
