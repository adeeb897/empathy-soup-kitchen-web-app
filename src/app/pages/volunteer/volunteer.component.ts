import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ScrollAnimateDirective } from '../../shared/components/scroll-animate.directive';
import { VolunteerShiftService } from '../calendar/services/volunteer-shift.service';
import { TextBoxService } from '../calendar/services/text-box.service';
import { ModalService } from '../../shared/services/modal.service';
import { ToastService } from '../../shared/services/toast.service';
import { VolunteerShift, SignUp } from '../calendar/models/volunteer.model';
import { SignupModalComponent } from './signup-modal.component';
import { CancelModalComponent } from './cancel-modal.component';

interface WeekendGroup {
  weekStartDate: Date;
  days: { date: Date; shifts: VolunteerShift[] }[];
}

@Component({
  selector: 'app-volunteer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ScrollAnimateDirective],
  templateUrl: './volunteer.component.html',
  styleUrl: './volunteer.component.scss',
})
export class VolunteerComponent implements OnInit {
  weekends: WeekendGroup[] = [];
  loading = true;
  error: string | null = null;
  instructionsText = '';
  showDetails = false;

  constructor(
    private shiftService: VolunteerShiftService,
    private textBoxService: TextBoxService,
    private modalService: ModalService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const [shifts, instructions] = await Promise.all([
        this.shiftService.getShiftsWithSignups(),
        this.textBoxService.getTextByName('VolunteerInstructions'),
      ]);

      this.weekends = this.shiftService.organizeShiftsByWeekend(shifts);
      this.instructionsText = instructions || '';
    } catch (e) {
      console.error('Failed to load volunteer data:', e);
      this.error = 'Unable to load volunteer shifts. Please try again later.';
    } finally {
      this.loading = false;
    }
  }

  getCapacity(shift: VolunteerShift) {
    return this.shiftService.getShiftCapacityInfo(shift);
  }

  formatTime(shift: VolunteerShift): string {
    return this.shiftService.formatShiftTime(shift);
  }

  formatDate(shift: VolunteerShift): string {
    return this.shiftService.formatShiftDate(shift);
  }

  formatWeekendLabel(date: Date): string {
    return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  }

  formatDayLabel(date: Date): string {
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  }

  async openSignupModal(shift: VolunteerShift): Promise<void> {
    const ref = this.modalService.open(SignupModalComponent, { shift });
    const result = await ref.result;

    if (result?.success) {
      this.toastService.success('You\'re signed up! Check your email for confirmation.');
      await this.loadData();
    }
  }

  async openCancelModal(): Promise<void> {
    const ref = this.modalService.open(CancelModalComponent);
    const result = await ref.result;

    if (result?.cancelled) {
      this.toastService.success('Your signup has been cancelled.');
      await this.loadData();
    }
  }

  toggleDetails(): void {
    this.showDetails = !this.showDetails;
  }

  get noShiftsAvailable(): boolean {
    if (this.weekends.length === 0) return true;
    for (const weekend of this.weekends) {
      if (this.hasShiftsForWeekend(weekend)) return false;
    }
    return true;
  }

  hasShiftsForWeekend(weekend: WeekendGroup): boolean {
    return weekend.days.some(day => day.shifts.length > 0);
  }
}
