import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RetryService } from '../../shared/utils/retry.service';

type State = 'confirm' | 'cancelling' | 'done' | 'error' | 'missing';

/**
 * Landing page for the "Cancel this shift" link in a volunteer's email.
 *
 * The token in the URL is what authorises the cancellation — it names one
 * signup and is signed server-side, so it cannot be used for anyone else's.
 * Nothing is cancelled until the volunteer confirms, because mail scanners
 * and link previewers follow URLs on their own.
 */
@Component({
  selector: 'app-cancel-signup',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cancel-signup.component.html',
  styleUrl: './cancel-signup.component.scss',
})
export class CancelSignupComponent implements OnInit {
  state: State = 'confirm';
  errorMessage = '';
  private token = '';

  constructor(private retryService: RetryService) {}

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    this.token = params.get('t') ?? params.get('token') ?? '';
    if (!this.token) {
      this.state = 'missing';
    }
  }

  async cancel(): Promise<void> {
    if (!this.token || this.state === 'cancelling') return;

    this.state = 'cancelling';
    this.errorMessage = '';

    try {
      // The signup id lives inside the signed token; the server reads it
      // there rather than trusting anything in the URL path.
      const response = await this.retryService.fetchWithRetry(
        `/api/signups?t=${encodeURIComponent(this.token)}`,
        { method: 'DELETE' }
      );

      if (response.ok || response.status === 204) {
        this.state = 'done';
        return;
      }

      const body = await response.json().catch(() => null);
      this.errorMessage =
        body?.error || 'That cancellation link is no longer valid.';
      this.state = 'error';
    } catch (e) {
      this.errorMessage = 'Something went wrong. Please try again.';
      this.state = 'error';
      console.error('Cancellation failed:', e);
    }
  }
}
