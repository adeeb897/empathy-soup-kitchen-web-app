import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CalendarDayComponent } from './components/calendar-day/calendar-day.component';
import { ShiftModalComponent } from './components/shift-modal/shift-modal.component';
import { VolunteerShift, SignUp } from './models/volunteer.model';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    CalendarDayComponent,
    ShiftModalComponent,
  ],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
})
export class CalendarComponent implements OnInit {
  shifts: VolunteerShift[] = [];
  selectedShift: VolunteerShift | null = null;
  showSignups = false;
  showSignupForm = false;
  calendarDays: { date: Date; shifts: VolunteerShift[] }[] = [];
  visibleWeeks = 2; // Start with 2 weeks visible
  maxWeeks = 8; // Allow viewing up to 8 weeks

  ngOnInit(): void {
    this.fetchShifts();
  }

  async fetchShifts(): Promise<void> {
    try {
      const shifts = await this.list();
      if (shifts && shifts.length > 0) {
        this.shifts = shifts;
        this.organizeShiftsByDate();
      }
    } catch (error) {
      console.error('Error fetching shifts:', error);
    }
  }

  organizeShiftsByDate(): void {
    // Clear the existing calendar
    this.calendarDays = [];

    // Get current date (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create calendar for the specified number of weeks
    const daysToShow = this.visibleWeeks * 7;
    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      // Find shifts for this date
      const dayShifts = this.shifts.filter((shift) => {
        const shiftDate = new Date(shift.StartTime);
        return (
          shiftDate.getDate() === date.getDate() &&
          shiftDate.getMonth() === date.getMonth() &&
          shiftDate.getFullYear() === date.getFullYear()
        );
      });

      // Include all days, even those without shifts
      this.calendarDays.push({
        date: date,
        shifts: dayShifts,
      });
    }
  }

  async list(): Promise<VolunteerShift[]> {
    try {
      const endpoint = '/data-api/rest/VolunteerShifts';
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const text = await response.text();

      if (!text) {
        console.log('Empty response received');
        return [];
      }

      try {
        const data = JSON.parse(text);
        // Filter out past shifts
        const currentDate = new Date();
        return data.value.filter(
          (shift: VolunteerShift) => new Date(shift.StartTime) >= currentDate
        );
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        console.log('Raw response:', text);
        return [];
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      return [];
    }
  }

  async getSignUpsForShift(shiftId: number): Promise<SignUp[]> {
    try {
      const endpoint = `/data-api/rest/SignUps?$filter=ShiftID eq ${shiftId}`;
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const text = await response.text();

      if (!text) {
        console.log('Empty response received');
        return [];
      }

      try {
        const data = JSON.parse(text);
        return data.value;
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        return [];
      }
    } catch (error) {
      console.error('Error fetching signups:', error);
      return [];
    }
  }

  async onShiftSelected(shift: VolunteerShift): Promise<void> {
    try {
      const signups = await this.getSignUpsForShift(shift.ShiftID);
      shift.signups = signups;
      this.selectedShift = shift;
      this.showSignups = true;
    } catch (error) {
      console.error('Error fetching shift details:', error);
    }
  }

  closeModal(): void {
    this.showSignups = false;
    this.showSignupForm = false;
    this.selectedShift = null;
  }

  setShowSignupForm(show: boolean): void {
    this.showSignupForm = show;
  }

  async handleSignupSubmit(formData: any): Promise<void> {
    if (!this.selectedShift) return;

    try {
      const data = {
        ...formData,
        ShiftID: this.selectedShift.ShiftID,
      };

      const endpoint = `/data-api/rest/SignUps/`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Refresh the shift details to show updated signup information
      this.showSignupForm = false;
      await this.onShiftSelected(this.selectedShift);
    } catch (error) {
      console.error('Error submitting signup:', error);
    }
  }

  showMoreWeeks(): void {
    this.visibleWeeks = Math.min(this.visibleWeeks + 2, this.maxWeeks);
    this.organizeShiftsByDate();
  }

  // Check if we can show more weeks
  canShowMore(): boolean {
    return this.visibleWeeks < this.maxWeeks;
  }

  // Group calendar days by week for better display
  getCalendarWeeks(): {
    weekStartDate: Date;
    days: { date: Date; shifts: VolunteerShift[] }[];
  }[] {
    const weeks: {
      weekStartDate: Date;
      days: { date: Date; shifts: VolunteerShift[] }[];
    }[] = [];

    for (let i = 0; i < this.calendarDays.length; i += 7) {
      const weekDays = this.calendarDays.slice(i, i + 7);
      if (weekDays.length > 0) {
        weeks.push({
          weekStartDate: weekDays[0].date,
          days: weekDays,
        });
      }
    }

    return weeks;
  }
}
