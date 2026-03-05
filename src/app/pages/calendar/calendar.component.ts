import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { VolunteerShift, SignUp, CreateSignupData } from './models/volunteer.model';
import { VolunteerShiftService } from './services/volunteer-shift.service';
import { TextBoxService } from './services/text-box.service';
import { SignupDialogComponent, SignupDialogData } from './components/signup-dialog.component';
import { AdminLoginDialogComponent } from './components/admin-login-dialog.component';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule
  ],
  template: `
    <div class="calendar-container">
      <!-- Header -->
      <div class="header">
        <h1>Volunteer Shifts</h1>
        <div class="header-actions">
          <button mat-raised-button routerLink="/calendar/admin" color="primary">
            <mat-icon>admin_panel_settings</mat-icon>
            Admin
          </button>
        </div>
      </div>

      <!-- Instructions -->
      <div class="instructions" [innerHTML]="formatInstructions(instructionsText)"></div>

      <!-- Loading -->
      <div *ngIf="loading" class="loading-container">
        <mat-spinner></mat-spinner>
        <p>Loading shifts...</p>
      </div>

      <!-- Error -->
      <div *ngIf="error" class="error-container">
        <mat-icon color="warn">error</mat-icon>
        <p>{{ error }}</p>
        <button mat-button (click)="loadShifts()" color="primary">Retry</button>
      </div>

      <!-- Shifts -->
      <div *ngIf="!loading && !error" class="shifts-container">
        <div *ngIf="upcomingShifts.length === 0" class="no-shifts">
          <mat-icon>event_busy</mat-icon>
          <p>No upcoming shifts available</p>
        </div>

        <div *ngFor="let shift of upcomingShifts; trackBy: trackShift" class="shift-card">
          <mat-card>
            <mat-card-header>
              <mat-card-title>{{ formatDate(shift.StartTime) }}</mat-card-title>
              <mat-card-subtitle>{{ formatTimeRange(shift) }}</mat-card-subtitle>
            </mat-card-header>

            <mat-card-content>
              <div class="capacity-info">
                <div class="capacity-bar">
                  <div class="capacity-fill"
                       [style.width.%]="getCapacityPercentage(shift)"
                       [class.full]="isShiftFull(shift)"
                       [class.nearly-full]="isShiftNearlyFull(shift)">
                  </div>
                </div>
                <div class="capacity-text">
                  {{ getFilledSlots(shift) }} / {{ shift.Capacity }} volunteers
                  <span *ngIf="getRemainingSlots(shift) > 0" class="remaining">
                    ({{ getRemainingSlots(shift) }} spots left)
                  </span>
                  <span *ngIf="isShiftFull(shift)" class="full-text">FULL</span>
                </div>
              </div>

              <div *ngIf="shift.signups.length > 0" class="signups-list">
                <h4>Signed up volunteers:</h4>
                <div *ngFor="let signup of shift.signups" class="signup-item">
                  {{ signup.Name }} ({{ signup.NumPeople }} {{ signup.NumPeople === 1 ? 'person' : 'people' }})
                </div>
              </div>
            </mat-card-content>

            <mat-card-actions>
              <button mat-raised-button
                      color="primary"
                      [disabled]="isShiftFull(shift) || isShiftInPast(shift)"
                      (click)="openSignupDialog(shift)">
                <mat-icon>person_add</mat-icon>
                Sign Up
              </button>
            </mat-card-actions>
          </mat-card>
        </div>
      </div>

      <!-- Cancel My Signup Section -->
      <mat-card class="cancel-section">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>person_remove</mat-icon>
            Cancel My Signup
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p class="cancel-description">Need to cancel? Enter your email and name to find your signups.</p>
          <form [formGroup]="cancelForm" (ngSubmit)="lookupSignups()" class="cancel-form">
            <mat-form-field appearance="outline">
              <mat-label>Email Address</mat-label>
              <input matInput type="email" formControlName="email" placeholder="your.email@example.com">
              <mat-error *ngIf="cancelForm.get('email')?.hasError('required')">Email is required</mat-error>
              <mat-error *ngIf="cancelForm.get('email')?.hasError('email')">Enter a valid email</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Full Name</mat-label>
              <input matInput formControlName="name" placeholder="Enter your full name">
              <mat-error *ngIf="cancelForm.get('name')?.hasError('required')">Name is required</mat-error>
            </mat-form-field>

            <button mat-raised-button type="submit" [disabled]="cancelForm.invalid || lookingUp">
              <mat-icon *ngIf="lookingUp">hourglass_empty</mat-icon>
              <mat-icon *ngIf="!lookingUp">search</mat-icon>
              {{ lookingUp ? 'Searching...' : 'Find My Signups' }}
            </button>
          </form>

          <!-- Lookup Results -->
          <div *ngIf="lookupResults !== null" class="lookup-results">
            <div *ngIf="lookupResults.length === 0" class="no-results">
              <p>No upcoming signups found for this email and name.</p>
            </div>

            <div *ngFor="let result of lookupResults" class="lookup-result-card">
              <div class="result-info">
                <div class="result-shift">
                  <mat-icon>event</mat-icon>
                  <span>{{ result.shift ? formatDate(result.shift.StartTime) : 'Unknown shift' }}</span>
                </div>
                <div *ngIf="result.shift" class="result-time">
                  <mat-icon>schedule</mat-icon>
                  <span>{{ formatTimeRange(result.shift) }}</span>
                </div>
                <div class="result-people">
                  <mat-icon>group</mat-icon>
                  <span>{{ result.NumPeople }} {{ result.NumPeople === 1 ? 'person' : 'people' }}</span>
                </div>
              </div>
              <button mat-raised-button
                      color="warn"
                      [disabled]="cancelling.has(result.SignUpID)"
                      (click)="cancelSignup(result)">
                <mat-icon>{{ cancelling.has(result.SignUpID) ? 'hourglass_empty' : 'cancel' }}</mat-icon>
                {{ cancelling.has(result.SignUpID) ? 'Cancelling...' : 'Cancel' }}
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .calendar-container {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .header h1 {
      margin: 0;
      color: #333;
    }

    .instructions {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
      line-height: 1.5;
    }

    .loading-container, .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      text-align: center;
    }

    .loading-container p, .error-container p {
      margin-top: 10px;
    }

    .no-shifts {
      text-align: center;
      padding: 40px;
      color: #666;
    }

    .no-shifts mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 10px;
    }

    .shifts-container {
      display: grid;
      gap: 20px;
    }

    .shift-card mat-card {
      transition: box-shadow 0.3s ease;
    }

    .shift-card mat-card:hover {
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }

    .capacity-info {
      margin-bottom: 15px;
    }

    .capacity-bar {
      width: 100%;
      height: 8px;
      background-color: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 5px;
    }

    .capacity-fill {
      height: 100%;
      background-color: #4caf50;
      transition: width 0.3s ease;
    }

    .capacity-fill.nearly-full {
      background-color: #ff9800;
    }

    .capacity-fill.full {
      background-color: #f44336;
    }

    .capacity-text {
      font-size: 14px;
      color: #666;
    }

    .remaining {
      color: #4caf50;
      font-weight: 500;
    }

    .full-text {
      color: #f44336;
      font-weight: bold;
    }

    .signups-list {
      margin-top: 15px;
    }

    .signups-list h4 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #666;
    }

    .signup-item {
      padding: 4px 0;
      font-size: 14px;
    }

    mat-card-actions {
      padding-top: 0;
    }

    /* Cancel section */
    .cancel-section {
      margin-top: 40px;
    }

    .cancel-section mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .cancel-description {
      color: #666;
      margin-bottom: 16px;
    }

    .cancel-form {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .cancel-form mat-form-field {
      flex: 1;
      min-width: 200px;
    }

    .cancel-form button {
      margin-top: 4px;
    }

    .lookup-results {
      margin-top: 20px;
    }

    .no-results {
      color: #666;
      font-style: italic;
    }

    .lookup-result-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      margin-bottom: 12px;
      background: #fafafa;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }

    .result-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .result-shift, .result-time, .result-people {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }

    .result-shift {
      font-weight: 500;
    }

    .result-shift mat-icon, .result-time mat-icon, .result-people mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #666;
    }

    @media (max-width: 600px) {
      .cancel-form {
        flex-direction: column;
      }

      .cancel-form mat-form-field {
        width: 100%;
      }

      .cancel-form button {
        width: 100%;
      }

      .lookup-result-card {
        flex-direction: column;
        gap: 12px;
        align-items: stretch;
      }

      .lookup-result-card button {
        width: 100%;
      }
    }
  `]
})
export class CalendarComponent implements OnInit {
  upcomingShifts: VolunteerShift[] = [];
  loading = true;
  error: string | null = null;
  instructionsText = 'Welcome to the volunteer signup portal! Please review available shifts and sign up for those that fit your schedule.';

