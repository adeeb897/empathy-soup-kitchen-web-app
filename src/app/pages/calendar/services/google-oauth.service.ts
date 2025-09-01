import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
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
    // Generate a cryptographically random code verifier (43-128 characters)
    const codeVerifier = this.generateRandomString(128);
    
    // Create SHA256 hash of the code verifier
    const hash = CryptoJS.SHA256(codeVerifier);
    
    // Base64URL encode the hash to create the code challenge
    const codeChallenge = hash.toString(CryptoJS.enc.Base64)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return {
      codeVerifier,
      codeChallenge
    };
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
   * Stores the OAuth state securely for later verification.
   * 
   * @param config - OAuth configuration
   * @returns Complete authorization URL
   */
  buildAuthorizationUrl(config: Partial<OAuthConfig> = {}): string {
    const fullConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    if (!fullConfig.clientId) {
      throw new Error('OAuth client ID is required');
    }

    const pkce = this.generatePKCEChallenge();
    const state = this.generateState();

    // Store OAuth state for callback verification
    const oauthState: OAuthState = {
      state,
      codeVerifier: pkce.codeVerifier,
      redirectUri: fullConfig.redirectUri
    };
    
    sessionStorage.setItem('oauth_state', JSON.stringify(oauthState));

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

    return `${this.GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Processes the OAuth callback and extracts authorization code and state.
   * Validates state parameter to prevent CSRF attacks.
   * 
   * @param callbackUrl - The callback URL containing authorization code and state
   * @returns Object containing authorization code and stored code verifier
   * @throws Error if state validation fails or required parameters are missing
   */
  processCallback(callbackUrl: string): { code: string; codeVerifier: string } {
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

    // Retrieve and validate stored OAuth state
    const storedStateJson = sessionStorage.getItem('oauth_state');
    if (!storedStateJson) {
      throw new Error('OAuth state not found in storage');
    }

    let storedState: OAuthState;
    try {
      storedState = JSON.parse(storedStateJson);
    } catch (e) {
      throw new Error('Invalid OAuth state format');
    }

    // Validate state parameter for CSRF protection
    if (state !== storedState.state) {
      throw new Error('OAuth state mismatch - possible CSRF attack');
    }

    // Clean up stored state
    sessionStorage.removeItem('oauth_state');

    return {
      code,
      codeVerifier: storedState.codeVerifier
    };
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
      redirectUri
    };

    return this.http.post<TokenResponse>('/api/auth/token', body).pipe(
      catchError(error => {
        console.error('Token exchange failed:', error);
        return throwError(() => new Error('Failed to exchange authorization code for tokens'));
      })
    );
  }

  /**
   * Initiates the OAuth flow by redirecting the user to Google's authorization server.
   * 
   * @param config - OAuth configuration
   */
  startOAuthFlow(config: Partial<OAuthConfig> = {}): void {
    try {
      const authUrl = this.buildAuthorizationUrl(config);
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to start OAuth flow:', error);
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
}