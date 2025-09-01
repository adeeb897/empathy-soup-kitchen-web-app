import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError, combineLatest } from 'rxjs';
import { catchError, switchMap, tap, map } from 'rxjs/operators';
import { GoogleOAuthService, OAuthConfig } from './google-oauth.service';
import { TokenService, TokenValidationResponse } from './token.service';

export interface AdminUser {
  email: string;
  name: string;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AdminUser | null;
  error: string | null;
}

export interface LoginResult {
  success: boolean;
  user?: AdminUser;
  error?: string;
}

// Add interface for the window environment
interface WindowWithEnv extends Window {
  env?: {
    [key: string]: string;
  };
}

/**
 * Service responsible for orchestrating the complete OAuth authentication flow.
 * Replaces the existing AdminAuthService with OAuth2-based authentication.
 * Manages authentication state, user validation, and admin access control.
 */
@Injectable({
  providedIn: 'root'
})
export class AdminOAuthService {
  private authStateSubject = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    error: null
  });

  // Public observable for components to subscribe to
  public authState$ = this.authStateSubject.asObservable();
  
  // Convenience observables
  public isAuthenticated$ = this.authState$.pipe(map(state => state.isAuthenticated));
  public isLoading$ = this.authState$.pipe(map(state => state.isLoading));
  public user$ = this.authState$.pipe(map(state => state.user));
  public error$ = this.authState$.pipe(map(state => state.error));

  constructor(
    private googleOAuthService: GoogleOAuthService,
    private tokenService: TokenService
  ) {
    // Initialize authentication state on service creation
    this.initializeAuthState();
  }

  /**
   * Initializes the authentication state by checking for existing tokens
   * and handling OAuth callbacks if present.
   */
  private initializeAuthState(): void {
    // Check if we're returning from OAuth callback
    if (this.googleOAuthService.isCallbackUrl()) {
      this.handleOAuthCallback();
      return;
    }

    // Check if we have existing valid tokens
    if (this.tokenService.hasValidToken()) {
      this.validateExistingToken();
      return;
    }

    // No existing authentication
    this.updateAuthState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null
    });
  }

  /**
   * Handles OAuth callback processing after user returns from Google.
   * Processes the authorization code and exchanges it for tokens.
   */
  private handleOAuthCallback(): void {
    this.updateAuthState({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      error: null
    });

    try {
      const { code, codeVerifier } = this.googleOAuthService.processCallback(window.location.href);
      const config = this.getOAuthConfig();
      
      this.googleOAuthService.exchangeCodeForTokens(code, codeVerifier, config.redirectUri)
        .pipe(
          switchMap(tokenResponse => {
            // Store tokens
            this.tokenService.storeTokens(
              tokenResponse.access_token,
              tokenResponse.refresh_token,
              tokenResponse.expires_in,
              tokenResponse.token_type,
              tokenResponse.scope
            );
            
            // Validate the token and check admin status
            return this.tokenService.validateToken();
          }),
          catchError(error => {
            console.error('OAuth callback processing failed:', error);
            return throwError(() => new Error('Authentication failed'));
          })
        )
        .subscribe({
          next: (validationResponse) => {
            this.handleSuccessfulAuthentication(validationResponse);
            // Clean up URL by removing OAuth parameters
            this.cleanupCallbackUrl();
          },
          error: (error) => {
            this.handleAuthenticationError(error.message || 'Authentication failed');
          }
        });

    } catch (error: any) {
      this.handleAuthenticationError(error.message || 'Invalid OAuth callback');
    }
  }

  /**
   * Validates existing tokens on service initialization.
   */
  private validateExistingToken(): void {
    this.updateAuthState({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      error: null
    });

    this.tokenService.validateToken().subscribe({
      next: (validationResponse) => {
        this.handleSuccessfulAuthentication(validationResponse);
      },
      error: (error) => {
        console.error('Token validation failed:', error);
        this.tokenService.clearTokens();
        this.updateAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: null
        });
      }
    });
  }

  /**
   * Handles successful authentication by updating state with user information.
   * 
   * @param validationResponse - Token validation response from server
   */
  private handleSuccessfulAuthentication(validationResponse: TokenValidationResponse): void {
    if (!validationResponse.valid || !validationResponse.isAdmin) {
      this.handleAuthenticationError('Access denied - Admin privileges required');
      return;
    }

    const user: AdminUser = {
      email: validationResponse.email || '',
      name: validationResponse.name || '',
      isAuthenticated: true,
      isAdmin: validationResponse.isAdmin || false
    };

    this.updateAuthState({
      isAuthenticated: true,
      isLoading: false,
      user,
      error: null
    });

    console.log('Authentication successful:', user);
  }

  /**
   * Handles authentication errors by updating state and clearing tokens.
   * 
   * @param errorMessage - Error message to display
   */
  private handleAuthenticationError(errorMessage: string): void {
    this.tokenService.clearTokens();
    this.updateAuthState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: errorMessage
    });

    console.error('Authentication error:', errorMessage);
  }

  /**
   * Updates the authentication state and notifies subscribers.
   * 
   * @param newState - New authentication state
   */
  private updateAuthState(newState: AuthState): void {
    this.authStateSubject.next(newState);
  }

  /**
   * Initiates the OAuth login flow by redirecting to Google's authorization server.
   * 
   * @returns Observable that completes when login flow starts
   */
  login(): Observable<LoginResult> {
    return new Observable(observer => {
      try {
        this.updateAuthState({
          isAuthenticated: false,
          isLoading: true,
          user: null,
          error: null
        });

        const config = this.getOAuthConfig();
        
        if (!config.clientId) {
          throw new Error('OAuth client ID not configured');
        }

        // Start OAuth flow - this will redirect the user
        this.googleOAuthService.startOAuthFlow(config);
        
        // The observer completes here as we're redirecting
        observer.next({ success: true });
        observer.complete();
        
      } catch (error: any) {
        const errorMessage = error.message || 'Failed to start login';
        this.handleAuthenticationError(errorMessage);
        
        observer.next({ 
          success: false, 
          error: errorMessage 
        });
        observer.complete();
      }
    });
  }

  /**
   * Logs out the user by revoking tokens and clearing authentication state.
   * 
   * @returns Observable that completes when logout is finished
   */
  logout(): Observable<void> {
    this.updateAuthState({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      error: null
    });

    return this.tokenService.logout().pipe(
      tap(() => {
        this.updateAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: null
        });
        console.log('Logout successful');
      }),
      map(() => void 0),
      catchError(error => {
        console.error('Logout error:', error);
        // Still clear local state even if server logout failed
        this.updateAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: null
        });
        return [void 0];
      })
    );
  }

  /**
   * Checks if the current user is authenticated.
   * 
   * @returns True if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.authStateSubject.value.isAuthenticated;
  }

  /**
   * Gets the current authenticated user.
   * 
   * @returns Current user or null if not authenticated
   */
  getCurrentUser(): AdminUser | null {
    return this.authStateSubject.value.user;
  }

  /**
   * Checks the current authentication status without making network requests.
   * 
   * @returns Current authentication state
   */
  getAuthState(): AuthState {
    return this.authStateSubject.value;
  }

  /**
   * Forces a refresh of the authentication state by validating current tokens.
   * 
   * @returns Observable that completes when refresh is finished
   */
  refreshAuthState(): Observable<void> {
    if (!this.tokenService.hasValidToken()) {
      return throwError(() => new Error('No valid token available'));
    }

    this.updateAuthState({
      ...this.authStateSubject.value,
      isLoading: true,
      error: null
    });

    return this.tokenService.validateToken().pipe(
      tap(validationResponse => {
        this.handleSuccessfulAuthentication(validationResponse);
      }),
      map(() => void 0),
      catchError(error => {
        this.handleAuthenticationError('Token validation failed');
        return throwError(() => error);
      })
    );
  }

  /**
   * Public method to handle OAuth callback processing.
   * Used by the AdminAuthGuard to process callbacks.
   * 
   * @returns Observable that completes when callback processing is finished
   */
  handleCallback(): Observable<boolean> {
    return new Observable(observer => {
      try {
        // Set loading state
        this.updateAuthState({
          isAuthenticated: false,
          isLoading: true,
          user: null,
          error: null
        });

        const { code, codeVerifier } = this.googleOAuthService.processCallback(window.location.href);
        const config = this.getOAuthConfig();
        
        this.googleOAuthService.exchangeCodeForTokens(code, codeVerifier, config.redirectUri)
          .pipe(
            switchMap(tokenResponse => {
              // Store tokens
              this.tokenService.storeTokens(
                tokenResponse.access_token,
                tokenResponse.refresh_token,
                tokenResponse.expires_in,
                tokenResponse.token_type,
                tokenResponse.scope
              );
              
              // Validate the token and check admin status
              return this.tokenService.validateToken();
            }),
            catchError(error => {
              console.error('OAuth callback processing failed:', error);
              observer.next(false);
              observer.complete();
              return throwError(() => new Error('Authentication failed'));
            })
          )
          .subscribe({
            next: (validationResponse) => {
              this.handleSuccessfulAuthentication(validationResponse);
              observer.next(true);
              observer.complete();
            },
            error: (error) => {
              this.handleAuthenticationError(error.message || 'Authentication failed');
              observer.next(false);
              observer.complete();
            }
          });

      } catch (error: any) {
        this.handleAuthenticationError(error.message || 'Invalid OAuth callback');
        observer.next(false);
        observer.complete();
      }
    });
  }

  /**
   * Gets the OAuth configuration from environment variables with fallbacks.
   * 
   * @returns OAuth configuration
   */
  private getOAuthConfig(): OAuthConfig {
    const clientId = this.getEnvironmentVariable('GOOGLE_OAUTH_CLIENT_ID', '');
    const adminEmails = this.getEnvironmentVariable('ADMIN_EMAILS', '')
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    return {
      clientId,
      redirectUri: `${window.location.origin}/calendar/auth/callback`,
      scope: 'openid email profile',
      adminEmails
    };
  }

  /**
   * Safely gets environment variables with fallbacks.
   * Reuses the same pattern as the existing AdminAuthService.
   * 
   * @param key - Environment variable key
   * @param defaultValue - Default value if not found
   * @returns Environment variable value or default
   */
  private getEnvironmentVariable(key: string, defaultValue: string = ''): string {
    if (typeof window !== 'undefined') {
      // Check if there's a global env object (like window.env)
      const windowWithEnv = window as WindowWithEnv;
      if (windowWithEnv.env && windowWithEnv.env[key]) {
        return windowWithEnv.env[key];
      }

      // Check if there's a global config object
      const globalConfig = (window as any).OAUTH_CONFIG;
      if (globalConfig && globalConfig[key]) {
        return globalConfig[key];
      }
    }

    // Check localStorage for development/testing
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(`OAUTH_${key}`);
      if (stored) {
        return stored;
      }
    }

    return defaultValue;
  }

  /**
   * Cleans up the URL by removing OAuth callback parameters.
   */
  private cleanupCallbackUrl(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('scope');
    
    // Use replaceState to avoid adding to browser history
    window.history.replaceState({}, document.title, url.pathname + url.search);
  }

  /**
   * Clears any authentication errors from the state.
   */
  clearError(): void {
    const currentState = this.authStateSubject.value;
    if (currentState.error) {
      this.updateAuthState({
        ...currentState,
        error: null
      });
    }
  }
}