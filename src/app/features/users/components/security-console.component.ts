import { CommonModule } from '@angular/common';
import { randomId } from '../../../core/utils/random-id';
import { Component, computed, effect, inject, signal, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserSessionService } from '../../../core/auth/user-session.service';
import { AppUser, EffectiveLevel, ModuleAccess } from '../data/users.repository';
import { SecurityService, SecurityDirectory, SecurityRecord, SECURITY_MODULES, MigrationPreview } from '../data/security.service';

@Component({
  host: { '(window:focus)': 'refreshDirectory()' },
  selector: 'spai-security-console', imports: [CommonModule, FormsModule],
  templateUrl: './security-console.component.html', styleUrl: './security-console.component.css',
})
export class SecurityConsoleComponent {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly service = inject(SecurityService);
  private readonly session = inject(UserSessionService);
  readonly directory = signal<SecurityDirectory | null>(null);
  readonly directoryState = signal<'loading' | 'ready' | 'error' | 'restricted'>('loading');
  readonly profiles = computed(() => this.directory()?.usuarios.filter(user => !user.identityAliasOf) ?? []);
  readonly activeProfiles = computed(() => this.profiles().filter(user => user.status === 'Activo'));
  readonly legacyProfiles = computed(() => this.profiles().filter(user => user.permissionSchemaVersion !== 2));
  readonly activeAssignments = computed(() => this.directory()?.asignaciones_roles.filter(item => item.status === 'ACTIVE') ?? []);
  readonly pendingReviews = computed(() => this.directory()?.revisiones_roles.filter(item => item.status === 'REQUIERE_REVISION_ADMIN_GENERAL') ?? []);
  readonly liveDelegations = computed(() => this.directory()?.delegaciones.filter(grant => grant.status === 'ACTIVE' && this.activeProfiles().some(user => user.id === grant.userId && user.delegationId === grant.id)) ?? []);
  confirmation: { command: Record<string,unknown>; generation: number; title: string; recipient: string; impact: string } | null = null;
  private dialogOpener: HTMLElement | null = null;
  readonly general = computed(() => this.session.session()?.appUser?.baseRole === 'ADMIN_GENERAL');
  readonly modules = SECURITY_MODULES;
  readonly baseRoles = ['COORDINACION_ACADEMICA', 'ALTA_DOCENTES', 'ADMIN_OPERATIVO', 'ADMIN_GENERAL', 'CUSTOM'] as const;
  readonly roleLabels: Record<string, string> = { COORDINACION_ACADEMICA: 'Coordinación Académica', ALTA_DOCENTES: 'Alta de Docentes', ADMIN_OPERATIVO: 'Auxiliar de Sistemas', ADMIN_GENERAL: 'Administración de Sistemas', CUSTOM: 'Acceso personalizado' };
  readonly capabilities = ['MANAGE_CUSTOM_ROLES', 'VALIDATE_TEACHERS', 'MANAGE_CYCLES', 'CONFIRM_MOODLE_UPDATE', 'MANAGE_MOODLE_TEMPLATES', 'RECOVER_DELETED_RECORDS', 'PURGE_CYCLE', 'OPERATE_EXCEPTIONAL_CHANGE', 'REQUEST_TEACHER_MOODLE_IDENTITY'];
  readonly capabilityLabels: Record<string, string> = { MANAGE_CUSTOM_ROLES: 'Asignar roles preaprobados', VALIDATE_TEACHERS: 'Validar docentes', MANAGE_CYCLES: 'Administrar ciclos', CONFIRM_MOODLE_UPDATE: 'Confirmar actualización Moodle', MANAGE_MOODLE_TEMPLATES: 'Administrar plantillas Moodle', RECOVER_DELETED_RECORDS: 'Recuperar registros (flujo posterior)', PURGE_CYCLE: 'Depurar ciclos (flujo posterior)', OPERATE_EXCEPTIONAL_CHANGE: 'Corrección extraordinaria', REQUEST_TEACHER_MOODLE_IDENTITY: 'Solicitar corrección de identidad docente (flujo posterior)' };
  busy = false; error = ''; message = ''; reason = '';
  mode: 'user' | 'role' | 'delegation' | 'operation' | 'preview' | null = null;
  section: 'summary' | 'assignments' | 'delegations' | 'reviews' = 'summary';
  operation: { request: Record<string, unknown>; title: string; recipient: string; replace?: boolean } | null = null;
  readonly actionLabels: Record<string,string> = {assignRole:'Asignar rol',removeRole:'Retirar rol asignado',deleteRole:'Retirar definición',suspendDelegation:'Suspender delegación',revokeDelegation:'Revocar delegación',resolveReview:'Resolver revisión',approveMapping:'Registrar correspondencia',previewMigration:'Consultar vista previa',applyMigration:'Aplicar migración'};
  statusLabel(value?: string): string { return ({ACTIVE:'Activo',REVOKED:'Revocado',SUSPENDED:'Suspendido',RETIRED:'Retirado',REMOVED:'Retirado',NOT_REQUIRED:'Sin revisión requerida',REQUIERE_REVISION_ADMIN_GENERAL:'Pendiente de Administración General',RESOLVED:'Resuelta',KEEP:'Conservado',REMOVE:'Retirado',REPLACE:'Sustituido',Activo:'Activo',Inactivo:'Inactivo'} as Record<string,string>)[value ?? ''] ?? 'Sin estado informado'; }
  roleInUse(id: string): boolean { return Boolean(this.directory()?.asignaciones_roles.some(a => a.roleId === id && a.status === 'ACTIVE')); }
  changeSection(section: typeof this.section): void { this.section = section; this.reason = ''; this.selectedRoleId = ''; this.selectedUserId = ''; this.preview = null; this.pendingRequest = null; this.error = ''; this.message = ''; }
  selectionChanged(): void { this.reason = ''; this.preview = null; this.pendingRequest = null; }
  legacyPersonChanged(): void { this.selectionChanged(); this.mappingRole = ''; }
  targetId = ''; expectedRevision = 0; name = ''; email = ''; baseRole: AppUser['baseRole'] = 'COORDINACION_ACADEMICA'; status = 'Activo';
  programs = ''; cycles = ''; teachers = ''; fields = '';
  permissions: Partial<Record<keyof ModuleAccess, EffectiveLevel>> = {};
  selectedCapabilities: string[] = [];
  selectedUserId = ''; selectedRoleId = ''; mappingRole = '';
  preview: MigrationPreview | null = null;
  private pendingRequest: Record<string, unknown> | null = null;
  area = '';
  greetingGender: AppUser['greetingGender'] = 'Femenino';
  roleDirectory = false;
  readonly editorDialog = viewChild<ElementRef<HTMLDialogElement>>('editorDialog');
  private rememberOpener(): void {
    const active = this.element.nativeElement.ownerDocument.activeElement;
    if (active instanceof HTMLElement && !this.editorDialog()?.nativeElement.contains(active)) this.dialogOpener = active;
  }
  showDialog(): void {
    setTimeout(() => {
      const dialog = this.editorDialog()?.nativeElement;
      if (!(this.mode || this.roleDirectory) || !dialog) return;
      if (!dialog.open) dialog.showModal();
      const target = dialog.querySelector<HTMLElement>('input:not([disabled]),textarea:not([disabled]),select:not([disabled])') ?? dialog.querySelector<HTMLElement>('#security-editor-title');
      target?.focus();
    });
  }
  cancelEditor(event: Event): void { event.preventDefault(); if (!this.busy) this.closeEditor(); }
  closeEditor(): void {
    this.editorDialog()?.nativeElement.close();
    this.selectedUserId = ''; this.selectedRoleId = ''; this.mappingRole = ''; this.preview = null;
    this.mode = null; this.roleDirectory = false; this.operation = null; this.confirmation = null; this.reason = ''; this.pendingRequest = null;
    queueMicrotask(() => {
      if (!this.mode && !this.roleDirectory) {
        if (this.dialogOpener?.isConnected && !this.dialogOpener.hasAttribute('disabled')) this.dialogOpener.focus();
        else this.element.nativeElement.querySelector<HTMLButtonElement>('.panel-actions button, .section-navigation button')?.focus();
      }
    });
  }
  openRoles(): void { if (!this.general()) return; this.rememberOpener(); this.closeEditor(); this.roleDirectory = true; this.showDialog(); }
  private sessionGeneration = 0;
  private directoryRequest = 0;
  constructor() {
    effect(() => {
      const user = this.session.session()?.appUser;
      this.sessionGeneration++;
      this.selectedUserId = ''; this.selectedRoleId = ''; this.reason = ''; this.error = ''; this.message = ''; this.busy = false;
      this.directory.set(null); this.directoryState.set('restricted'); this.section = 'summary'; this.preview = null; this.closeEditor();
      if (user?.status === 'Activo' && (user.baseRole === 'ADMIN_GENERAL' || user.capabilities?.includes('MANAGE_CUSTOM_ROLES'))) void this.reload();
    });
  }
  refreshDirectory(): void { if (!this.mode && !this.roleDirectory && !this.busy && this.directoryState() !== 'loading' && this.directoryState() !== 'restricted') void this.reload(); }
  async reload(): Promise<void> {
    this.directory.set(null); this.directoryState.set('loading'); this.error = '';
    const generation = this.sessionGeneration;
    const request = ++this.directoryRequest;
    try { const data = await this.service.directory(); if (generation === this.sessionGeneration && request === this.directoryRequest) { this.directory.set(data); this.directoryState.set('ready'); } }
    catch (e) { if (generation === this.sessionGeneration && request === this.directoryRequest) { this.directory.set(null); this.directoryState.set('error'); this.error = this.errorText(e); } }
  }
  userName(id?: string): string { const user = this.directory()?.usuarios.find(u => u.id === id); return user ? `${user.name} (${user.email})` : 'Perfil fuera de esta vista'; }
  roleName(id?: string): string { return this.directory()?.roles_personalizados.find(r => r.id === id)?.name ?? 'Rol conservado en historial'; }
  open(mode: 'user' | 'role' | 'delegation', record?: AppUser | SecurityRecord): void {
    if (!this.general()) return;
    this.rememberOpener(); this.operation = null; this.confirmation = null; this.preview = null; this.roleDirectory = false; this.mode = mode; this.showDialog(); this.targetId = record?.id ?? randomId(); this.expectedRevision = record?.revision ?? 0;
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
    if (!this.general() || !this.mode || (this.mode === 'operation' || this.mode === 'preview')) return;
    const scope = { programs: this.values(this.programs), cycles: this.values(this.cycles), teachers: this.values(this.teachers), fields: this.values(this.fields) };
    await this.run({ action: this.mode === 'user' ? 'saveUser' : this.mode === 'role' ? 'saveRole' : 'grantDelegation', targetId: this.targetId, expectedRevision: this.expectedRevision, value: { greetingGender: this.greetingGender, area: this.area.trim(), name: this.name, email: this.email.trim().toLowerCase(), role: this.roleLabels[this.baseRole ?? 'CUSTOM'], baseRole: this.baseRole, status: this.status, permissions: this.permissions, capabilities: this.selectedCapabilities, scope, assignedPrograms: scope.programs } });
  }
  async assign(): Promise<void> {
    const user = this.directory()?.usuarios.find(u => u.id === this.selectedUserId); const role = this.directory()?.roles_personalizados.find(r => r.id === this.selectedRoleId);
    if (!user || !role) { this.error = 'Selecciona usuario y rol.'; return; }
    this.beginOperation({ action: 'assignRole', targetId: user.id, expectedRevision: user.revision ?? 0, roleId: role.id, roleRevision: role.revision }, `${user.name} — ${role.name}`);
  }
  async action(action: string, item: SecurityRecord, decision?: string): Promise<void> {
    if (action === 'deleteRole' && (!this.general() || this.roleInUse(item.id))) { this.error = 'No se puede retirar una definición con asignaciones vigentes.'; return; }
    this.beginOperation({ action, targetId: item.id, expectedRevision: item.revision, ...(decision ? { decision } : {}) }, action === 'deleteRole' ? item.name ?? item.id : `${this.userName(item.userId)} · ${item.id}`);
  }
  async replaceReview(item: SecurityRecord): Promise<void> {
    this.beginOperation({action:'resolveReview',targetId:item.id,expectedRevision:item.revision,decision:'REPLACE'}, this.userName(item.userId), true);
  }
  async migration(action: string): Promise<void> {
    const user = this.directory()?.usuarios.find(u => u.id === (action === 'applyMigration' ? this.preview?.userId : this.selectedUserId));
    if (!this.general()) return;
    if (!user) { this.error = 'Selecciona un perfil.'; return; }
    if (action === 'approveMapping' && !this.mappingRole) { this.error = 'Selecciona la correspondencia verificada para esta persona.'; return; }
    this.beginOperation({ action, targetId: user.id, expectedRevision: user.revision ?? 0, baseRole: this.mappingRole, ...(action === 'applyMigration' ? { previewId: this.preview?.previewId } : {}) }, user.name);
  }
  private beginOperation(request: Record<string,unknown>, recipient: string, replace = false): void {
    this.rememberOpener(); this.closeEditor(); this.error = ''; this.message = ''; if (replace) this.selectedRoleId = '';
    const decision = request['decision'] ? ` — ${this.statusLabel(String(request['decision']))}` : '';
    this.operation = {request,recipient,title:(this.actionLabels[String(request['action'])] ?? 'Cambio de acceso') + decision,replace}; this.mode = 'operation'; this.showDialog();
  }
  async confirmOperation(): Promise<void> {
    if (!this.operation) return;
    const request = {...this.operation.request};
    if (this.operation.replace) {
      const role = this.directory()?.roles_personalizados.find(r => r.id === this.selectedRoleId && r.status === 'ACTIVE');
      if (!role) { this.error = 'Selecciona el rol de sustitución para esta revisión.'; return; }
      request['roleId'] = role.id; request['roleRevision'] = role.revision;
    }
    await this.run(request);
  }
  async run(request: Record<string, unknown>): Promise<void> {
    if (this.busy) return;
    if (this.reason.trim().length < 4) { this.error = 'Escribe un motivo antes de revisar y confirmar.'; return; }
    const impacts: Record<string,string> = {
      deleteRole: 'La definición dejará de estar disponible para nuevas asignaciones; se conserva su historial. El servidor rechaza el retiro si tiene asignaciones vigentes.',
      approveMapping: 'Registra una correspondencia verificada. Para un perfil heredado inicia la transición temporal vigente de siete días; no sustituye la migración explícita.',
      previewMigration: 'Genera una vista previa auditable; todavía no modifica los permisos del perfil.',
      applyMigration: 'Aplica únicamente la vista previa identificada. Cambios de perfil, mapeo, delegación o vigencia pueden invalidarla.',
      grantDelegation: 'Otorga una delegación nueva a la persona indicada, con los módulos, capacidades y ámbitos revisados.',
      revokeDelegation: 'Retira las facultades de esta delegación. Los roles ya asignados se conservan y requieren revisión administrativa.',
      suspendDelegation: 'Suspende las facultades de esta delegación; no elimina su historial.',
      removeRole: 'Retira esta asignación de rol a la persona indicada; conserva su historial.',
      assignRole: 'Asigna el rol preaprobado indicado, sujeto al ámbito y facultades vigentes.',
      resolveReview: 'Registra la decisión indicada sobre el rol asignado; no reactiva delegaciones revocadas.',
    };
    this.confirmation = { command: {...request,reason:this.reason.trim()}, generation:this.sessionGeneration, title:this.operation?.title ?? (this.mode === 'role' ? 'Guardar definición de rol' : this.mode === 'delegation' ? 'Otorgar delegación' : 'Guardar perfil institucional'), recipient:this.operation?.recipient ?? this.name, impact:impacts[String(request['action'])] ?? 'Guarda la configuración revisada para este destinatario y registra el cambio en bitácora.' };
    this.showDialog();
  }
  backToEditor(): void { this.confirmation = null; this.showDialog(); }
  async confirmChange(): Promise<void> {
    const draft = this.confirmation;
    if (!draft || this.busy || draft.generation !== this.sessionGeneration) return;
    const {command,generation} = draft, serialized = JSON.stringify(command);
    if (!this.pendingRequest || this.pendingRequest['draft'] !== serialized) this.pendingRequest = {draft:serialized,operationId:randomId()};
    this.busy = true; this.error = ''; this.message = '';
    try {
      const result = await this.service.command({...command,operationId:this.pendingRequest['operationId']});
      if (generation !== this.sessionGeneration) return;
      this.pendingRequest = null;
      if (result.preview) {
        this.preview = result.preview; this.operation = null; this.confirmation = null; this.reason = ''; this.mode = 'preview'; this.showDialog();
      } else {
        this.closeEditor(); await this.reload();
        if (generation === this.sessionGeneration) this.message = 'Operación confirmada y auditada.';
      }
    } catch (e) {
      if (generation === this.sessionGeneration) { this.error = this.errorText(e); this.confirmation = null; this.showDialog(); }
    } finally { if (generation === this.sessionGeneration) this.busy = false; }
  }
  private errorText(e: unknown): string { return e instanceof Error ? e.message : 'No se confirmó la operación. Conserva los datos y vuelve a consultar.'; }
}
