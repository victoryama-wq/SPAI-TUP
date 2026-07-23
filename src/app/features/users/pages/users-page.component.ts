import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  ACADEMIC_COORDINATION_ACCESS,
  AppUser,
  CreateUserPayload,
  FULL_MODULE_ACCESS,
  ModuleAccess,
  UpdateUserPayload,
  UserGreetingGender,
  UserRole,
  UserStatus,
  UsersRepository,
} from '../data/users.repository';
import { RoleManagerComponent } from '../components/role-manager.component';
import {
  CustomRolesRepository,
  PermissionLevel,
  RoleTemplate,
} from '../data/custom-roles.repository';
import { UserSessionService } from '../../../core/auth/user-session.service';
import { ConfirmationDialogService } from '../../../shared/confirmation/confirmation-dialog.service';
import { NomenclaturesRepository } from '../../nomenclatures/data/nomenclatures.repository';
import { ProgramsRepository } from '../../nomenclatures/data/programs.repository';

interface ProgramOption {
  label: string;
  value: string;
  owner: string;
}

interface ModuleAccessOption {
  key: keyof ModuleAccess;
  label: string;
}

interface RoleOption {
  label: string;
  value: UserRole;
  custom: boolean;
}

@Component({
  selector: 'spai-users-page',
  imports: [CommonModule, ReactiveFormsModule, RoleManagerComponent],
  providers: [
    CustomRolesRepository,
    NomenclaturesRepository,
    ProgramsRepository,
    UsersRepository,
  ],
  templateUrl: './users-page.component.html',
  styleUrl: './users-page.component.css',
})
export class UsersPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly usersRepository = inject(UsersRepository);
  private readonly customRolesRepository = inject(CustomRolesRepository);
  private readonly userSessionService = inject(UserSessionService);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly nomenclaturesRepository = inject(NomenclaturesRepository);
  private readonly programsRepository = inject(ProgramsRepository);
  private readonly isSavingSignal = signal(false);
  private readonly saveErrorSignal = signal('');
  private readonly programOptionsRefreshSignal = signal(0);

  readonly roles: UserRole[] = [
    'Coordinación Académica',
    'Coordinación de Sistemas',
    'Auxiliar de Sistemas',
  ];
  readonly statuses: UserStatus[] = ['Activo', 'Inactivo'];
  readonly greetingGenders: UserGreetingGender[] = ['Femenino', 'Masculino'];
  readonly users = this.usersRepository.users;
  readonly customRoles = this.customRolesRepository.roleTemplates;
  readonly nomenclatures = this.nomenclaturesRepository.nomenclatures;
  readonly programs = this.programsRepository.programs;
  readonly usersReadError = this.usersRepository.usersReadError;
  readonly isSaving = this.isSavingSignal.asReadonly();
  readonly saveError = this.saveErrorSignal.asReadonly();
  readonly currentUserRole = computed(() => this.userSessionService.session()?.appUser?.role ?? null);
  readonly roleOptions = computed<RoleOption[]>(() => {
    const baseRoles = this.roles.map((role) => ({
      label: role,
      value: role,
      custom: false,
    }));
    const customRoles = this.customRoles().map((role) => ({
      label: role.name,
      value: role.name,
      custom: true,
    }));

    return [...baseRoles, ...customRoles];
  });
  readonly rolesAvailableCount = computed(() => this.roleOptions().length);
  readonly currentAccessDiagnostic = computed(() => {
    const session = this.userSessionService.session();
    const appUser = session?.appUser;

    if (!session) {
      return 'Sesion no iniciada.';
    }

    if (!appUser) {
      return `Sesion Google activa (${session.email}), pero no hay usuario activo enlazado en Firestore.`;
    }

    return [
      `Documento: ${appUser.id}`,
      `Correo: ${appUser.email}`,
      `Rol: ${appUser.role}`,
      `Estado: ${appUser.status}`,
      `Acceso usuarios: ${appUser.access?.usuarios === true ? 'SI' : 'NO'}`,
    ].join(' | ');
  });
  readonly emailDomain = '@tecplayacar.edu.mx';

  readonly programOptions = computed<ProgramOption[]>(() => {
    this.programOptionsRefreshSignal();
    const optionsByValue = new Map<string, ProgramOption>();
    const setOption = (value: string, label: string): void => {
      if (!value || optionsByValue.has(value) || this.isProgramUnavailableForForm(value)) {
        return;
      }

      optionsByValue.set(value, {
        value,
        label,
        owner: '',
      });
    };

    this.nomenclatures()
      .filter((nomenclature) => nomenclature.status === 'ACTIVA')
      .forEach((nomenclature) => {
        const value = this.normalizeProgramCode(nomenclature.programCode || nomenclature.abbreviation);

        setOption(value, `${value} - ${nomenclature.programName}`);
      });

    this.form.controls.assignedPrograms.value.forEach((assignedProgram) => {
      const value = this.normalizeProgramCode(assignedProgram);

      if (!value || optionsByValue.has(value)) {
        return;
      }

      optionsByValue.set(value, {
        value,
        label: `${value} - asignado actualmente`,
        owner: '',
      });
    });

    return Array.from(optionsByValue.values())
      .sort((a, b) => a.value.localeCompare(b.value, 'es'));
  });
  readonly moduleAccessOptions: ModuleAccessOption[] = [
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

  private readonly institutionalEmailValidator = (
    control: AbstractControl<string>,
  ): ValidationErrors | null => {
    const emailUser = this.normalizeEmailUser(control.value);
    const emailUserPattern = /^[a-z0-9._-]+$/;

    if (!emailUser || emailUserPattern.test(emailUser)) {
      return null;
    }

    return { emailUser: true };
  };

  readonly activeUsersCount = computed(
    () => this.users().filter((user) => user.status === 'Activo').length,
  );

  readonly coordinatorCount = computed(
    () => this.users().filter((user) => user.role === 'Coordinación Académica').length,
  );

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, this.institutionalEmailValidator]],
    role: this.formBuilder.nonNullable.control<UserRole>('Coordinación Académica', Validators.required),
    greetingGender: this.formBuilder.nonNullable.control<UserGreetingGender>('Femenino', Validators.required),
    assignedPrograms: this.formBuilder.nonNullable.control<string[]>([]),
    access: this.formBuilder.nonNullable.control<ModuleAccess>(ACADEMIC_COORDINATION_ACCESS),
    status: this.formBuilder.nonNullable.control<UserStatus>('Activo', Validators.required),
  });

  isFormOpen = false;
  editingUserId: string | null = null;

  get modalEyebrow(): string {
    return this.editingUserId ? 'Edicion de usuario' : 'Alta de usuario';
  }

  get modalTitle(): string {
    return this.editingUserId ? 'Editar acceso' : 'Datos de acceso';
  }

  get submitLabel(): string {
    return this.editingUserId ? 'Guardar cambios' : 'Guardar usuario';
  }

  openForm(): void {
    this.editingUserId = null;
    this.resetForm();
    this.refreshProgramOptions();
    this.isFormOpen = true;
  }

  editUser(user: AppUser): void {
    this.editingUserId = user.id;
    this.form.reset({
      name: user.name,
      email: this.getEmailUser(user.email),
      role: user.role,
      greetingGender: user.greetingGender ?? this.inferGreetingGender(user.name),
      assignedPrograms: this.assignedProgramsForUser(user),
      access: user.access,
      status: user.status,
    });
    this.refreshProgramOptions();
    this.isFormOpen = true;
  }

  closeForm(): void {
    this.isFormOpen = false;
    this.editingUserId = null;
    this.saveErrorSignal.set('');
    this.resetForm();
  }

  private resetForm(): void {
    this.form.reset({
      name: '',
      email: '',
      role: 'Coordinación Académica',
      greetingGender: 'Femenino',
      assignedPrograms: [],
      access: ACADEMIC_COORDINATION_ACCESS,
      status: 'Activo',
    });
  }

  async saveUser(): Promise<void> {
    this.saveErrorSignal.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.getPayloadFromForm();
    const duplicateUser = this.users().find(
      (user) => user.email === payload.email && user.id !== this.editingUserId && user.status === 'Activo',
    );

    if (duplicateUser) {
      this.saveErrorSignal.set('Ya existe un usuario registrado con ese correo institucional.');
      return;
    }

    const unavailablePrograms = payload.assignedPrograms
      .map((program) => ({
        program,
        owner: this.programAssignedOwner(program),
      }))
      .filter((item) => item.owner);

    if (unavailablePrograms.length) {
      const details = unavailablePrograms
        .map((item) => `${item.program} (${item.owner})`)
        .join(', ');
      this.saveErrorSignal.set(`No se puede guardar. Estos programas ya estan asignados a otra coordinacion: ${details}.`);
      return;
    }

    this.isSavingSignal.set(true);

    try {
      if (this.editingUserId) {
        await this.usersRepository.updateUser(this.editingUserId, payload as UpdateUserPayload);
      } else {
        await this.usersRepository.createUser(payload as CreateUserPayload);
      }

      this.closeForm();
    } catch (error) {
      console.error('No se pudo guardar el usuario', error);
      this.saveErrorSignal.set(this.getSaveErrorMessage(error));
    } finally {
      this.isSavingSignal.set(false);
    }
  }

  private getPayloadFromForm(): CreateUserPayload {
    const formValue = this.form.getRawValue();

    return {
      ...formValue,
      email: `${this.normalizeEmailUser(formValue.email)}${this.emailDomain}`,
      assignedPrograms: Array.from(new Set(
        formValue.assignedPrograms.map((program) => this.normalizeProgramCode(program)).filter(Boolean),
      )),
      access: this.getAccessForRole(formValue.role, formValue.access),
    };
  }

  private normalizeEmailUser(value: string): string {
    const cleanValue = value.trim().toLowerCase();

    return cleanValue.endsWith(this.emailDomain)
      ? cleanValue.slice(0, -this.emailDomain.length)
      : cleanValue;
  }

  private getAccessForRole(role: UserRole, access: ModuleAccess): ModuleAccess {
    const customRole = this.customRoleFor(role);

    if (customRole) {
      return this.moduleAccessFromCustomRole(customRole);
    }

    if (this.isSystemsRole(role)) {
      return FULL_MODULE_ACCESS;
    }

    if (this.isAcademicRole(role)) {
      return {
        ...ACADEMIC_COORDINATION_ACCESS,
        ligasMeet: access.ligasMeet,
        moodle: false,
        bitacora: false,
      };
    }

    return access;
  }

  private getEmailUser(email: string): string {
    return this.normalizeEmailUser(email);
  }

  private getSaveErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);

    if (message.toLowerCase().includes('permission')) {
      return 'Firebase no permitió guardar. Confirma que tu usuario tenga rol Coordinación de Sistemas y status Activo.';
    }

    return 'No se pudo guardar el usuario. Revisa los datos e intenta otra vez.';
  }

  private inferGreetingGender(name: string): UserGreetingGender {
    const firstName = name.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    const feminineNames = new Set([
      'lizett',
      'lizet',
      'lizeth',
      'lizbeth',
      'maria',
      'maría',
      'ana',
      'karla',
      'carla',
      'laura',
      'paola',
      'alejandra',
      'guadalupe',
    ]);

    return feminineNames.has(firstName) || firstName.endsWith('a') ? 'Femenino' : 'Masculino';
  }

  toggleProgram(program: string, checked: boolean): void {
    if (checked && this.isProgramUnavailable(program)) {
      return;
    }

    const currentPrograms = this.form.controls.assignedPrograms.value;
    const normalizedProgram = this.normalizeProgramCode(program);
    const aliases = this.programAliases(program);
    const nextPrograms = checked
      ? Array.from(new Set([...currentPrograms, normalizedProgram]))
      : currentPrograms.filter((assignedProgram) => !aliases.has(this.normalizeProgramCode(assignedProgram)));

    this.form.controls.assignedPrograms.setValue(nextPrograms);
    this.form.controls.assignedPrograms.markAsTouched();
    this.refreshProgramOptions();
  }

  isProgramSelected(program: string): boolean {
    const aliases = this.programAliases(program);

    return this.form.controls.assignedPrograms.value
      .some((assignedProgram) => aliases.has(this.normalizeProgramCode(assignedProgram)));
  }

  isProgramUnavailable(program: string): boolean {
    return Boolean(this.programAssignedOwner(program));
  }

  isProgramUnavailableForForm(program: string): boolean {
    const aliases = this.programAliases(program);
    const formAssignedPrograms = this.form.controls.assignedPrograms.value
      .map((assignedProgram) => this.normalizeProgramCode(assignedProgram));

    return Boolean(this.programAssignedOwner(program))
      && !formAssignedPrograms.some((assignedProgram) => aliases.has(assignedProgram));
  }

  programAssignedOwner(program: string): string {
    const aliases = this.programAliases(program);
    const assignedUser = this.users().find((user) => {
      if (user.id === this.editingUserId) {
        return false;
      }

      return user.role.toLowerCase().includes('acad')
        && user.status === 'Activo'
        && user.assignedPrograms
          .map((assignedProgram) => this.normalizeProgramCode(assignedProgram))
          .some((assignedProgram) => aliases.has(assignedProgram));
    });

    if (assignedUser) {
      return assignedUser.name;
    }

    const assignedProgram = this.programs().find((item) => {
      const programCode = this.normalizeProgramCode(item.code);

      return aliases.has(programCode)
        && item.coordinator.trim()
        && !this.isCurrentEditingUserCoordinator(item.coordinator);
    });

    return assignedProgram?.coordinator ?? '';
  }

  private assignedProgramsForUser(user: AppUser): string[] {
    const userPrograms = user.assignedPrograms.map((program) => this.normalizeProgramCode(program));
    const coordinatorPrograms = this.programs()
      .filter((program) => this.coordinatorMatchesUser(program.coordinator, user))
      .map((program) => this.normalizeProgramCode(program.code));

    return Array.from(new Set([...userPrograms, ...coordinatorPrograms].filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'es'));
  }

  private coordinatorMatchesUser(coordinator: string, user: AppUser): boolean {
    const normalizedCoordinator = this.normalizeSearchText(coordinator);

    return Boolean(normalizedCoordinator)
      && (
        normalizedCoordinator === this.normalizeSearchText(user.name)
        || normalizedCoordinator === this.normalizeSearchText(user.email)
      );
  }

  private isCurrentEditingUserCoordinator(coordinator: string): boolean {
    const editingUser = this.users().find((user) => user.id === this.editingUserId);

    return editingUser ? this.coordinatorMatchesUser(coordinator, editingUser) : false;
  }

  private programAliases(program: string): Set<string> {
    const normalizedProgram = this.normalizeProgramCode(program);
    const aliases = new Set<string>(normalizedProgram ? [normalizedProgram] : []);

    this.nomenclatures().forEach((nomenclature) => {
      const abbreviation = this.normalizeProgramCode(nomenclature.abbreviation);
      const programCode = this.normalizeProgramCode(nomenclature.programCode);
      const knownAliases = [abbreviation, programCode].filter(Boolean);

      if (knownAliases.includes(normalizedProgram)) {
        knownAliases.forEach((alias) => aliases.add(alias));
      }
    });

    return aliases;
  }

  private normalizeSearchText(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  private normalizeRole(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private isSystemsRole(role: string): boolean {
    return this.normalizeRole(role).includes('sistemas');
  }

  private isSystemsAssistantRole(role: string): boolean {
    const normalizedRole = this.normalizeRole(role);

    return normalizedRole.includes('sistemas') && normalizedRole.includes('auxiliar');
  }

  private isAcademicRole(role: string): boolean {
    const normalizedRole = this.normalizeRole(role);

    return normalizedRole.includes('acad') && !normalizedRole.includes('sistemas');
  }

  private normalizeProgramCode(program: string): string {
    return program.trim().toUpperCase();
  }

  private refreshProgramOptions(): void {
    this.programOptionsRefreshSignal.update((value) => value + 1);
  }

  private activeCatalogProgramValues(): string[] {
    const values = new Set<string>();

    this.nomenclatures()
      .filter((nomenclature) => nomenclature.status === 'ACTIVA')
      .forEach((nomenclature) => {
        const value = this.normalizeProgramCode(nomenclature.programCode || nomenclature.abbreviation);

        if (value) {
          values.add(value);
        }
      });

    return Array.from(values);
  }

  hasProgramOptions(): boolean {
    return this.programOptions().length > 0 || this.activeCatalogProgramValues().length > 0;
  }

  areAllProgramOptionsAssigned(): boolean {
    const catalogPrograms = this.activeCatalogProgramValues();

    return this.programOptions().length === 0
      && catalogPrograms.length > 0
      && catalogPrograms.every((program) => this.isProgramUnavailableForForm(program));
  }

  updateAccessForRole(role: UserRole): void {
    this.form.controls.access.setValue(this.getAccessForRole(role, FULL_MODULE_ACCESS));
  }

  toggleModuleAccess(moduleKey: keyof ModuleAccess, checked: boolean): void {
    this.form.controls.access.setValue({
      ...this.form.controls.access.value,
      [moduleKey]: checked,
    });
    this.form.controls.access.markAsTouched();
  }

  isModuleSelected(moduleKey: keyof ModuleAccess): boolean {
    return this.form.controls.access.value[moduleKey];
  }

  canEditModuleAccess(): boolean {
    const role = this.form.controls.role.value;

    return this.isSystemsAssistantRole(role)
      || this.isAcademicRole(role)
      || this.isCustomRole(this.form.controls.role.value);
  }

  canToggleModuleAccess(moduleKey: keyof ModuleAccess): boolean {
    const role = this.form.controls.role.value;

    if (this.isCustomRole(this.form.controls.role.value)) {
      return true;
    }

    if (this.isSystemsAssistantRole(role)) {
      return true;
    }

    if (this.isAcademicRole(role)) {
      return moduleKey === 'ligasMeet';
    }

    return false;
  }

  toggleStatus(user: AppUser): void {
    this.usersRepository.toggleStatus(user.id);
  }

  async deleteUserAccess(user: AppUser): Promise<void> {
    const confirmed = await this.confirmationDialogService.confirm({
      title: 'Eliminar acceso',
      message: `Se eliminara el acceso de ${user.name}. Esta accion retirara su entrada del directorio de usuarios.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    this.usersRepository.deleteUserAccess(user.id);
  }

  statusActionLabel(user: AppUser): string {
    return user.status === 'Activo' ? 'Inactivar' : 'Activar';
  }

  canManageAccess(): boolean {
    const appUser = this.userSessionService.session()?.appUser;

    return appUser?.status === 'Activo' && this.isSystemsRole(appUser.role);
  }

  accessSummary(user: AppUser): string {
    const effectiveAccess = this.getAccessForRole(user.role, user.access);

    if (this.hasFullAccess(effectiveAccess)) {
      return 'Acceso total';
    }

    const enabledModules = this.moduleAccessOptions
      .filter((option) => effectiveAccess[option.key])
      .map((option) => option.label);

    return enabledModules.length ? enabledModules.join(', ') : 'Sin accesos asignados';
  }

  private hasFullAccess(access: ModuleAccess): boolean {
    return this.moduleAccessOptions.every((option) => access[option.key]);
  }

  private customRoleFor(roleName: UserRole): RoleTemplate | undefined {
    return this.customRoles().find((role) => role.name === roleName);
  }

  private isCustomRole(roleName: UserRole): boolean {
    return Boolean(this.customRoleFor(roleName));
  }

  private moduleAccessFromCustomRole(role: RoleTemplate): ModuleAccess {
    return this.moduleAccessOptions.reduce<ModuleAccess>((access, module) => ({
      ...access,
      [module.key]: this.permissionAllowsAccess(role.permissions[module.key]),
    }), { ...ACADEMIC_COORDINATION_ACCESS });
  }

  private permissionAllowsAccess(permission: PermissionLevel | undefined): boolean {
    return permission === 'view' || permission === 'edit';
  }

  userInitials(user: AppUser): string {
    return user.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase();
  }
}
