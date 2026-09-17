import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MODAL_REF, ModalRef } from '../../shared/services/modal.service';
import { RetryService } from '../../shared/utils/retry.service';

/**
 * Requests cancellation links by email.
 *
 * This used to look a volunteer's signups up by address and list them, which
 * meant anyone could type in an address and learn whether that person
 * volunteers here, and when. Now the links are emailed instead, and the
 * response is identical whether or not the address has any shifts.
 */
@Component({
  selector: 'app-cancel-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-card">
      <div class="modal-card__header">
        <h2>Cancel a Signup</h2>
        <button class="modal-card__close" (click)="close()" aria-label="Close">
          <span class="material-icons">close</span>
        </button>
      </div>

      @if (sent) {
        <div class="modal-card__body cancel-sent">
          <span class="material-icons cancel-sent__icon">mark_email_read</span>
          <p>{{ message }}</p>
          <p class="cancel-sent__hint">
            The email contains a button for each upcoming shift. Check your spam
            folder if it hasn't arrived in a few minutes.
          </p>
        </div>
        <div class="modal-card__footer">
          <button class="btn btn--primary" (click)="close()">Done</button>
        </div>
      } @else {
        <div class="modal-card__body">
          <p class="modal-card__desc">
            Enter your email and we'll send you a cancellation link for each of
            your upcoming shifts.
          </p>

          @if (errorMessage) {
            <div class="modal-card__error">
              <span class="material-icons">error</span>
              {{ errorMessage }}
            </div>
          }

          <form (ngSubmit)="requestLinks()">
            <div class="form-group">
              <label class="form-label" for="cancel-email">Email Address</label>
              <input
                id="cancel-email"
                type="email"
                class="form-input"
                [(ngModel)]="email"
                name="email"
                required
                placeholder="your.email@example.com">
            </div>

            <div class="modal-card__footer">
              <button type="button" class="btn btn--ghost" (click)="close()">Cancel</button>
              <button type="submit" class="btn btn--primary" [disabled]="sending || !email">
                @if (sending) {
                  <div class="spinner spinner--sm"></div>
                  Sending...
                } @else {
                  Email my cancellation links
                }
              </button>
            </div>
          </form>
        </div>
      }
    </div>
  `,
  styles: [`
    .cancel-sent {
      text-align: center;
    }

    .cancel-sent__icon {
      font-size: 48px;
      color: var(--color-sage);
      margin-bottom: var(--space-md);
    }

    .cancel-sent__hint {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin-top: var(--space-md);
    }

    .spinner--sm {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class CancelModalComponent {
  email = '';
  sending = false;
  sent = false;
  message = '';
  errorMessage = '';

  constructor(
    @Inject(MODAL_REF) private modalRef: ModalRef,
    private retryService: RetryService
  ) {}

  async requestLinks(): Promise<void> {
    if (!this.email || this.sending) return;

    this.sending = true;
    this.errorMessage = '';

    try {
      const response = await this.retryService.fetchWithRetry('/api/cancel-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email }),
      });

      const body = await response.json().catch(() => null);
      // The API answers the same way for every address, so there is nothing
      // here to distinguish "sent" from "no such volunteer".
      this.message =
        body?.message ||
        'If that address has upcoming shifts, we have emailed your cancellation links.';
      this.sent = true;
    } catch (e) {
      this.errorMessage = 'Something went wrong. Please try again.';
      console.error('Cancellation link request failed:', e);
    } finally {
      this.sending = false;
    }
  }

  close(): void {
    this.modalRef.close(this.sent ? { requested: true } : null);
  }
}
