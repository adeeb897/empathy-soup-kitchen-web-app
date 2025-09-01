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
  ) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    // First, check if this is a callback from OAuth
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code') && urlParams.has('state')) {
      // Handle OAuth callback
      return this.adminOAuthService.handleCallback().pipe(
        map(success => {
          if (success) {
            // Clean up URL parameters after successful callback
            this.router.navigate(['/calendar/admin'], { replaceUrl: true });
            return true;
          } else {
            this.redirectToLogin();
            return false;
          }
        }),
        catchError(() => {
          this.redirectToLogin();
          return of(false);
        }),
        take(1)
      );
    }

    // Check if user is already authenticated
    return this.adminOAuthService.isAuthenticated$.pipe(
      map(isAuthenticated => {
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
    // Redirect to calendar page with a flag to show login modal
    this.router.navigate(['/calendar'], { queryParams: { adminLogin: 'true' } });
  }
}