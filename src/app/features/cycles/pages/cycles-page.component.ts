import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
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
  templateUrl: './cycles-page.component.html',
  styleUrl: './cycles-page.component.css',
})
export class CyclesPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly cyclesRepository = inject(CyclesRepository);
  private readonly userSessionService = inject(UserSessionService);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);

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
    notes: [''],
  });

  isFormOpen = false;
  duplicateCode = false;
  isSaving = false;
  formError = '';

  constructor() {
    this.form.controls.code.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.duplicateCode = false;
    });
  }

  openForm(): void {
    this.duplicateCode = false;
    this.formError = '';
    this.form.reset({
      code: '',
      label: '',
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
      notes: '',
    });
  }

  async saveCycle(): Promise<void> {
    this.formError = '';

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

  async startCapture(cycle: AcademicCycle): Promise<void> {
    const confirmed = await this.confirmationDialogService.confirm({
      title: 'Activar ciclo',
      message: `Activar ${cycle.code} como ciclo activo? Se mostrara en el encabezado y en los modulos operativos de SPAI.`,
      confirmLabel: 'Activar',
      cancelLabel: 'Cancelar',
    });

    if (confirmed) {
      this.cyclesRepository.startCapture(cycle.id);
    }
  }

  async closeCapture(cycle: AcademicCycle): Promise<void> {
    const confirmed = await this.confirmationDialogService.confirm({
      title: 'Cerrar captura',
      message: `Cerrar captura para el ciclo ${cycle.code}? Las coordinaciones academicas ya no podran editar materias.`,
      confirmLabel: 'Cerrar captura',
      cancelLabel: 'Cancelar',
    });

    if (confirmed) {
      this.cyclesRepository.closeCapture(cycle.id);
    }
  }

  async reopenCapture(cycle: AcademicCycle): Promise<void> {
    const confirmed = await this.confirmationDialogService.confirm({
      title: 'Reabrir captura',
      message: `Reabrir captura para el ciclo ${cycle.code}? Las coordinaciones academicas podran hacer ajustes nuevamente.`,
      confirmLabel: 'Reabrir',
      cancelLabel: 'Cancelar',
    });

    if (confirmed) {
      this.cyclesRepository.reopenCapture(cycle.id);
    }
  }

  async closeCycle(cycle: AcademicCycle): Promise<void> {
    const confirmed = await this.confirmationDialogService.confirm({
      title: 'Cerrar ciclo',
      message: `Cerrar el ciclo ${cycle.code}? Quedara como historico de consulta.`,
      confirmLabel: 'Cerrar ciclo',
      cancelLabel: 'Cancelar',
    });

    if (confirmed) {
      this.cyclesRepository.closeCycle(cycle.id);
    }
  }

  async deleteCycle(cycle: AcademicCycle): Promise<void> {
    if (!this.canDeleteCycle(cycle)) {
      await this.confirmationDialogService.alert({
        title: 'No se puede eliminar',
        message: 'Solo se pueden eliminar ciclos en preparacion o ciclos historicos cerrados.',
      });
      return;
    }

    const confirmed = await this.confirmationDialogService.confirm({
      title: 'Eliminar ciclo',
      message: `Eliminar el ciclo ${cycle.code}? Esta accion quitara el ciclo del catalogo de ciclos.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (confirmed) {
      void this.cyclesRepository.deleteCycle(cycle.id);
    }
  }

  canDeleteCycle(cycle: AcademicCycle): boolean {
    return cycle.status === 'Preparacion' || cycle.status === 'Cerrado';
  }

  private getSaveErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);

    if (message.toLowerCase().includes('permission')) {
      return 'Firebase no permitio guardar el ciclo. Revisa que tu usuario tenga acceso al modulo Ciclos o rol de Sistemas.';
    }

    return 'No se pudo guardar el ciclo. Intenta de nuevo.';
  }

  formatDate(value: string | null): string {
    if (!value) {
      return 'Pendiente';
    }

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }
}

