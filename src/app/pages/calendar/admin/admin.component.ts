import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { VolunteerShift, SignUp, CreateShiftData } from '../models/volunteer.model';
import { VolunteerShiftService } from '../services/volunteer-shift.service';
import { VolunteerDetailsDialogComponent, VolunteerDetailsDialogData } from '../components/volunteer-details-dialog.component';
import { AdminOAuthService } from '../services/admin-oauth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTooltipModule
  ],
  template: `
    <div class="admin-container">
      <!-- Header -->
      <div class="header">
        <div class="header-left">
          <h1>Shift Administration</h1>
          <div class="user-info" *ngIf="userInfo">
            <mat-icon>account_circle</mat-icon>
            <span>{{ userInfo.name || userInfo.email }}</span>
          </div>
        </div>
        <div class="header-actions">
          <button mat-stroked-button (click)="logout()" color="warn">
            <mat-icon>logout</mat-icon>
            Logout
          </button>
          <button mat-raised-button routerLink="/calendar" color="primary">
            <mat-icon>arrow_back</mat-icon>
            Back to Calendar
          </button>
        </div>
      </div>

      <!-- Add New Shift Form -->
      <mat-card class="add-shift-card">
        <mat-card-header>
          <mat-card-title>Add New Shift</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="shiftForm" (ngSubmit)="createShift()" class="shift-form">
            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Date</mat-label>
                <input matInput [matDatepicker]="picker" formControlName="date" required>
                <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                <mat-datepicker #picker></mat-datepicker>
                <mat-error *ngIf="shiftForm.get('date')?.hasError('required')">
                  Date is required
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Start Time</mat-label>
                <input matInput type="time" formControlName="startTime" required>
                <mat-error *ngIf="shiftForm.get('startTime')?.hasError('required')">
                  Start time is required
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>End Time</mat-label>
                <input matInput type="time" formControlName="endTime" required>
                <mat-error *ngIf="shiftForm.get('endTime')?.hasError('required')">
                  End time is required
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Capacity</mat-label>
                <input matInput type="number" formControlName="capacity" min="1" max="100" required>
                <mat-error *ngIf="shiftForm.get('capacity')?.hasError('required')">
                  Capacity is required
                </mat-error>
                <mat-error *ngIf="shiftForm.get('capacity')?.hasError('min')">
                  Capacity must be at least 1
                </mat-error>
                <mat-error *ngIf="shiftForm.get('capacity')?.hasError('max')">
                  Capacity cannot exceed 100
                </mat-error>
              </mat-form-field>
            </div>

            <!-- Recurring Options -->
            <div class="recurring-section">
              <mat-checkbox formControlName="isRecurring">
                Create recurring shifts
              </mat-checkbox>

              <div *ngIf="shiftForm.get('isRecurring')?.value" class="recurring-options">
                <div class="recurring-row">
                  <mat-form-field appearance="outline">
                    <mat-label>Repeat</mat-label>
                    <mat-select formControlName="recurrenceType">
                      <mat-option value="weekly">Weekly</mat-option>
                      <mat-option value="biweekly">Bi-weekly</mat-option>
                      <mat-option value="monthly">Monthly</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Number of weeks</mat-label>
                    <input matInput type="number" formControlName="weekCount" min="1" max="52">
                    <mat-hint>How many weeks to create shifts for</mat-hint>
                  </mat-form-field>
                </div>

                <div *ngIf="shiftForm.get('recurrenceType')?.value === 'weekly'" class="days-selection">
                  <label>Select days:</label>
                  <div class="days-checkboxes">
                    <mat-checkbox formControlName="sunday">Sunday</mat-checkbox>
                    <mat-checkbox formControlName="monday">Monday</mat-checkbox>
                    <mat-checkbox formControlName="tuesday">Tuesday</mat-checkbox>
                    <mat-checkbox formControlName="wednesday">Wednesday</mat-checkbox>
                    <mat-checkbox formControlName="thursday">Thursday</mat-checkbox>
                    <mat-checkbox formControlName="friday">Friday</mat-checkbox>
                    <mat-checkbox formControlName="saturday">Saturday</mat-checkbox>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-actions">
              <button mat-raised-button 
                      type="submit" 
                      color="primary"
                      [disabled]="shiftForm.invalid || creating">
                <mat-icon *ngIf="creating">hourglass_empty</mat-icon>
                <mat-icon *ngIf="!creating">add</mat-icon>
                {{ creating ? 'Creating...' : (shiftForm.get('isRecurring')?.value ? 'Create Recurring Shifts' : 'Create Shift') }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Existing Shifts -->
      <mat-card class="shifts-card">
        <mat-card-header>
          <mat-card-title>Existing Shifts</mat-card-title>
          <div class="refresh-button">
            <button mat-icon-button (click)="loadShifts()" [disabled]="loading">
              <mat-icon [class.spinning]="loading">refresh</mat-icon>
            </button>
          </div>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="loading" class="loading-container">
            <mat-spinner diameter="40"></mat-spinner>
            <p>Loading shifts...</p>
          </div>

          <div *ngIf="error" class="error-container">
            <mat-icon color="warn">error</mat-icon>
            <p>{{ error }}</p>
            <button mat-button (click)="loadShifts()" color="primary">Retry</button>
          </div>

          <div *ngIf="!loading && !error && shifts.length === 0" class="no-shifts">
            <mat-icon>event_busy</mat-icon>
            <p>No shifts found</p>
          </div>

          <div *ngIf="!loading && !error && shifts.length > 0" class="shifts-table-container">
            <table mat-table [dataSource]="shifts" class="shifts-table">
              <!-- Date Column -->
              <ng-container matColumnDef="date">
                <th mat-header-cell *matHeaderCellDef>Date</th>
                <td mat-cell *matCellDef="let shift">{{ formatDate(shift.StartTime) }}</td>
              </ng-container>

              <!-- Time Column -->
              <ng-container matColumnDef="time">
                <th mat-header-cell *matHeaderCellDef>Time</th>
                <td mat-cell *matCellDef="let shift">{{ formatTimeRange(shift) }}</td>
              </ng-container>

              <!-- Capacity Column -->
              <ng-container matColumnDef="capacity">
                <th mat-header-cell *matHeaderCellDef>Capacity</th>
                <td mat-cell *matCellDef="let shift">
                  <div class="capacity-display">
                    {{ getFilledSlots(shift) }} / {{ shift.Capacity }}
                    <div class="capacity-bar-small">
                      <div class="capacity-fill-small" 
                           [style.width.%]="getCapacityPercentage(shift)"
                           [class.full]="isShiftFull(shift)"
                           [class.nearly-full]="isShiftNearlyFull(shift)">
                      </div>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Signups Column -->
              <ng-container matColumnDef="signups">
                <th mat-header-cell *matHeaderCellDef>Volunteers</th>
                <td mat-cell *matCellDef="let shift">
                  <div *ngIf="shift.signups.length === 0" class="no-signups">No signups</div>
                  <button *ngIf="shift.signups.length > 0" 
                          mat-stroked-button 
                          class="volunteers-button"
                          (click)="showVolunteerDetails(shift)">
                    <mat-icon>people</mat-icon>
                    <span class="volunteer-summary">
                      {{ shift.signups.length }} volunteer{{ shift.signups.length === 1 ? '' : 's' }}
                      ({{ getFilledSlots(shift) }} people)
                    </span>
                  </button>
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Actions</th>
                <td mat-cell *matCellDef="let shift">
                  <div class="action-buttons">
                    <button mat-icon-button 
                            (click)="deleteShift(shift)"
                            [disabled]="deleting.has(shift.ShiftID)"
                            [matTooltip]="shift.signups.length > 0 ? 'Delete shift and all signups' : 'Delete shift'"
                            color="warn">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .admin-container {
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .header h1 {
      margin: 0;
      color: #333;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #666;
      font-size: 14px;
    }

    .user-info mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .add-shift-card, .shifts-card {
      margin-bottom: 20px;
    }

    .shift-form {
      display: flex;
      flex-direction: column;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 15px;
      margin-bottom: 20px;
    }

    .recurring-section {
      margin-bottom: 20px;
      padding: 15px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      background-color: #fafafa;
    }

    .recurring-options {
      margin-top: 15px;
      padding-left: 20px;
    }

    .recurring-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 15px;
    }

    .days-selection {
      margin-top: 15px;
    }

    .days-selection label {
      display: block;
      margin-bottom: 10px;
      font-weight: 500;
    }

    .days-checkboxes {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 10px;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
    }

    .loading-container, .error-container, .no-shifts {
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

    .no-shifts mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 10px;
      color: #666;
    }

    .refresh-button {
      margin-left: auto;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .shifts-table-container {
      overflow-x: auto;
    }

    .shifts-table {
      width: 100%;
    }

    .capacity-display {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .capacity-bar-small {
      width: 60px;
      height: 4px;
      background-color: #e0e0e0;
      border-radius: 2px;
      overflow: hidden;
    }

    .capacity-fill-small {
      height: 100%;
      background-color: #4caf50;
      transition: width 0.3s ease;
    }

    .capacity-fill-small.nearly-full {
      background-color: #ff9800;
    }

    .capacity-fill-small.full {
      background-color: #f44336;
    }

    .no-signups {
      color: #666;
      font-style: italic;
    }

    .volunteers-button {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-color: #1976d2;
      color: #1976d2;
      transition: all 0.3s ease;
    }

    .volunteers-button:hover {
      background-color: #1976d2;
      color: white;
    }

    .volunteers-button mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .volunteer-summary {
      font-size: 14px;
      font-weight: 500;
    }

    .action-buttons {
      display: flex;
      gap: 8px;
    }

    mat-card-header {
      display: flex;
      align-items: center;
    }

    @media (max-width: 1024px) {
      .form-row {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 900px) {
      .form-row {
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .recurring-row {
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .admin-container {
        padding: 16px;
      }
    }

    @media (max-width: 768px) {
      .form-row {
        grid-template-columns: 1fr;
      }
      .recurring-row {
        grid-template-columns: 1fr;
      }
      .header {
        flex-direction: column;
        align-items: stretch;
        gap: 16px;
      }
      .header-actions {
        order: 2;
        justify-content: flex-start;
        flex-wrap: wrap;
        gap: 8px;
      }
      .header-left {
        order: 1;
      }
      .header h1 {
        font-size: 1.75rem;
      }
      .add-shift-card, .shifts-card {
        margin-bottom: 16px;
      }
    }

    @media (max-width: 600px) {
      .admin-container {
        padding: 12px;
      }
      .header h1 {
        font-size: 1.5rem;
      }
      .user-info {
        font-size: 13px;
      }
      .volunteers-button {
        padding: 6px 12px;
        font-size: 12px;
      }
      .volunteer-summary {
        font-size: 12px;
      }
      .capacity-bar-small {
        width: 50px;
      }
      .recurring-section {
        padding: 12px;
      }
      .recurring-options {
        padding-left: 8px;
      }
      .days-checkboxes {
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: 6px;
      }
      .loading-container, .error-container, .no-shifts {
        padding: 24px 12px;
      }
    }

    @media (max-width: 480px) {
      .header h1 {
        font-size: 1.35rem;
      }
      .admin-container {
        padding: 10px 10px 70px;
      }
      .shifts-table {
        font-size: 12px;
      }
      .shifts-table th, .shifts-table td {
        padding: 4px 6px;
      }
      .volunteers-button {
        width: 100%;
        justify-content: center;
      }
      .form-actions {
        justify-content: stretch;
      }
      .form-actions button {
        width: 100%;
      }
      .capacity-display {
        font-size: 12px;
      }
      .capacity-bar-small {
        width: 44px;
      }
    }

    @media (max-width: 380px) {
      .header h1 {
        font-size: 1.2rem;
      }
      .shifts-table th, .shifts-table td {
        padding: 4px 4px;
      }
      .volunteers-button {
        padding: 6px 10px;
      }
    }
  `]
})
export class AdminComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  shiftForm: FormGroup;
  shifts: VolunteerShift[] = [];
  loading = false;
  creating = false;
  error: string | null = null;
  deleting = new Set<number>();
  displayedColumns = ['date', 'time', 'capacity', 'signups', 'actions'];
  userInfo: any = null;

  constructor(
    private fb: FormBuilder,
    private volunteerShiftService: VolunteerShiftService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private adminOAuthService: AdminOAuthService,
    private router: Router
  ) {
    this.shiftForm = this.fb.group({
      date: ['', Validators.required],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      capacity: ['', [Validators.required, Validators.min(1), Validators.max(100)]],
      isRecurring: [false],
      recurrenceType: ['weekly'],
      weekCount: [8],
      sunday: [false],
      monday: [false],
      tuesday: [false],
      wednesday: [false],
      thursday: [false],
      friday: [false],
      saturday: [false]
    });
  }

  ngOnInit() {
    this.loadShifts();
    
    // Subscribe to user info
    this.adminOAuthService.user$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user: any) => {
        this.userInfo = user;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  logout() {
    this.adminOAuthService.logout();
    this.router.navigate(['/calendar']);
  }

  async loadShifts() {
    this.loading = true;
    this.error = null;

    try {
      this.shifts = await this.volunteerShiftService.getShiftsWithSignups();
      this.shifts.sort((a, b) => a.StartTime.getTime() - b.StartTime.getTime());
    } catch (error) {
      console.error('Error loading shifts:', error);
      this.error = 'Failed to load shifts. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  async createShift() {
    if (this.shiftForm.invalid) return;

    this.creating = true;

    try {
      const formValue = this.shiftForm.value;
      const baseDate = new Date(formValue.date);
      
      const [startHours, startMinutes] = formValue.startTime.split(':').map(Number);
      const [endHours, endMinutes] = formValue.endTime.split(':').map(Number);

      if (endHours < startHours || (endHours === startHours && endMinutes <= startMinutes)) {
        this.showError('End time must be after start time');
        return;
      }

      if (formValue.isRecurring) {
        await this.createRecurringShifts(formValue, startHours, startMinutes, endHours, endMinutes);
      } else {
        await this.createSingleShift(baseDate, startHours, startMinutes, endHours, endMinutes, formValue.capacity);
      }
      
      await this.loadShifts(); // Reload to get fresh data
      this.shiftForm.reset();
      this.resetFormDefaults();
      this.showSuccess(formValue.isRecurring ? 'Recurring shifts created successfully!' : 'Shift created successfully!');
    } catch (error) {
      console.error('Error creating shift:', error);
      this.showError('Failed to create shift. Please try again.');
    } finally {
      this.creating = false;
    }
  }

  private async createSingleShift(date: Date, startHours: number, startMinutes: number, endHours: number, endMinutes: number, capacity: number) {
    const startTime = new Date(date);
    startTime.setHours(startHours, startMinutes, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(endHours, endMinutes, 0, 0);

    const shiftData: CreateShiftData = {
      StartTime: startTime,
      EndTime: endTime,
      Capacity: capacity
    };

    await this.volunteerShiftService.createShift(shiftData);
  }

  private async createRecurringShifts(formValue: any, startHours: number, startMinutes: number, endHours: number, endMinutes: number) {
    const baseDate = new Date(formValue.date);
    const weekCount = formValue.weekCount || 8;
    const shiftsToCreate: CreateShiftData[] = [];

    if (formValue.recurrenceType === 'weekly') {
      const selectedDays = [
        { day: 0, selected: formValue.sunday },    // Sunday = 0
        { day: 1, selected: formValue.monday },    // Monday = 1
        { day: 2, selected: formValue.tuesday },   // Tuesday = 2
        { day: 3, selected: formValue.wednesday }, // Wednesday = 3
        { day: 4, selected: formValue.thursday },  // Thursday = 4
        { day: 5, selected: formValue.friday },    // Friday = 5
        { day: 6, selected: formValue.saturday }   // Saturday = 6
      ];

      const activeDays = selectedDays.filter(d => d.selected);
      
      if (activeDays.length === 0) {
        throw new Error('Please select at least one day for weekly recurring shifts');
      }

      for (let week = 0; week < weekCount; week++) {
        for (const dayInfo of activeDays) {
          const shiftDate = new Date(baseDate);
          shiftDate.setDate(baseDate.getDate() + (week * 7) + (dayInfo.day - baseDate.getDay()));
          
          // Skip dates in the past
          if (shiftDate < new Date()) continue;

          const startTime = new Date(shiftDate);
          startTime.setHours(startHours, startMinutes, 0, 0);

          const endTime = new Date(shiftDate);
          endTime.setHours(endHours, endMinutes, 0, 0);

          shiftsToCreate.push({
            StartTime: startTime,
            EndTime: endTime,
            Capacity: formValue.capacity
          });
        }
      }
    } else if (formValue.recurrenceType === 'biweekly') {
      for (let week = 0; week < weekCount; week += 2) {
        const shiftDate = new Date(baseDate);
        shiftDate.setDate(baseDate.getDate() + (week * 7));
        
        if (shiftDate < new Date()) continue;

        const startTime = new Date(shiftDate);
        startTime.setHours(startHours, startMinutes, 0, 0);

        const endTime = new Date(shiftDate);
        endTime.setHours(endHours, endMinutes, 0, 0);

        shiftsToCreate.push({
          StartTime: startTime,
          EndTime: endTime,
          Capacity: formValue.capacity
        });
      }
    } else if (formValue.recurrenceType === 'monthly') {
      for (let month = 0; month < Math.ceil(weekCount / 4); month++) {
        const shiftDate = new Date(baseDate);
        shiftDate.setMonth(baseDate.getMonth() + month);
        
        if (shiftDate < new Date()) continue;

        const startTime = new Date(shiftDate);
        startTime.setHours(startHours, startMinutes, 0, 0);

        const endTime = new Date(shiftDate);
        endTime.setHours(endHours, endMinutes, 0, 0);

        shiftsToCreate.push({
          StartTime: startTime,
          EndTime: endTime,
          Capacity: formValue.capacity
        });
      }
    }

    // Create all shifts
    for (const shiftData of shiftsToCreate) {
      await this.volunteerShiftService.createShift(shiftData);
    }
  }

  private resetFormDefaults() {
    this.shiftForm.patchValue({
      isRecurring: false,
      recurrenceType: 'weekly',
      weekCount: 8,
      sunday: false,
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false
    });
  }

  showVolunteerDetails(shift: VolunteerShift) {
    const dialogData: VolunteerDetailsDialogData = { shift };
    
    this.dialog.open(VolunteerDetailsDialogComponent, {
      width: '800px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: dialogData
    });
  }

  async deleteShift(shift: VolunteerShift) {
    const confirmMessage = shift.signups.length > 0 
      ? `Are you sure you want to delete this shift? This will also delete ${shift.signups.length} signup(s) from volunteers.`
      : 'Are you sure you want to delete this shift?';
    
    if (!confirm(confirmMessage)) {
      return;
    }

    this.deleting.add(shift.ShiftID);

    try {
      await this.volunteerShiftService.deleteShift(shift.ShiftID);
      this.shifts = this.shifts.filter(s => s.ShiftID !== shift.ShiftID);
      const message = shift.signups.length > 0 
        ? `Shift and ${shift.signups.length} signup(s) deleted successfully!`
        : 'Shift deleted successfully!';
      this.showSuccess(message);
    } catch (error) {
      console.error('Error deleting shift:', error);
      this.showError('Failed to delete shift. Please try again.');
    } finally {
      this.deleting.delete(shift.ShiftID);
    }
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
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

  getCapacityPercentage(shift: VolunteerShift): number {
    return (this.getFilledSlots(shift) / shift.Capacity) * 100;
  }

  isShiftFull(shift: VolunteerShift): boolean {
    return this.getFilledSlots(shift) >= shift.Capacity;
  }

  isShiftNearlyFull(shift: VolunteerShift): boolean {
    return this.getCapacityPercentage(shift) >= 80 && !this.isShiftFull(shift);
  }

  private showSuccess(message: string) {
    this.snackBar.open(message, 'Close', { 
      duration: 3000,
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string) {
    this.snackBar.open(message, 'Close', { 
      duration: 5000,
      panelClass: ['error-snackbar']
    });
  }
}
