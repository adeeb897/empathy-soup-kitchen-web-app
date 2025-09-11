import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, timer } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  scope: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface TokenValidationResponse {
  valid: boolean;
  email?: string;
  name?: string;
  picture?: string;
  isAdmin?: boolean;
}

export interface AdminValidationResponse {
  success: boolean;
  isAdmin: boolean;
  user?: {
    email: string;
    name: string;
    picture: string;
  };
  permissions?: {
    canManageShifts: boolean;
    canViewReports: boolean;
    canManageVolunteers: boolean;
  };
}

/**
 * Service responsible for secure token management including storage, refresh, and validation.
 * Stores tokens in memory only for enhanced security and handles automatic token refresh.
 */
@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private tokenData: TokenData | null = null;
  private refreshTimer: any = null;
  private isRefreshing = false;
  
  // Observable to track token availability
  private tokenSubject = new BehaviorSubject<boolean>(false);
  public hasValidToken$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Stores tokens in memory with automatic refresh scheduling.
   * Calculates expiration time and sets up auto-refresh timer.
   * 
   * @param accessToken - OAuth access token
   * @param refreshToken - OAuth refresh token  
   * @param expiresIn - Token lifetime in seconds
   * @param tokenType - Type of token (usually 'Bearer')
   * @param scope - Token scope permissions
   */
  storeTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    tokenType: string = 'Bearer',
    scope: string = ''
  ): void {
    // Calculate actual expiration time (subtract 5 minutes for buffer)
    const expiresAt = Date.now() + ((expiresIn - 300) * 1000);
    
    this.tokenData = {
      accessToken,
      refreshToken,
      expiresAt,
      tokenType,
      scope
    };

    // Schedule automatic token refresh
    this.scheduleTokenRefresh();
    
    // Notify subscribers that token is available
    this.tokenSubject.next(true);

    console.log('Tokens stored successfully, expires at:', new Date(expiresAt));
  }

  /**
   * Retrieves the current access token if valid.
   * 
   * @returns Current access token or null if expired/unavailable
   */
  getAccessToken(): string | null {
    if (!this.tokenData) {
      return null;
    }

    // Check if token is still valid
    if (Date.now() >= this.tokenData.expiresAt) {
      console.warn('Access token has expired');
      return null;
    }

    return this.tokenData.accessToken;
  }

  /**
   * Gets the full authorization header value for HTTP requests.
   * 
   * @returns Authorization header value or null if no valid token
   */
  getAuthorizationHeader(): string | null {
    const accessToken = this.getAccessToken();
    if (!accessToken || !this.tokenData) {
      return null;
    }

    return `${this.tokenData.tokenType} ${accessToken}`;
  }

  /**
   * Checks if we currently have a valid access token.
   * 
   * @returns True if valid token exists
   */
  hasValidToken(): boolean {
    return this.getAccessToken() !== null;
  }

  /**
   * Gets the refresh token for token renewal.
   * 
   * @returns Refresh token or null if not available
   */
  getRefreshToken(): string | null {
    return this.tokenData?.refreshToken || null;
  }

  /**
   * Refreshes the access token using the refresh token via Azure Function.
   * Automatically stores the new tokens and reschedules refresh.
   * 
   * @returns Observable containing new token data
   */
  refreshAccessToken(): Observable<RefreshTokenResponse> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    if (this.isRefreshing) {
      return throwError(() => new Error('Token refresh already in progress'));
    }

    this.isRefreshing = true;

    const body = {
      refreshToken
    };

    return this.http.post<RefreshTokenResponse>('/api/auth/refresh', body).pipe(
      switchMap(response => {
        // Store the new tokens
        this.storeTokens(
          response.access_token,
          refreshToken, // Keep existing refresh token
          response.expires_in,
          response.token_type,
          response.scope
        );
        
        this.isRefreshing = false;
        console.log('Token refreshed successfully');
        
        return [response];
      }),
      catchError(error => {
        this.isRefreshing = false;
        console.error('Token refresh failed:', error);
        
        // Clear tokens on refresh failure
        this.clearTokens();
        
        return throwError(() => new Error('Failed to refresh access token'));
      })
    );
  }

  /**
   * Validates the current access token and gets user info via Azure Function.
   * 
   * @returns Observable containing token validation response
   */
  validateToken(): Observable<TokenValidationResponse> {
    const accessToken = this.getAccessToken();
    
    if (!accessToken) {
      return throwError(() => new Error('No access token available'));
    }

    return this.http.post<AdminValidationResponse>('/api/auth/validate-admin', {
      accessToken
    }).pipe(
      switchMap(response => {
        // Transform AdminValidationResponse to TokenValidationResponse
        const validationResponse: TokenValidationResponse = {
          valid: response.success && response.isAdmin,
          email: response.user?.email,
          name: response.user?.name,
          picture: response.user?.picture,
          isAdmin: response.isAdmin
        };
        return [validationResponse];
      }),
      catchError(error => {
        console.error('Token validation failed:', error);
        
        // Handle specific error responses that might still have isAdmin info
        if (error.error && typeof error.error === 'object') {
          const errorResponse = error.error;
          if ('isAdmin' in errorResponse) {
            const validationResponse: TokenValidationResponse = {
              valid: false,
              isAdmin: errorResponse.isAdmin || false
            };
            return [validationResponse];
          }
        }
        
        return throwError(() => new Error('Failed to validate token'));
      })
    );
  }

  /**
   * Schedules automatic token refresh before expiration.
   * Refreshes the token 5 minutes before it expires.
   */
  private scheduleTokenRefresh(): void {
    // Clear any existing refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.tokenData) {
      return;
    }

    // Calculate time until refresh (5 minutes before expiration)
    const refreshTime = this.tokenData.expiresAt - Date.now();
    
    if (refreshTime <= 0) {
      // Token is already expired, attempt immediate refresh
      this.refreshAccessToken().subscribe({
        error: (error) => console.error('Automatic token refresh failed:', error)
      });
      return;
    }

    // Schedule refresh
    this.refreshTimer = setTimeout(() => {
      this.refreshAccessToken().subscribe({
        error: (error) => {
          console.error('Scheduled token refresh failed:', error);
          // Clear tokens on refresh failure
          this.clearTokens();
        }
      });
    }, refreshTime);

    console.log('Token refresh scheduled for:', new Date(this.tokenData.expiresAt));
  }

  /**
   * Revokes tokens on the server and clears local storage via Azure Function.
   * 
   * @returns Observable indicating logout success
   */
  logout(): Observable<any> {
    const refreshToken = this.getRefreshToken();
    
    // Clear local tokens immediately
    this.clearTokens();

    // If we have a refresh token, revoke it on the server
    if (refreshToken) {
      const body = { refreshToken };
      
      return this.http.post('/api/auth/logout', body).pipe(
        catchError(error => {
          console.error('Server logout failed:', error);
          // Don't throw error since local tokens are already cleared
          return [{ success: false }];
        })
      );
    }

    // Return success if no server-side logout needed
    return new Observable(observer => {
      observer.next({ success: true });
      observer.complete();
    });
  }

  /**
   * Clears all stored tokens and cancels refresh timers.
   * Does not make server requests - use logout() for complete logout.
   */
  clearTokens(): void {
    this.tokenData = null;
    
    // Clear refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.isRefreshing = false;
    
    // Notify subscribers that token is no longer available
    this.tokenSubject.next(false);

    console.log('Tokens cleared from memory');
  }

  /**
   * Gets token expiration information.
   * 
   * @returns Object with expiration details or null if no token
   */
  getTokenExpiration(): { expiresAt: number; isExpired: boolean; timeUntilExpiry: number } | null {
    if (!this.tokenData) {
      return null;
    }

    const now = Date.now();
    return {
      expiresAt: this.tokenData.expiresAt,
      isExpired: now >= this.tokenData.expiresAt,
      timeUntilExpiry: this.tokenData.expiresAt - now
    };
  }

  /**
   * Forces an immediate token refresh if a refresh token is available.
   * Useful for testing or when token validation fails.
   * 
   * @returns Observable containing refresh result
   */
  forceRefresh(): Observable<RefreshTokenResponse> {
    return this.refreshAccessToken();
  }
}