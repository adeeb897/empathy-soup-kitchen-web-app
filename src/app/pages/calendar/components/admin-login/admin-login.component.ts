import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { AdminAuthService } from '../../services/admin-auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    FormsModule
  ],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.scss']
})
export class AdminLoginComponent {
  @Output() loginCancelled = new EventEmitter<void>();
  
  password = '';
  showPassword = false;
  error = '';
  
  constructor(private authService: AdminAuthService) {}
  
  login(): void {
    if (!this.password) {
      this.error = 'Password is required';
      return;
    }
    
    const isValid = this.authService.login(this.password);
    
    if (isValid) {
      // Close the modal on success
      this.loginCancelled.emit();
    } else {
      this.error = 'Invalid password';
      this.password = '';
    }
  }
  
  cancel(): void {
    this.loginCancelled.emit();
  }
  
  toggleShowPassword(): void {
    this.showPassword = !this.showPassword;
  }
}
