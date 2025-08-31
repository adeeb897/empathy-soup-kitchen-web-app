import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { VolunteerShift, CreateSignupData } from '../models/volunteer.model';

export interface SignupDialogData {
  shift: VolunteerShift;
}

@Component({
  selector: 'app-signup-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule
  ],
  template: `
    <div class="signup-dialog">
      <h2 mat-dialog-title>Sign Up for Volunteer Shift</h2>
      
      <div class="shift-details">
        <div class="detail-row">
          <mat-icon>event</mat-icon>
          <span>{{ formatDate(data.shift.StartTime) }}</span>
        </div>
        <div class="detail-row">
          <mat-icon>schedule</mat-icon>
          <span>{{ formatTimeRange(data.shift) }}</span>
        </div>
        <div class="detail-row">
          <mat-icon>people</mat-icon>
          <span>{{ getRemainingSlots() }} of {{ data.shift.Capacity }} spots available</span>
        </div>
      </div>

      <mat-dialog-content>
        <form [formGroup]="signupForm" class="signup-form">
          <mat-form-field appearance="fill" class="full-width">
            <mat-label>Full Name</mat-label>
            <input matInput formControlName="name" placeholder="Enter your full name">
            <mat-icon matSuffix>person</mat-icon>
            <mat-error *ngIf="signupForm.get('name')?.hasError('required')">
              Name is required
            </mat-error>
            <mat-error *ngIf="signupForm.get('name')?.hasError('maxlength')">
              Name cannot exceed 100 characters
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="fill" class="full-width">
            <mat-label>Email Address</mat-label>
            <input matInput type="email" formControlName="email" placeholder="your.email@example.com">
            <mat-icon matSuffix>email</mat-icon>
            <mat-error *ngIf="signupForm.get('email')?.hasError('required')">
              Email is required
            </mat-error>
            <mat-error *ngIf="signupForm.get('email')?.hasError('email')">
              Please enter a valid email address
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="fill" class="full-width">
            <mat-label>Phone Number</mat-label>
            <input matInput type="tel" formControlName="phoneNumber" placeholder="(555) 123-4567">
            <mat-icon matSuffix>phone</mat-icon>
            <mat-error *ngIf="signupForm.get('phoneNumber')?.hasError('required')">
              Phone number is required
            </mat-error>
            <mat-error *ngIf="signupForm.get('phoneNumber')?.hasError('pattern')">
              Please enter a valid phone number
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="fill" class="full-width">
            <mat-label>Number of People</mat-label>
            <input matInput type="number" formControlName="numPeople" min="1" [max]="getRemainingSlots()">
            <mat-icon matSuffix>group</mat-icon>
            <mat-error *ngIf="signupForm.get('numPeople')?.hasError('required')">
              Number of people is required
            </mat-error>
            <mat-error *ngIf="signupForm.get('numPeople')?.hasError('min')">
              Must be at least 1 person
            </mat-error>
            <mat-error *ngIf="signupForm.get('numPeople')?.hasError('max')">
              Cannot exceed {{ getRemainingSlots() }} available spots
            </mat-error>
          </mat-form-field>
        </form>
      </mat-dialog-content>

      <mat-dialog-actions>
        <button mat-button (click)="onCancel()">Cancel</button>
        <button mat-raised-button 
                color="primary" 
                (click)="onSignup()"
                [disabled]="signupForm.invalid">
          <mat-icon>person_add</mat-icon>
          Sign Up
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    /* Container: responsive, centered, rounded, subtle shadow */
    .signup-dialog {
      width: 100%;
      max-width: 480px;
      margin: 16px auto;
      padding: 20px;
      box-sizing: border-box;
      border-radius: 12px;
      background: #fff;
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
      overflow: hidden;
    }

    /* Shift details: compact, matching rounded corners inside */
    .shift-details {
      background: #f7f8fa;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 18px;
    }

    .detail-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      font-size: 0.98rem;
      color: #333;
    }

    .detail-row:last-child {
      margin-bottom: 0;
    }

    .detail-row mat-icon {
      color: #666;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* Form layout: compact spacing */
    .signup-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .full-width {
      width: 100%;
    }

    /* Give Material fill fields a slightly rounded, padded look */
    .mat-form-field-appearance-fill .mat-form-field-flex {
      padding: 6px 12px;
      border-radius: 8px;
    }
    .mat-form-field .mat-form-field-infix {
      padding: 0; /* avoid extra nesting padding that causes overflow */
      box-sizing: border-box;
    }

    /* Dialog actions: align to end on desktop */
    mat-dialog-actions {
      display: flex;
      flex-direction: row;
      justify-content: flex-end;
      gap: 10px;
      padding: 18px 0 0 0;
    }

    /* Buttons: full width on small screens, normal on larger */
    @media (max-width: 480px) {
      .signup-dialog {
        margin: 12px;
        padding: 14px;
        border-radius: 10px;
      }
      h2[mat-dialog-title] {
        font-size: 1.05rem;
        margin: 0 0 8px 0;
      }
      .shift-details {
        padding: 10px;
        font-size: 0.92rem;
      }
      .signup-form {
        gap: 12px;
      }
      mat-dialog-actions {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding-top: 14px;
      }
      mat-dialog-actions button {
        width: 100%;
        justify-content: center;
      }
    }

    /* Small polish to avoid any accidental horizontal overflow */
    input, textarea, .mat-form-field {
      max-width: 100%;
      box-sizing: border-box;
    }
  `]
})
export class SignupDialogComponent {
  signupForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<SignupDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SignupDialogData
  ) {
    this.signupForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^[\+]?[1-9][\d\s\-\(\)]{7,14}$/)]],
      numPeople: [1, [Validators.required, Validators.min(1), Validators.max(this.getRemainingSlots())]]
    });
  }

  getRemainingSlots(): number {
    const filledSlots = this.data.shift.signups.reduce((total, signup) => total + (signup.NumPeople || 1), 0);
    return this.data.shift.Capacity - filledSlots;
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatTimeRange(shift: VolunteerShift): string {
    const startTime = shift.StartTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const endTime = shift.EndTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `${startTime} - ${endTime}`;
  }

  onCancel() {
    this.dialogRef.close();
  }

  onSignup() {
    if (this.signupForm.valid) {
      const formValue = this.signupForm.value;
      const signupData: CreateSignupData = {
        ShiftID: this.data.shift.ShiftID,
        Name: formValue.name.trim(),
        Email: formValue.email.trim(),
        PhoneNumber: formValue.phoneNumber.trim(),
        NumPeople: formValue.numPeople
      };

      this.dialogRef.close(signupData);
    }
  }
}