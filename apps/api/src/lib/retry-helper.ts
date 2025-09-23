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
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10_000,
  exponent: 2,
  maxElapsedTime: 30_000,
  jitter: "full",
};

export class RetryableError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "RetryableError";
  }
}

export class NonRetryableError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "NonRetryableError";
  }
}

/** Optional shape for HTTP-like errors */
type MaybeHttpError = Error & {
  code?: string;
  name?: string;
  response?: { status?: number; headers?: Record<string, string> };
};

/** Parse Retry-After seconds (or HTTP date) into ms */
function parseRetryAfterMs(h?: string | null | undefined): number | null {
  if (!h) return null;
  const s = Number(h);
  if (Number.isFinite(s)) return Math.max(0, Math.floor(s * 1000));
  const d = new Date(h).getTime();
  if (Number.isFinite(d)) return Math.max(0, d - Date.now());
  return null;
}

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

  const transientCodes = [
    "econnreset",
    "enotfound",
    "etimedout",
    "econnrefused",
    "ehostunreach",
    "enetworkdown",
  ];
  if (transientCodes.includes(code)) return true;

  const transientNames = ["aborterror", "timeouterror"];
  if (transientNames.includes(name)) return true;

  const patterns = [
    "network",
    "connection",
    "timeout",
    "socket",
    "fetch",
    "aborted",
  ];
  return patterns.some((p) => msg.includes(p));
}

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
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  cfg: Partial<RetryConfig> = {},
): Promise<T> {
  const c: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...cfg };
  const start = Date.now();
  let lastError: unknown;

  // attemptIndex: 1 = first try (no delay beforehand)
  for (let attemptIndex = 1; attemptIndex <= c.maxRetries + 1; attemptIndex++) {
    if (c.signal?.aborted) {
      throw new NonRetryableError("Aborted", new Error("Operation cancelled"));
    }

    // Delay before attempt >= 2
    if (attemptIndex > 1) {
      const elapsed = Date.now() - start;
      if (elapsed >= c.maxElapsedTime) break;

      // Exponential backoff baseline
      const backoff = Math.min(
        c.initialDelay * Math.pow(c.exponent, attemptIndex - 2),
        c.maxDelay,
      );
      // Remaining time budget
      const remaining = Math.max(0, c.maxElapsedTime - elapsed);
      let delay = applyJitter(Math.min(backoff, remaining), c.jitter);

      // If last error had Retry-After, prefer it (capped by remaining)
      const raMs = parseRetryAfterMs(
        (lastError as MaybeHttpError)?.response?.headers?.["retry-after"],
      );
      if (raMs != null) delay = Math.min(raMs, remaining);

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
              reject(new NonRetryableError("Aborted during backoff"));
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
  throw new RetryableError("Retry attempts exhausted", e);
}
