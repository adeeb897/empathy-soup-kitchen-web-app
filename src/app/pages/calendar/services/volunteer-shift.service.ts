import { Injectable } from '@angular/core';
import { VolunteerShift, SignUp } from '../models/volunteer.model';
import { EmailService } from './email.service';
import { RetryService } from '../../../shared/utils/retry.service';

export interface VolunteerShiftAPIResponse {
  value: VolunteerShift[];
}

export interface SignUpAPIResponse {
  value: SignUp[];
}

@Injectable({
  providedIn: 'root'
})
export class VolunteerShiftService {
  private shiftsEndpoint = '/api/shifts';
  private signupsEndpoint = '/api/signups';

  constructor(
    private emailService: EmailService,
    private retryService: RetryService
  ) {}

  async getAllShifts(includePast = false): Promise<VolunteerShift[]> {
    const data = await this.fetchJson<VolunteerShiftAPIResponse>(this.shiftsEndpoint);
    const shifts = (data.value || []).map(shift => this.parseShiftDates(shift));
    return includePast ? shifts : shifts.filter(shift => shift.StartTime >= new Date());
  }

  async getAllSignups(): Promise<SignUp[]> {
    const data = await this.fetchJson<SignUpAPIResponse>(this.signupsEndpoint);
    return data.value || [];
  }

  async getShiftsWithSignups(includePast = false): Promise<VolunteerShift[]> {
    const [shifts, allSignups] = await Promise.all([
      this.getAllShifts(includePast),
      this.getAllSignups()
    ]);

    const signupsByShiftId = allSignups.reduce((acc, signup) => {
      if (!acc[signup.ShiftID]) acc[signup.ShiftID] = [];
      acc[signup.ShiftID].push(signup);
      return acc;
    }, {} as Record<number, SignUp[]>);

    return shifts.map(shift => ({
      ...shift,
      signups: signupsByShiftId[shift.ShiftID] || []
    }));
  }

  async createShift(shiftData: { StartTime: Date; EndTime: Date; Capacity: number }): Promise<VolunteerShift> {
    const response = await this.retryService.fetchWithRetry(this.shiftsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        StartTime: shiftData.StartTime.toISOString(),
        EndTime: shiftData.EndTime.toISOString(),
        Capacity: shiftData.Capacity
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create shift: ${response.status}`);
    }

    const data = await response.json();
    const newShift = Array.isArray(data.value) ? data.value[0] : data;
    return this.parseShiftDates(newShift);
  }

  async deleteShift(shiftId: number): Promise<void> {
    // Delete all signups for this shift first
    const allSignups = await this.getAllSignups();
    const shiftSignups = allSignups.filter(s => s.ShiftID === shiftId);
    for (const signup of shiftSignups) {
      await this.deleteSignup(signup.SignUpID);
    }

    const response = await this.retryService.fetchWithRetry(
      `${this.shiftsEndpoint}/${shiftId}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete shift: ${response.status}`);
    }
  }

  async createSignup(signupData: Omit<SignUp, 'SignUpID'>): Promise<SignUp> {
    const response = await this.retryService.fetchWithRetry(this.signupsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signupData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create signup: ${response.status}`);
    }

    const data = await response.json();
    const newSignup = Array.isArray(data.value) ? data.value[0] : data;

    // Send emails (non-blocking)
    try {
      const shift = await this.getShiftById(signupData.ShiftID);
      if (shift) {
        this.emailService.sendSignupConfirmation(shift, newSignup).catch(e => console.warn('Signup confirmation email failed:', e));
        this.emailService.sendSignupAdminNotification(shift, newSignup).catch(e => console.warn('Admin signup notification failed:', e));
      }
    } catch (e) {
      console.warn('Failed to send signup emails:', e);
    }

