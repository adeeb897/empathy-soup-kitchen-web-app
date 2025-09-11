import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AdminOAuthService } from '../services/admin-oauth.service';
import { Observable, of } from 'rxjs';
import { map, catchError, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AdminAuthGuard implements CanActivate {
  constructor(
    private adminOAuthService: AdminOAuthService,
    private router: Router
  ) {
    console.log('[AdminAuthGuard] Guard initialized');
  }

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    console.log('[AdminAuthGuard] canActivate called for route:', route);
    console.log('[AdminAuthGuard] Current URL:', window.location.href);
    
    // First, check if this is a callback from OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const hasCode = urlParams.has('code');
    const hasState = urlParams.has('state');
    console.log('[AdminAuthGuard] OAuth callback check - code:', hasCode, 'state:', hasState);
    
    if (hasCode && hasState) {
      console.log('[AdminAuthGuard] Handling OAuth callback');
      // Handle OAuth callback
      return this.adminOAuthService.handleCallback().pipe(
        map(success => {
          console.log('[AdminAuthGuard] Callback result:', success);
          if (success) {
            // Clean up URL parameters after successful callback
            this.router.navigate(['/calendar/admin'], { replaceUrl: true });
            return true;
          } else {
            this.redirectToLogin();
            return false;
          }
        }),
        catchError((error) => {
          console.error('[AdminAuthGuard] Callback error:', error);
          this.redirectToLogin();
          return of(false);
        }),
        take(1)
      );
    }

    // Check if user is already authenticated
    console.log('[AdminAuthGuard] Checking authentication status');
    return this.adminOAuthService.isAuthenticated$.pipe(
      map(isAuthenticated => {
        console.log('[AdminAuthGuard] Authentication status:', isAuthenticated);
        if (isAuthenticated) {
          return true;
        } else {
          this.redirectToLogin();
          return false;
        }
      }),
      take(1)
    );
  }

  private redirectToLogin(): void {
    console.log('[AdminAuthGuard] Redirecting to login');
    // Redirect to calendar page with a flag to show login modal
    this.router.navigate(['/calendar'], { queryParams: { adminLogin: 'true' } });
  }
}