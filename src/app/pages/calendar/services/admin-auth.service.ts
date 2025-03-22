import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

// Add interface for the window environment
interface WindowWithEnv extends Window {
  env?: {
    [key: string]: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AdminAuthService {
  // Get admin password from window.env
  private adminPassword: string;
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  
  constructor() {
    // Get password from window.env or use default
    this.adminPassword = this.getEnvironmentVariable('ADMIN_PASSWORD') || 'admin123';
    
    // Check if we have an auth token in session storage
    this.checkAuthStatus();
    console.log('Admin password is set to:', this.adminPassword);
  }
  
  // Method to safely get environment variables from window.env
  private getEnvironmentVariable(key: string): string | null {
    // Cast window to our custom interface with env property
    const windowWithEnv = window as WindowWithEnv;
    
    if (typeof window !== 'undefined' && 
        windowWithEnv.env && 
        windowWithEnv.env[key]) {
      return windowWithEnv.env[key];
    }
    return null;
  }
  
  checkAuthStatus(): void {
    const isAuth = sessionStorage.getItem('calendar_admin_authenticated') === 'true';
    this.isAuthenticatedSubject.next(isAuth);
  }
  
  login(password: string): boolean {
    console.log('Login attempt with password:', password);
    console.log('Expected password:', this.adminPassword);
    
    // Compare as strings to ensure exact matching
    const isValid = String(password) === String(this.adminPassword);
    console.log('Password valid:', isValid);
    
    if (isValid) {
      sessionStorage.setItem('calendar_admin_authenticated', 'true');
      this.isAuthenticatedSubject.next(true);
    }
    
    return isValid;
  }
  
  logout(): void {
    sessionStorage.removeItem('calendar_admin_authenticated');
    this.isAuthenticatedSubject.next(false);
  }
  
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }
}
