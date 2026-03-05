import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MODAL_DATA, MODAL_REF, ModalRef } from '../../shared/services/modal.service';
import { VolunteerShiftService } from '../calendar/services/volunteer-shift.service';
import { VolunteerShift, SignUp } from '../calendar/models/volunteer.model';

@Component({
  selector: 'app-cancel-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-card">
      <div class="modal-card__header">
        <h2>Cancel a Signup</h2>
        <p class="modal-card__desc">Enter your email to find your upcoming signups.</p>
      </div>

      <div class="modal-card__body">
        <!-- Step 1: Email lookup -->
        @if (step === 'email') {
          <form (ngSubmit)="lookupSignups()">
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
            @if (errorMessage) {
              <div class="cancel-error">
                <span class="material-icons">error</span>
                {{ errorMessage }}
              </div>
            }
            <div class="modal-card__actions">
              <button type="button" class="btn btn--ghost" (click)="close()">Cancel</button>
              <button type="submit" class="btn btn--primary" [disabled]="searching || !email">
                @if (searching) {
                  <div class="spinner spinner--sm"></div>
                  Looking up...
                } @else {
                  Find My Signups
                }
              </button>
            </div>
          </form>
        }

        <!-- Step 2: Select signup to cancel -->
        @if (step === 'select') {
          <div class="cancel-signups">
            @if (signups.length === 0) {
              <div class="cancel-empty">
                <span class="material-icons">event_busy</span>
                <p>No upcoming signups found for <strong>{{ email }}</strong></p>
              </div>
            } @else {
              <p class="cancel-found">Found {{ signups.length }} upcoming signup(s):</p>
              @for (signup of signups; track signup.SignUpID) {
                <div class="cancel-signup-card">
                  <div>
                    <strong>{{ signup.Name }}</strong>
                    @if (signup.shift) {
                      <span class="cancel-signup-card__date">
                        {{ formatShiftDate(signup.shift) }} &middot; {{ formatShiftTime(signup.shift) }}
                      </span>
                    }
                    <span class="cancel-signup-card__people">{{ signup.NumPeople }} {{ signup.NumPeople === 1 ? 'person' : 'people' }}</span>
                  </div>
                  <button
                    class="btn btn--danger btn--small"
                    (click)="confirmCancel(signup)"
                    [disabled]="cancelling">
                    @if (cancelling && cancellingId === signup.SignUpID) {
                      <div class="spinner spinner--sm"></div>
                    } @else {
                      Cancel
                    }
                  </button>
                </div>
              }
            }
            <div class="modal-card__actions">
              <button class="btn btn--ghost" (click)="step = 'email'">
                <span class="material-icons">arrow_back</span>
                Back
              </button>
              <button class="btn btn--ghost" (click)="close()">Close</button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .modal-card {
      background: var(--color-white);
      border-radius: var(--border-radius-lg);
      width: 100%;
      max-width: 520px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: var(--shadow-xl);
      animation: modalSlideIn 0.25s ease;
    }

    .modal-card__header {
      padding: var(--space-xl) var(--space-xl) 0;

      h2 {
        font-size: var(--font-size-xl);
        margin-bottom: var(--space-sm);
      }
    }

    .modal-card__desc {
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
    }

    .modal-card__body {
      padding: var(--space-lg) var(--space-xl) var(--space-xl);
    }

    .modal-card__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-md);
      margin-top: var(--space-xl);
    }

    .cancel-error {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding: var(--space-md);
      background: rgba(209, 67, 67, 0.08);
      border-radius: var(--border-radius);
      color: #D14343;
      font-size: var(--font-size-sm);
      margin-bottom: var(--space-md);

      .material-icons { font-size: 18px; }
    }

    .cancel-empty {
      text-align: center;
      padding: var(--space-xl) 0;
      color: var(--color-text-secondary);

      .material-icons {
        font-size: 40px;
        color: var(--color-border);
        margin-bottom: var(--space-md);
      }
    }

    .cancel-found {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-lg);
    }

    .cancel-signup-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-md) var(--space-lg);
      background: var(--color-cream);
      border-radius: var(--border-radius);
      margin-bottom: var(--space-sm);

      strong {
        display: block;
        font-size: var(--font-size-sm);
      }

      &__date {
        display: block;
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        margin-top: 2px;
      }

      &__people {
        display: block;
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
      }
    }

    .spinner--sm {
      width: 16px;
      height: 16px;
      border-width: 2px;
      border-color: rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `]
})
export class CancelModalComponent {
  step: 'email' | 'select' = 'email';
  email = '';
  signups: (SignUp & { shift?: VolunteerShift })[] = [];
  searching = false;
  cancelling = false;
  cancellingId: number | null = null;
  errorMessage = '';

  constructor(
    @Inject(MODAL_REF) private modalRef: ModalRef,
    private shiftService: VolunteerShiftService
  ) {}

  async lookupSignups(): Promise<void> {
    if (!this.email) return;

    this.searching = true;
    this.errorMessage = '';

    try {
      this.signups = await this.shiftService.findSignupsByEmail(this.email);
      this.step = 'select';
    } catch (e: any) {
      this.errorMessage = e?.message || 'Failed to look up signups.';
    } finally {
      this.searching = false;
    }
  }

  async confirmCancel(signup: SignUp): Promise<void> {
    this.cancelling = true;
    this.cancellingId = signup.SignUpID;

    try {
      await this.shiftService.cancelSignupWithNotification(signup.SignUpID);
      this.signups = this.signups.filter(s => s.SignUpID !== signup.SignUpID);

      if (this.signups.length === 0) {
        this.modalRef.close({ cancelled: true });
      }
    } catch (e: any) {
      this.errorMessage = e?.message || 'Failed to cancel signup.';
    } finally {
      this.cancelling = false;
      this.cancellingId = null;
    }
  }

  formatShiftDate(shift: VolunteerShift): string {
    return this.shiftService.formatShiftDate(shift);
  }

  formatShiftTime(shift: VolunteerShift): string {
    return this.shiftService.formatShiftTime(shift);
  }

  close(): void {
    this.modalRef.close(null);
  }
}
