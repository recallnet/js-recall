import { AsyncLocalStorage } from "async_hooks";

interface TraceContext {
  traceId: string;
  startTime: bigint;
}

// AsyncLocalStorage for trace context
const traceStorage = new AsyncLocalStorage<TraceContext>();

/**
 * Get the current trace ID from async context
 * @returns Current trace ID or 'unknown' if not available
 */
export function getTraceId(): string {
  try {
    const context = traceStorage.getStore();
    return context?.traceId || "unknown";
  } catch {
    // AsyncLocalStorage might not be available during app initialization
    // This is normal and expected during database setup, migrations, etc.
    return "init";
  }
}

/**
 * Get the current request start time
 * @returns Start time in nanoseconds or current time if not available
 */
export function getRequestStartTime(): bigint {
  try {
    const context = traceStorage.getStore();
    return context?.startTime || process.hrtime.bigint();
  } catch {
    // Fallback to current time if AsyncLocalStorage is not available
    return process.hrtime.bigint();
  }
}

/**
 * Run a function with trace context
 * @param traceId - Unique trace identifier
 * @param startTime - Request start time in nanoseconds
 * @param fn - Function to run with context
 */
export function runWithTraceContext<T>(
  traceId: string,
  startTime: bigint,
  fn: () => T,
): T {
  return traceStorage.run({ traceId, startTime }, fn);
}
