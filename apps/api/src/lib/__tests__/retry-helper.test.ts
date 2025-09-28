import { describe, expect, it, vi } from "vitest";

import {
  NonRetryableError,
  RetryConfig,
  RetryExhaustedError,
  RetryableError,
  withRetry,
} from "../retry-helper.js";

describe("retry-helper", () => {
  const TEST_RETRY_CONFIG: RetryConfig = {
    maxRetries: 2,
    initialDelay: 100,
    maxDelay: 1000,
    exponent: 2,
    maxElapsedTime: 4000,
  };
  describe("withRetry", () => {
    it("should retry a function", async () => {
      const result = await withRetry(
        () => Promise.resolve("success"),
        TEST_RETRY_CONFIG,
      );
      expect(result).toBe("success");
    });

    it("should throw an error if the function throws an error", async () => {
      await expect(
        withRetry(() => Promise.reject(new Error("error")), TEST_RETRY_CONFIG),
      ).rejects.toThrow("error");
    });

    it("should throw an error if the function throws a retryable error", async () => {
      await expect(
        withRetry(
          () => Promise.reject(new RetryableError("error")),
          TEST_RETRY_CONFIG,
        ),
      ).rejects.toThrow(RetryExhaustedError);

      await expect(
        withRetry(
          () => Promise.reject(new RetryableError("error")),
          TEST_RETRY_CONFIG,
        ),
      ).rejects.toThrow("Operation failed after 3 attempts");
    });

    it("should throw an error if the function throws a non-retryable error", async () => {
      await expect(
        withRetry(
          () => Promise.reject(new NonRetryableError("error")),
          TEST_RETRY_CONFIG,
        ),
      ).rejects.toThrow("error");
    });

    it("should throw an error if the function throws an unknown error", async () => {
      await expect(
        withRetry(
          () => Promise.reject(new Error("unknown error")),
          TEST_RETRY_CONFIG,
        ),
      ).rejects.toThrow("unknown error");
    });

    describe("with optional config", () => {
      it("should use jitter none", async () => {
        const controller = new AbortController();
        const RETRY_CONFIG_WITH_OPTIONALS: RetryConfig = {
          ...TEST_RETRY_CONFIG,
          jitter: "none",
          signal: controller.signal,
        };
        const result = await withRetry(
          () => Promise.resolve("success"),
          RETRY_CONFIG_WITH_OPTIONALS,
        );
        expect(result).toBe("success");
      });

      it("should use jitter full", async () => {
        const RETRY_CONFIG_WITH_OPTIONALS: RetryConfig = {
          ...TEST_RETRY_CONFIG,
          jitter: "full",
        };
        const result = await withRetry(
          () => Promise.resolve("success"),
          RETRY_CONFIG_WITH_OPTIONALS,
        );
        expect(result).toBe("success");
      });

      it("should use jitter equal with retries", async () => {
        let attemptCount = 0;
        const onRetryMock = vi.fn();

        const RETRY_CONFIG_WITH_OPTIONALS: RetryConfig = {
          ...TEST_RETRY_CONFIG,
          jitter: "equal",
          onRetry: onRetryMock,
        };

        await expect(
          withRetry(() => {
            attemptCount++;
            if (attemptCount <= 2) {
              return Promise.reject(new RetryableError("retry me"));
            }
            return Promise.resolve("success");
          }, RETRY_CONFIG_WITH_OPTIONALS),
        ).resolves.toBe("success");

        // onRetry should be called twice (after first and second failures)
        expect(onRetryMock).toHaveBeenCalledTimes(2);
        expect(onRetryMock).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            attempt: 1,
            nextDelayMs: expect.any(Number), // Jitter makes this variable
            error: expect.any(RetryableError),
            elapsedMs: expect.any(Number),
          }),
        );
        expect(onRetryMock).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            attempt: 2,
            nextDelayMs: expect.any(Number), // Jitter makes this variable
            error: expect.any(RetryableError),
            elapsedMs: expect.any(Number),
          }),
        );
      });

      it("should respect abort signal", async () => {
        const controller = new AbortController();

        const RETRY_CONFIG_WITH_OPTIONALS: RetryConfig = {
          ...TEST_RETRY_CONFIG,
          // Ensure non-zero backoff so abort can be observed deterministically
          jitter: "none",
          signal: controller.signal,
        };

        // Abort after a short delay
        setTimeout(() => controller.abort(), 50);

        await expect(
          withRetry(
            () => Promise.reject(new RetryableError("keep failing")),
            RETRY_CONFIG_WITH_OPTIONALS,
          ),
        ).rejects.toThrow("Aborted");
      });

      it("should call onRetry callback with correct info", async () => {
        let callCount = 0;
        const onRetryMock = vi.fn(() => {
          callCount++;
        });

        const RETRY_CONFIG_WITH_OPTIONALS: RetryConfig = {
          ...TEST_RETRY_CONFIG,
          onRetry: onRetryMock,
        };

        let attemptCount = 0;
        await expect(
          withRetry(() => {
            attemptCount++;
            if (attemptCount === 1) {
              return Promise.reject(new RetryableError("first failure"));
            }
            return Promise.resolve("success");
          }, RETRY_CONFIG_WITH_OPTIONALS),
        ).resolves.toBe("success");

        // onRetry should be called once (after first failure)
        expect(onRetryMock).toHaveBeenCalledTimes(1);
        expect(onRetryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            attempt: 1,
            nextDelayMs: expect.any(Number),
            error: expect.any(RetryableError),
            elapsedMs: expect.any(Number),
          }),
        );
        expect(callCount).toBe(1);
      });

      it("should use custom isRetryable predicate", async () => {
        const customRetryConfig: RetryConfig = {
          ...TEST_RETRY_CONFIG,
          isRetryable: (error) => {
            return error instanceof Error && error.message === "retry-me";
          },
        };

        let attemptCount = 0;
        await expect(
          withRetry(() => {
            attemptCount++;
            if (attemptCount === 1) {
              return Promise.reject(new Error("retry-me"));
            }
            return Promise.resolve("success");
          }, customRetryConfig),
        ).resolves.toBe("success");

        expect(attemptCount).toBe(2);
      });

      it("should not retry if custom predicate returns false", async () => {
        const customRetryConfig: RetryConfig = {
          ...TEST_RETRY_CONFIG,
          isRetryable: () => false,
        };

        // Use an error message that won't trigger built-in retry logic
        await expect(
          withRetry(
            () => Promise.reject(new Error("custom business error")),
            customRetryConfig,
          ),
        ).rejects.toThrow("custom business error");
      });
    });

    describe("config validation", () => {
      it("should throw on invalid maxRetries", async () => {
        await expect(
          withRetry(() => Promise.resolve("test"), {
            ...TEST_RETRY_CONFIG,
            maxRetries: -1,
          }),
        ).rejects.toThrow("Invalid retry configuration");
      });

      it("should throw on invalid initialDelay", async () => {
        await expect(
          withRetry(() => Promise.resolve("test"), {
            ...TEST_RETRY_CONFIG,
            initialDelay: NaN,
          }),
        ).rejects.toThrow("Invalid retry configuration");
      });

      it("should throw on invalid maxDelay", async () => {
        await expect(
          withRetry(() => Promise.resolve("test"), {
            ...TEST_RETRY_CONFIG,
            maxDelay: -100,
          }),
        ).rejects.toThrow("Invalid retry configuration");
      });

      it("should throw on invalid exponent", async () => {
        await expect(
          withRetry(() => Promise.resolve("test"), {
            ...TEST_RETRY_CONFIG,
            exponent: 0.5,
          }),
        ).rejects.toThrow("Invalid retry configuration");
      });

      it("should throw if initialDelay > maxDelay", async () => {
        await expect(
          withRetry(() => Promise.resolve("test"), {
            ...TEST_RETRY_CONFIG,
            initialDelay: 2000,
            maxDelay: 1000,
          }),
        ).rejects.toThrow("Invalid retry configuration");
      });

      it("should throw on invalid jitter value", async () => {
        await expect(
          withRetry(() => Promise.resolve("test"), {
            ...TEST_RETRY_CONFIG,
            // We want to test the invalid jitter value
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            jitter: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid retry configuration");
      });
    });
  });
});
