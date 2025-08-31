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
    .signup-dialog {
      min-width: 400px;
      padding: 24px 24px 0 24px;
      box-sizing: border-box;
    }

    .shift-details {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .detail-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      font-size: 1rem;
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

    .signup-form {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .full-width {
      width: 100%;
    }

    mat-dialog-actions {
      display: flex;
      flex-direction: row;
      justify-content: flex-end;
      gap: 10px;
      padding: 20px 0 0 0;
    }

    @media (max-width: 600px) {
      .signup-dialog {
        min-width: 100vw;
        padding: 12px 8px 0 8px;
      }
      .shift-details {
        padding: 10px;
        font-size: 0.95rem;
      }
      .signup-form {
        gap: 12px;
      }
      mat-dialog-actions {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding-top: 16px;
      }
    }

    @media (max-width: 480px) {
      .signup-dialog {
        min-width: 100vw;
        padding: 8px 4px 0 4px;
      }
      h2[mat-dialog-title] {
        font-size: 1.1rem;
      }
      .shift-details {
        font-size: 0.9rem;
      }
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