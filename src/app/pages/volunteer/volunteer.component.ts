import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ScrollAnimateDirective } from '../../shared/components/scroll-animate.directive';
import { VolunteerShiftService } from '../calendar/services/volunteer-shift.service';
import { ApiWarmupService } from '../../shared/services/api-warmup.service';
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
export class VolunteerComponent implements OnInit, OnDestroy {
  weekends: WeekendGroup[] = [];
  loading = true;
  warmingUp = false;
  warmingSeconds = 0;
  error: string | null = null;
  instructionsText = '';
  showDetails = false;

  /**
   * The database only needs waking when it has auto-paused. Hold the notice
   * back briefly so an already-warm database just loads without explanation.
   */
  private static readonly WARMING_NOTICE_DELAY_MS = 1500;

  private warmingNoticeTimer?: ReturnType<typeof setTimeout>;
  private warmingClock?: ReturnType<typeof setInterval>;

  constructor(
    private shiftService: VolunteerShiftService,
    private textBoxService: TextBoxService,
    private modalService: ModalService,
    private toastService: ToastService,
    private warmup: ApiWarmupService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.stopWarmingNotice();
  }

  async loadData(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.startWarmingNotice();

    try {
      // Waiting for the database to resume before querying keeps the page from
      // failing on a cold start; when it is already awake this returns at once.
      await this.warmup.ensureReady();

      const [shifts, instructions] = await Promise.all([
        this.shiftService.getShiftsWithSignups(),
        this.textBoxService.getTextByName('VolunteerInstructions'),
      ]);

      this.weekends = this.shiftService.organizeShiftsByWeekend(shifts);
      this.instructionsText = instructions || '';
    } catch (e) {
      console.error('Failed to load volunteer data:', e);
      this.error = this.warmingUp
        ? 'The sign-up system is taking longer than usual to wake up. Please try again.'
        : 'Unable to load volunteer shifts. Please try again later.';
    } finally {
      this.stopWarmingNotice();
      this.loading = false;
    }
  }

  private startWarmingNotice(): void {
    this.stopWarmingNotice();
    this.warmingSeconds = 0;

    this.warmingNoticeTimer = setTimeout(() => {
      this.warmingUp = true;
      this.warmingClock = setInterval(() => this.warmingSeconds++, 1000);
    }, VolunteerComponent.WARMING_NOTICE_DELAY_MS);
  }

  private stopWarmingNotice(): void {
    clearTimeout(this.warmingNoticeTimer);
    clearInterval(this.warmingClock);
    this.warmingNoticeTimer = undefined;
    this.warmingClock = undefined;
    this.warmingUp = false;
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