    return newSignup;
  }

  async deleteSignup(signupId: number): Promise<void> {
    const response = await this.retryService.fetchWithRetry(
      `${this.signupsEndpoint}/${signupId}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete signup: ${response.status}`);
    }
  }

  async cancelSignupWithNotification(signupId: number): Promise<void> {
    // Fetch signup details before deleting
    const allSignups = await this.getAllSignups();
    const signup = allSignups.find(s => s.SignUpID === signupId);
    if (!signup) {
      throw new Error('Signup not found');
    }

    const shift = await this.getShiftById(signup.ShiftID);

    // Delete the signup
    await this.deleteSignup(signupId);

    // Send cancellation emails (non-blocking)
    if (shift) {
      this.emailService.sendCancellationConfirmation(shift, signup).catch(e => console.warn('Cancellation confirmation email failed:', e));
      this.emailService.sendCancellationAdminNotification(shift, signup).catch(e => console.warn('Admin cancellation notification failed:', e));
    }
  }

  async findSignupsByEmail(email: string): Promise<(SignUp & { shift?: VolunteerShift })[]> {
    const [allSignups, shifts] = await Promise.all([
      this.getAllSignups(),
      this.getAllShifts()
    ]);

    const shiftMap = new Map(shifts.map(s => [s.ShiftID, s]));

    return allSignups
      .filter(s => s.Email.toLowerCase() === email.toLowerCase())
      .filter(s => {
        const shift = shiftMap.get(s.ShiftID);
        return shift && shift.StartTime >= new Date(); // Only future shifts
      })
      .map(s => ({ ...s, shift: shiftMap.get(s.ShiftID) }));
  }

  getShiftCapacityInfo(shift: VolunteerShift) {
    const filledSlots = shift.signups?.reduce((total, s) => total + (s.NumPeople || 1), 0) || 0;
    const remainingCapacity = shift.Capacity - filledSlots;
    const percentFilled = shift.Capacity > 0 ? (filledSlots / shift.Capacity) * 100 : 0;
    return { filledSlots, remainingCapacity, percentFilled, isFull: filledSlots >= shift.Capacity };
  }

  organizeShiftsByWeekend(shifts: VolunteerShift[], weeksToShow: number = 6) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextSaturday = new Date(today);
    const daysUntilSaturday = (6 - today.getDay() + 7) % 7;
    nextSaturday.setDate(today.getDate() + daysUntilSaturday);

    const weeks = [];
    for (let week = 0; week < weeksToShow; week++) {
      const saturday = new Date(nextSaturday);
      saturday.setDate(nextSaturday.getDate() + (week * 7));
      const sunday = new Date(saturday);
      sunday.setDate(saturday.getDate() + 1);

      weeks.push({
        weekStartDate: new Date(saturday),
        days: [
          { date: new Date(saturday), shifts: shifts.filter(s => this.isSameDay(s.StartTime, saturday)) },
          { date: new Date(sunday), shifts: shifts.filter(s => this.isSameDay(s.StartTime, sunday)) }
        ]
      });
    }
    return weeks;
  }

  formatShiftTime(shift: VolunteerShift): string {
    const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${fmt(shift.StartTime)} - ${fmt(shift.EndTime)}`;
  }

  formatShiftDate(shift: VolunteerShift): string {
    return shift.StartTime.toLocaleDateString([], {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  }

  private async getShiftById(shiftId: number): Promise<VolunteerShift | null> {
    try {
      const data = await this.fetchJson<VolunteerShiftAPIResponse>(
        `${this.shiftsEndpoint}?ShiftID=${shiftId}`
      );
      const shifts = data.value || [];
      return shifts.length > 0 ? this.parseShiftDates(shifts[0]) : null;
    } catch {
      return null;
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await this.retryService.fetchWithRetry(url);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const text = await response.text();
    if (!text) return { value: [] } as unknown as T;
    return JSON.parse(text);
  }

  private parseShiftDates(shift: any): VolunteerShift {
    return {
      ...shift,
      StartTime: this.parseDate(shift.StartTime),
      EndTime: this.parseDate(shift.EndTime),
      signups: shift.signups || []
    };
  }

  private parseDate(dateValue: string | Date): Date {
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue === 'string') {
      let s = dateValue;
      if (s.endsWith('Z')) s = s.slice(0, -1);
      if (!s.includes('T')) s += 'T00:00:00';
      if (!s.endsWith('Z') && !s.includes('+') && !s.includes('-', 10)) s += 'Z';
      const d = new Date(s);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  }
}
