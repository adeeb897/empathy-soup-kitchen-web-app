import { Injectable } from '@angular/core';
import { VolunteerShift, SignUp } from '../models/volunteer.model';
import { EmailService } from './email.service';
import { ReminderService } from './reminder.service';

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
  private shiftsEndpoint = '/data-api/rest/VolunteerShifts';
  private signupsEndpoint = '/data-api/rest/SignUps';

  constructor(
    private emailService: EmailService,
    private reminderService: ReminderService
  ) {}

  async getAllShifts(): Promise<VolunteerShift[]> {
    try {
      const response = await fetch(this.shiftsEndpoint);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch shifts: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      if (!text) {
        return [];
      }

      const data: VolunteerShiftAPIResponse = JSON.parse(text);
      return (data.value || []).map((shift) => this.parseShiftDates(shift)).filter((shift) => this.isUpcomingShift(shift));
    } catch (error) {
      console.error('Error fetching shifts:', error);
      throw error;
    }
  }

  async getAllSignups(): Promise<SignUp[]> {
    try {
      const response = await fetch(this.signupsEndpoint);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch signups: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      if (!text) {
        return [];
      }

      const data: SignUpAPIResponse = JSON.parse(text);
      return data.value || [];
    } catch (error) {
      console.error('Error fetching signups:', error);
      throw error;
    }
  }

  async getShiftsWithSignups(): Promise<VolunteerShift[]> {
    try {
      const [shifts, allSignups] = await Promise.all([
        this.getAllShifts(),
        this.getAllSignups()
      ]);

      // Group signups by ShiftID for efficient lookup
      const signupsByShiftId = allSignups.reduce((acc, signup) => {
        if (!acc[signup.ShiftID]) {
          acc[signup.ShiftID] = [];
        }
        acc[signup.ShiftID].push(signup);
        return acc;
      }, {} as { [key: number]: SignUp[] });

      // Attach signups to each shift
      return shifts.map(shift => ({
        ...shift,
        signups: signupsByShiftId[shift.ShiftID] || []
      }));
    } catch (error) {
      console.error('Error fetching shifts with signups:', error);
      throw error;
    }
  }

  async createShift(shiftData: Omit<VolunteerShift, 'ShiftID' | 'signups'>): Promise<VolunteerShift> {
    try {
      const payload = {
        StartTime: shiftData.StartTime.toISOString(),
        EndTime: shiftData.EndTime.toISOString(),
        Capacity: shiftData.Capacity
      };

      const response = await fetch(this.shiftsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to create shift: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      if (!text) {
        throw new Error('Empty response when creating shift');
      }

      const data = JSON.parse(text);
      const newShift = Array.isArray(data.value) ? data.value[0] : data;
      const parsedShift = this.parseShiftDates(newShift);

      // Send email notification to admins about new shift creation
      try {
        await this.emailService.sendShiftCreationNotification(parsedShift);
      } catch (emailError) {
        console.warn('Failed to send shift creation notification email:', emailError);
        // Don't fail the shift creation if email fails
      }

      return parsedShift;
    } catch (error) {
      console.error('Error creating shift:', error);
      throw error;
    }
  }

  async updateShift(shiftId: number, updates: Partial<Omit<VolunteerShift, 'ShiftID' | 'signups'>>): Promise<VolunteerShift> {
    try {
      const payload: any = {};
      
      if (updates.StartTime) {
        payload.StartTime = updates.StartTime.toISOString();
      }
      if (updates.EndTime) {
        payload.EndTime = updates.EndTime.toISOString();
      }
      if (updates.Capacity !== undefined) {
        payload.Capacity = updates.Capacity;
      }

      const response = await fetch(`${this.shiftsEndpoint}/ShiftID/${shiftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update shift: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const text = await response.text();
      if (!text) {
        throw new Error('Empty response when updating shift');
      }

      const data = JSON.parse(text);
      const updatedShift = Array.isArray(data.value) ? data.value[0] : data;
      return this.parseShiftDates(updatedShift);
    } catch (error) {
      console.error('Error updating shift:', error);
      throw error;
    }
  }

  async deleteShift(shiftId: number): Promise<void> {
    try {
      // First get all signups for this shift
      const allSignups = await this.getAllSignups();
      const shiftSignups = allSignups.filter(signup => signup.ShiftID === shiftId);
      
      // Delete all signups for this shift
      for (const signup of shiftSignups) {
        await this.deleteSignup(signup.SignUpID);
      }

      // Then delete the shift
      const response = await fetch(`${this.shiftsEndpoint}/ShiftID/${shiftId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete shift: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Remove all reminders for this shift
      try {
        this.reminderService.removeRemindersForShift(shiftId);
      } catch (reminderError) {
        console.warn('Failed to remove reminders for deleted shift:', reminderError);
        // Don't fail the shift deletion if reminder cleanup fails
      }
    } catch (error) {
      console.error('Error deleting shift:', error);
      throw error;
    }
  }

  async getShiftById(shiftId: number): Promise<VolunteerShift | null> {
    try {
      // Use filter query format for Data API Builder
      const response = await fetch(`${this.shiftsEndpoint}?$filter=ShiftID eq ${shiftId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch shift: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      if (!text) {
        return null;
      }

      const data = JSON.parse(text);
      const shifts = data.value || [];
      
      if (shifts.length === 0) {
        return null;
      }
      
      return this.parseShiftDates(shifts[0]);
    } catch (error) {
      console.error('Error fetching shift:', error);
      throw error;
    }
  }

  async createSignup(signupData: Omit<SignUp, 'SignUpID'>): Promise<SignUp> {
    try {
      const response = await fetch(this.signupsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create signup: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      if (!text) {
        throw new Error('Empty response when creating signup');
      }

      const data = JSON.parse(text);
      const newSignup = Array.isArray(data.value) ? data.value[0] : data;

      // Get the shift details to include in email notifications
      try {
        const shift = await this.getShiftById(signupData.ShiftID);
        if (shift) {
          // Send confirmation email to volunteer
          try {
            await this.emailService.sendShiftSignupConfirmation(shift, newSignup);
          } catch (emailError) {
            console.warn('Failed to send signup confirmation email:', emailError);
            // Don't fail the signup if email fails
          }

          // Send notification email to admins
          try {
            await this.emailService.sendShiftSignupAdminNotification(shift, newSignup);
          } catch (emailError) {
            console.warn('Failed to send admin notification email:', emailError);
            // Don't fail the signup if email fails
          }

          // Schedule reminder email
          try {
            this.reminderService.scheduleReminderForSignup(shift, newSignup);
          } catch (reminderError) {
            console.warn('Failed to schedule reminder:', reminderError);
            // Don't fail the signup if reminder scheduling fails
          }
        }
      } catch (shiftError) {
        console.warn('Failed to fetch shift for email notifications:', shiftError);
        // Continue even if we can't send emails
      }

      return newSignup;
    } catch (error) {
      console.error('Error creating signup:', error);
      throw error;
    }
  }

  async updateSignup(signupId: number, updates: Partial<Omit<SignUp, 'SignUpID'>>): Promise<SignUp> {
    try {
      const response = await fetch(`${this.signupsEndpoint}/SignUpID/${signupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update signup: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const text = await response.text();
      if (!text) {
        throw new Error('Empty response when updating signup');
      }

      const data = JSON.parse(text);
      return Array.isArray(data.value) ? data.value[0] : data;
    } catch (error) {
      console.error('Error updating signup:', error);
      throw error;
    }
  }

  async deleteSignup(signupId: number): Promise<void> {
    try {
      // First get the signup details for reminder cleanup
      let signupInfo: SignUp | null = null;
      try {
        const allSignups = await this.getAllSignups();
        signupInfo = allSignups.find(s => s.SignUpID === signupId) || null;
      } catch (fetchError) {
        console.warn('Could not fetch signup for reminder cleanup:', fetchError);
      }

      const response = await fetch(`${this.signupsEndpoint}/SignUpID/${signupId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete signup: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Remove reminders for this signup
      if (signupInfo) {
        try {
          this.reminderService.removeRemindersForSignup(signupInfo.ShiftID, signupInfo.Email);
        } catch (reminderError) {
          console.warn('Failed to remove reminders for deleted signup:', reminderError);
          // Don't fail the signup deletion if reminder cleanup fails
        }
      }
    } catch (error) {
      console.error('Error deleting signup:', error);
      throw error;
    }
  }

  getShiftCapacityInfo(shift: VolunteerShift): {
    filledSlots: number;
    remainingCapacity: number;
    percentFilled: number;
    isFull: boolean;
  } {
    const filledSlots = shift.signups?.reduce((total, signup) => total + (signup.NumPeople || 1), 0) || 0;
    const remainingCapacity = shift.Capacity - filledSlots;
    const percentFilled = shift.Capacity > 0 ? (filledSlots / shift.Capacity) * 100 : 0;
    const isFull = filledSlots >= shift.Capacity;

    return { filledSlots, remainingCapacity, percentFilled, isFull };
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
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    if (typeof dateValue === 'string') {
      // Handle different date string formats from the API
      let cleanDateString = dateValue;
      
      // Remove 'Z' suffix if present and add it back to ensure proper UTC parsing
      if (cleanDateString.endsWith('Z')) {
        cleanDateString = cleanDateString.slice(0, -1);
      }
      
      // If the string doesn't include timezone info, treat it as UTC
      if (!cleanDateString.includes('T')) {
        // Handle date-only strings by adding time component
        cleanDateString = cleanDateString + 'T00:00:00';
      }
      
      // Add Z to ensure UTC interpretation
      if (!cleanDateString.endsWith('Z') && !cleanDateString.includes('+') && !cleanDateString.includes('-', 10)) {
        cleanDateString = cleanDateString + 'Z';
      }
      
      const parsedDate = new Date(cleanDateString);
      
      if (isNaN(parsedDate.getTime())) {
        console.error('Invalid date string:', dateValue);
        return new Date();
      }
      
      return parsedDate;
    }
    
    console.error('Unexpected date type:', typeof dateValue, dateValue);
    return new Date();
  }

  private isUpcomingShift = (shift: VolunteerShift): boolean => {
    const now = new Date();
    return shift.StartTime >= now;
  };

  organizeShiftsByWeekend(shifts: VolunteerShift[], weeksToShow: number = 6): Array<{
    weekStartDate: Date;
    days: Array<{ date: Date; shifts: VolunteerShift[] }>;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the next Saturday
    const nextSaturday = new Date(today);
    const daysUntilSaturday = (6 - today.getDay() + 7) % 7;
    nextSaturday.setDate(today.getDate() + daysUntilSaturday);

    const weeks = [];

    for (let week = 0; week < weeksToShow; week++) {
      const saturday = new Date(nextSaturday);
      saturday.setDate(nextSaturday.getDate() + (week * 7));
      
      const sunday = new Date(saturday);
      sunday.setDate(saturday.getDate() + 1);

      const saturdayShifts = shifts.filter(shift => this.isSameDay(shift.StartTime, saturday));
      const sundayShifts = shifts.filter(shift => this.isSameDay(shift.StartTime, sunday));

      weeks.push({
        weekStartDate: new Date(saturday),
        days: [
          { date: new Date(saturday), shifts: saturdayShifts },
          { date: new Date(sunday), shifts: sundayShifts }
        ]
      });
    }

    return weeks;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  }

  formatShiftTime(shift: VolunteerShift): string {
    const startTime = shift.StartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = shift.EndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${startTime} - ${endTime}`;
  }

  formatShiftDate(shift: VolunteerShift): string {
    return shift.StartTime.toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }
}