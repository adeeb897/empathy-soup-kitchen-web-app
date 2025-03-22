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
        // Fetch signups for all shifts
        await this.fetchAllShiftSignups();
        this.organizeShiftsByDate();
      }
    } catch (error) {
      console.error('Error fetching shifts:', error);
    }
  }

  // New method to fetch signups for all shifts
  async fetchAllShiftSignups(): Promise<void> {
    try {
      // Fetch all signups at once
      const allSignups = await this.listAllSignups();
      
      // Group signups by ShiftID
      const signupsByShiftId: { [key: number]: SignUp[] } = {};
      allSignups.forEach(signup => {
        if (!signupsByShiftId[signup.ShiftID]) {
          signupsByShiftId[signup.ShiftID] = [];
        }
        signupsByShiftId[signup.ShiftID].push(signup);
      });

      // Assign signups to each shift
      this.shifts.forEach(shift => {
        shift.signups = signupsByShiftId[shift.ShiftID] || [];
      });
    } catch (error) {
      console.error('Error fetching signups for shifts:', error);
    }
  }

  // New method to fetch all signups at once
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
        // Return test data
        return [
          { ShiftID: 1, StartTime: '2025-04-10T09:00:00Z', EndTime: '2025-04-10T12:00:00Z', Capacity: 5, signups: [] },
          { ShiftID: 2, StartTime: '2025-04-11T13:00:00Z', EndTime: '2025-04-11T16:00:00Z', Capacity: 3, signups: [] },
        ]
        // return [];
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
        // Return test data for signups
        return [
          { SignUpID: 1, ShiftID: shiftId, Name: 'John Doe', Email: 'test@test.com', PhoneNumber: '1234567890', NumPeople: 1 },
          { SignUpID: 2, ShiftID: shiftId, Name: 'Jane Doe', Email: 'test2@test.com', PhoneNumber: '0987654321', NumPeople: 2 },
        ]
        // return [];
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
        alert(`Sorry, there are only ${remainingCapacity} spots remaining for this shift.`);
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
          const newSignup = newSignupResponse.value || newSignupResponse;
          
          // Add the new signup to the shift's signups
          if (this.selectedShift.signups) {
            this.selectedShift.signups.push(newSignup);
          } else {
            this.selectedShift.signups = [newSignup];
          }
          
          // Find this shift in the shifts array and update it
          const shiftIndex = this.shifts.findIndex(s => s.ShiftID === this.selectedShift?.ShiftID);
          if (shiftIndex !== -1) {
            this.shifts[shiftIndex] = { ...this.selectedShift };
            
            // Update calendar days to reflect the new signup
            this.calendarDays.forEach(day => {
              const dayShiftIndex = day.shifts.findIndex(s => s.ShiftID === this.selectedShift?.ShiftID);
              if (dayShiftIndex !== -1) {
                day.shifts[dayShiftIndex] = { ...this.selectedShift! };
              }
            });
          }
          
          // Show a success message
          alert(`Thank you ${newSignup.Name}! Your signup has been confirmed.`);
  
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
