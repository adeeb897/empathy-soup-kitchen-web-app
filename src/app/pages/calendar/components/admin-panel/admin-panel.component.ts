import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { VolunteerShift } from '../../models/volunteer.model';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    FormsModule,
    ReactiveFormsModule,
    MatSortModule,
  ],
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.scss'],
})
export class AdminPanelComponent {
  @Input() shifts: VolunteerShift[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() createShift = new EventEmitter<Partial<VolunteerShift>>();
  @Output() updateShift = new EventEmitter<{
    shiftId: number;
    data: Partial<VolunteerShift>;
  }>();
  @Output() deleteShift = new EventEmitter<number>();

  displayedColumns: string[] = [
    'date',
    'time',
    'capacity',
    'signups',
    'actions',
  ];
  showNewShiftForm = false;
  newShiftForm: FormGroup;

  constructor(private fb: FormBuilder) {
    // Initialize with default values for tomorrow, 9 AM to 12 PM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(12, 0, 0, 0);

    this.newShiftForm = this.fb.group({
      StartTime: [this.formatDateTimeForInput(tomorrow), Validators.required],
      EndTime: [this.formatDateTimeForInput(tomorrowEnd), Validators.required],
      Capacity: [5, [Validators.required, Validators.min(1)]],
    });
  }

  closePanel(): void {
    this.close.emit();
  }

  showCreateShiftForm(): void {
    this.showNewShiftForm = true;
  }

  cancelCreateShift(): void {
    this.showNewShiftForm = false;
  }

  submitNewShift(): void {
    if (this.newShiftForm.invalid) return;

    const formData = this.newShiftForm.value;
    const newShift: Partial<VolunteerShift> = {
      StartTime: new Date(formData.StartTime).toISOString(),
      EndTime: new Date(formData.EndTime).toISOString(),
      Capacity: formData.Capacity,
    };

    this.createShift.emit(newShift);
    this.showNewShiftForm = false;

    // Reset form with fresh dates
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(12, 0, 0, 0);

    this.newShiftForm.setValue({
      StartTime: this.formatDateTimeForInput(tomorrow),
      EndTime: this.formatDateTimeForInput(tomorrowEnd),
      Capacity: 5,
    });
  }

  formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatDateTimeForInput(date: Date): string {
    // Format date as YYYY-MM-DDThh:mm
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  getFilledSpots(shift: VolunteerShift): number {
    if (!shift.signups) return 0;
    return shift.signups.reduce(
      (total, signup) => total + (signup.NumPeople || 1),
      0
    );
  }

  sortShiftsByDate(): VolunteerShift[] {
    return [...this.shifts].sort(
      (a, b) =>
        new Date(a.StartTime).getTime() - new Date(b.StartTime).getTime()
    );
  }
}
