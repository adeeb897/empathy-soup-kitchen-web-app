import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CalendarDayComponent } from './components/calendar-day/calendar-day.component';
import { ShiftModalComponent } from './components/shift-modal/shift-modal.component';
import { VolunteerShift, SignUp } from './models/volunteer.model';
import { TextBoxService } from './services/text-box.service';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
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
  visibleWeeks = 6; // Start with 6 weeks visible
  maxWeeks = 8; // Allow viewing up to 8 weeks
  loading = true; // Add loading state

  // Volunteer instructions properties
  instructionsText =
    'Welcome to the volunteer signup portal! Please review available shifts and sign up for those that fit your schedule. If you have questions, contact us at volunteer@empathysoupkitchen.org.';

  constructor(
    private textBoxService: TextBoxService
  ) {}

  ngOnInit(): void {
    this.fetchShifts();
    this.fetchInstructions();
    this.organizeShiftsByDate();
  }

  // Fetch instructions from the database
  async fetchInstructions(): Promise<void> {
    try {
      console.log('Fetching volunteer instructions...');
      const volunteerInstructions = await this.textBoxService.getTextByName('VolunteerInstructions');
      if (volunteerInstructions) {
        this.instructionsText = volunteerInstructions;
        console.log('Instructions loaded successfully');
      } else {
        console.warn('No instructions found, using default');
      }
    } catch (error) {
      console.error('Error fetching instructions:', error);
      // Keep using the default instructions that are set in the component
    }
  }

  async fetchShifts(): Promise<void> {
    this.loading = true; // Start loading
    try {
      const shifts = await this.list();
      if (shifts && shifts.length > 0) {
        this.shifts = shifts;
        // Fetch signups for all shifts
        await this.fetchAllShiftSignups();
        this.organizeShiftsByDate();
      }
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      this.loading = false; // End loading regardless of success/failure
    }
  }

  // New method to fetch signups for all shifts
  async fetchAllShiftSignups(): Promise<void> {
    try {
      // Fetch all signups at once
      const allSignups = await this.listAllSignups();

      // Group signups by ShiftID
      const signupsByShiftId: { [key: number]: SignUp[] } = {};
      allSignups.forEach((signup) => {
        if (!signupsByShiftId[signup.ShiftID]) {
          signupsByShiftId[signup.ShiftID] = [];
        }
        signupsByShiftId[signup.ShiftID].push(signup);
      });

      // Assign signups to each shift
      this.shifts.forEach((shift) => {
        shift.signups = signupsByShiftId[shift.ShiftID] || [];
      });
    } catch (error) {
      console.error('Error fetching signups for shifts:', error);
    }
  }

  async listAllSignups(): Promise<SignUp[]> {
    try {
      const endpoint = '/data-api/rest/SignUps';
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
      console.error('Error fetching all signups:', error);
      return [];
    }
  }

  organizeShiftsByDate(): void {
    // Clear the existing calendar
    this.calendarDays = [];

    // Get current date (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the next Saturday from today
    const nextSaturday = new Date(today);
    const dayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7; // Days until next Saturday
    nextSaturday.setDate(today.getDate() + daysUntilSaturday);

    // Create calendar for the specified number of weeks, but only include Saturday and Sunday
    for (let week = 0; week < this.visibleWeeks; week++) {
      // Calculate the Saturday for this week
      const saturdayDate = new Date(nextSaturday);
      saturdayDate.setDate(nextSaturday.getDate() + (week * 7));
      
      // Calculate the Sunday for this week
      const sundayDate = new Date(saturdayDate);
      sundayDate.setDate(saturdayDate.getDate() + 1);
      
      // Find shifts for Saturday
      const saturdayShifts = this.shifts.filter((shift) => {
        const shiftDate = new Date(shift.StartTime);
        return (
          shiftDate.getDate() === saturdayDate.getDate() &&
          shiftDate.getMonth() === saturdayDate.getMonth() &&
          shiftDate.getFullYear() === saturdayDate.getFullYear()
        );
      });
      
      // Find shifts for Sunday
      const sundayShifts = this.shifts.filter((shift) => {
        const shiftDate = new Date(shift.StartTime);
        return (
          shiftDate.getDate() === sundayDate.getDate() &&
          shiftDate.getMonth() === sundayDate.getMonth() &&
          shiftDate.getFullYear() === sundayDate.getFullYear()
        );
      });
      
      // Add Saturday to calendar days
      this.calendarDays.push({
        date: saturdayDate,
        shifts: saturdayShifts,
      });
      
      // Add Sunday to calendar days
      this.calendarDays.push({
        date: sundayDate,
        shifts: sundayShifts,
      });
    }
  }

  // Utility to parse UTC date strings safely
  parseUtcDate(dateStr: string): Date {
    if (dateStr.endsWith('Z')) {
      return new Date(dateStr);
    }
    return new Date(dateStr + 'Z');
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
        const currentDate = new Date();
        return data.value
          .map((shift: VolunteerShift) => ({
            ...shift,
            StartTime: this.parseUtcDate(shift.StartTime),
            EndTime: shift.EndTime ? this.parseUtcDate(shift.EndTime) : undefined,
          }))
          .filter(
            (shift: VolunteerShift) => this.parseUtcDate(shift.StartTime) >= currentDate
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

  async onShiftSelected(shift: VolunteerShift): Promise<void> {
    this.selectedShift = shift;
    this.showSignups = true;
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
      // Calculate remaining capacity
      const filledSlots = this.selectedShift.signups.reduce(
        (total, signup) => total + (signup.NumPeople || 1),
        0
      );
      const remainingCapacity = this.selectedShift.Capacity - filledSlots;

      // Check if there's enough capacity
      if (formData.NumPeople > remainingCapacity) {
        alert(
          `Sorry, there are only ${remainingCapacity} spots remaining for this shift.`
        );
        return;
      }

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

      // Get the new signup from the response
      const text = await response.text();
      if (text) {
        try {
          const newSignupResponse = JSON.parse(text);
          const newSignup = newSignupResponse.value[0] || newSignupResponse;

          // Add the new signup to the shift's signups
          if (this.selectedShift.signups) {
            this.selectedShift.signups.push(newSignup);
          } else {
            this.selectedShift.signups = [newSignup];
          }

          // Find this shift in the shifts array and update it
          const shiftIndex = this.shifts.findIndex(
            (s) => s.ShiftID === this.selectedShift?.ShiftID
          );
          if (shiftIndex !== -1) {
            this.shifts[shiftIndex] = { ...this.selectedShift };

            // Update calendar days to reflect the new signup
            this.calendarDays.forEach((day) => {
              const dayShiftIndex = day.shifts.findIndex(
                (s) => s.ShiftID === this.selectedShift?.ShiftID
              );
              if (dayShiftIndex !== -1) {
                day.shifts[dayShiftIndex] = { ...this.selectedShift! };
              }
            });
          }
        } catch (parseError) {
          console.error('Failed to parse response:', parseError);
        }
      }

      // Reset form and close it
      this.showSignupForm = false;
    } catch (error) {
      console.error('Error submitting signup:', error);
      alert('There was an error processing your signup. Please try again.');
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

    for (let i = 0; i < this.calendarDays.length; i += 2) {
      const weekDays = this.calendarDays.slice(i, i + 2);
      if (weekDays.length > 0) {
        weeks.push({
          weekStartDate: weekDays[0].date,
          days: weekDays,
        });
      }
    }

    return weeks;
  }
  
  // Navigate to previous week
  previousWeek(): void {
    // Get the first date in our calendar (which should be a Saturday)
    if (this.calendarDays.length === 0) return;
    
    const firstDate = new Date(this.calendarDays[0].date);
    // Go back 7 days to get to the previous week's Saturday
    firstDate.setDate(firstDate.getDate() - 7);
    
    // Clear the calendar and rebuild it starting from the new date
    this.calendarDays = [];
    
    for (let week = 0; week < this.visibleWeeks; week++) {
      // Calculate the Saturday for this week
      const saturdayDate = new Date(firstDate);
      saturdayDate.setDate(firstDate.getDate() + (week * 7));
      
      // Calculate the Sunday for this week
      const sundayDate = new Date(saturdayDate);
      sundayDate.setDate(saturdayDate.getDate() + 1);
      
      // Find shifts for Saturday
      const saturdayShifts = this.shifts.filter((shift) => {
        const shiftDate = new Date(shift.StartTime);
        return (
          shiftDate.getDate() === saturdayDate.getDate() &&
          shiftDate.getMonth() === saturdayDate.getMonth() &&
          shiftDate.getFullYear() === saturdayDate.getFullYear()
        );
      });
      
      // Find shifts for Sunday
      const sundayShifts = this.shifts.filter((shift) => {
        const shiftDate = new Date(shift.StartTime);
        return (
          shiftDate.getDate() === sundayDate.getDate() &&
          shiftDate.getMonth() === sundayDate.getMonth() &&
          shiftDate.getFullYear() === sundayDate.getFullYear()
        );
      });
      
      // Add Saturday to calendar days
      this.calendarDays.push({
        date: saturdayDate,
        shifts: saturdayShifts,
      });
      
      // Add Sunday to calendar days
      this.calendarDays.push({
        date: sundayDate,
        shifts: sundayShifts,
      });
    }
  }
  
  // Navigate to next week
  nextWeek(): void {
    // Get the last date in our calendar (which should be a Sunday)
    if (this.calendarDays.length === 0) return;
    
    const lastDate = new Date(this.calendarDays[this.calendarDays.length - 1].date);
    // Go forward 6 days to get to the next week's Saturday
    lastDate.setDate(lastDate.getDate() + 6);
    
    // Clear the calendar and rebuild it starting from the new date
    this.calendarDays = [];
    
    for (let week = 0; week < this.visibleWeeks; week++) {
      // Calculate the Saturday for this week
      const saturdayDate = new Date(lastDate);
      saturdayDate.setDate(lastDate.getDate() + (week * 7));
      
      // Calculate the Sunday for this week
      const sundayDate = new Date(saturdayDate);
      sundayDate.setDate(saturdayDate.getDate() + 1);
      
      // Find shifts for Saturday
      const saturdayShifts = this.shifts.filter((shift) => {
        const shiftDate = new Date(shift.StartTime);
        return (
          shiftDate.getDate() === saturdayDate.getDate() &&
          shiftDate.getMonth() === saturdayDate.getMonth() &&
          shiftDate.getFullYear() === saturdayDate.getFullYear()
        );
      });
      
      // Find shifts for Sunday
      const sundayShifts = this.shifts.filter((shift) => {
        const shiftDate = new Date(shift.StartTime);
        return (
          shiftDate.getDate() === sundayDate.getDate() &&
          shiftDate.getMonth() === sundayDate.getMonth() &&
          shiftDate.getFullYear() === sundayDate.getFullYear()
        );
      });
      
      // Add Saturday to calendar days
      this.calendarDays.push({
        date: saturdayDate,
        shifts: saturdayShifts,
      });
      
      // Add Sunday to calendar days
      this.calendarDays.push({
        date: sundayDate,
        shifts: sundayShifts,
      });
    }
  }

  // Format instructions text for display to preserve line breaks and make URLs clickable
  formatInstructionsForDisplay(text: string): string {
    if (!text) return '';
    
    // First, escape HTML to prevent injection
    let safeText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    
    // Turn URLs into clickable links
    safeText = safeText.replace(
      /(https?:\/\/[^\s]+)/g, 
      '<a href="$1" target="_blank">$1</a>'
    );
    
    // Convert email addresses to mailto links
    safeText = safeText.replace(
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      '<a href="mailto:$1">$1</a>'
    );
    
    return safeText;
  }
}
