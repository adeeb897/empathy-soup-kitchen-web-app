import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { VolunteerShift } from '../../models/volunteer.model';

@Component({
  selector: 'app-shift-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './shift-card.component.html',
  styleUrls: ['./shift-card.component.scss'],
})
export class ShiftCardComponent {
  @Input() shift!: VolunteerShift;
  @Output() shiftClicked = new EventEmitter<void>();

  getFilledSlots(): number {
    if (!this.shift || !this.shift.signups) return 0;
    return this.shift.signups.reduce(
      (total, signup) => total + (signup.NumPeople || 1),
      0
    );
  }

  isShiftFull(): boolean {
    if (!this.shift || !this.shift.signups) return false;
    return this.getFilledSlots() >= this.shift.Capacity;
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
