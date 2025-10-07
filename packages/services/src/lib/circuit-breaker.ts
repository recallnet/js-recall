import { Logger } from "pino";

/**
 * Circuit breaker states following the standard pattern
 */
export type CircuitState = "closed" | "open" | "half-open";

/**
 * Configuration options for the circuit breaker
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit (recommended: 2-3 for financial APIs) */
  failureThreshold: number;
  /** Time in ms before attempting to close the circuit (recommended: 10-15s for trading APIs) */
  resetTimeout: number;
  /** Number of successful calls in half-open state before closing (recommended: 1-2) */
  successThreshold?: number;
  /** Rolling window duration in ms for counting failures (optional, enables percentage-based thresholds) */
  rollingWindowDuration?: number;
  /** Error threshold percentage within rolling window (optional, requires rollingWindowDuration) */
  errorThresholdPercentage?: number;
  /** Request timeout in ms (recommended: 1-3s for financial APIs) */
  requestTimeout?: number;
  /** Optional name for logging */
  name?: string;
  /** Optional logger instance */
  logger?: Logger;
  /** Optional callback when state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  /** Optional callback to determine if an error should trip the circuit */
  isFailure?: (error: unknown) => boolean;
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  constructor(message = "Circuit breaker is open") {
    super(message);
    this.name = "CircuitOpenError";
  }
}

/**
 * Error thrown when request times out
 */
export class CircuitTimeoutError extends Error {
  constructor(message = "Circuit breaker timeout") {
    super(message);
    this.name = "CircuitTimeoutError";
  }
}

