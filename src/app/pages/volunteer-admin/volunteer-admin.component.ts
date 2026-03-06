import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminAuthService, AuthState } from '../calendar/services/admin-auth.service';
import { VolunteerShiftService } from '../calendar/services/volunteer-shift.service';
import { ToastService } from '../../shared/services/toast.service';
import { VolunteerShift } from '../calendar/models/volunteer.model';

@Component({
  selector: 'app-volunteer-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './volunteer-admin.component.html',
  styleUrl: './volunteer-admin.component.scss',
})
export class VolunteerAdminComponent implements OnInit {
  authState: AuthState = { isAuthenticated: false, isLoading: true, user: null, error: null };
  shifts: VolunteerShift[] = [];
  loading = false;
  expandedShiftId: number | null = null;

  // Login form
  loginEmail = '';
  linkSent = false;
  linkMessage = '';

  // Create shift form
  newShift = {
    date: '',
    startTime: '13:00',
    endTime: '14:00',
    capacity: 10,
  };
  creating = false;

  constructor(
    private authService: AdminAuthService,
    private shiftService: VolunteerShiftService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // Check for magic link token in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      this.authService.verifyToken(token).then((success) => {
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        if (success) {
          this.toastService.success('Signed in successfully');
        }
      });
    }

    this.authService.authState$.subscribe((state) => {
      this.authState = state;
      if (state.isAuthenticated) {
        this.loadShifts();
      }
    });
  }

  async sendLoginLink(): Promise<void> {
    if (!this.loginEmail) {
      this.toastService.error('Please enter your email');
      return;
    }

    const result = await this.authService.sendMagicLink(this.loginEmail);
    this.linkSent = true;
    this.linkMessage = result.message;

    if (result.success) {
      this.toastService.success('Check your email for a login link');
    } else {
      this.toastService.error(result.message);
    }
  }

  logout(): void {
    this.authService.logout();
    this.shifts = [];
    this.linkSent = false;
    this.loginEmail = '';
  }

  async loadShifts(): Promise<void> {
    this.loading = true;
    try {
      this.shifts = await this.shiftService.getShiftsWithSignups();
      this.shifts.sort((a, b) => a.StartTime.getTime() - b.StartTime.getTime());
    } catch (e) {
      this.toastService.error('Failed to load shifts');
    } finally {
      this.loading = false;
    }
  }

  async createShift(): Promise<void> {
    if (!this.newShift.date || !this.newShift.startTime || !this.newShift.endTime) {
      this.toastService.error('Please fill in all fields');
      return;
    }

    this.creating = true;
    try {
      const startTime = new Date(`${this.newShift.date}T${this.newShift.startTime}:00`);
      const endTime = new Date(`${this.newShift.date}T${this.newShift.endTime}:00`);

      await this.shiftService.createShift({
        StartTime: startTime,
        EndTime: endTime,
        Capacity: this.newShift.capacity,
      });

      this.toastService.success('Shift created successfully');
      this.newShift.date = '';
      await this.loadShifts();
    } catch (e) {
      this.toastService.error('Failed to create shift');
    } finally {
      this.creating = false;
    }
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

  async deleteSignup(signupId: number): Promise<void> {
    if (!confirm('Remove this signup?')) return;

    try {
      await this.shiftService.cancelSignupWithNotification(signupId);
      this.toastService.success('Signup removed');
      await this.loadShifts();
    } catch (e) {
      this.toastService.error('Failed to remove signup');
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
