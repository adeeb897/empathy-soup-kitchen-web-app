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
    // Get password from environment or use default
    this.adminPassword = this.getEnvironmentVariable('ADMIN_PASSWORD', 'admin123');
    
    // Check if we have an auth token in session storage
    this.checkAuthStatus();
    console.log('Admin password is set to:', this.adminPassword);
  }
  
  // Method to safely get environment variables
  private getEnvironmentVariable(key: string, defaultValue: string = ''): string {
    if (typeof window !== 'undefined') {
      // Check if there's a global env object (like window.env)
      const windowWithEnv = window as WindowWithEnv;
      if (windowWithEnv.env && windowWithEnv.env[key]) {
        return windowWithEnv.env[key];
      }

      // Check if there's a global config object (like EMAIL_CONFIG pattern)
      const globalConfig = (window as any).ADMIN_CONFIG;
      if (globalConfig && globalConfig[key]) {
        return globalConfig[key];
      }
    }

    // Check localStorage for development/testing
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(`ADMIN_${key}`);
      if (stored) {
        return stored;
      }
    }

    return defaultValue;
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
