/**
 * Configuration options for retry behavior.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (not including initial attempt) */
  maxRetries: number;
  /** Initial delay in ms before the 2nd try */
  initialDelay: number;
  /** Maximum backoff delay in ms */
  maxDelay: number;
  /** Exponential backoff multiplier */
  exponent: number;
  /** Maximum total time in ms (including delays) */
  maxElapsedTime: number;
  /** Jitter strategy: "none" | "full" | "equal" */
  jitter?: "none" | "full" | "equal";
  /** Optional AbortSignal to cancel */
  signal?: AbortSignal;
  /** Observer for retries */
  onRetry?: (info: {
    attempt: number; // 1-based (the attempt that just failed)
    nextDelayMs: number | null; // null if stopping
    error: unknown;
    elapsedMs: number;
  }) => void;
  /** Custom predicate to determine if an error is retryable (in addition to built-in logic) */
  isRetryable?: (error: unknown) => boolean;
}

/**
 * Default retry configuration with sensible defaults.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10_000,
  exponent: 2,
  maxElapsedTime: 30_000,
  jitter: "full",
};

/**
 * Error indicating that an operation should be retried.
 */
export class RetryableError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "RetryableError";
  }
}

/**
 * Error indicating that an operation should not be retried.
 */
export class NonRetryableError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "NonRetryableError";
  }
}

/**
 * Error indicating that retry attempts have been exhausted.
 */
export class RetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly attempts?: number,
  ) {
    super(message, cause ? { cause } : undefined);
    this.name = "RetryExhaustedError";
  }
}

/** Optional shape for HTTP-like errors */
type MaybeHttpError = Error & {
  code?: string;
  name?: string;
  response?: {
    status?: number;
    headers?: Record<string, string> | Headers;
  };
};

/**
 * Get header value case-insensitively from various header formats.
 * @param headers - Headers object (Record or Headers instance)
 * @param name - Header name to look for
 * @returns Header value or undefined
 */
function getHeaderCaseInsensitive(
  headers: Record<string, string> | Headers | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;

  // Handle Headers instance (from fetch API)
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  // Handle plain object with case-insensitive lookup
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  return undefined;
}

/**
 * Parse Retry-After header value (seconds or HTTP date) into milliseconds.
 * @param h - The Retry-After header value
 * @returns Delay in milliseconds, or null if invalid
 */
function parseRetryAfterMs(h?: string | null | undefined): number | null {
  if (!h) return null;
  const s = Number(h);
  if (Number.isFinite(s)) return Math.max(0, Math.floor(s * 1000));
  const d = new Date(h).getTime();
  if (Number.isFinite(d)) return Math.max(0, d - Date.now());
  return null;
}

/**
 * Determine if an error is likely to be transient and retryable based on
 * HTTP status codes, Node.js error codes, and error patterns.
 * @param err - The error to evaluate
 * @returns True if the error appears to be retryable
 */
function isNetworkLikelyRetryable(err: unknown): boolean {
  // Known transient HTTP statuses
  const http = err as MaybeHttpError;
  const status = http?.response?.status ?? null;
  if (status === 408 || status === 429 || (status && status >= 500))
    return true;

  // Node/fetch error names/codes
  const e = err as NodeJS.ErrnoException & { name?: string };
  const name = (e?.name || "").toLowerCase();
  const code = (e?.code || "").toLowerCase();
  const msg = (e?.message || "").toLowerCase();

  // Comprehensive list of transient error codes
  const transientCodes = [
    // Connection errors
    "econnreset",
    "econnrefused",
    "econnaborted",
    "epipe",
    "ehostunreach",
    "ehostdown",
    "enetunreach",
    "enetdown",
    "enetreset",

    // DNS errors
    "enotfound",
    "eai_again", // DNS temporary failure
    "etempfail",

    // Timeout errors
    "etimedout",
    "esockettimedout",

    // SSL/TLS transient errors
    "eproto", // Protocol error (can be transient)
    "ssl_error_syscall", // SSL system call error
  ];
  if (transientCodes.includes(code)) return true;

  // Error names that indicate transient issues
  const transientNames = [
    "aborterror",
    "timeouterror",
    "networkerror",
    "fetcherror",
    "requesttimeouterror",
  ];
  if (transientNames.includes(name)) return true;

  // Message patterns that indicate transient issues
  const patterns = [
    "network",
    "connection",
    "timeout",
    "socket",
    "fetch",
    "aborted",
    "dns",
    "getaddrinfo",
    "certificate", // Some certificate errors are transient
    "ssl",
    "tls",
    "closed before receiving",
    "premature close",
    "eai_", // DNS resolution errors
    "temporary failure",
    "service unavailable",
  ];
  return patterns.some((p) => msg.includes(p));
}

/**
 * Validate retry configuration parameters.
 * @param config - The configuration to validate
 * @throws Error if configuration is invalid
 */
