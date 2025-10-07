import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CircuitBreaker,
  CircuitOpenError,
  CircuitTimeoutError,
  createCircuitBreaker,
  createSimpleCircuitBreaker,
} from "../circuit-breaker.js";

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  describe("Basic functionality", () => {
    it("should allow requests when circuit is closed", async () => {
      breaker = createSimpleCircuitBreaker("test");

      const result = await breaker.execute(() => Promise.resolve("success"));
      expect(result).toBe("success");
      expect(breaker.getState()).toBe("closed");
    });

    it("should open circuit after failure threshold", async () => {
      breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000,
        name: "test",
      });

      // First failure
      await expect(
        breaker.execute(() => Promise.reject(new Error("fail"))),
      ).rejects.toThrow("fail");
      expect(breaker.getState()).toBe("closed");

      // Second failure - should open
      await expect(
        breaker.execute(() => Promise.reject(new Error("fail"))),
      ).rejects.toThrow("fail");
      expect(breaker.getState()).toBe("open");

      // Third attempt should fail immediately
      await expect(
        breaker.execute(() => Promise.resolve("success")),
      ).rejects.toThrow(CircuitOpenError);
    });

    it("should transition to half-open after reset timeout", async () => {
      breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1000,
        successThreshold: 1,
        name: "test",
      });

      // Open the circuit
      await expect(
        breaker.execute(() => Promise.reject(new Error("fail"))),
      ).rejects.toThrow("fail");
      expect(breaker.getState()).toBe("open");

      // Wait for reset timeout
      vi.advanceTimersByTime(1001);

      // Should allow one request (half-open)
      const result = await breaker.execute(() => Promise.resolve("success"));
      expect(result).toBe("success");
      expect(breaker.getState()).toBe("closed");
    });

    it("should re-open from half-open on failure", async () => {
      breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1000,
        name: "test",
      });

      // Open the circuit
      await expect(
        breaker.execute(() => Promise.reject(new Error("fail"))),
      ).rejects.toThrow("fail");
      expect(breaker.getState()).toBe("open");

      // Wait for reset timeout
      vi.advanceTimersByTime(1001);

      // Fail in half-open state
      await expect(
        breaker.execute(() => Promise.reject(new Error("fail again"))),
      ).rejects.toThrow("fail again");
      expect(breaker.getState()).toBe("open");
    });
  });

  describe("Request timeout", () => {
    it("should timeout requests that take too long", async () => {
      vi.useRealTimers(); // Use real timers for this test

      breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 1000,
        requestTimeout: 100,
        name: "test",
      });

      await expect(
        breaker.execute(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve("too late"), 200);
            }),
        ),
      ).rejects.toThrow(CircuitTimeoutError);

      vi.useFakeTimers(); // Switch back to fake timers
    });
  });

  describe("Rolling window", () => {
    it("should track error rate in rolling window", async () => {
      breaker = createCircuitBreaker("test", {
        rollingWindowDuration: 1000,
        errorThresholdPercentage: 50,
      });

      // Create mixed success/failure pattern
      await breaker.execute(() => Promise.resolve("ok"));
      await breaker.execute(() => Promise.resolve("ok"));
      await expect(
        breaker.execute(() => Promise.reject(new Error("fail"))),
      ).rejects.toThrow();
      await expect(
        breaker.execute(() => Promise.reject(new Error("fail"))),
      ).rejects.toThrow();
      await breaker.execute(() => Promise.resolve("ok"));

      const stats = breaker.getStats();
      expect(stats.requestsInWindow).toBe(5);
      expect(stats.failuresInWindow).toBe(2);
      expect(stats.errorRatePercentage).toBe(40); // 2/5 = 40%

      // Should still be closed (under 50% threshold)
      expect(breaker.getState()).toBe("closed");
    });

    it("should open based on error percentage", async () => {
      breaker = createCircuitBreaker("test", {
        rollingWindowDuration: 1000,
        errorThresholdPercentage: 50,
      });

      // Need at least 5 requests for percentage to matter
      for (let i = 0; i < 3; i++) {
        await breaker.execute(() => Promise.resolve("ok"));
      }

      // Now add failures to exceed 50%
      for (let i = 0; i < 4; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error("fail"))),
        ).rejects.toThrow();
      }

      // 4 failures out of 7 = 57% > 50% threshold
      expect(breaker.getState()).toBe("open");
    });
  });

  describe("Custom failure detection", () => {
    it("should use custom isFailure predicate", async () => {
      breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000,
        name: "test",
        isFailure: (error: unknown) => {
          // Only count 500 errors as circuit failures
          return (error as { status?: number })?.status === 500;
        },
      });

      // 404 shouldn't count
      await expect(
        breaker.execute(() => Promise.reject({ status: 404 })),
      ).rejects.toEqual({ status: 404 });
      expect(breaker.getState()).toBe("closed");

      // 500 should count
      await expect(
        breaker.execute(() => Promise.reject({ status: 500 })),
      ).rejects.toEqual({ status: 500 });

      await expect(
        breaker.execute(() => Promise.reject({ status: 500 })),
      ).rejects.toEqual({ status: 500 });

      expect(breaker.getState()).toBe("open");
    });
  });

  describe("Stats and monitoring", () => {
    it("should provide comprehensive statistics", () => {
      breaker = createSimpleCircuitBreaker("test");

      const stats = breaker.getStats();
      expect(stats).toHaveProperty("state");
      expect(stats).toHaveProperty("failureCount");
      expect(stats).toHaveProperty("successCount");
      expect(stats).toHaveProperty("lastFailureTime");
    });

    it("should call state change callback", async () => {
      const onStateChange = vi.fn();

      breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1000,
        name: "test",
        onStateChange,
      });

      await expect(
        breaker.execute(() => Promise.reject(new Error("fail"))),
      ).rejects.toThrow();

      expect(onStateChange).toHaveBeenCalledWith("closed", "open");
    });
  });

  describe("Reset functionality", () => {
    it("should manually reset the circuit", async () => {
      breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 10000, // Long timeout
        name: "test",
      });

      // Open the circuit
      await expect(
        breaker.execute(() => Promise.reject(new Error("fail"))),
      ).rejects.toThrow();
      expect(breaker.getState()).toBe("open");

      // Manual reset
      breaker.reset();
      expect(breaker.getState()).toBe("closed");

      // Should work again
      const result = await breaker.execute(() => Promise.resolve("success"));
      expect(result).toBe("success");
    });
  });
});
