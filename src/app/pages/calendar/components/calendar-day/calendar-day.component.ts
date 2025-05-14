import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { VolunteerShift } from '../../models/volunteer.model';
import { ShiftCardComponent } from '../shift-card/shift-card.component';

@Component({
  selector: 'app-calendar-day',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, ShiftCardComponent],
  templateUrl: './calendar-day.component.html',
  styleUrls: ['./calendar-day.component.scss'],
})
export class CalendarDayComponent {
  @Input() date: Date = new Date();
  @Input() shifts: VolunteerShift[] = [];
  @Input() isAdminMode = false;
  @Output() shiftSelected = new EventEmitter<VolunteerShift>();

  onShiftSelect(shift: VolunteerShift): void {
    this.shiftSelected.emit(shift);
  }

  formatDate(date: Date): string {
    // Format the date to be more readable for elderly and tech-illiterate users
    return date.toLocaleDateString([], {
      weekday: 'long', // Full weekday name (e.g., "Saturday" instead of "Sat")
      month: 'long',   // Full month name (e.g., "January" instead of "Jan")
      day: 'numeric',
    });
  }
}
