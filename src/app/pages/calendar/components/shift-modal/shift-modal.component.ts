import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { SignUp, VolunteerShift } from '../../models/volunteer.model';

@Component({
  selector: 'app-shift-modal',
  standalone: true,
  imports: [
    CommonModule, 
    MatButtonModule, 
    MatIconModule, 
    ReactiveFormsModule,
    MatMenuModule,
    FormsModule
  ],
  templateUrl: './shift-modal.component.html',
  styleUrls: ['./shift-modal.component.scss'],
})
export class ShiftModalComponent implements OnChanges {
  @Input() shift!: VolunteerShift;
  @Input() showSignupForm = false;
  @Input() isAdminMode = false;

  @Output() close = new EventEmitter<void>();
  @Output() showSignupFormChange = new EventEmitter<boolean>();
  @Output() submitSignup = new EventEmitter<any>();
  @Output() deleteSignup = new EventEmitter<{signupId: number, shiftId: number}>();
  @Output() updateSignup = new EventEmitter<{signupId: number, shiftId: number, data: Partial<SignUp>}>();
  @Output() deleteShift = new EventEmitter<number>();
  @Output() updateShift = new EventEmitter<{shiftId: number, data: Partial<VolunteerShift>}>();
  
  signupForm: FormGroup;
  formSubmitted = false;

  // Track capacities
  remainingCapacity = 0;
  filledSlots = 0;
  percentFilled = 0;

  editingShift = false;
  editShiftForm: FormGroup;
  editingSignup: number | null = null;
  editSignupForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.signupForm = this.fb.group({
      Name: ['', Validators.required],
      Email: ['', [Validators.required, Validators.email]],
      PhoneNumber: ['', Validators.required],
      NumPeople: [1, [Validators.required, Validators.min(1)]],
    });

    this.editShiftForm = this.fb.group({
      StartTime: ['', Validators.required],
      EndTime: ['', Validators.required],
      Capacity: [1, [Validators.required, Validators.min(1)]],
    });
    
    this.editSignupForm = this.fb.group({
      Name: ['', Validators.required],
      Email: ['', [Validators.required, Validators.email]],
      PhoneNumber: ['', Validators.required],
      NumPeople: [1, [Validators.required, Validators.min(1)]],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['shift'] || changes['showSignupForm']) {
      this.updateCapacityCalculations();
      
      // Update form validators if form is shown
      if (this.showSignupForm) {
        this.updateFormValidators();
      }
    }
  }

  updateCapacityCalculations(): void {
    this.filledSlots = this.getFilledSlots();
    this.remainingCapacity = this.shift.Capacity - this.filledSlots;
    this.percentFilled = (this.filledSlots / this.shift.Capacity) * 100;
  }

  updateFormValidators(): void {
    // Update NumPeople validator to include max value
    this.signupForm.get('NumPeople')?.setValidators([
      Validators.required,
      Validators.min(1),
      Validators.max(this.remainingCapacity)
    ]);
    
    // Set initial value to 1 or remaining capacity (whichever is smaller)
    this.signupForm.get('NumPeople')?.setValue(Math.min(1, this.remainingCapacity));
    this.signupForm.get('NumPeople')?.updateValueAndValidity();
  }

  closeModal(): void {
    this.close.emit();
  }

  toggleSignupForm(show: boolean): void {
    this.showSignupFormChange.emit(show);
    
    if (!show) {
      this.signupForm.reset({ NumPeople: 1 });
      this.formSubmitted = false;
    } else {
      this.updateCapacityCalculations();
      this.updateFormValidators();
    }
  }

  onSubmit(): void {
    this.formSubmitted = true;
    
    if (this.signupForm.valid) {
      this.submitSignup.emit(this.signupForm.value);
    }
  }

  // Validation helpers
  isFieldInvalid(fieldName: string): boolean {
    const field = this.signupForm.get(fieldName);
    return (field?.invalid && (field?.dirty || field?.touched)) || 
           (field?.invalid && this.formSubmitted) || false;
  }

  getErrorMessage(fieldName: string): string {
    const field = this.signupForm.get(fieldName);
    
    if (!field) return '';
    
    if (field.hasError('required')) {
      return 'This field is required';
    }
    
    if (field.hasError('email')) {
      return 'Please enter a valid email address';
    }
    
    if (field.hasError('min')) {
      return `Value must be at least ${field.getError('min').min}`;
    }
    
    if (field.hasError('max')) {
      return `Maximum ${field.getError('max').max} people allowed for this shift`;
    }
    
    return '';
  }

  getRemainingCapacity(): number {
    return this.remainingCapacity;
  }

  getFilledSlots(): number {
    if (!this.shift.signups) return 0;
    return this.shift.signups.reduce(
      (total, signup) => total + (signup.NumPeople || 1),
      0
    );
  }

  isShiftFull(): boolean {
    if (!this.shift.signups) return false;
    return this.getFilledSlots() >= this.shift.Capacity;
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  // Admin methods for shift management
  startEditingShift(): void {
    this.editingShift = true;
    const startDate = new Date(this.shift.StartTime);
    const endDate = new Date(this.shift.EndTime);
    
    this.editShiftForm.setValue({
      StartTime: this.formatDateTimeForInput(startDate),
      EndTime: this.formatDateTimeForInput(endDate),
      Capacity: this.shift.Capacity
    });
  }
  
  cancelEditShift(): void {
    this.editingShift = false;
  }
  
  saveShiftChanges(): void {
    if (this.editShiftForm.invalid) return;
    
    const formData = this.editShiftForm.value;
    const data: Partial<VolunteerShift> = {
      StartTime: formData.StartTime,
      EndTime: formData.EndTime,
      Capacity: formData.Capacity
    };
    
    this.updateShift.emit({ shiftId: this.shift.ShiftID, data });
    this.editingShift = false;
  }
  
  removeShift(): void {
    this.deleteShift.emit(this.shift.ShiftID);
    this.closeModal();
  }
  
  // Admin methods for signup management
  startEditingSignup(signup: SignUp): void {
    this.editingSignup = signup.SignUpID;
    
    this.editSignupForm.setValue({
      Name: signup.Name,
      Email: signup.Email,
      PhoneNumber: signup.PhoneNumber,
      NumPeople: signup.NumPeople
    });
  }
  
  cancelEditSignup(): void {
    this.editingSignup = null;
  }
  
  saveSignupChanges(signupId: number): void {
    if (this.editSignupForm.invalid) return;
    
    this.updateSignup.emit({
      signupId,
      shiftId: this.shift.ShiftID,
      data: this.editSignupForm.value
    });
    
    this.editingSignup = null;
  }
  
  removeSignup(signupId: number): void {
    this.deleteSignup.emit({ signupId, shiftId: this.shift.ShiftID });
  }
  
  // Helper for datetime-local input format
  formatDateTimeForInput(date: Date): string {
    // Format date as YYYY-MM-DDThh:mm
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}