/**
 * Circuit Breaker implementation following industry best practices
 * Optimized for financial/trading API integration with rolling windows and percentage thresholds
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit tripped, requests fail immediately
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 3,
 *   resetTimeout: 10000, // 10 seconds
 *   successThreshold: 2,
 *   requestTimeout: 3000, // 3 seconds
 *   name: "hyperliquid-api"
 * });
 *
 * try {
 *   const result = await breaker.execute(() => apiCall());
 * } catch (error) {
 *   if (error instanceof CircuitOpenError) {
 *     // Circuit is open, service is down
 *   }
 * }
 * ```
 */
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly config: Required<CircuitBreakerConfig>;

  // Rolling window tracking
  private readonly requestHistory: Array<{
    timestamp: number;
    success: boolean;
  }> = [];

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      successThreshold: 1,
      name: "circuit-breaker",
      rollingWindowDuration: undefined,
      errorThresholdPercentage: undefined,
      requestTimeout: undefined,
      isFailure: undefined,
      ...config,
    } as Required<CircuitBreakerConfig>;
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit statistics
   */
  getStats() {
    const windowStats = this.getWindowStats();
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      ...windowStats,
    };
  }

  /**
   * Get rolling window statistics
   */
  private getWindowStats() {
    if (!this.config.rollingWindowDuration) {
      return {};
    }

    const now = Date.now();
    const windowStart = now - this.config.rollingWindowDuration;

    // Count requests within the window (after windowStart)
    const recentRequests = this.requestHistory.filter(
      (req) => req.timestamp > windowStart,
    );

    const totalInWindow = recentRequests.length;
    const failuresInWindow = recentRequests.filter(
      (req) => !req.success,
    ).length;
    const errorRate =
      totalInWindow > 0 ? (failuresInWindow / totalInWindow) * 100 : 0;

    return {
      requestsInWindow: totalInWindow,
      failuresInWindow,
      errorRatePercentage: errorRate,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should transition from open to half-open
    if (this.state === "open") {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.config.resetTimeout) {
        this.transition("half-open");
      } else {
        throw new CircuitOpenError(
          `Circuit breaker is open (${this.config.name}). Retry after ${
            this.config.resetTimeout - (now - this.lastFailureTime)
          }ms`,
        );
      }
    }

    try {
      let result: T;

      // Apply timeout if configured
      if (this.config.requestTimeout) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new CircuitTimeoutError(
                `Request timeout after ${this.config.requestTimeout}ms (${this.config.name})`,
              ),
            );
          }, this.config.requestTimeout);
        });

        result = await Promise.race([fn(), timeoutPromise]);
      } else {
        result = await fn();
      }

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    if (this.state !== "closed") {
      this.transition("closed");
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    // Track in rolling window if configured
    if (this.config.rollingWindowDuration) {
      this.recordRequest(true);
    }

    this.failureCount = 0; // Reset consecutive failures

    if (this.state === "half-open") {
      this.successCount++;

      if (this.successCount >= this.config.successThreshold) {
        this.transition("closed");
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error?: unknown): void {
    // Check if this error should count as a failure
    if (this.config.isFailure && !this.config.isFailure(error)) {
      return; // Don't count this as a circuit failure
    }

    // Track in rolling window if configured
    if (this.config.rollingWindowDuration) {
      this.recordRequest(false);
    }

    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0; // Reset success count on any failure

    if (this.state === "half-open") {
      // Any failure in half-open state reopens the circuit
      this.transition("open");
    } else if (this.state === "closed") {
      // Check if we should open based on threshold strategy
      if (this.shouldOpen()) {
        this.transition("open");
      }
    }
  }

  /**
   * Record request in rolling window
   */
  private recordRequest(success: boolean): void {
    const now = Date.now();
    this.requestHistory.push({ timestamp: now, success });

    // Clean old entries (remove those at or before windowStart)
    // This is consistent with getWindowStats which counts entries > windowStart
    if (this.config.rollingWindowDuration) {
      const windowStart = now - this.config.rollingWindowDuration;
      while (
        this.requestHistory.length > 0 &&
        this.requestHistory[0]!.timestamp <= windowStart
      ) {
        this.requestHistory.shift();
      }
    }
  }

  /**
   * Determine if circuit should open based on configured strategy
   */
  private shouldOpen(): boolean {
    // If using rolling window with percentage threshold
    if (
      this.config.rollingWindowDuration &&
      this.config.errorThresholdPercentage
    ) {
      const stats = this.getWindowStats();
      return (
        (stats.errorRatePercentage || 0) >=
          this.config.errorThresholdPercentage &&
        (stats.requestsInWindow || 0) >= 5
      ); // Minimum requests to avoid false positives
    }

    // Otherwise use consecutive failure count
    return this.failureCount >= this.config.failureThreshold;
  }

  /**
   * Transition between states
   */
  private transition(to: CircuitState): void {
    const from = this.state;
    this.state = to;

    // Reset counters on state transition
    if (to === "closed") {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (to === "half-open") {
      this.successCount = 0;
    }

    // Log state change
    this.config.logger?.info(
      {
        circuitBreaker: this.config.name,
        from,
        to,
        failureCount: this.failureCount,
      },
      `[CircuitBreaker] State transition: ${from} -> ${to}`,
    );

    // Call optional callback
    this.config.onStateChange?.(from, to);
  }
}

/**
 * Factory function to create a circuit breaker with defaults for financial/trading APIs
 * Based on industry best practices research
 */
export function createCircuitBreaker(
  name: string,
  options: Partial<CircuitBreakerConfig> = {},
): CircuitBreaker {
  return new CircuitBreaker({
    name,
    failureThreshold: 3, // Lower threshold for financial APIs
    resetTimeout: 10000, // 10 seconds (faster recovery for trading systems)
    successThreshold: 2, // Require 2 successful calls to fully close
    requestTimeout: 3000, // 3 second timeout for API calls
    ...options,
  });
}

/**
 * Factory function for circuit breaker with rolling window (advanced)
 * Better for high-volume scenarios where percentage-based thresholds are more meaningful
 */
export function createRollingWindowCircuitBreaker(
  name: string,
  options: Partial<CircuitBreakerConfig> = {},
): CircuitBreaker {
  return new CircuitBreaker({
    name,
    failureThreshold: 3, // Fallback for consecutive failures
    resetTimeout: 10000, // 10 seconds
    successThreshold: 2,
    requestTimeout: 3000, // 3 seconds
    rollingWindowDuration: 10000, // 10 second window
    errorThresholdPercentage: 50, // Open if >50% requests fail in window
    ...options,
  });
}
