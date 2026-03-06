import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MODAL_DATA, MODAL_REF, ModalRef } from '../../shared/services/modal.service';
import { VolunteerShiftService } from '../calendar/services/volunteer-shift.service';
import { VolunteerShift } from '../calendar/models/volunteer.model';

@Component({
  selector: 'app-signup-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-card">
      <div class="modal-card__header">
        <h2>Sign Up to Volunteer</h2>
        <p class="modal-card__shift-info">
          <span class="material-icons">schedule</span>
          {{ formatDate() }} &middot; {{ formatTime() }}
        </p>
      </div>

      <form (ngSubmit)="onSubmit()" class="modal-card__body">
        <div class="form-group">
          <label class="form-label" for="name">Full Name *</label>
          <input
            id="name"
            class="form-input"
            [(ngModel)]="formData.Name"
            name="name"
            required
            placeholder="Your full name"
            [class.is-invalid]="submitted && !formData.Name">
          @if (submitted && !formData.Name) {
            <span class="form-error">Name is required</span>
          }
        </div>

        <div class="form-group">
          <label class="form-label" for="email">Email *</label>
          <input
            id="email"
            type="email"
            class="form-input"
            [(ngModel)]="formData.Email"
            name="email"
            required
            placeholder="your.email@example.com"
            [class.is-invalid]="submitted && !formData.Email">
          @if (submitted && !formData.Email) {
            <span class="form-error">Email is required</span>
          }
        </div>

        <div class="form-group">
          <label class="form-label" for="phone">Phone Number *</label>
          <input
            id="phone"
            type="tel"
            class="form-input"
            [(ngModel)]="formData.PhoneNumber"
            name="phone"
            required
            placeholder="(555) 123-4567"
            [class.is-invalid]="submitted && !formData.PhoneNumber">
          @if (submitted && !formData.PhoneNumber) {
            <span class="form-error">Phone number is required</span>
          }
        </div>

        <div class="form-group">
          <label class="form-label" for="numPeople">Group Size</label>
          <input
            id="numPeople"
            type="number"
            class="form-input"
            [(ngModel)]="formData.NumPeople"
            name="numPeople"
            min="1"
            max="50"
            placeholder="How many people in your group?">
        </div>

        @if (errorMessage) {
          <div class="modal-card__error">
            <span class="material-icons">error</span>
            {{ errorMessage }}
          </div>
        }

        <div class="modal-card__actions">
          <button type="button" class="btn btn--ghost" (click)="close()">Cancel</button>
          <button type="submit" class="btn btn--primary" [disabled]="submitting">
            @if (submitting) {
              <div class="spinner spinner--sm"></div>
              Signing up...
            } @else {
              Sign Up
            }
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .modal-card {
      background: var(--color-white);
      border-radius: var(--border-radius-lg);
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: var(--shadow-xl);
      animation: modalSlideIn 0.25s ease;
    }

    .modal-card__header {
      padding: var(--space-xl) var(--space-xl) var(--space-md);

      h2 {
        font-size: var(--font-size-xl);
        margin-bottom: var(--space-sm);
      }
    }

    .modal-card__shift-info {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      font-size: var(--font-size-sm);
      color: var(--color-terracotta);
      font-weight: 500;

      .material-icons { font-size: 18px; }
    }

    .modal-card__body {
      padding: var(--space-md) var(--space-xl) var(--space-xl);
    }

    .modal-card__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-md);
      margin-top: var(--space-xl);
    }

    .modal-card__error {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding: var(--space-md);
      background: rgba(209, 67, 67, 0.08);
      border-radius: var(--border-radius);
      color: #D14343;
      font-size: var(--font-size-sm);

      .material-icons { font-size: 18px; }
    }

    .spinner--sm {
      width: 16px;
      height: 16px;
      border-width: 2px;
      border-color: rgba(255,255,255,0.3);
      border-top-color: white;
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
export class SignupModalComponent {
  formData = {
    Name: '',
    Email: '',
    PhoneNumber: '',
    NumPeople: 1,
  };

  submitted = false;
  submitting = false;
  errorMessage = '';

  private shift: VolunteerShift;

  constructor(
    @Inject(MODAL_DATA) private data: { shift: VolunteerShift },
    @Inject(MODAL_REF) private modalRef: ModalRef,
    private shiftService: VolunteerShiftService
  ) {
    this.shift = data.shift;
  }

  formatDate(): string {
    return this.shiftService.formatShiftDate(this.shift);
  }

  formatTime(): string {
    return this.shiftService.formatShiftTime(this.shift);
  }

  async onSubmit(): Promise<void> {
    this.submitted = true;

    if (!this.formData.Name || !this.formData.Email || !this.formData.PhoneNumber) {
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    try {
      await this.shiftService.createSignup({
        ShiftID: this.shift.ShiftID,
        Name: this.formData.Name,
        Email: this.formData.Email,
        PhoneNumber: this.formData.PhoneNumber,
        NumPeople: this.formData.NumPeople || 1,
      });
      this.modalRef.close({ success: true });
    } catch (e: any) {
      this.errorMessage = e?.message || 'Failed to sign up. Please try again.';
    } finally {
      this.submitting = false;
    }
  }

  close(): void {
    this.modalRef.close(null);
  }
}
