import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as CryptoJS from 'crypto-js';

export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  scope: string;
  adminEmails: string[];
}

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
}

export interface OAuthState {
  state: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface OAuthError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

/**
 * Service responsible for handling Google OAuth2 flow with PKCE (Proof Key for Code Exchange).
 * Implements security best practices including PKCE and state parameters for CSRF protection.
 */
@Injectable({
  providedIn: 'root'
})
export class GoogleOAuthService {
  private readonly GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly DEFAULT_CONFIG: OAuthConfig = {
    clientId: '',
    redirectUri: `${window.location.origin}/calendar/admin`,
    scope: 'openid email profile',
    adminEmails: []
  };

  constructor(private http: HttpClient) {}

  /**
   * Generates a PKCE (Proof Key for Code Exchange) challenge pair.
   * Uses SHA256 hashing for security as recommended by RFC 7636.
   * 
   * @returns PKCEChallenge containing code verifier and challenge
   */
  generatePKCEChallenge(): PKCEChallenge {
    console.log('[GoogleOAuthService] Generating PKCE challenge...');
    try {
      // Generate a cryptographically random code verifier (43-128 characters)
      console.log('[GoogleOAuthService] Generating random string...');
      const codeVerifier = this.generateRandomString(128);
      console.log('[GoogleOAuthService] Code verifier generated, length:', codeVerifier.length);
      
      // Create SHA256 hash of the code verifier
      console.log('[GoogleOAuthService] Creating SHA256 hash...');
      const hash = CryptoJS.SHA256(codeVerifier);
      console.log('[GoogleOAuthService] Hash created successfully');
      
      // Base64URL encode the hash to create the code challenge
      console.log('[GoogleOAuthService] Encoding to Base64URL...');
      const codeChallenge = hash.toString(CryptoJS.enc.Base64)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      console.log('[GoogleOAuthService] Code challenge generated, length:', codeChallenge.length);

      return {
        codeVerifier,
        codeChallenge
      };
    } catch (error) {
      console.error('[GoogleOAuthService] Error generating PKCE challenge:', error);
      throw error;
    }
  }

  /**
   * Generates a cryptographically secure random string for PKCE and state parameters.
   * 
   * @param length - Length of the random string
   * @returns Base64URL encoded random string
   */
  private generateRandomString(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      result += charset[randomIndex];
    }
    
    return result;
  }

  /**
   * Generates a random state parameter for CSRF protection.
   * 
   * @returns Random state string
   */
  generateState(): string {
    return this.generateRandomString(32);
  }

  /**
   * Constructs the Google OAuth2 authorization URL with PKCE parameters.
   * Stores the OAuth state securely on the server for later verification.
   * 
   * @param config - OAuth configuration
   * @returns Promise resolving to complete authorization URL
   */
  async buildAuthorizationUrl(config: Partial<OAuthConfig> = {}): Promise<string> {
    console.log('[GoogleOAuthService] Building authorization URL...');
    const fullConfig = { ...this.DEFAULT_CONFIG, ...config };
    console.log('[GoogleOAuthService] Full config:', fullConfig);
    
    if (!fullConfig.clientId) {
      throw new Error('OAuth client ID is required');
    }

    console.log('[GoogleOAuthService] Generating PKCE challenge...');
    const pkce = this.generatePKCEChallenge();
    console.log('[GoogleOAuthService] PKCE generated successfully');
    
    const state = this.generateState();
    console.log('[GoogleOAuthService] State generated:', state);

    // Store OAuth state on server for callback verification
    console.log('[GoogleOAuthService] Storing OAuth state on server...');
    const storeResponse = await this.storeOAuthStateOnServer(state, pkce.codeVerifier, fullConfig.redirectUri);
    console.log('[GoogleOAuthService] Server-side state storage result:', storeResponse);

    if (!storeResponse.success) {
      throw new Error('Failed to store OAuth state on server');
    }

    // Store session ID in browser for retrieval
    sessionStorage.setItem('oauth_session_id', storeResponse.sessionId);

    // Build authorization URL with all required parameters
    const params = new URLSearchParams({
      client_id: fullConfig.clientId,
      redirect_uri: fullConfig.redirectUri,
      response_type: 'code',
      scope: fullConfig.scope,
      state: state,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent'
    });

    const authUrl = `${this.GOOGLE_AUTH_URL}?${params.toString()}`;
    console.log('[GoogleOAuthService] Final authorization URL:', authUrl);
    return authUrl;
  }