  // Cancel form
  cancelForm: FormGroup;
  lookupResults: (SignUp & { shift?: VolunteerShift })[] | null = null;
  lookingUp = false;
  cancelling = new Set<number>();

  constructor(
    private volunteerShiftService: VolunteerShiftService,
    private textBoxService: TextBoxService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private route: ActivatedRoute,
    private fb: FormBuilder
  ) {
    this.cancelForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      name: ['', [Validators.required]]
    });
  }

  ngOnInit() {
    this.loadData();
    this.checkForAdminLogin();
  }

  private checkForAdminLogin() {
    this.route.queryParams.subscribe(params => {
      if (params['adminLogin'] === 'true') {
        this.openAdminLoginDialog();
      }
    });
  }

  private openAdminLoginDialog() {
    this.dialog.open(AdminLoginDialogComponent, {
      width: '450px',
      disableClose: true,
      autoFocus: true
    });
  }

  async loadData() {
    this.loading = true;
    this.error = null;

    try {
      await Promise.all([
        this.loadShifts(),
        this.loadInstructions()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      this.error = 'Failed to load data. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  async loadShifts() {
    try {
      this.upcomingShifts = await this.volunteerShiftService.getShiftsWithSignups();
      this.upcomingShifts.sort((a, b) => a.StartTime.getTime() - b.StartTime.getTime());
    } catch (error) {
      console.error('Error loading shifts:', error);
      throw error;
    }
  }

  async loadInstructions() {
    try {
      const instructions = await this.textBoxService.getTextByName('VolunteerInstructions');
      if (instructions) {
        this.instructionsText = instructions;
      }
    } catch (error) {
      console.error('Error loading instructions:', error);
    }
  }

  openSignupDialog(shift: VolunteerShift) {
    const dialogData: SignupDialogData = { shift };

    const dialogRef = this.dialog.open(SignupDialogComponent, {
      width: '500px',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(async (signupData: CreateSignupData) => {
      if (signupData) {
        try {
          const newSignup = await this.volunteerShiftService.createSignup(signupData);

          const shiftIndex = this.upcomingShifts.findIndex(s => s.ShiftID === shift.ShiftID);
          if (shiftIndex !== -1) {
            this.upcomingShifts[shiftIndex].signups.push(newSignup);
          }

          this.showMessage('Successfully signed up for the shift!');
        } catch (error) {
          console.error('Error creating signup:', error);
          this.showMessage('Error signing up for shift. Please try again.');
        }
      }
    });
  }

  async lookupSignups() {
    if (this.cancelForm.invalid) return;

    this.lookingUp = true;
    this.lookupResults = null;

    try {
      const { email, name } = this.cancelForm.value;
      const results = await this.volunteerShiftService.findSignupsByEmail(email.trim());
      // Filter by name (case-insensitive)
      this.lookupResults = results.filter(
        r => r.Name.toLowerCase() === name.trim().toLowerCase()
      );
    } catch (error) {
      console.error('Error looking up signups:', error);
      this.showMessage('Error looking up signups. Please try again.');
    } finally {
      this.lookingUp = false;
    }
  }

  async cancelSignup(signup: SignUp & { shift?: VolunteerShift }) {
    const shiftDate = signup.shift ? this.formatDate(signup.shift.StartTime) : 'this shift';
    if (!confirm(`Are you sure you want to cancel your signup for ${shiftDate}?`)) {
      return;
    }

    this.cancelling.add(signup.SignUpID);

    try {
      await this.volunteerShiftService.cancelSignupWithNotification(signup.SignUpID);

      // Remove from lookup results
      this.lookupResults = this.lookupResults?.filter(r => r.SignUpID !== signup.SignUpID) || null;

      // Reload shifts to update capacity display
      await this.loadShifts();

      this.showMessage('Your signup has been cancelled. A confirmation email has been sent.');
    } catch (error) {
      console.error('Error cancelling signup:', error);
      this.showMessage('Error cancelling signup. Please try again.');
    } finally {
      this.cancelling.delete(signup.SignUpID);
    }
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

  getFilledSlots(shift: VolunteerShift): number {
    return shift.signups.reduce((total, signup) => total + (signup.NumPeople || 1), 0);
  }

  getRemainingSlots(shift: VolunteerShift): number {
    return shift.Capacity - this.getFilledSlots(shift);
  }

  getCapacityPercentage(shift: VolunteerShift): number {
    return (this.getFilledSlots(shift) / shift.Capacity) * 100;
  }

  isShiftFull(shift: VolunteerShift): boolean {
    return this.getFilledSlots(shift) >= shift.Capacity;
  }

  isShiftNearlyFull(shift: VolunteerShift): boolean {
    return this.getCapacityPercentage(shift) >= 80 && !this.isShiftFull(shift);
  }

  isShiftInPast(shift: VolunteerShift): boolean {
    return shift.StartTime < new Date();
  }

  formatInstructions(text: string): string {
    if (!text) return '';

    let safeText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    safeText = safeText.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank">$1</a>'
    );

    safeText = safeText.replace(
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      '<a href="mailto:$1">$1</a>'
    );

    return safeText;
  }

  trackShift(index: number, shift: VolunteerShift): number {
    return shift.ShiftID;
  }

  private showMessage(message: string) {
    this.snackBar.open(message, 'Close', { duration: 3000 });
  }
}
