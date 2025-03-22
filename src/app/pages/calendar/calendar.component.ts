import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

interface VolunteerShift {
  ShiftID: number;
  StartTime: string;
  EndTime: string;
  Capacity: number;
  signups: SignUp[];
}

interface SignUp {
  SignUpID: number;
  ShiftID: number;
  Name: string;
  Email: string;
  PhoneNumber: string;
  NumPeople: number;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatListModule,
    MatIconModule,
    ReactiveFormsModule,
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
  signupForm: FormGroup;

  constructor(private dialog: MatDialog, private fb: FormBuilder) {
    this.signupForm = this.fb.group({
      Name: ['', Validators.required],
      Email: ['', [Validators.required, Validators.email]],
      PhoneNumber: ['', Validators.required],
      NumPeople: [1, [Validators.required, Validators.min(1)]],
    });
  }

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

  async viewShiftDetails(shift: VolunteerShift): Promise<void> {
    try {
      const signups = await this.getSignUpsForShift(shift.ShiftID);
      shift.signups = signups;
      this.selectedShift = shift;
      this.showSignups = true;
    } catch (error) {
      console.error('Error fetching shift details:', error);
    }
  }

  closeSignupDetails(): void {
    this.showSignups = false;
    this.selectedShift = null;
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  // Add this method to calculate filled slots
  getFilledSlots(shift: VolunteerShift): number {
    if (!shift.signups) return 0;
    return shift.signups.reduce(
      (total, signup) => total + (signup.NumPeople || 1),
      0
    );
  }

  showSignupFormForShift(): void {
    this.showSignupForm = true;
  }

  cancelSignup(): void {
    this.showSignupForm = false;
    this.signupForm.reset({ NumPeople: 1 });
  }

  async submitSignup(): Promise<void> {
    if (this.signupForm.invalid || !this.selectedShift) {
      return;
    }

    try {
      const data = {
        ...this.signupForm.value,
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
      this.cancelSignup();
      await this.viewShiftDetails(this.selectedShift);
    } catch (error) {
      console.error('Error submitting signup:', error);
    }
  }

  isShiftFull(shift: VolunteerShift): boolean {
    if (!shift.signups) return false;
    return this.getFilledSlots(shift) >= shift.Capacity;
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
  getCalendarWeeks(): { weekStartDate: Date; days: { date: Date; shifts: VolunteerShift[] }[] }[] {
    const weeks: { weekStartDate: Date; days: { date: Date; shifts: VolunteerShift[] }[] }[] = [];
    
    for (let i = 0; i < this.calendarDays.length; i += 7) {
      const weekDays = this.calendarDays.slice(i, i + 7);
      if (weekDays.length > 0) {
        weeks.push({
          weekStartDate: weekDays[0].date,
          days: weekDays
        });
      }
    }
    
    return weeks;
  }
}
