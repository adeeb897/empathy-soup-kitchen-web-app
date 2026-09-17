import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AdminUser {
  email: string;
  name: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AdminUser | null;
  error: string | null;
}

const STORAGE_KEY = 'esk_admin_session';

interface StoredSession {
  sessionToken: string;
  email: string;
  name: string;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private state = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
  });

  authState$ = this.state.asObservable();

  constructor() {
    this.restoreSession();
  }

  private restoreSession(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.setState({ isAuthenticated: false, isLoading: false, user: null, error: null });
        return;
      }

      const session: StoredSession = JSON.parse(raw);
      if (Date.now() > session.expiresAt) {
        localStorage.removeItem(STORAGE_KEY);
        this.setState({ isAuthenticated: false, isLoading: false, user: null, error: null });
        return;
      }

      this.setState({
        isAuthenticated: true,
        isLoading: false,
        user: { email: session.email, name: session.name },
        error: null,
      });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      this.setState({ isAuthenticated: false, isLoading: false, user: null, error: null });
    }
  }

  async sendMagicLink(email: string): Promise<{ success: boolean; message: string }> {
    this.setState({ ...this.state.value, isLoading: true, error: null });

    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      this.setState({ ...this.state.value, isLoading: false });

      if (!res.ok) {
        return { success: false, message: data.error || 'Failed to send login link' };
      }

      return { success: true, message: data.message };
    } catch {
      this.setState({ ...this.state.value, isLoading: false });
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  async verifyToken(token: string): Promise<boolean> {
    this.setState({ isAuthenticated: false, isLoading: true, user: null, error: null });

    try {
      const res = await fetch('/api/auth/verify-magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        this.setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: data.error || 'Invalid or expired link',
        });
        return false;
      }

      const session: StoredSession = {
        sessionToken: data.sessionToken,
        email: data.email,
        name: data.name,
        expiresAt: data.expiresAt,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));

      this.setState({
        isAuthenticated: true,
        isLoading: false,
        user: { email: data.email, name: data.name },
        error: null,
      });
      return true;
    } catch {
      this.setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: 'Verification failed. Please try again.',
      });
      return false;
    }
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.setState({ isAuthenticated: false, isLoading: false, user: null, error: null });
  }

  isAuthenticated(): boolean {
    return this.state.value.isAuthenticated;
  }

  /**
   * The current session token, or null when signed out or expired.
   * Single reader of the stored session — callers must not parse it themselves.
   */
  getSessionToken(): string | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const session: StoredSession = JSON.parse(raw);
      if (!session?.sessionToken || Date.now() > session.expiresAt) {
        return null;
      }
      return session.sessionToken;
    } catch {
      return null;
    }
  }

  /**
   * Auth headers for admin API calls, or {} when not signed in — safe to
   * spread into any request, including public ones.
   *
   * X-Admin-Token is the one the API relies on. Azure Static Web Apps treats
   * Authorization as its own header, so a request can arrive at the function
   * carrying a different value than the browser sent, which the API then
   * rejects as an invalid token. Authorization is still sent so anything
   * calling the API directly keeps working.
   */
  authHeaders(): Record<string, string> {
    const token = this.getSessionToken();
    if (!token) return {};
    return {
      'X-Admin-Token': token,
      Authorization: `Bearer ${token}`,
    };
  }

  private setState(s: AuthState): void {
    this.state.next(s);
  }
}
