import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  MatSlideToggleModule,
  MatSlideToggleChange,
} from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CalendarDayComponent } from './components/calendar-day/calendar-day.component';
import { ShiftModalComponent } from './components/shift-modal/shift-modal.component';
import { AdminPanelComponent } from './components/admin-panel/admin-panel.component';
import { AdminLoginComponent } from './components/admin-login/admin-login.component';
import { VolunteerShift, SignUp } from './models/volunteer.model';
import { AdminAuthService } from './services/admin-auth.service';
import { TextBoxService } from './services/text-box.service';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
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
  loading = true; // Add loading state

  // Volunteer instructions properties
  instructionsText =
    'Welcome to the volunteer signup portal! Please review available shifts and sign up for those that fit your schedule. If you have questions, contact us at volunteer@empathysoupkitchen.org.';
  editingInstructions = false;
  tempInstructionsText = '';

  constructor(
    private authService: AdminAuthService,
    private textBoxService: TextBoxService
  ) {}

  ngOnInit(): void {
    this.fetchShifts();
    this.fetchInstructions();

    // Check for admin authentication
    this.authService.isAuthenticated$.subscribe((isAuthenticated) => {
      this.isAdminMode = isAuthenticated;
    });
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

  // Toggle edit mode for instructions
  toggleEditInstructions(): void {
    if (this.editingInstructions) {
      // Save the changes
      this.saveInstructions();
    } else {
      // Enter edit mode
      this.tempInstructionsText = this.instructionsText;
      this.editingInstructions = true;
    }
  }

  // Save the updated instructions
  async saveInstructions(): Promise<void> {
    try {
      console.log('Saving instructions...');
      const success = await this.textBoxService.updateText('VolunteerInstructions', this.instructionsText);
      
      if (!success) {
        console.warn('Instructions were saved to localStorage but not to database');
        // Show a less alarming message since we still saved to localStorage
        const saveMsg = document.createElement('div');
        saveMsg.textContent = 'Instructions saved locally. They may not persist across devices until database connectivity is restored.';
        saveMsg.style.cssText = 'position:fixed; top:20px; right:20px; background:#fff3cd; color:#856404; padding:10px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.1); z-index:9999;';
        document.body.appendChild(saveMsg);
        setTimeout(() => saveMsg.remove(), 5000);
      }
      
      this.editingInstructions = false;
    } catch (error) {
      console.error('Error saving instructions:', error);
      alert('There was a problem saving your changes, but they have been stored locally. Please try again later.');
      // Still exit edit mode since we saved locally
      this.editingInstructions = false;
    }
  }

  // Cancel editing and revert to previous instructions
  cancelEditInstructions(): void {
    this.instructionsText = this.tempInstructionsText;
    this.editingInstructions = false;
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
        // Return test data for signups
        return [
          {
            SignUpID: 1,
            ShiftID: shiftId,
            Name: 'John Doe',
            Email: 'test@test.com',
            PhoneNumber: '1234567890',
            NumPeople: 1,
          },
          {
            SignUpID: 2,
            ShiftID: shiftId,
            Name: 'Jane Doe',
            Email: 'test2@test.com',
            PhoneNumber: '0987654321',
            NumPeople: 2,
          },
        ];
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
        } catch (parseError) {
          console.error('Failed to parse response:', parseError);
        }
      }
    } catch (error) {
      console.error('Error creating shift:', error);
      alert('Failed to create shift. Please try again.');
    }
  }

  async updateShift(
    shiftId: number,
    shiftData: Partial<VolunteerShift>
  ): Promise<void> {
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
      const shiftIndex = this.shifts.findIndex((s) => s.ShiftID === shiftId);
      if (shiftIndex !== -1) {
        this.shifts[shiftIndex] = {
          ...this.shifts[shiftIndex],
          ...shiftData,
        };

        // Refresh the calendar
        this.organizeShiftsByDate();
      }
    } catch (error) {
      console.error('Error updating shift:', error);
      alert('Failed to update shift. Please try again.');
    }
  }

  async deleteShift(shiftId: number): Promise<void> {
    try {
      // Delete all signups for this shift first (if any)
      const signups = await this.getSignUpsForShift(shiftId);
      for (const signup of signups) {
        await this.deleteSignup(signup.SignUpID, shiftId);
      }

      const endpoint = `/data-api/rest/VolunteerShifts/ShiftID`;
      const response = await fetch(`${endpoint}/${shiftId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Remove the shift from the shifts array
      this.shifts = this.shifts.filter((s) => s.ShiftID !== shiftId);

      // Refresh the calendar
      this.organizeShiftsByDate();
    } catch (error) {
      console.error('Error deleting shift:', error);
      alert('Failed to delete shift. Please try again.');
    }
  }

  // Admin methods for signups
  async deleteSignup(signupId: number, shiftId: number): Promise<void> {
    try {
      const endpoint = `/data-api/rest/SignUps/SignUpID`;
      const response = await fetch(`${endpoint}/${signupId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Find the shift and remove the signup
      const shiftIndex = this.shifts.findIndex((s) => s.ShiftID === shiftId);
      if (shiftIndex !== -1) {
        this.shifts[shiftIndex].signups = this.shifts[
          shiftIndex
        ].signups.filter((s) => s.SignUpID !== signupId);

        // If we're currently viewing this shift, update the selectedShift
        if (this.selectedShift && this.selectedShift.ShiftID === shiftId) {
          this.selectedShift = { ...this.shifts[shiftIndex] };
        }
      }
    } catch (error) {
      console.error('Error deleting signup:', error);
      alert('Failed to delete signup. Please try again.');
    }
  }

  async updateSignup(
    signupId: number,
    shiftId: number,
    signupData: Partial<SignUp>
  ): Promise<void> {
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
      const shiftIndex = this.shifts.findIndex((s) => s.ShiftID === shiftId);
      if (shiftIndex !== -1) {
        const signupIndex = this.shifts[shiftIndex].signups.findIndex(
          (s) => s.SignUpID === signupId
        );

        if (signupIndex !== -1) {
          this.shifts[shiftIndex].signups[signupIndex] = {
            ...this.shifts[shiftIndex].signups[signupIndex],
            ...signupData,
          };

          // If we're currently viewing this shift, update the selectedShift
          if (this.selectedShift && this.selectedShift.ShiftID === shiftId) {
            this.selectedShift = { ...this.shifts[shiftIndex] };
          }
        }
      }
    } catch (error) {
      console.error('Error updating signup:', error);
      alert('Failed to update signup. Please try again.');
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
