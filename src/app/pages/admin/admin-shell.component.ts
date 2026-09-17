import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AdminAuthService, AuthState } from '../calendar/services/admin-auth.service';
import { ToastService } from '../../shared/services/toast.service';
import { takeMagicLinkToken } from '../../shared/utils/magic-link-token';

/**
 * Admin shell: owns sign-in and the tab chrome, and renders the active
 * section through <router-outlet>. Each section is its own lazily-loaded
 * component, so adding one does not grow this file.
 *
 * This shell is the only gate on the admin UI — the <router-outlet> is
 * inside the authenticated branch, so no section can render without a
 * session. A CanActivate guard on the children would be redundant and, with
 * the default '' -> 'shifts' redirect, would bounce between /admin and
 * /admin/shifts forever. The real security boundary is the API, which
 * checks the session token on every privileged endpoint.
 */
@Component({
    selector: 'app-admin-shell',
    imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive],
    templateUrl: './admin-shell.component.html',
    styleUrl: './admin-shell.component.scss'
})
export class AdminShellComponent implements OnInit {
  authState: AuthState = { isAuthenticated: false, isLoading: true, user: null, error: null };

  // Login form
  loginEmail = '';
  linkSent = false;
  linkMessage = '';

  readonly tabs = [
    { path: 'shifts', label: 'Shifts', icon: 'event' },
    { path: 'pledges', label: 'Pledges', icon: 'volunteer_activism' },
    { path: 'settings', label: 'Site Text', icon: 'edit_note' },
  ];

  constructor(
    private authService: AdminAuthService,
    private toastService: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // The token is stashed before the router runs (see main.ts), so it
    // survives the /volunteer/admin -> /admin redirect that older emails hit.
    const token = takeMagicLinkToken();
    if (token) {
      this.authService.verifyToken(token).then((success) => {
        if (success) {
          this.toastService.success('Signed in successfully');
        } else {
          this.toastService.error('That sign-in link is invalid or has expired.');
        }
      });
    }

    this.authService.authState$.subscribe((state) => {
      this.authState = state;
    });
  }

  async sendLoginLink(): Promise<void> {
    if (!this.loginEmail) {
      this.toastService.error('Please enter your email');
      return;
    }

    const result = await this.authService.sendMagicLink(this.loginEmail);
    this.linkSent = true;
    this.linkMessage = result.message;

    if (result.success) {
      this.toastService.success('Check your email for a login link');
    } else {
      this.toastService.error(result.message);
    }
  }

  logout(): void {
    this.authService.logout();
    this.linkSent = false;
    this.loginEmail = '';
    this.router.navigate(['/admin']);
  }
}
