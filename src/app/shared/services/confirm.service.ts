import { Injectable } from '@angular/core';
import { ModalService } from './modal.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../components/confirm-dialog/confirm-dialog.component';

/**
 * Drop-in replacement for window.confirm() that uses the app's modal system.
 *
 *   if (!(await this.confirm.ask({ title: '…', message: '…' }))) return;
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  constructor(private modalService: ModalService) {}

  async ask(data: ConfirmDialogData): Promise<boolean> {
    const ref = this.modalService.open(ConfirmDialogComponent, data);
    // Dismissing via overlay/Escape resolves with null, which is a "no".
    return (await ref.result) === true;
  }
}
