import { Injectable } from '@angular/core';

export type WarmupState = 'unknown' | 'warming' | 'ready' | 'unavailable';

/**
 * Wakes the volunteer database before the data is actually needed.
 *
 * The database runs on Azure SQL serverless and auto-pauses when idle, so the
 * first request after a quiet spell waits 30-90 seconds for it to resume.
 * Nothing can make that resume faster, but it can be started earlier: hovering
 * or tapping a link to the volunteer page kicks it off while the visitor is
 * still reading the page they are on.
 *
 * `/api/warmup` returns immediately with the current state instead of holding
 * the request open, because Static Web Apps drops any API call that runs longer
 * than 45 seconds.
 */
@Injectable({ providedIn: 'root' })
export class ApiWarmupService {
  private readonly endpoint = '/api/warmup';
  private readonly pollIntervalMs = 3000;
  private readonly maxWaitMs = 150000;

  /** Current state of the database, for progress UI and diagnostics. */
  state: WarmupState = 'unknown';

  private ready = false;
  private inFlight: Promise<boolean> | null = null;

  /** Fire-and-forget wake-up, for hover/tap on links into the volunteer flow. */
  prewarm(): void {
    void this.ensureReady().catch(() => undefined);
  }

  /**
   * Resolves true once the database is serving queries, false if it never came
   * up within the wait budget. Concurrent callers share a single poll loop.
   */
  ensureReady(): Promise<boolean> {
    if (this.ready) return Promise.resolve(true);

    if (!this.inFlight) {
      this.inFlight = this.pollUntilReady().finally(() => {
        this.inFlight = null;
      });
    }

    return this.inFlight;
  }

  private async pollUntilReady(): Promise<boolean> {
    const deadline = Date.now() + this.maxWaitMs;

    while (Date.now() < deadline) {
      switch (await this.probe()) {
        case 'ready':
          this.ready = true;
          this.state = 'ready';
          return true;
        case 'warming':
          this.state = 'warming';
          break;
      }

      await this.sleep(this.pollIntervalMs);
    }

    this.state = 'unavailable';
    return false;
  }

  private async probe(): Promise<'ready' | 'warming'> {
    try {
      const response = await fetch(this.endpoint, { cache: 'no-store' });

      // An older deployment may not have the warmup route at all — in that case
      // there is nothing to wait for, so let the caller fetch data directly.
      if (response.status === 404 || response.status === 405) return 'ready';

      if (!response.ok) return 'warming';

      const body = await response.json().catch(() => null);
      return !body || body.ready ? 'ready' : 'warming';
    } catch {
      return 'warming';
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