function validateRetryConfig(config: RetryConfig): void {
  const errors: string[] = [];
  if (!Number.isFinite(config.maxRetries) || config.maxRetries < 0) {
    errors.push("maxRetries must be a non-negative finite number");
  }
  if (!Number.isFinite(config.initialDelay) || config.initialDelay < 0) {
    errors.push("initialDelay must be a non-negative finite number");
  }
  if (!Number.isFinite(config.maxDelay) || config.maxDelay < 0) {
    errors.push("maxDelay must be a non-negative finite number");
  }
  if (!Number.isFinite(config.exponent) || config.exponent < 1) {
    errors.push("exponent must be a finite number >= 1");
  }
  if (!Number.isFinite(config.maxElapsedTime) || config.maxElapsedTime < 0) {
    errors.push("maxElapsedTime must be a non-negative finite number");
  }
  if (config.initialDelay > config.maxDelay) {
    errors.push("initialDelay cannot be greater than maxDelay");
  }
  if (config.jitter && !["none", "full", "equal"].includes(config.jitter)) {
    errors.push('jitter must be one of: "none", "full", "equal"');
  }
  if (errors.length > 0) {
    throw new Error(`Invalid retry configuration: ${errors.join("; ")}`);
  }
}

/**
 * Apply jitter to a base delay value according to the specified strategy.
 * @param base - The base delay value in milliseconds
 * @param kind - The jitter strategy to apply
 * @returns The jittered delay value
 */
function applyJitter(base: number, kind: RetryConfig["jitter"]): number {
  if (kind === "none") return base;
  if (kind === "equal") {
    // +/- 50%
    const delta = base * 0.5;
    return Math.max(0, base - delta + Math.random() * (2 * delta));
  }
  // "full" jitter: [0, base]
  return Math.random() * base;
}

/**
 * Execute `fn` with retries + exponential backoff + jitter + optional Retry-After handling.
 * @param fn - The async function to execute with retries
 * @param cfg - Partial retry configuration (merged with defaults)
 * @returns Promise that resolves with the function result or rejects with final error
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  cfg: Partial<RetryConfig> = {},
): Promise<T> {
  const c: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...cfg };

  // Validate the configuration
  validateRetryConfig(c);

  const start = Date.now();
  let lastError: unknown;

  // attemptIndex: 1 = first try (no delay beforehand)
  for (let attemptIndex = 1; attemptIndex <= c.maxRetries + 1; attemptIndex++) {
    if (c.signal?.aborted) {
      throw new NonRetryableError("Aborted", new Error("Operation cancelled"));
    }

    // Delay before attempt >= 2
    const MIN_DELAY = 10; // Brief delay to avoid busy-waiting
    if (attemptIndex > 1) {
      const elapsed = Date.now() - start;
      if (elapsed >= c.maxElapsedTime) break;

      const backoff = Math.min(
        c.initialDelay * Math.pow(c.exponent, attemptIndex - 2),
        c.maxDelay,
      );
      const remaining = Math.max(0, c.maxElapsedTime - elapsed);
      if (remaining === 0) break;

      let delay = applyJitter(Math.min(backoff, remaining), c.jitter);

      const httpError = lastError as MaybeHttpError;
      const retryAfterValue = getHeaderCaseInsensitive(
        httpError?.response?.headers,
        "retry-after",
      );
      const raMs = parseRetryAfterMs(retryAfterValue);
      if (raMs != null) delay = Math.min(raMs, remaining);

      if (delay > 0 && delay < MIN_DELAY) delay = MIN_DELAY;

      c.onRetry?.({
        attempt: attemptIndex - 1,
        nextDelayMs: delay,
        error: lastError,
        elapsedMs: elapsed,
      });

      if (delay > 0) {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, delay);
          c.signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(t);
              reject(
                new NonRetryableError(
                  "Aborted during backoff",
                  new Error("Operation cancelled"),
                ),
              );
            },
            { once: true },
          );
        });
      }
    }

    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Hard-stop errors
      if (err instanceof NonRetryableError) {
        throw err.cause ?? err;
      }

      // Retryable by contract
      if (err instanceof RetryableError) {
        continue;
      }

      // Check custom retry predicate first
      if (c.isRetryable && c.isRetryable(err)) {
        continue;
      }

      // Retry on network/transient signals, otherwise bail
      if (!isNetworkLikelyRetryable(err)) {
        throw err;
      }
      // else loop and retry
    }
  }

  // Exhausted
  const e =
    lastError instanceof Error
      ? lastError
      : new Error(String(lastError ?? "Unknown error"));
  const actualAttempts = c.maxRetries + 1;
  throw new RetryExhaustedError(
    `Operation failed after ${actualAttempts} attempts`,
    e,
    actualAttempts,
  );
}
