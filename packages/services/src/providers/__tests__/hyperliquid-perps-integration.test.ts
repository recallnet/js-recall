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
const KNOWN_FILLS_PERIOD = {
  // Start: Dec 1, 2024
  start: new Date("2024-12-01T00:00:00Z"),
  // End: Current date (or use a fixed date for deterministic tests)
  end: new Date(),
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

    console.log(`\n✓ Account Summary for ${TEST_WALLET.address}:`);
    console.log(`  Total Equity: $${summary.totalEquity.toFixed(2)}`);
    console.log(
      `  Unrealized PnL: $${(summary.totalUnrealizedPnl ?? 0).toFixed(2)}`,
    );
    console.log(
      `  Realized PnL: $${(summary.totalRealizedPnl ?? 0).toFixed(2)}`,
    );
  }, 30000);

  test("should fetch open positions from real Hyperliquid API", async () => {
    const positions = await provider.getPositions(TEST_WALLET.address);

    // Verify structure
    expect(Array.isArray(positions)).toBe(true);

    console.log(
      `\n✓ Found ${positions.length} open positions for ${TEST_WALLET.address}`,
    );

    // Log details for any positions found
    positions.forEach((position, index) => {
      console.log(`  Position ${index + 1}:`);
      console.log(`    Symbol: ${position.symbol}`);
      console.log(`    Side: ${position.side}`);
      console.log(`    Size: $${position.positionSizeUsd.toFixed(2)}`);
      console.log(
        `    Entry Price: $${position.entryPrice?.toFixed(4) ?? "N/A"}`,
      );
      console.log(`    Leverage: ${position.leverage ?? "N/A"}x`);
      console.log(
        `    Collateral: $${position.collateralAmount?.toFixed(2) ?? "N/A"}`,
      );

      // Verify each position has required fields
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

    console.log(`\n✓ Found ${fills.length} closed position fills`);
    console.log(
      `  Period: ${KNOWN_FILLS_PERIOD.start.toISOString()} to ${KNOWN_FILLS_PERIOD.end.toISOString()}`,
    );

    // Verify structure of first fill
    const firstFill = fills[0]!;
    console.log(`\n  Sample closed fill:`);
    console.log(`    Provider Fill ID: ${firstFill.providerFillId}`);
    console.log(`    Symbol: ${firstFill.symbol}`);
    console.log(`    Side: ${firstFill.side}`);
    console.log(`    Position Size: ${firstFill.positionSize}`);
    console.log(`    Close Price: $${firstFill.closePrice.toFixed(4)}`);
    console.log(`    Closed PnL: $${firstFill.closedPnl.toFixed(4)}`);
    console.log(`    Closed At: ${firstFill.closedAt.toISOString()}`);
    console.log(
      `    Fee: ${firstFill.fee !== undefined ? `$${firstFill.fee.toFixed(4)}` : "N/A"}`,
    );

    // Verify all required fields are present with correct types
    expect(firstFill.providerFillId).toBeDefined();
    expect(firstFill.providerFillId.length).toBeGreaterThan(0);
    expect(firstFill.symbol).toBeDefined();
    expect(firstFill.side).toMatch(/^(long|short)$/);
    expect(typeof firstFill.positionSize).toBe("number");
    expect(firstFill.positionSize).toBeGreaterThan(0);
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

    console.log(
      `\n✓ All ${fills.length} fills are within requested date range`,
    );
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

    console.log(
      `\n✓ Correctly returned empty array for date range with no fills`,
    );
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

    console.log(`\n✓ All ${fills.length} fills have unique provider IDs`);
    console.log(`  Sample IDs: ${fillIds.slice(0, 3).join(", ")}...`);
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

    // Count by side for logging
    const longCount = fills.filter((f) => f.side === "long").length;
    const shortCount = fills.filter((f) => f.side === "short").length;

    console.log(`\n✓ Fill direction parsing:`);
    console.log(`  Long closes: ${longCount}`);
    console.log(`  Short closes: ${shortCount}`);
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

    console.log(
      `\n✓ All ${fills.length} fills have non-zero closedPnl (filter working correctly)`,
    );
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

    console.log(`\n✓ Concurrent requests completed successfully:`);
    console.log(`  Account summary: $${summary.totalEquity.toFixed(2)} equity`);
    console.log(`  Open positions: ${positions.length}`);
    console.log(`  Closed fills: ${fills.length}`);
  }, 30000);

  test("should verify provider name", () => {
    expect(provider.getName()).toBe("Hyperliquid");
  });

  test("should verify provider health check", async () => {
    const isHealthy = await provider.isHealthy();

    expect(typeof isHealthy).toBe("boolean");
    expect(isHealthy).toBe(true);

    console.log(
      `\n✓ Provider health check: ${isHealthy ? "healthy" : "unhealthy"}`,
    );
  }, 30000);
});
