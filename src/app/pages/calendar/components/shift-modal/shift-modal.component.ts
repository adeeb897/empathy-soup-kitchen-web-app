import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { VolunteerShift } from '../../models/volunteer.model';

@Component({
  selector: 'app-shift-modal',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, ReactiveFormsModule],
  templateUrl: './shift-modal.component.html',
  styleUrls: ['./shift-modal.component.scss'],
})
export class ShiftModalComponent {
  @Input() shift!: VolunteerShift;
  @Input() showSignupForm = false;

  @Output() close = new EventEmitter<void>();
  @Output() showSignupFormChange = new EventEmitter<boolean>();
  @Output() submitSignup = new EventEmitter<any>();

  signupForm: FormGroup;
  formSubmitted = false;

  constructor(private fb: FormBuilder) {
    this.signupForm = this.fb.group({
      Name: ['', Validators.required],
      Email: ['', [Validators.required, Validators.email]],
      PhoneNumber: ['', Validators.required],
      NumPeople: [1, [Validators.required, Validators.min(1)]],
    });
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
      // Calculate remaining capacity
      const remainingCapacity = this.shift.Capacity - this.getFilledSlots();
      
      // Update NumPeople validator to include max value
      this.signupForm.get('NumPeople')?.setValidators([
        Validators.required,
        Validators.min(1),
        Validators.max(remainingCapacity)
      ]);
      
      // Set initial value to 1 or remaining capacity (whichever is smaller)
      this.signupForm.get('NumPeople')?.setValue(Math.min(1, remainingCapacity));

      this.signupForm.get('NumPeople')?.updateValueAndValidity();
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
    return this.shift.Capacity - this.getFilledSlots();
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
}
