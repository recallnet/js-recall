import { Logger } from "pino";

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /**
   * Maximum number of retry attempts (default: 3)
   */
  maxRetries?: number;

  /**
   * Base delay in milliseconds before first retry (default: 50ms)
   * Each subsequent retry uses exponential backoff: baseDelay * 2^(attempt-1)
   */
  baseDelay?: number;

  /**
   * Function to determine if an error is retryable
   * Default checks for PostgreSQL deadlock errors (40P01, 40001)
   */
  isRetryable?: (error: unknown) => boolean;

  /**
   * Optional logger for retry attempts
   */
  logger?: Logger;

  /**
   * Context string for logging (e.g., "createTradeWithBalances")
   */
  context?: string;
}

/**
 * Default retry checker for PostgreSQL deadlock errors
 */
export function isDeadlockError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: string }).code
      : "";

  return (
    errorMessage.includes("deadlock") ||
    errorCode === "40P01" || // deadlock_detected
    errorCode === "40001" // serialization_failure
  );
}

/**
 * Generic retry decorator for async functions
 *
 * Automatically retries a function when it throws retryable errors.
 * Uses exponential backoff: 50ms, 100ms, 200ms, etc.
 *
 * @example
 * ```typescript
 * class MyRepository {
 *   async createRecord(data: Data) {
 *     return withRetry(async () => {
 *       // Your database operation here
 *       return await this.db.insert(records).values(data);
 *     }, {
 *       maxRetries: 3,
 *       logger: this.logger,
 *       context: 'createRecord'
 *     });
 *   }
 * }
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 50,
    isRetryable,
    logger,
    context = "operation",
  } = config;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if this error is retryable
      if (!isRetryable || !isRetryable(error) || attempt === maxRetries) {
        // Not retryable or max retries reached - throw immediately
        if (logger) {
          logger.error(
            `[withRetry] ${context} failed after ${attempt} ${attempt === 1 ? "attempt" : "attempts"}`,
            { error: lastError },
          );
        }
        throw error;
      }

      // Calculate exponential backoff delay
      const delay = baseDelay * Math.pow(2, attempt - 1);

      if (logger) {
        logger.warn(
          `[withRetry] ${context} failed on attempt ${attempt}/${maxRetries}, retrying in ${delay}ms...`,
          {
            error: error instanceof Error ? error.message : String(error),
            errorCode:
              error && typeof error === "object" && "code" in error
                ? (error as { code?: string }).code
                : undefined,
          },
        );
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError || new Error(`${context} failed after ${maxRetries} retries`);
}
