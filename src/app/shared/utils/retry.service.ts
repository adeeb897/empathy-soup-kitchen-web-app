import { Injectable } from '@angular/core';

export interface RetryConfig {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  retryCondition?: (error: any) => boolean;
}

interface RetryableError extends Error {
  status?: number;
  code?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RetryService {
  
  private defaultConfig: Required<RetryConfig> = {
    maxAttempts: 4,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryCondition: this.defaultRetryCondition
  };

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = {}
  ): Promise<T> {
    const finalConfig = { ...this.defaultConfig, ...config };
    let lastError: any;
    
    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.log("Caught error on attempt", attempt, ":", error);
        
        // Check if we should retry this error
        if (!finalConfig.retryCondition(error)) {
          throw error;
        }
        
        // If this is the last attempt, don't wait - just throw
        if (attempt === finalConfig.maxAttempts) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, finalConfig);
        
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error);
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  async fetchWithRetry(
    url: string, 
    options: RequestInit = {}, 
    config: RetryConfig = {}
  ): Promise<Response> {
    return this.executeWithRetry(
      () => fetch(url, options),
      {
        ...config,
        retryCondition: (error) => this.shouldRetryFetchError(error)
      }
    );
  }

  private defaultRetryCondition(error: RetryableError): boolean {
    return this.shouldRetryFetchError(error);
  }

  private shouldRetryFetchError(error: RetryableError): boolean {
    // Don't retry if we're getting HTML responses (indicates API server is down)
    // This prevents infinite retries when the Data API Builder isn't running
    if (error.message?.toLowerCase().includes('invalid json response')) {
      console.warn('Received HTML response instead of JSON - API server may be down');
      return false; // Don't retry HTML responses
    }
    
    // Network errors (no response)
    if (!error.status && (
      error.message?.includes('fetch') ||
      error.message?.includes('network') ||
      error.message?.includes('timeout') ||
      error.message?.includes('connection')
    )) {
      return true;
    }
    
    // HTTP status codes that indicate temporary issues
    if (error.status) {
      const retryableStatusCodes = [
        408, // Request Timeout
        429, // Too Many Requests
        500, // Internal Server Error
        502, // Bad Gateway
        503, // Service Unavailable
        504, // Gateway Timeout
        520, // Web Server Returned an Unknown Error
        521, // Web Server Is Down
        522, // Connection Timed Out
        523, // Origin Is Unreachable
        524  // A Timeout Occurred
      ];
      
      return retryableStatusCodes.includes(error.status);
    }
    
    // Database connection errors
    if (error.message?.toLowerCase().includes('database') ||
        error.message?.toLowerCase().includes('connection') ||
        error.message?.toLowerCase().includes('timeout')) {
      return true;
    }
    
    // Other JSON parsing errors (but not HTML responses)
    if (error.message?.toLowerCase().includes('json') ||
        error.message?.toLowerCase().includes('unexpected character')) {
      return true;
    }
    
    return false;
  }

  private calculateDelay(attempt: number, config: Required<RetryConfig>): number {
    // Calculate exponential backoff delay
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Cap at maximum delay
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (config.jitter) {
      // Add random jitter of ±25%
      const jitterRange = delay * 0.25;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay = Math.max(0, delay + jitter);
    }
    
    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}