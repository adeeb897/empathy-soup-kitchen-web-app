import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminOAuthService } from '../services/admin-oauth.service';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-admin-login-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <h2 mat-dialog-title>Admin Login</h2>
    <div mat-dialog-content>
      <div class="login-content">
        <p class="login-description">
          Sign in with your Google account to access the admin panel. 
          Only authorized administrators can access this area.
        </p>
        
        <div class="google-login-container" *ngIf="!isLoading">
          <button 
            mat-raised-button 
            color="primary" 
            class="google-signin-btn"
            [disabled]="isLoading"
            (click)="loginWithGoogle()">
            <mat-icon class="google-icon">account_circle</mat-icon>
            Sign in with Google
          </button>
        </div>
        
        <div class="loading-container" *ngIf="isLoading">
          <mat-spinner diameter="40"></mat-spinner>
          <p class="loading-text">{{ loadingMessage }}</p>
        </div>
        
        <div class="error-message" *ngIf="hasError">
          <mat-icon color="warn">error</mat-icon>
          <span>{{ errorMessage }}</span>
        </div>
      </div>
    </div>
    
    <div mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
    </div>
  `,
  styles: [`
    .login-content {
      min-width: 400px;
      text-align: center;
      padding: 20px 0;
    }
    
    .login-description {
      color: #666;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    
    .google-login-container {
      margin: 24px 0;
    }
    
    .google-signin-btn {
      min-width: 200px;
      height: 48px;
      font-size: 16px;
      font-weight: 500;
    }
    
    .google-icon {
      margin-right: 8px;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      margin: 24px 0;
    }
    
    .loading-text {
      color: #666;
      font-size: 14px;
      margin: 0;
    }
    
    .error-message {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #f44336;
      font-size: 14px;
      margin: 16px 0;
      padding: 12px;
      background-color: #ffeef0;
      border-radius: 4px;
      border: 1px solid #ffcdd2;
    }
    
    .error-message mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    
    mat-dialog-content {
      padding: 20px 24px;
    }
    
    mat-dialog-actions {
      padding: 16px 24px;
    }
  `]
})
export class AdminLoginDialogComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  
  isLoading = false;
  hasError = false;
  errorMessage = '';
  loadingMessage = 'Redirecting to Google...';

  constructor(
    private dialogRef: MatDialogRef<AdminLoginDialogComponent>,
    private adminOAuthService: AdminOAuthService,
    private router: Router
  ) {
    // Subscribe to authentication state changes
    this.adminOAuthService.isAuthenticated$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isAuthenticated => {
        if (isAuthenticated) {
          this.dialogRef.close(true);
          this.router.navigate(['/calendar/admin']);
        }
      });

    // Subscribe to authentication errors to reset UI state
    this.adminOAuthService.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        if (error) {
          console.log('[AdminLoginDialog] Authentication error received:', error);
          this.isLoading = false;
          this.hasError = true;
          this.errorMessage = error;
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loginWithGoogle() {
    console.log('[AdminLoginDialog] loginWithGoogle called');
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';
    this.loadingMessage = 'Redirecting to Google...';

    try {
      console.log('[AdminLoginDialog] Calling adminOAuthService.login()...');
      // Initiate OAuth login - this will redirect to Google
      this.adminOAuthService.login().subscribe({
        next: (result) => {
          console.log('[AdminLoginDialog] Login result:', result);
          if (!result.success) {
            this.isLoading = false;
            this.hasError = true;
            this.errorMessage = result.error || 'Login failed';
          }
          // If successful, we should be redirected to Google
        },
        error: (error) => {
          console.error('[AdminLoginDialog] Login error:', error);
          this.isLoading = false;
          this.hasError = true;
          this.errorMessage = error.message || 'Failed to start authentication process';
        }
      });
    } catch (error) {
      console.error('[AdminLoginDialog] Exception in loginWithGoogle:', error);
      this.isLoading = false;
      this.hasError = true;
      this.errorMessage = error instanceof Error ? error.message : 'Failed to start authentication process';
    }
  }

  cancel() {
    this.dialogRef.close(false);
  }
}