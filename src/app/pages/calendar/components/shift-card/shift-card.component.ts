import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnChanges, SimpleChanges } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShiftCardComponent implements OnChanges {
  @Input() shift!: VolunteerShift;
  @Output() shiftClicked = new EventEmitter<void>();
  
  filledSlots = 0;
  percentFilled = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['shift']) {
      this.updateCapacityIndicators();
    }
  }
  
  updateCapacityIndicators(): void {
    this.filledSlots = this.getFilledSlots();
    this.percentFilled = (this.filledSlots / this.shift.Capacity) * 100;
  }

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
