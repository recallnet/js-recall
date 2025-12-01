/**
 * Returns a promise that resolves after a given number of milliseconds,
 * with optional cancellation support via an {@link AbortSignal}.
 *
 * @param ms - The number of milliseconds to wait before resolving.
 * @param signal - Optional {@link AbortSignal} to cancel the delay early.
 *   - If the signal is already aborted, the returned promise rejects immediately.
 *   - If the signal is aborted while waiting, the timeout is cleared and the
 *     promise rejects with {@link AbortSignal.reason}.
 *
 * @returns A promise that:
 *   - Resolves after `ms` milliseconds if not aborted.
 *   - Rejects with `signal.reason` if aborted before completion.
 *
 * @example
 * ```ts
 * // Basic usage
 * await delay(1000);
 * console.log("1 second later");
 *
 * // With abort
 * const controller = new AbortController();
 * const promise = delay(5000, controller.signal);
 * controller.abort(new Error("Cancelled"));
 *
 * try {
 *   await promise;
 * } catch (err) {
 *   console.error("Aborted:", err);
 * }
 * ```
 */
export async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => resolve(), ms);
    if (signal) {
      const handleAbort = () => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", handleAbort);
        reject(signal.reason);
      };
      if (signal.aborted) handleAbort();
      signal.addEventListener("abort", handleAbort);
    }
  });
}
