import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiWarmupService } from '../../../shared/services/api-warmup.service';
import { VolunteerShiftService } from '../../calendar/services/volunteer-shift.service';
import { ToastService } from '../../../shared/services/toast.service';
import { VolunteerShift, SignUp } from '../../calendar/models/volunteer.model';

@Component({
  selector: 'app-admin-shifts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-shifts.component.html',
  styleUrl: './admin-shifts.component.scss',
})
export class AdminShiftsComponent implements OnInit {
  upcomingShifts: VolunteerShift[] = [];
  pastShifts: VolunteerShift[] = [];
  loading = false;
  expandedShiftId: number | null = null;
  showPastShifts = false;
  selectedShiftIds = new Set<number>();
  deleting = false;
  todayStr = new Date().toISOString().split('T')[0];

  // Create shift form
  newShift = {
    date: '',
    startTime: '13:00',
    endTime: '15:00',
    capacity: 1,
  };
  recurring = false;
  repeatWeeks = 4;
  repeatDays: { [key: number]: boolean } = { 0: false, 1: false, 2: false, 3: false, 4: false, 5: true, 6: true };
  dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  creating = false;

  constructor(
    private shiftService: VolunteerShiftService,
    private toastService: ToastService,
    private warmup: ApiWarmupService
  ) {}

  ngOnInit(): void {
    this.loadShifts();
  }

  async loadShifts(): Promise<void> {
    this.loading = true;
    try {
      // The database may have auto-paused; wait for it to resume before querying.
      await this.warmup.ensureReady();
      const allShifts = await this.shiftService.getShiftsWithSignups(true);
      allShifts.sort((a, b) => a.StartTime.getTime() - b.StartTime.getTime());
      const now = new Date();
      this.upcomingShifts = allShifts.filter(s => s.StartTime >= now);
      this.pastShifts = allShifts.filter(s => s.StartTime < now).reverse();
    } catch (e) {
      this.toastService.error('Failed to load shifts');
    } finally {
      this.loading = false;
    }
  }

  get selectedDayCount(): number {
    return Object.values(this.repeatDays).filter(Boolean).length;
  }

  get totalShiftsToCreate(): number {
    if (!this.recurring) return 1;
    return this.selectedDayCount * this.repeatWeeks;
  }

  toggleDay(day: number): void {
    this.repeatDays[day] = !this.repeatDays[day];
  }

  async createShift(): Promise<void> {
    if (!this.newShift.startTime || !this.newShift.endTime) {
      this.toastService.error('Please fill in all fields');
      return;
    }

    if (this.recurring) {
      if (this.selectedDayCount === 0) {
        this.toastService.error('Please select at least one day of the week');
        return;
      }
      if (!this.newShift.date) {
        this.toastService.error('Please pick a start date');
        return;
      }
    } else if (!this.newShift.date) {
      this.toastService.error('Please fill in all fields');
      return;
    }

    if (this.newShift.date < this.todayStr) {
      this.toastService.error('Cannot create shifts in the past');
      return;
    }

    this.creating = true;
    try {
      const dates = this.buildShiftDates();
      let created = 0;

      for (const date of dates) {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const startTime = new Date(`${dateStr}T${this.newShift.startTime}:00`);
        const endTime = new Date(`${dateStr}T${this.newShift.endTime}:00`);

        await this.shiftService.createShift({
          StartTime: startTime,
          EndTime: endTime,
          Capacity: this.newShift.capacity,
        });
        created++;
      }

      const msg = created > 1 ? `${created} shifts created successfully` : 'Shift created successfully';
      this.toastService.success(msg);
      this.newShift.date = '';
      await this.loadShifts();
    } catch (e) {
      this.toastService.error('Failed to create shift(s)');
    } finally {
      this.creating = false;
    }
  }

  private buildShiftDates(): Date[] {
    const baseDate = new Date(`${this.newShift.date}T00:00:00`);

    if (!this.recurring) return [baseDate];

    const selectedDays = Object.entries(this.repeatDays)
      .filter(([, selected]) => selected)
      .map(([day]) => parseInt(day));

    const dates: Date[] = [];
    for (let w = 0; w < this.repeatWeeks; w++) {
      const weekStart = new Date(baseDate);
      weekStart.setDate(weekStart.getDate() + w * 7);
      // Find the Monday of that week
      const mondayOffset = (weekStart.getDay() + 6) % 7; // days since Monday
      const monday = new Date(weekStart);
      monday.setDate(monday.getDate() - mondayOffset);

      for (const day of selectedDays) {
        const shiftDate = new Date(monday);
        shiftDate.setDate(monday.getDate() + (day === 0 ? 6 : day - 1));
        // Only include dates on or after the start date
        if (shiftDate >= baseDate) {
          dates.push(shiftDate);
        }
      }
    }

    dates.sort((a, b) => a.getTime() - b.getTime());
    return dates;
  }

  async deleteShift(shift: VolunteerShift): Promise<void> {
    if (!confirm(`Delete shift on ${this.formatDate(shift)}? This will also delete all signups.`)) {
      return;
    }

    try {
      await this.shiftService.deleteShift(shift.ShiftID);
      this.toastService.success('Shift deleted');
      await this.loadShifts();
    } catch (e) {
      this.toastService.error('Failed to delete shift');
    }
  }

  async deleteSignup(signup: SignUp): Promise<void> {
    if (!confirm('Remove this signup?')) return;

    try {
      await this.shiftService.cancelSignupWithNotification(signup);
      this.toastService.success('Signup removed');
      await this.loadShifts();
    } catch (e) {
      this.toastService.error('Failed to remove signup');
    }
  }

  toggleSelect(shiftId: number): void {
    if (this.selectedShiftIds.has(shiftId)) {
      this.selectedShiftIds.delete(shiftId);
    } else {
      this.selectedShiftIds.add(shiftId);
    }
  }

  get allSelected(): boolean {
    return this.upcomingShifts.length > 0 && this.selectedShiftIds.size === this.upcomingShifts.length;
  }

  toggleSelectAll(): void {
    if (this.allSelected) {
      this.selectedShiftIds.clear();
    } else {
      this.upcomingShifts.forEach(s => this.selectedShiftIds.add(s.ShiftID));
    }
  }

  async deleteSelectedShifts(): Promise<void> {
    const count = this.selectedShiftIds.size;
    if (count === 0) return;
    if (!confirm(`Delete ${count} shift${count > 1 ? 's' : ''}? This will also delete all associated signups.`)) {
      return;
    }

    this.deleting = true;
    try {
      for (const id of this.selectedShiftIds) {
        await this.shiftService.deleteShift(id);
      }
      this.toastService.success(`${count} shift${count > 1 ? 's' : ''} deleted`);
      this.selectedShiftIds.clear();
      await this.loadShifts();
    } catch (e) {
      this.toastService.error('Failed to delete some shifts');
      await this.loadShifts();
    } finally {
      this.deleting = false;
    }
  }

  toggleExpand(shiftId: number): void {
    this.expandedShiftId = this.expandedShiftId === shiftId ? null : shiftId;
  }

  formatDate(shift: VolunteerShift): string {
    return this.shiftService.formatShiftDate(shift);
  }

  formatTime(shift: VolunteerShift): string {
    return this.shiftService.formatShiftTime(shift);
  }

  getCapacity(shift: VolunteerShift) {
    return this.shiftService.getShiftCapacityInfo(shift);
  }
}
