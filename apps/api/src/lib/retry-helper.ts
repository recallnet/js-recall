/**
 * Configuration for retry logic with exponential backoff
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (not including initial attempt) */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Exponential backoff multiplier */
  exponent: number;
  /** Maximum total time to spend retrying in milliseconds */
  maxElapsedTime: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10_000,
  exponent: 2,
  maxElapsedTime: 30_000,
};

/**
 * Error types for retry logic
 */
export class RetryableError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "RetryableError";
    Object.setPrototypeOf(this, RetryableError.prototype);
  }
}

export class NonRetryableError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "NonRetryableError";
    Object.setPrototypeOf(this, NonRetryableError.prototype);
  }
}

/**
 * Execute a function with retry logic and exponential backoff
 * @param fn Function to execute that may throw retryable errors
 * @param config Retry configuration
 * @returns Promise that resolves with the function result or rejects with final error
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const startTime = Date.now();

  let lastError: Error | undefined;

  // Total attempts = initial attempt + retries
  for (let attempt = 1; attempt <= finalConfig.maxRetries + 1; attempt++) {
    // Add exponential backoff delay between attempts (except first attempt)
    if (attempt > 1) {
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime >= finalConfig.maxElapsedTime) {
        break; // Exceeded max elapsed time
      }

      // Calculate exponential backoff delay: attempt - 2 gives us 0, 1, 2... for delays
      const backoffDelay = Math.min(
        finalConfig.initialDelay * Math.pow(finalConfig.exponent, attempt - 2),
        finalConfig.maxDelay,
      );

      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry non-retryable errors
      if (error instanceof NonRetryableError) {
        throw error.cause || error;
      }

      // Don't retry if it's not explicitly marked as retryable
      if (!(error instanceof RetryableError)) {
        throw error;
      }

      // Check if we've exceeded max elapsed time
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime >= finalConfig.maxElapsedTime) {
        break;
      }
    }
  }

  // All retries exhausted, throw the last error
  throw lastError || new Error("Retry attempts exhausted");
}
