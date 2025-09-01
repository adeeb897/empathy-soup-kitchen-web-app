import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { AdminAuthService } from '../services/admin-auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-login-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>Admin Login</h2>
    <div mat-dialog-content>
      <p>Enter the admin password to access the shift administration panel.</p>
      
      <form [formGroup]="loginForm" (ngSubmit)="login()">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Admin Password</mat-label>
          <input 
            matInput 
            type="password" 
            formControlName="password" 
            [class.error]="hasError"
            (keydown.enter)="login()"
            #passwordInput>
          <mat-icon matSuffix>lock</mat-icon>
        </mat-form-field>
        
        <div class="error-message" *ngIf="hasError">
          <mat-icon color="warn">error</mat-icon>
          <span>Invalid password. Please try again.</span>
        </div>
      </form>
    </div>
    
    <div mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
      <button 
        mat-raised-button 
        color="primary" 
        [disabled]="loginForm.invalid || isLogging"
        (click)="login()">
        <mat-icon *ngIf="isLogging">hourglass_empty</mat-icon>
        {{ isLogging ? 'Logging in...' : 'Login' }}
      </button>
    </div>
  `,
  styles: [`
    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }
    
    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #f44336;
      font-size: 14px;
      margin-bottom: 16px;
    }
    
    .error-message mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    
    input.error {
      border-color: #f44336;
    }
    
    mat-dialog-content {
      min-width: 400px;
      padding: 20px 24px;
    }
    
    mat-dialog-actions {
      padding: 16px 24px;
    }
  `]
})
export class AdminLoginDialogComponent {
  loginForm: FormGroup;
  hasError = false;
  isLogging = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AdminLoginDialogComponent>,
    private adminAuthService: AdminAuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      password: ['', [Validators.required]]
    });
  }

  login() {
    if (this.loginForm.invalid) return;

    this.isLogging = true;
    this.hasError = false;

    const password = this.loginForm.get('password')?.value;
    
    // Simulate a brief delay for better UX
    setTimeout(() => {
      const success = this.adminAuthService.login(password);
      
      if (success) {
        this.dialogRef.close(true);
        this.router.navigate(['/calendar/admin']);
      } else {
        this.hasError = true;
        this.loginForm.get('password')?.setValue('');
      }
      
      this.isLogging = false;
    }, 500);
  }

  cancel() {
    this.dialogRef.close(false);
  }
}