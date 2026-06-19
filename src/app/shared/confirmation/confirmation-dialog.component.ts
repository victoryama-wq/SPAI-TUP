import { Component, inject } from '@angular/core';
import { ConfirmationDialogService } from './confirmation-dialog.service';

@Component({
  selector: 'spai-confirmation-dialog',
  templateUrl: './confirmation-dialog.component.html',
  styleUrl: './confirmation-dialog.component.css',
})
export class ConfirmationDialogComponent {
  readonly confirmationDialogService = inject(ConfirmationDialogService);
  readonly dialog = this.confirmationDialogService.dialog;

  accept(): void {
    this.confirmationDialogService.accept();
  }

  cancel(): void {
    this.confirmationDialogService.cancel();
  }
}
