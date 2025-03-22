import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

interface VolunteerShift {
  ShiftID: number;
  StartTime: string;
  EndTime: string;
  Capacity: number;
  signups?: SignUp[];
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
  ],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
})
export class CalendarComponent implements OnInit {
  shifts: VolunteerShift[] = [];
  selectedShift: VolunteerShift | null = null;
  showSignups = false;
  calendarDays: { date: Date; shifts: VolunteerShift[] }[] = [];

  constructor(private dialog: MatDialog) {}

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

    // Create calendar for the next 30 days
    for (let i = 0; i < 30; i++) {
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

      // Only add days that have shifts
      if (dayShifts.length > 0) {
        this.calendarDays.push({
          date: date,
          shifts: dayShifts,
        });
      }
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
}
