import { hasCapability, hasAccess } from '../../users/data/module-permission.service';
import { CommonModule } from '@angular/common';
import { afterRenderEffect, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AcademicCycle,
  CyclesRepository,
} from '../data/cycles.repository';
import { UserSessionService } from '../../../core/auth/user-session.service';
import { ConfirmationDialogService } from '../../../shared/confirmation/confirmation-dialog.service';

@Component({
  selector: 'spai-cycles-page',
  imports: [CommonModule, ReactiveFormsModule],
  providers: [ConfirmationDialogService],
  templateUrl: './cycles-page.component.html',
  styleUrl: './cycles-page.component.css',
})
export class CyclesPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly cyclesRepository = inject(CyclesRepository);
  private readonly userSessionService = inject(UserSessionService);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly cycleDialog = viewChild<ElementRef<HTMLDialogElement>>('cycleDialog');
  readonly confirmation = this.confirmationDialogService.dialog;
  readonly informationDismissed = signal(false);
  private informationShown = false;
  private entranceResolved = false;
  private entranceCycleId: string | null = null;
  private dialogStep: unknown = null;
  private dialogOpener: HTMLElement | null = null;
  readonly informationCycle = computed(() => this.cyclesRepository.ready()
    && this.contextReady() && hasAccess(this.userSessionService.session()?.appUser, 'ciclos')
    && !this.inconsistent() && this.activeCycle()?.status === 'Captura' ? this.activeCycle() : null);

  readonly mayCreate = computed(() => hasAccess(this.userSessionService.session()?.appUser, 'ciclos', true) && hasCapability(this.userSessionService.session()?.appUser, 'MANAGE_CYCLES'));
  readonly creationLimitReached = computed(() => this.cycles().length >= 2);
  readonly canManage = computed(() => this.cyclesRepository.contextReady() && hasAccess(this.userSessionService.session()?.appUser, 'ciclos', true) && hasCapability(this.userSessionService.session()?.appUser, 'MANAGE_CYCLES') && !this.cyclesRepository.inconsistent());
  readonly cycleMessage = this.cyclesRepository.captureMessage;
  readonly contextReady = this.cyclesRepository.contextReady;
  readonly inconsistent = this.cyclesRepository.inconsistent;
  readonly canCreateCycle = computed(() => this.cyclesRepository.ready()
    && this.canManage() && this.cyclesRepository.operativeCycles().length === 0);
  readonly createBlockedReason = computed(() => {
    if (!this.cyclesRepository.ready()) return this.cyclesRepository.readMessage();
    if (this.inconsistent()) return this.cycleMessage();
    if (this.cyclesRepository.contextError()) return this.cyclesRepository.contextError();
    if (!this.contextReady()) return 'Verificando el estado de los ciclos…';
    if (this.cyclesRepository.operativeCycles().length) return 'Ya existe un ciclo operativo. Debes cerrarlo definitivamente para crear otro.';
    if (!this.canManage()) return 'No tienes autorización vigente para crear ciclos.';
    return '';
  });
  reopenReason: Record<string, string> = {};
  canOperate(cycle: AcademicCycle): boolean { const user=this.userSessionService.session()?.appUser; return this.canManage() && !this.isSaving && (user?.baseRole==='ADMIN_GENERAL' || Boolean(user?.scope?.cycles?.some(c=>c==='*'||c===cycle.code))); }
  validReopenReason(cycle: AcademicCycle): boolean { const reason=(this.reopenReason[cycle.id] || '').trim(); return reason.length >= 4 && reason.length <= 1000; }
  setReason(id: string, event: Event): void { this.reopenReason[id]=(event.target as HTMLInputElement).value; }
  readonly cycles = this.cyclesRepository.cycles;
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
      `Acceso ciclos: ${appUser.access?.ciclos === true ? 'SI' : 'NO'}`,
    ].join(' | ');
  });

  readonly activeCycle = this.cyclesRepository.activeCycle;

  readonly planningCycles = computed(
    () => this.cycles().filter((cycle) => cycle.status === 'Preparacion'),
  );

  readonly captureCycles = computed(
    () => this.cycles().filter((cycle) => cycle.status === 'Captura'),
  );

  readonly closedCycles = computed(
    () => this.cycles().filter((cycle) => cycle.status === 'Cerrado'),
  );

  readonly form = this.formBuilder.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{2}-\d$/)]],
    label: ['', [Validators.required, Validators.minLength(3)]],
    tentativeCaptureCloseAt: [''],
    notes: [''],
  });

  isFormOpen = false;
  duplicateCode = false;
  isSaving = false;
  formError = '';

  constructor() {
    // One visit is one component instance. Live updates may refresh an open
    // notice, but never reopen a dismissed notice or pick an ambiguous cycle.
    afterRenderEffect(() => {
      const dialog = this.cycleDialog()?.nativeElement;
      if (!dialog) return;
      const confirmation = this.confirmation();
      const cycle = this.informationCycle();
      if (!this.entranceResolved && this.cyclesRepository.ready() && this.contextReady()) {
        this.entranceResolved = true;
        this.entranceCycleId = cycle?.id ?? null;
      }
      const showInformation = !!cycle && cycle.id === this.entranceCycleId && !this.informationDismissed();
      if (confirmation || showInformation && (!this.informationShown || dialog.open)) {
        if (!dialog.open) {
          this.dialogOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          dialog.showModal();
          if (!confirmation) this.informationShown = true;
        }
        const step = confirmation ?? 'information';
        if (this.dialogStep !== step) dialog.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
        this.dialogStep = step;
      } else if (dialog.open) {
        dialog.close();
        this.dialogStep = null;
        this.restoreDialogFocus();
      }
    });
    inject(DestroyRef).onDestroy(() => this.confirmationDialogService.cancel());
    this.form.controls.code.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.duplicateCode = false;
    });
  }

  dismissInformation(): void { this.informationDismissed.set(true); }
  cancelCycleDialog(event?: Event): void {
    event?.preventDefault();
    if (this.confirmation()) this.confirmationDialogService.cancel();
    else this.dismissInformation();
  }
  acceptConfirmation(): void { if(this.deletionTarget() && !this.validDeleteReason()) return; this.confirmationDialogService.accept(); }
  onDialogKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const buttons = Array.from(this.cycleDialog()?.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), input:not([disabled])') ?? []);
    const first = buttons[0], last = buttons[buttons.length - 1];
    const active = document.activeElement;
    if (first && (!buttons.some(button => button === active) || event.shiftKey && active === first || !event.shiftKey && active === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }
  private restoreDialogFocus(): void {
    const opener = this.dialogOpener;
    if (opener?.isConnected && opener !== document.body && !opener.hasAttribute('disabled')) opener.focus();
    else this.element.nativeElement.querySelector<HTMLElement>('#cycles-directory-title')?.focus();
  }

  openForm(): void {
    if (!this.canCreateCycle() || this.isSaving) return;
    this.duplicateCode = false;
    this.formError = '';
    this.form.reset({
      code: '',
      label: '',
      tentativeCaptureCloseAt: '',
      notes: '',
    });
    this.isFormOpen = true;
  }

  closeForm(): void {
    this.isFormOpen = false;
    this.duplicateCode = false;
    this.formError = '';
    this.isSaving = false;
    this.form.reset({
      code: '',
      label: '',
      tentativeCaptureCloseAt: '',
      notes: '',
    });
  }

  async saveCycle(): Promise<void> {
    if (!this.canCreateCycle() || this.isSaving) { this.formError = this.createBlockedReason() || 'Espera a que termine la operación actual.'; return; }
    this.formError = '';
    if (this.creationLimitReached()) { this.formError = 'Ya hay dos ciclos registrados. Cancela y elimina el histórico anterior mediante su acción explícita antes de crear otro.'; return; }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError = 'Revisa los datos del ciclo antes de guardar.';
      return;
    }

    const payload = this.form.getRawValue();
    this.duplicateCode = this.cyclesRepository.hasCycleCode(payload.code);

    if (this.duplicateCode) {
      this.formError = 'Ya existe un ciclo con ese codigo.';
      return;
    }

    this.isSaving = true;

    try {
      await this.cyclesRepository.createCycle(payload);
      this.closeForm();
    } catch (error) {
      console.error('No se pudo guardar el ciclo', error);
      this.formError = this.getSaveErrorMessage(error);
    } finally {
      this.isSaving = false;
    }
  }

  async startCapture(cycle: AcademicCycle): Promise<void> { await this.transition('start', cycle, 'Iniciar captura'); }
  async closeCapture(cycle: AcademicCycle): Promise<void> { await this.transition('closeCapture', cycle, 'Cerrar captura'); }
  async reopenCapture(cycle: AcademicCycle): Promise<void> { await this.transition('reopen', cycle, 'Reabrir captura', {reason:this.reopenReason[cycle.id] || ''}); }
  async closeCycle(cycle: AcademicCycle): Promise<void> { await this.transition('close', cycle, 'Cerrar ciclo'); }
  async toggleSpecials(cycle: AcademicCycle): Promise<void> { await this.transition('specials', cycle, cycle.specialsEnabled?'Deshabilitar Especiales':'Habilitar Especiales', {enabled:!cycle.specialsEnabled}); }
  private async transition(action: string, cycle: AcademicCycle, title: string, extra: Record<string, unknown> = {}): Promise<void> {
    if (!this.canOperate(cycle)) return;
    if(action==='reopen' && String(extra['reason']).trim().length<4) {this.formError='Indica un motivo de reapertura (mínimo 4 caracteres).';return;}
    const command=this.cyclesRepository.prepare(action,cycle,extra);
    this.dismissInformation();
    this.isSaving=true; this.formError='';
    try {
      const confirmed=await this.confirmationDialogService.confirm({title,message:action === 'closeCapture' ? 'Al cerrar la captura, se bloquearán las operaciones académicas ordinarias del ciclo.' : `${title} para ${cycle.code}. Se comprobarán los permisos, el estado y la versión vigentes antes de confirmar.`,confirmLabel:title,cancelLabel:'Cancelar'});
      if(confirmed) await this.cyclesRepository.confirm(command);
    } catch(error) { this.formError=this.getSaveErrorMessage(error); }
    finally {this.isSaving=false;delete this.reopenReason[cycle.id];}
  }

  deleteReason = '';
  deletionTarget = signal<AcademicCycle | null>(null);
  readonly purgeAllowed = computed(() => hasAccess(this.userSessionService.session()?.appUser, 'ciclos', true) && hasCapability(this.userSessionService.session()?.appUser, 'PURGE_CYCLE'));
  canDeleteCycle(cycle: AcademicCycle): boolean {
    const user=this.userSessionService.session()?.appUser;
    return this.contextReady() && this.purgeAllowed() && !this.isSaving && cycle.status === 'Cerrado'
      && !this.cyclesRepository.multipleOperative()
      && this.cycles().some(other => other.status === 'Cerrado' && other.code > cycle.code)
      && (user?.baseRole === 'ADMIN_GENERAL' || !!user?.scope?.cycles?.some(code=>code === '*' || code === cycle.code));
  }
  async deleteCycle(cycle: AcademicCycle): Promise<void> {
    if (!this.canDeleteCycle(cycle)) return;
    this.deleteReason = ''; this.deletionTarget.set(cycle); this.dismissInformation();
    this.isSaving = true; this.formError = '';
    const command=this.cyclesRepository.prepare('purge',cycle);
    try {
      const accepted=await this.confirmationDialogService.confirm({title:'Eliminar ciclo histórico',message:`${cycle.code} · ${cycle.label}. Se eliminará únicamente un histórico anterior sin dependencias. El último histórico se conserva para consulta. Si existen registros asociados, el servidor bloqueará la eliminación. La bitácora conservará el documento completo y el motivo.`,confirmLabel:'Eliminar ciclo',cancelLabel:'Cancelar',tone:'danger'});
      if (accepted) await this.cyclesRepository.confirm({...command,reason:this.deleteReason.trim()});
    } catch(error) { this.formError=this.getSaveErrorMessage(error); }
    finally {this.isSaving=false;this.deleteReason='';this.deletionTarget.set(null);}
  }
  validDeleteReason(): boolean {return this.deleteReason.trim().length >= 4 && this.deleteReason.trim().length <= 1000;}
  setDeleteReason(event: Event): void {this.deleteReason=(event.target as HTMLTextAreaElement).value;}

  async updateTentativeCaptureClose(cycle: AcademicCycle, event: Event): Promise<void> {
    if (!this.canManage()) { this.formError = 'No tienes delegación vigente para administrar ciclos.'; return; }
    const input = event.target as HTMLInputElement;
    const tentativeCaptureCloseAt = input.value || null;

    try {
      await this.cyclesRepository.updateTentativeCaptureClose(cycle.id, tentativeCaptureCloseAt);
    } catch (error) {
      console.error('No se pudo actualizar el Cierre de Captura', error);
      input.value = this.dateInputValue(cycle.tentativeCaptureCloseAt);
      await this.confirmationDialogService.alert({
        title: 'No se pudo actualizar',
        message: this.getSaveErrorMessage(error),
      });
    }
  }

  dateInputValue(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    return value.slice(0, 10);
  }

  private getSaveErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);

    if (message.toLowerCase().includes('permission')) {
      return 'Firebase no permitio guardar el ciclo. Revisa que tu usuario tenga acceso al modulo Ciclos o rol de Sistemas.';
    }

    return message || 'No se pudo guardar el ciclo. Intenta de nuevo.';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'Pendiente';
    }

    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00`)
      : new Date(value);

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }
}

