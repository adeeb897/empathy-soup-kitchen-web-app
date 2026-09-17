import { Component, Inject } from '@angular/core';
import { MODAL_DATA, MODAL_REF, ModalRef } from '../../services/modal.service';

export interface ConfirmDialogData {
  title: string;
  message: string;
  /** Text for the confirming button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Styles the confirm button as destructive. Defaults to true. */
  destructive?: boolean;
}

/**
 * Replaces native confirm() for destructive admin actions, so they use the
 * same styled, focus-trapped dialog as the public-facing flows.
 *
 * Open it through ConfirmService rather than ModalService directly.
 */
@Component({
    selector: 'app-confirm-dialog',
    imports: [],
    template: `
    <div class="confirm">
      <div class="confirm__icon" [class.confirm__icon--danger]="destructive">
        <span class="material-icons">{{ destructive ? 'warning' : 'help_outline' }}</span>
      </div>
      <h2 class="confirm__title">{{ data.title }}</h2>
      <p class="confirm__message">{{ data.message }}</p>
      <div class="confirm__actions">
        <button type="button" class="btn btn--ghost" (click)="cancel()">Cancel</button>
        <button
          type="button"
          class="btn"
          [class.btn--danger]="destructive"
          [class.btn--primary]="!destructive"
          (click)="confirm()">
          {{ data.confirmLabel || 'Confirm' }}
        </button>
      </div>
    </div>
  `,
    styles: [`
    .confirm {
      background: var(--color-white);
      border-radius: var(--border-radius-lg);
      padding: var(--space-2xl);
      max-width: 420px;
      text-align: center;
    }

    .confirm__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      margin-bottom: var(--space-lg);
      border-radius: var(--border-radius-full);
      background: var(--color-cream);

      .material-icons {
        font-size: 28px;
        color: var(--color-terracotta);
      }

      &--danger {
        background: rgba(192, 86, 63, 0.1);
        .material-icons { color: #C0563F; }
      }
    }

    .confirm__title {
      font-size: var(--font-size-xl);
      color: var(--color-charcoal);
      margin-bottom: var(--space-sm);
    }

    .confirm__message {
      color: var(--color-text-secondary);
      line-height: 1.6;
      margin-bottom: var(--space-xl);
    }

    .confirm__actions {
      display: flex;
      gap: var(--space-md);
      justify-content: center;
      flex-wrap: wrap;
    }
  `]
})
export class ConfirmDialogComponent {
  readonly destructive: boolean;

  constructor(
    @Inject(MODAL_DATA) public data: ConfirmDialogData,
    @Inject(MODAL_REF) private modalRef: ModalRef
  ) {
    this.destructive = data.destructive !== false;
  }

  confirm(): void {
    this.modalRef.close(true);
  }

  cancel(): void {
    this.modalRef.close(false);
  }
}
