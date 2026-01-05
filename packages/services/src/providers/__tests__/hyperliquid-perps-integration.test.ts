import { Logger } from "pino";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { HyperliquidPerpsProvider } from "../perps/hyperliquid-perps.provider.js";

/**
 * Integration tests for HyperliquidPerpsProvider against the real Hyperliquid API.
 *
 * These tests verify our implementation works correctly with actual API responses,
 * particularly for the getClosedPositionFills method which parses userFillsByTime data.
 *
 * Run with: pnpm --filter @recallnet/services test hyperliquid-perps-integration
 */

// Mock logger for tests
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

// Known test wallet with trading history on Hyperliquid
// This wallet has verified fills that we manually tested via curl
const TEST_WALLET = {
  address: "0x3c8120d5eafca181da83d4a1e17b2751d4a16023",
  description: "Wallet with verified Hyperliquid trading history",
};

// Known date range where this wallet has closed fills
// Based on manual API testing performed during development
// Using fixed dates for deterministic test results in CI
const KNOWN_FILLS_PERIOD = {
  // Start: Dec 1, 2024
  start: new Date("2024-12-01T00:00:00Z"),
  // End: Oct 31, 2025 - fixed date where test wallet has verified fills
  end: new Date("2025-10-31T23:59:59Z"),
  description: "Period with verified closed position fills",
};

describe("HyperliquidPerpsProvider - Integration Tests (Real API)", () => {
  let provider: HyperliquidPerpsProvider;

  beforeEach(() => {
    // Create real provider instance (no mocks)
    provider = new HyperliquidPerpsProvider(mockLogger);

    // Set higher timeout for network calls
    vi.setConfig({ testTimeout: 30_000 });
  });

  test("should fetch account summary from real Hyperliquid API", async () => {
    const summary = await provider.getAccountSummary(TEST_WALLET.address);

    // Verify structure
    expect(summary).toBeDefined();
    expect(typeof summary.totalEquity).toBe("number");
    expect(typeof summary.totalUnrealizedPnl).toBe("number");
    expect(typeof summary.totalRealizedPnl).toBe("number");
  }, 30000);

  test("should fetch open positions from real Hyperliquid API", async () => {
    const positions = await provider.getPositions(TEST_WALLET.address);

    // Verify structure
    expect(Array.isArray(positions)).toBe(true);

    // Verify each position has required fields
    positions.forEach((position) => {
      expect(position.symbol).toBeDefined();
      expect(position.side).toMatch(/^(long|short)$/);
    });
  }, 30000);

  test("should fetch closed position fills from real Hyperliquid API", async () => {
    const fills = await provider.getClosedPositionFills(
      TEST_WALLET.address,
      KNOWN_FILLS_PERIOD.start,
      KNOWN_FILLS_PERIOD.end,
    );

    // Should find at least some closed fills
    expect(Array.isArray(fills)).toBe(true);
    expect(fills.length).toBeGreaterThan(0);

    // Verify structure of first fill
    const firstFill = fills[0]!;

    // Verify all required fields are present with correct types
    expect(firstFill.providerFillId).toBeDefined();
    expect(firstFill.providerFillId.length).toBeGreaterThan(0);
    expect(firstFill.symbol).toBeDefined();
    expect(firstFill.side).toMatch(/^(long|short)$/);
    expect(typeof firstFill.positionSizeUsd).toBe("number");
    expect(firstFill.positionSizeUsd).toBeGreaterThan(0);
    expect(typeof firstFill.closePrice).toBe("number");
    expect(firstFill.closePrice).toBeGreaterThan(0);
    expect(typeof firstFill.closedPnl).toBe("number");
    // closedPnl can be positive or negative but should not be zero
    // (zero PnL fills are filtered out by the provider)
    expect(firstFill.closedPnl).not.toBe(0);
    expect(firstFill.closedAt instanceof Date).toBe(true);

    // Verify closed fills are within the requested date range
    fills.forEach((fill) => {
      expect(fill.closedAt.getTime()).toBeGreaterThanOrEqual(
        KNOWN_FILLS_PERIOD.start.getTime(),
      );
      expect(fill.closedAt.getTime()).toBeLessThanOrEqual(
        KNOWN_FILLS_PERIOD.end.getTime(),
      );
    });
  }, 30000);

  test("should return empty array for wallet with no closed fills in date range", async () => {
    // Use a very old date range where we expect no activity
    const oldStart = new Date("2020-01-01T00:00:00Z");
    const oldEnd = new Date("2020-01-02T00:00:00Z");

    const fills = await provider.getClosedPositionFills(
      TEST_WALLET.address,
      oldStart,
      oldEnd,
    );

    expect(Array.isArray(fills)).toBe(true);
    expect(fills.length).toBe(0);
  }, 30000);

  test("should verify closed fills have unique provider fill IDs", async () => {
    const fills = await provider.getClosedPositionFills(
      TEST_WALLET.address,
      KNOWN_FILLS_PERIOD.start,
      KNOWN_FILLS_PERIOD.end,
    );

    // Extract all fill IDs
    const fillIds = fills.map((f) => f.providerFillId);
    const uniqueIds = new Set(fillIds);

    // All IDs should be unique
    expect(uniqueIds.size).toBe(fillIds.length);
  }, 30000);

  test("should correctly parse fill direction from Hyperliquid dir field", async () => {
    const fills = await provider.getClosedPositionFills(
      TEST_WALLET.address,
      KNOWN_FILLS_PERIOD.start,
      KNOWN_FILLS_PERIOD.end,
    );

    // All fills should have valid side values
    fills.forEach((fill) => {
      expect(fill.side).toMatch(/^(long|short)$/);
    });
  }, 30000);

  test("should only return fills with non-zero closedPnl (critical filter)", async () => {
    const fills = await provider.getClosedPositionFills(
      TEST_WALLET.address,
      KNOWN_FILLS_PERIOD.start,
      KNOWN_FILLS_PERIOD.end,
    );

    // All returned fills must have non-zero closedPnl
    // This is critical - fills with closedPnl == 0 represent entries, not closes
    fills.forEach((fill) => {
      expect(fill.closedPnl).not.toBe(0);
    });
  }, 30000);

  test("should handle concurrent requests without issues", async () => {
    // Make multiple concurrent requests to verify provider stability
    const [summary, positions, fills] = await Promise.all([
      provider.getAccountSummary(TEST_WALLET.address),
      provider.getPositions(TEST_WALLET.address),
      provider.getClosedPositionFills(
        TEST_WALLET.address,
        KNOWN_FILLS_PERIOD.start,
        KNOWN_FILLS_PERIOD.end,
      ),
    ]);

    expect(summary).toBeDefined();
    expect(Array.isArray(positions)).toBe(true);
    expect(Array.isArray(fills)).toBe(true);
  }, 30000);

  test("should verify provider name", () => {
    expect(provider.getName()).toBe("Hyperliquid");
  });

  test("should verify provider health check", async () => {
    const isHealthy = await provider.isHealthy();

    expect(typeof isHealthy).toBe("boolean");
    expect(isHealthy).toBe(true);
  }, 30000);
});
