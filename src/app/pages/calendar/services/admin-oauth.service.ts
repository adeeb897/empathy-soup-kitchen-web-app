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
    console.log('[AdminOAuthService] Service initialized');
    // Initialize authentication state on service creation
    this.initializeAuthState();
  }

  /**
   * Initializes the authentication state by checking for existing tokens
   * and handling OAuth callbacks if present.
   */
  private initializeAuthState(): void {
    console.log('[AdminOAuthService] Initializing auth state...');
    console.log('[AdminOAuthService] Current URL:', window.location.href);
    
    // Check if we're returning from OAuth callback
    const isCallback = this.googleOAuthService.isCallbackUrl();
    console.log('[AdminOAuthService] Is callback URL:', isCallback);
    
    if (isCallback) {
      console.log('[AdminOAuthService] Handling OAuth callback');
      this.handleOAuthCallback();
      return;
    }

    // Check if we have existing valid tokens
    const hasToken = this.tokenService.hasValidToken();
    console.log('[AdminOAuthService] Has valid token:', hasToken);
    
    if (hasToken) {
      console.log('[AdminOAuthService] Validating existing token');
      this.validateExistingToken();
      return;
    }

    // No existing authentication
    console.log('[AdminOAuthService] No authentication found, setting unauthenticated state');
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
  private async handleOAuthCallback(): Promise<void> {
    this.updateAuthState({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      error: null
    });

    try {
      // Process callback asynchronously with server-side state
      const callbackData = await this.googleOAuthService.processCallback(window.location.href);
      const config = this.getOAuthConfig();
      
      this.googleOAuthService.exchangeCodeForTokens(callbackData.code, callbackData.codeVerifier, config.redirectUri)
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
    console.log('[AdminOAuthService] Starting token validation...');
    this.updateAuthState({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      error: null
    });

    this.tokenService.validateToken().subscribe({
      next: (validationResponse) => {
        console.log('[AdminOAuthService] Token validation successful:', validationResponse);
        this.handleSuccessfulAuthentication(validationResponse);
      },
      error: (error) => {
        console.error('[AdminOAuthService] Token validation failed:', error);
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
    console.log('[AdminOAuthService] State change:', {
      from: this.authStateSubject.value,
      to: newState
    });
    this.authStateSubject.next(newState);
  }

  /**
   * Initiates the OAuth login flow by redirecting to Google's authorization server.
   * 
   * @returns Observable that completes when login flow starts
   */
  login(): Observable<LoginResult> {
    console.log('[AdminOAuthService] Starting login process...');
    return new Observable(observer => {
      try {
        console.log('[AdminOAuthService] Setting loading state...');
        this.updateAuthState({
          isAuthenticated: false,
          isLoading: true,
          user: null,
          error: null
        });

        console.log('[AdminOAuthService] Getting OAuth config...');
        const config = this.getOAuthConfig();
        console.log('[AdminOAuthService] OAuth config:', config);
        
        if (!config.clientId) {
          throw new Error('OAuth client ID not configured');
        }

        if (config.clientId === 'debug-client-id') {
          throw new Error('Debug client ID detected - OAuth cannot proceed without real credentials');
        }

        console.log('[AdminOAuthService] Starting OAuth flow with GoogleOAuthService...');
        // Start OAuth flow - this will redirect the user
        this.googleOAuthService.startOAuthFlow(config).then(() => {
          console.log('[AdminOAuthService] OAuth flow initiated, should redirect soon...');
          // The observer completes here as we're redirecting
          observer.next({ success: true });
          observer.complete();
        }).catch((error) => {
          console.error('[AdminOAuthService] Failed to start OAuth flow:', error);
          const errorMessage = error.message || 'Failed to start login';
          this.handleAuthenticationError(errorMessage);
          
          observer.next({ 
            success: false, 
            error: errorMessage 
          });
          observer.complete();
        });
        
      } catch (error: any) {
        console.error('[AdminOAuthService] Login error:', error);
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

        // Process callback asynchronously with server-side state
        const callbackPromise = this.googleOAuthService.processCallback(window.location.href);
        
        callbackPromise.then(({ code, codeVerifier }) => {
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
        }).catch((error) => {
          this.handleAuthenticationError(error.message || 'Invalid OAuth callback');
          observer.next(false);
          observer.complete();
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
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0);

    return {
      clientId,
      redirectUri: `${window.location.origin}/calendar/admin`,
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
    console.log('[AdminOAuthService] Getting environment variable:', key);
    
    if (typeof window !== 'undefined') {
      // Check if there's a global env object (like window.env)
      const windowWithEnv = window as WindowWithEnv;
      console.log('[AdminOAuthService] window.env:', windowWithEnv.env);
      
      if (windowWithEnv.env && windowWithEnv.env[key]) {
        console.log('[AdminOAuthService] Found in window.env:', key, '=', windowWithEnv.env[key]);
        return windowWithEnv.env[key];
      }

      // Check if there's a global config object
      const globalConfig = (window as any).OAUTH_CONFIG;
      console.log('[AdminOAuthService] window.OAUTH_CONFIG:', globalConfig);
      
      if (globalConfig && globalConfig[key]) {
        console.log('[AdminOAuthService] Found in OAUTH_CONFIG:', key, '=', globalConfig[key]);
        return globalConfig[key];
      }
    }

    // Check localStorage for development/testing
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(`OAUTH_${key}`);
      if (stored) {
        console.log('[AdminOAuthService] Found in localStorage:', key, '=', stored);
        return stored;
      }
    }

    console.log('[AdminOAuthService] Using default value for', key, '=', defaultValue);
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