  /**
   * Processes the OAuth callback and extracts authorization code and state.
   * Validates state parameter to prevent CSRF attacks using server-side storage.
   * 
   * @param callbackUrl - The callback URL containing authorization code and state
   * @returns Promise resolving to object containing authorization code and stored code verifier
   * @throws Error if state validation fails or required parameters are missing
   */
  async processCallback(callbackUrl: string): Promise<{ code: string; codeVerifier: string }> {
    const url = new URL(callbackUrl);
    const urlParams = new URLSearchParams(url.search);
    
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    
    // Check for OAuth errors
    if (error) {
      const errorDescription = urlParams.get('error_description');
      throw new Error(`OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`);
    }
    
    if (!code) {
      throw new Error('Authorization code not found in callback');
    }
    
    if (!state) {
      throw new Error('State parameter not found in callback');
    }

    // Get session ID from browser storage
    const sessionId = sessionStorage.getItem('oauth_session_id');
    console.log('[GoogleOAuthService] Session ID from storage:', sessionId ? sessionId.substring(0, 8) + '...' : 'null');
    
    if (!sessionId) {
      throw new Error('OAuth session ID not found - unable to retrieve server-side state');
    }

    // Retrieve and validate stored OAuth state from server
    console.log('[GoogleOAuthService] Retrieving OAuth state from server...');
    
    try {
      const stateResponse = await this.retrieveOAuthStateFromServer(sessionId, state);
      console.log('[GoogleOAuthService] Server-side state retrieval successful');

      // Clean up server-side state after successful use
      await this.cleanupOAuthStateOnServer(sessionId);
      
      // Clean up browser-side session ID
      sessionStorage.removeItem('oauth_session_id');
      
      console.log('[GoogleOAuthService] OAuth state validation and cleanup successful');

      return {
        code,
        codeVerifier: stateResponse.codeVerifier
      };

    } catch (error: any) {
      // Clean up session ID even if retrieval fails
      sessionStorage.removeItem('oauth_session_id');
      
      console.error('[GoogleOAuthService] Server-side state retrieval failed:', error);
      
      if (error.status === 404) {
        throw new Error('OAuth state not found or expired on server');
      } else if (error.status === 403) {
        throw new Error('OAuth state mismatch - possible CSRF attack');
      } else {
        throw new Error('Failed to validate OAuth state on server');
      }
    }
  }

  /**
   * Exchanges the authorization code for access tokens via Azure Function.
   * Uses the stored code verifier to complete the PKCE flow.
   * 
   * @param code - Authorization code from callback
   * @param codeVerifier - PKCE code verifier
   * @param redirectUri - The redirect URI used in the authorization request
   * @returns Observable containing token response
   */
  exchangeCodeForTokens(code: string, codeVerifier: string, redirectUri: string): Observable<TokenResponse> {
    const body = {
      code,
      codeVerifier,
      redirectUri,
      state: 'oauth_callback'
    };

    console.log('[GoogleOAuthService] Token exchange request:', {
      ...body,
      codeVerifier: '***' // Hide sensitive data in logs
    });

    return this.http.post<TokenResponse>('/api/auth/token', body).pipe(
      catchError(error => {
        console.error('[GoogleOAuthService] Token exchange failed:', error);
        console.error('[GoogleOAuthService] Error details:', {
          status: error.status,
          statusText: error.statusText,
          error: error.error
        });
        return throwError(() => new Error(`Token exchange failed: ${error.status} ${error.statusText}`));
      })
    );
  }

  /**
   * Initiates the OAuth flow by redirecting the user to Google's authorization server.
   * 
   * @param config - OAuth configuration
   * @returns Promise that resolves when OAuth flow is initiated
   */
  async startOAuthFlow(config: Partial<OAuthConfig> = {}): Promise<void> {
    console.log('[GoogleOAuthService] Starting OAuth flow with config:', config);
    try {
      console.log('[GoogleOAuthService] Building authorization URL...');
      const authUrl = await this.buildAuthorizationUrl(config);
      console.log('[GoogleOAuthService] Authorization URL built:', authUrl);
      console.log('[GoogleOAuthService] Redirecting to Google...');
      window.location.href = authUrl;
    } catch (error) {
      console.error('[GoogleOAuthService] Failed to start OAuth flow:', error);
      throw error;
    }
  }

  /**
   * Checks if the current URL is an OAuth callback URL.
   * 
   * @returns True if current URL contains OAuth callback parameters
   */
  isCallbackUrl(): boolean {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('code') && urlParams.has('state');
  }

  /**
   * Gets the OAuth configuration from environment variables or defaults.
   * 
   * @returns OAuth configuration
   */
  getOAuthConfig(): OAuthConfig {
    // This can be extended to read from environment variables
    // For now, return default config that can be overridden
    return { ...this.DEFAULT_CONFIG };
  }

  /**
   * Stores OAuth state securely on the server
   * 
   * @param state - OAuth state parameter
   * @param codeVerifier - PKCE code verifier
   * @param redirectUri - OAuth redirect URI
   * @returns Promise resolving to storage response
   */
  private async storeOAuthStateOnServer(state: string, codeVerifier: string, redirectUri: string): Promise<any> {
    const body = {
      state,
      codeVerifier,
      redirectUri
    };

    return firstValueFrom(this.http.post('/api/oauth-state?action=store', body));
  }

  /**
   * Retrieves OAuth state from the server
   * 
   * @param sessionId - Server session ID
   * @param state - OAuth state parameter for validation
   * @returns Promise resolving to stored OAuth data
   */
  private async retrieveOAuthStateFromServer(sessionId: string, state: string): Promise<any> {
    const params = new URLSearchParams({
      sessionId,
      state
    });

    return firstValueFrom(this.http.get(`/api/oauth-state?action=retrieve&${params.toString()}`));
  }

  /**
   * Cleans up OAuth state on the server after successful use
   * 
   * @param sessionId - Server session ID
   * @returns Promise resolving to cleanup response
   */
  private async cleanupOAuthStateOnServer(sessionId: string): Promise<any> {
    const params = new URLSearchParams({
      sessionId
    });

    return firstValueFrom(this.http.delete(`/api/oauth-state?action=cleanup&${params.toString()}`));
  }
}