import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { VolunteerShift, SignUp } from '../models/volunteer.model';

export interface VolunteerDetailsDialogData {
  shift: VolunteerShift;
}

@Component({
  selector: 'app-volunteer-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDividerModule
  ],
  template: `
    <div class="volunteer-details-dialog">
      <h2 mat-dialog-title>
        <mat-icon>people</mat-icon>
        Volunteer Details
      </h2>
      
      <div class="shift-info">
        <h3>{{ formatDate(data.shift.StartTime) }}</h3>
        <p class="shift-time">{{ formatTimeRange(data.shift) }}</p>
        <p class="capacity-info">
          {{ getTotalVolunteers() }} volunteer{{ getTotalVolunteers() === 1 ? '' : 's' }} signed up 
          ({{ getTotalPeople() }} total people)
        </p>
      </div>

      <mat-dialog-content>
        <div *ngIf="data.shift.signups.length === 0" class="no-volunteers">
          <mat-icon class="large-icon">person_off</mat-icon>
          <p>No volunteers signed up for this shift yet.</p>
        </div>

        <div *ngIf="data.shift.signups.length > 0" class="volunteers-grid">
          <mat-card *ngFor="let signup of data.shift.signups; trackBy: trackSignup" class="volunteer-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>person</mat-icon>
              <mat-card-title>{{ signup.Name }}</mat-card-title>
              <mat-card-subtitle>
                {{ signup.NumPeople }} {{ signup.NumPeople === 1 ? 'person' : 'people' }}
              </mat-card-subtitle>
            </mat-card-header>
            
            <mat-card-content>
              <div class="contact-methods">
                <div class="contact-item">
                  <mat-icon class="contact-icon">email</mat-icon>
                  <div class="contact-details">
                    <strong>Email</strong>
                    <a href="mailto:{{ signup.Email }}" class="contact-link">{{ signup.Email }}</a>
                  </div>
                </div>
                
                <mat-divider></mat-divider>
                
                <div class="contact-item">
                  <mat-icon class="contact-icon">phone</mat-icon>
                  <div class="contact-details">
                    <strong>Phone</strong>
                    <a href="tel:{{ signup.PhoneNumber }}" class="contact-link">{{ formatPhone(signup.PhoneNumber) }}</a>
                  </div>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions>
        <button mat-raised-button color="primary" (click)="close()">
          <mat-icon>close</mat-icon>
          Close
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .volunteer-details-dialog {
      min-width: 600px;
      max-width: 800px;
    }

    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #333;
      margin-bottom: 0;
    }

    .shift-info {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      text-align: center;
    }

    .shift-info h3 {
      margin: 0 0 8px 0;
      color: #333;
      font-size: 18px;
    }

    .shift-time {
      margin: 0 0 12px 0;
      color: #666;
      font-size: 16px;
      font-weight: 500;
    }

    .capacity-info {
      margin: 0;
      color: #1976d2;
      font-weight: 500;
    }

    .no-volunteers {
      text-align: center;
      padding: 40px 20px;
      color: #666;
    }

    .large-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
    }

    .volunteers-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }

    .volunteer-card {
      transition: box-shadow 0.3s ease;
    }

    .volunteer-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .contact-methods {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .contact-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .contact-icon {
      color: #1976d2;
      font-size: 20px;
      width: 20px;
      height: 20px;
      margin-top: 2px;
    }

    .contact-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .contact-details strong {
      font-size: 14px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .contact-link {
      color: #1976d2;
      text-decoration: none;
      font-weight: 500;
      word-break: break-word;
    }

    .contact-link:hover {
      text-decoration: underline;
    }

    mat-dialog-actions {
      display: flex;
      justify-content: center;
      padding: 20px 0 0 0;
    }

    mat-divider {
      margin: 0 -16px;
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
      .volunteer-details-dialog {
        min-width: 350px;
        max-width: 90vw;
      }

      .volunteers-grid {
        grid-template-columns: 1fr;
        gap: 16px;
      }

      .shift-info {
        padding: 16px;
      }
    }

    @media (max-width: 480px) {
      .volunteer-details-dialog {
        min-width: 300px;
      }

      .contact-item {
        flex-direction: column;
        gap: 8px;
      }

      .contact-icon {
        align-self: flex-start;
      }
    }
  `]
})
export class VolunteerDetailsDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<VolunteerDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: VolunteerDetailsDialogData
  ) {}

  getTotalVolunteers(): number {
    return this.data.shift.signups.length;
  }

  getTotalPeople(): number {
    return this.data.shift.signups.reduce((total, signup) => total + (signup.NumPeople || 1), 0);
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

  formatPhone(phone: string): string {
    // Basic phone number formatting
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone; // Return as-is if not standard 10-digit US number
  }

  trackSignup(index: number, signup: SignUp): number {
    return signup.SignUpID;
  }

  close() {
    this.dialogRef.close();
  }
}