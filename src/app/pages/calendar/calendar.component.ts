import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { CalendarDayComponent } from './components/calendar-day/calendar-day.component';
import { ShiftModalComponent } from './components/shift-modal/shift-modal.component';
import { AdminPanelComponent } from './components/admin-panel/admin-panel.component';
import { AdminLoginComponent } from './components/admin-login/admin-login.component';
import { VolunteerShift, SignUp } from './models/volunteer.model';
import { AdminAuthService } from './services/admin-auth.service';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    CalendarDayComponent,
    ShiftModalComponent,
    AdminPanelComponent,
    AdminLoginComponent,
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
  isAdminMode = false;
  showAdminPanel = false;
  showAdminLogin = false;

  constructor(private authService: AdminAuthService) {}

  ngOnInit(): void {
    this.fetchShifts();
    
    // Check for admin authentication
    this.authService.isAuthenticated$.subscribe(isAuthenticated => {
      this.isAdminMode = isAuthenticated;
    });
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
          const newSignup = newSignupResponse.value[0] || newSignupResponse;
          
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
          alert(`Thank you ${newSignup.Name ?? ''}! Your signup has been confirmed.`);
  
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

  toggleAdminMode(event: MatSlideToggleChange): void {
    if (event.checked) {
      // Check if already authenticated
      if (!this.authService.isAuthenticated()) {
        // Show login modal
        this.showAdminLogin = true;
        // Revert the toggle until authenticated
        event.source.checked = false;
      }
    } else {
      // Log out
      this.authService.logout();
      // Close any open modals when toggling admin mode
      this.closeModal();
    }
  }
  
  hideAdminLogin(): void {
    this.showAdminLogin = false;
  }

  openAdminPanel(): void {
    this.showAdminPanel = true;
  }
  
  closeAdminPanel(): void {
    this.showAdminPanel = false;
  }
  
  // Admin methods for shifts
  async createShift(shiftData: Partial<VolunteerShift>): Promise<void> {
    try {
      const endpoint = '/data-api/rest/VolunteerShifts';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const text = await response.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          const newShift = data.value || data;
          newShift.signups = [];
          
          // Add to shifts array and refresh calendar
          this.shifts.push(newShift);
          this.organizeShiftsByDate();
          
          alert('Shift created successfully!');
        } catch (parseError) {
          console.error('Failed to parse response:', parseError);
        }
      }
    } catch (error) {
      console.error('Error creating shift:', error);
      alert('Failed to create shift. Please try again.');
    }
  }
  
  async updateShift(shiftId: number, shiftData: Partial<VolunteerShift>): Promise<void> {
    try {
      const endpoint = `/data-api/rest/VolunteerShifts(${shiftId})`;
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Find and update the shift in the shifts array
      const shiftIndex = this.shifts.findIndex(s => s.ShiftID === shiftId);
      if (shiftIndex !== -1) {
        this.shifts[shiftIndex] = {
          ...this.shifts[shiftIndex],
          ...shiftData
        };
        
        // Refresh the calendar
        this.organizeShiftsByDate();
        
        alert('Shift updated successfully!');
      }
    } catch (error) {
      console.error('Error updating shift:', error);
      alert('Failed to update shift. Please try again.');
    }
  }
  
  async deleteShift(shiftId: number): Promise<void> {
    if (!confirm('Are you sure you want to delete this shift? This will also delete all signups for this shift.')) {
      return;
    }
    
    try {
      const endpoint = `/data-api/rest/VolunteerShifts/ShiftID`;
      const response = await fetch(`${endpoint}/${shiftId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Remove the shift from the shifts array
      this.shifts = this.shifts.filter(s => s.ShiftID !== shiftId);
      
      // Refresh the calendar
      this.organizeShiftsByDate();
      
      alert('Shift deleted successfully!');
    } catch (error) {
      console.error('Error deleting shift:', error);
      alert('Failed to delete shift. Please try again.');
    }
  }
  
  // Admin methods for signups
  async deleteSignup(signupId: number, shiftId: number): Promise<void> {
    if (!confirm('Are you sure you want to delete this signup?')) {
      return;
    }
    
    try {
      const endpoint = `/data-api/rest/SignUps/SignUpID`;
      const response = await fetch(`${endpoint}/${signupId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Find the shift and remove the signup
      const shiftIndex = this.shifts.findIndex(s => s.ShiftID === shiftId);
      if (shiftIndex !== -1) {
        this.shifts[shiftIndex].signups = this.shifts[shiftIndex].signups.filter(
          s => s.SignUpID !== signupId
        );
        
        // If we're currently viewing this shift, update the selectedShift
        if (this.selectedShift && this.selectedShift.ShiftID === shiftId) {
          this.selectedShift = { ...this.shifts[shiftIndex] };
        }
        
        alert('Signup deleted successfully!');
      }
    } catch (error) {
      console.error('Error deleting signup:', error);
      alert('Failed to delete signup. Please try again.');
    }
  }
  
  async updateSignup(signupId: number, shiftId: number, signupData: Partial<SignUp>): Promise<void> {
    try {
      const endpoint = `/data-api/rest/SignUps(${signupId})`;
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Find the shift and update the signup
      const shiftIndex = this.shifts.findIndex(s => s.ShiftID === shiftId);
      if (shiftIndex !== -1) {
        const signupIndex = this.shifts[shiftIndex].signups.findIndex(
          s => s.SignUpID === signupId
        );
        
        if (signupIndex !== -1) {
          this.shifts[shiftIndex].signups[signupIndex] = {
            ...this.shifts[shiftIndex].signups[signupIndex],
            ...signupData
          };
          
          // If we're currently viewing this shift, update the selectedShift
          if (this.selectedShift && this.selectedShift.ShiftID === shiftId) {
            this.selectedShift = { ...this.shifts[shiftIndex] };
          }
          
          alert('Signup updated successfully!');
        }
      }
    } catch (error) {
      console.error('Error updating signup:', error);
      alert('Failed to update signup. Please try again.');
    }
  }
}
