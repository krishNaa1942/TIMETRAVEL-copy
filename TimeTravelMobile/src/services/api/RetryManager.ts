/**
 * 🔄 RETRY MANAGER
 * Intelligent retry with circuit breaker pattern
 * 
 * Features:
 * - Exponential backoff + jitter
 * - Circuit breaker (stops requests when backend failing)
 * - Retry budget (limits total retries)
 * - Only retries idempotent requests
 */

import { CircuitBreakerState, RetryConfig } from './types';

// ─────────────────────────────────────────────────────────────
// DEFAULT CONFIGURATION
// ─────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,          // 1 second
  maxDelay: 30000,          // 30 seconds
  retryableStatuses: [
    408, // Request Timeout
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
  ],
};

// Circuit breaker configuration
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,          // Open after 5 failures
  resetTimeout: 30000,          // Try again after 30s
  halfOpenMaxAttempts: 3,       // Max attempts in half-open state
};

// ─────────────────────────────────────────────────────────────
// RETRY MANAGER CLASS
// ─────────────────────────────────────────────────────────────
class RetryManager {
  private config: RetryConfig;
  private circuitBreaker: CircuitBreakerState = {
    status: 'CLOSED',
    failureCount: 0,
    lastFailureTime: 0,
    nextAttemptTime: 0,
  };
  private retryBudget = 10; // Max retries per minute
  private retryBudgetReset = Date.now() + 60000;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate delay with exponential backoff + jitter
   */
  calculateDelay(attempt: number): number {
    const baseDelay = Math.min(
      this.config.baseDelay * Math.pow(2, attempt),
      this.config.maxDelay
    );
    // Add jitter (±20%) to prevent thundering herd
    const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
    return Math.floor(baseDelay + jitter);
  }

  /**
   * Check if error is retryable
   */
  isRetryable(status: number, method: string): boolean {
    // Only retry GET, HEAD, OPTIONS, and idempotent PUT/DELETE
    const isIdempotent = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'].includes(method.toUpperCase());
    if (!isIdempotent) return false;

    return this.config.retryableStatuses.includes(status);
  }

  /**
   * Check if network error is retryable
   */
  isNetworkRetryable(error: Error): boolean {
    const retryableCodes = ['ECONNABORTED', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'];
    return retryableCodes.some(code => error.message.includes(code));
  }

  /**
   * Check circuit breaker state
   */
  canMakeRequest(): boolean {
    const now = Date.now();

    // Check retry budget
    if (now > this.retryBudgetReset) {
      this.retryBudget = 10;
      this.retryBudgetReset = now + 60000;
    }

    if (this.retryBudget <= 0) {
      this.log('Retry budget exhausted');
      return false;
    }

    switch (this.circuitBreaker.status) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        if (now >= this.circuitBreaker.nextAttemptTime) {
          this.circuitBreaker.status = 'HALF_OPEN';
          this.log('Circuit breaker -> HALF_OPEN');
          return true;
        }
        this.log('Circuit breaker OPEN, rejecting request');
        return false;

      case 'HALF_OPEN':
        return true;

      default:
        return true;
    }
  }

  /**
   * Record successful request (resets circuit breaker)
   */
  recordSuccess(): void {
    if (this.circuitBreaker.status === 'HALF_OPEN') {
      this.circuitBreaker.status = 'CLOSED';
      this.circuitBreaker.failureCount = 0;
      this.log('Circuit breaker -> CLOSED (success)');
    }
    this.circuitBreaker.failureCount = 0;
  }

  /**
   * Record failed request (updates circuit breaker)
   */
  recordFailure(): void {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();
    this.retryBudget--;

    if (this.circuitBreaker.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      this.circuitBreaker.status = 'OPEN';
      this.circuitBreaker.nextAttemptTime = Date.now() + CIRCUIT_BREAKER_CONFIG.resetTimeout;
      this.log('Circuit breaker -> OPEN (too many failures)');
    }
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }

  /**
   * Sleep utility
   */
  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    method: string,
    shouldSkipRetry: boolean = false
  ): Promise<T> {
    if (shouldSkipRetry) {
      return operation();
    }

    const maxAttempts = this.config.maxRetries + 1;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Check circuit breaker
      if (!this.canMakeRequest()) {
        throw new Error('Circuit breaker is open - too many recent failures');
      }

      try {
        const result = await operation();
        this.recordSuccess();
        return result;
      } catch (error: any) {
        lastError = error;

        // Check if we should retry
        const status = error?.response?.status || 0;
        const isRetryable = this.isRetryable(status, method) || 
          (status === 0 && this.isNetworkRetryable(error));

        if (!isRetryable || attempt === this.config.maxRetries) {
          throw error;
        }

        this.recordFailure();
        const delay = this.calculateDelay(attempt);
        this.log(`Retry attempt ${attempt + 1}/${this.config.maxRetries} in ${delay}ms`);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Reset circuit breaker (for manual recovery)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker = {
      status: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
    };
    this.retryBudget = 10;
    this.log('Circuit breaker manually reset');
  }

  // ─────────────────────────────────────────────────────────────
  // LOGGING
  // ─────────────────────────────────────────────────────────────

  private log(message: string, data?: unknown): void {
    if (__DEV__) {
      console.log(`🔄 [RetryManager] ${message}`, data ?? '');
    }
  }
}

// ─────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────
export const retryManager = new RetryManager();
export default retryManager;