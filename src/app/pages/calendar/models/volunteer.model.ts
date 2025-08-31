export interface VolunteerShift {
  ShiftID: number;
  StartTime: Date;
  EndTime: Date;
  Capacity: number;
  signups: SignUp[];
}

export interface SignUp {
  SignUpID: number;
  ShiftID: number;
  Name: string;
  Email: string;
  PhoneNumber: string;
  NumPeople: number;
}

export interface CreateShiftData {
  StartTime: Date;
  EndTime: Date;
  Capacity: number;
}

export interface CreateSignupData {
  ShiftID: number;
  Name: string;
  Email: string;
  PhoneNumber: string;
  NumPeople: number;
}

export interface ShiftCapacityInfo {
  filledSlots: number;
  remainingCapacity: number;
  percentFilled: number;
  isFull: boolean;
}

export interface CalendarDay {
  date: Date;
  shifts: VolunteerShift[];
}

export interface CalendarWeek {
  weekStartDate: Date;
  days: CalendarDay[];
}

export enum ShiftStatus {
  AVAILABLE = 'AVAILABLE',
  NEARLY_FULL = 'NEARLY_FULL',
  FULL = 'FULL'
}

export class VolunteerShiftValidator {
  static validateShiftData(data: CreateShiftData): string[] {
    const errors: string[] = [];
    
    if (!data.StartTime || isNaN(data.StartTime.getTime())) {
      errors.push('Valid start time is required');
    }
    
    if (!data.EndTime || isNaN(data.EndTime.getTime())) {
      errors.push('Valid end time is required');
    }
    
    if (data.StartTime && data.EndTime && data.StartTime >= data.EndTime) {
      errors.push('End time must be after start time');
    }
    
    if (!data.Capacity || data.Capacity < 1) {
      errors.push('Capacity must be at least 1');
    }
    
    if (data.Capacity > 100) {
      errors.push('Capacity cannot exceed 100');
    }
    
    return errors;
  }
  
  static validateSignupData(data: CreateSignupData, remainingCapacity: number): string[] {
    const errors: string[] = [];
    
    if (!data.Name?.trim()) {
      errors.push('Name is required');
    }
    
    if (data.Name && data.Name.length > 100) {
      errors.push('Name cannot exceed 100 characters');
    }
    
    if (!data.Email?.trim()) {
      errors.push('Email is required');
    }
    
    if (data.Email && !this.isValidEmail(data.Email)) {
      errors.push('Please enter a valid email address');
    }
    
    if (!data.PhoneNumber?.trim()) {
      errors.push('Phone number is required');
    }
    
    if (data.PhoneNumber && !this.isValidPhoneNumber(data.PhoneNumber)) {
      errors.push('Please enter a valid phone number');
    }
    
    if (!data.NumPeople || data.NumPeople < 1) {
      errors.push('Number of people must be at least 1');
    }
    
    if (data.NumPeople > remainingCapacity) {
      errors.push(`Only ${remainingCapacity} spots remaining for this shift`);
    }
    
    if (data.NumPeople > 10) {
      errors.push('Cannot sign up more than 10 people at once');
    }
    
    return errors;
  }
  
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  private static isValidPhoneNumber(phone: string): boolean {
    // Allow various phone number formats
    const phoneRegex = /^[\+]?[1-9][\d\s\-\(\)]{7,14}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }
}

export class ShiftHelper {
  static getShiftStatus(shift: VolunteerShift): ShiftStatus {
    const filledSlots = shift.signups?.reduce((total, signup) => total + (signup.NumPeople || 1), 0) || 0;
    const percentFilled = (filledSlots / shift.Capacity) * 100;
    
    if (percentFilled >= 100) {
      return ShiftStatus.FULL;
    } else if (percentFilled >= 80) {
      return ShiftStatus.NEARLY_FULL;
    }
    
    return ShiftStatus.AVAILABLE;
  }
  
  static isShiftInPast(shift: VolunteerShift): boolean {
    const now = new Date();
    return shift.EndTime < now;
  }
  
  static canSignUpForShift(shift: VolunteerShift, numPeople: number): boolean {
    const filledSlots = shift.signups?.reduce((total, signup) => total + (signup.NumPeople || 1), 0) || 0;
    const remainingCapacity = shift.Capacity - filledSlots;
    return remainingCapacity >= numPeople && !this.isShiftInPast(shift);
  }
  
  static formatShiftDuration(shift: VolunteerShift): string {
    const durationMs = shift.EndTime.getTime() - shift.StartTime.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (minutes === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    
    return `${hours}h ${minutes}m`;
  }
}
