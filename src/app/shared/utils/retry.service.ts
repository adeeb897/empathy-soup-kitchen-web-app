import { Injectable } from '@angular/core';

export interface RetryConfig {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  retryCondition?: (error: any) => boolean;
}

/**
 * HTTP statuses worth retrying for a read. 503 is what the API returns while
 * the serverless database resumes from auto-pause.
 */
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524]);

/**
 * Statuses that are safe to retry for a write. A 503 from our API is raised
 * before the request ever reaches SQL, so retrying cannot duplicate a signup;
 * a 500 or a gateway timeout might arrive after the row was already inserted.
 */
const RETRYABLE_STATUSES_FOR_WRITES = new Set([503]);

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable({
  providedIn: 'root'
})
export class RetryService {

  private defaultConfig: Required<Omit<RetryConfig, 'retryCondition'>> = {
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 8000,
    backoffMultiplier: 2,
    jitter: true
  };

  /**
   * Retries an arbitrary async operation with exponential backoff.
   * By default every thrown error is retried; pass `retryCondition` to narrow it.
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = {}
  ): Promise<T> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const shouldRetry = config.retryCondition ?? (() => true);
    let lastError: any;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!shouldRetry(error) || attempt === finalConfig.maxAttempts) {
          throw error;
        }

        const delay = this.calculateDelay(attempt, finalConfig);
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * fetch() with retries for transient failures.
   *
   * `fetch` only rejects on network errors — an HTTP 500 or 503 resolves
   * normally — so status codes are inspected explicitly here. The response of
   * the final attempt is returned as-is so callers keep checking `response.ok`.
   */
  async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    config: RetryConfig = {}
  ): Promise<Response> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const method = (options.method ?? 'GET').toUpperCase();
    const retryableStatuses = IDEMPOTENT_METHODS.has(method)
      ? RETRYABLE_STATUSES
      : RETRYABLE_STATUSES_FOR_WRITES;

    let lastError: any;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      const isLastAttempt = attempt === finalConfig.maxAttempts;

      try {
        const response = await fetch(url, options);

        if (response.ok || !retryableStatuses.has(response.status) || isLastAttempt) {
          return response;
        }

        const delay = this.retryAfterDelay(response) ?? this.calculateDelay(attempt, finalConfig);
        console.warn(`Request to ${url} returned ${response.status}, retrying in ${delay}ms`);
        await this.sleep(delay);
      } catch (error) {
        // Network-level failure: no response was received.
        lastError = error;

        if (isLastAttempt) {
          throw error;
        }

        const delay = this.calculateDelay(attempt, finalConfig);
        console.warn(`Request to ${url} failed, retrying in ${delay}ms:`, error);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /** Honours a server-provided Retry-After header (seconds), capped at maxDelay. */
  private retryAfterDelay(response: Response): number | null {
    const header = response.headers?.get?.('Retry-After');
    if (!header) return null;

    const seconds = Number(header);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;

    return Math.min(seconds * 1000, this.defaultConfig.maxDelay);
  }

  private calculateDelay(attempt: number, config: Required<Omit<RetryConfig, 'retryCondition'>>): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, config.maxDelay);

    if (config.jitter) {
      const jitterRange = delay * 0.25;
      delay = Math.max(0, delay + (Math.random() - 0.5) * 2 * jitterRange);
    }

    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
