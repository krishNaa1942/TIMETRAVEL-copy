/**
 * 🔌 CIRCUIT BREAKER
 * Prevents cascade failures with three states: CLOSED, OPEN, HALF_OPEN
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: All requests blocked, waiting for cooldown
 * - HALF_OPEN: Limited requests allowed to test recovery
 */

import { CircuitState, CircuitBreakerConfig, CircuitBreakerStats } from './types';

// ─────────────────────────────────────────────────────────────
// DEFAULT CONFIGURATION
// ─────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,        // Open after 5 failures
  successThreshold: 3,        // Close after 3 successes in half-open
  openDuration: 30000,        // 30 seconds cooldown
  halfOpenMaxRequests: 1,     // Only 1 test request in half-open
};

// ─────────────────────────────────────────────────────────────
// CIRCUIT BREAKER CLASS
// ─────────────────────────────────────────────────────────────
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private lastStateChange = Date.now();
  private halfOpenRequests = 0;
  
  // Stats
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;

  private readonly config: CircuitBreakerConfig;
  private readonly name: string;

  constructor(name: string = 'default', config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if requests are allowed
   */
  canRequest(): boolean {
    this.totalRequests++;

    switch (this.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        // Check if cooldown period has passed
        if (this.shouldAttemptReset()) {
          this.transitionTo('HALF_OPEN');
          return true;
        }
        return false;

      case 'HALF_OPEN':
        // Only allow limited requests
        return this.halfOpenRequests < this.config.halfOpenMaxRequests;

      default:
        return false;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.totalSuccesses++;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      this.halfOpenRequests = Math.max(0, this.halfOpenRequests - 1);

      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // Any failure in half-open -> back to open
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED') {
      this.failureCount++;

      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionTo('OPEN');
      }
    }
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canRequest()) {
      throw new CircuitBreakerError(
        `Circuit breaker [${this.name}] is OPEN`,
        this.getStats()
      );
    }

    if (this.state === 'HALF_OPEN') {
      this.halfOpenRequests++;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Force reset the circuit breaker
   */
  reset(): void {
    this.transitionTo('CLOSED');
  }

  /**
   * Force open the circuit breaker
   */
  trip(): void {
    this.transitionTo('OPEN');
  }

  /**
   * Get current stats
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if should attempt reset from OPEN to HALF_OPEN
   */
  private shouldAttemptReset(): boolean {
    if (this.lastFailureTime === null) return false;
    return Date.now() - this.lastFailureTime >= this.config.openDuration;
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    // Reset counters on transition
    if (newState === 'CLOSED') {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (newState === 'HALF_OPEN') {
      this.successCount = 0;
      this.halfOpenRequests = 0;
    } else if (newState === 'OPEN') {
      this.halfOpenRequests = 0;
    }

    this.log(`State transition: ${oldState} → ${newState}`);
  }

  private log(message: string): void {
    if (__DEV__) {
      console.log(`🔌 [CircuitBreaker:${this.name}] ${message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// CIRCUIT BREAKER ERROR
// ─────────────────────────────────────────────────────────────
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly stats: CircuitBreakerStats
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

// ─────────────────────────────────────────────────────────────
// CIRCUIT BREAKER MANAGER (Multiple instances)
// ─────────────────────────────────────────────────────────────
class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker
   */
  getBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all breaker stats
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });
    return stats;
  }

  /**
   * Reset all breakers
   */
  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

export const circuitBreakerManager = new CircuitBreakerManager();
export default CircuitBreaker;