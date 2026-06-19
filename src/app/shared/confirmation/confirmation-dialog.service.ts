import { Injectable, signal } from '@angular/core';

export interface ConfirmationDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  showCancel?: boolean;
}

interface ConfirmationDialogState extends Required<ConfirmationDialogOptions> {
  resolve: (confirmed: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmationDialogService {
  private readonly dialogSignal = signal<ConfirmationDialogState | null>(null);

  readonly dialog = this.dialogSignal.asReadonly();

  confirm(options: ConfirmationDialogOptions): Promise<boolean> {
    const currentDialog = this.dialogSignal();

    if (currentDialog) {
      currentDialog.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      this.dialogSignal.set({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirmar',
        cancelLabel: options.cancelLabel ?? 'Cancelar',
        tone: options.tone ?? 'default',
        showCancel: options.showCancel ?? true,
        resolve,
      });
    });
  }

  alert(options: Omit<ConfirmationDialogOptions, 'showCancel' | 'cancelLabel'>): Promise<boolean> {
    return this.confirm({
      ...options,
      confirmLabel: options.confirmLabel ?? 'Entendido',
      showCancel: false,
    });
  }

  accept(): void {
    this.close(true);
  }

  cancel(): void {
    this.close(false);
  }

  private close(confirmed: boolean): void {
    const currentDialog = this.dialogSignal();

    if (!currentDialog) {
      return;
    }

    currentDialog.resolve(confirmed);
    this.dialogSignal.set(null);
  }
}
