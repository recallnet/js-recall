import { describe, expect, it } from "vitest";

import {
  NonRetryableError,
  RetryConfig,
  RetryableError,
  withRetry,
} from "../retry-helper.js";

describe("retry-helper", () => {
  const TEST_RETRY_CONFIG: RetryConfig = {
    maxRetries: 2,
    initialDelay: 100,
    maxDelay: 1000,
    exponent: 2,
    maxElapsedTime: 5000,
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
      ).rejects.toThrow("error");
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
  });
});
