/**
 * Basic E2E tests for IndexerSyncService with real Envio
 *
 * These tests verify that:
 * 1. We can connect to the Envio GraphQL endpoint
 * 2. We can fetch data using the IndexerSyncService
 *
 * Run with: TEST_LIVE_TRADING=true pnpm test:e2e indexer-sync-basic
 */
import { beforeAll, describe, expect, test } from "vitest";

import { IndexerSyncService } from "@/services/indexer-sync.service.js";

// Only run these tests when TEST_LIVE_TRADING is enabled
const describeIfLiveTrading =
  process.env.TEST_LIVE_TRADING === "true" ? describe : describe.skip;

describeIfLiveTrading("IndexerSyncService - Basic E2E", () => {
  let indexerSync: IndexerSyncService;

  beforeAll(() => {
    // Create service instance
    indexerSync = new IndexerSyncService();
  });

  test("should connect to Envio GraphQL endpoint", async () => {
    // This is a simple connectivity test
    // Even if there's no data, the query should not throw
    const trades = await indexerSync.fetchTrades(
      0, // fromTimestamp (0 = from beginning)
      1, // limit
      0, // offset
    );

    // Should return an array (even if empty)
    expect(Array.isArray(trades)).toBe(true);
    console.log(
      `✅ Successfully connected to Envio. Found ${trades.length} trades.`,
    );
  });

  test("should fetch transfers from Envio", async () => {
    // Test fetching transfers
    const transfers = await indexerSync.fetchTransfers(
      0, // fromTimestamp
      5, // limit - just get a few
      0, // offset
    );

    // Should return an array
    expect(Array.isArray(transfers)).toBe(true);

    // If we have transfers, verify they have expected structure
    if (transfers.length > 0) {
      const transfer = transfers[0];
      expect(transfer).toHaveProperty("id");
      expect(transfer).toHaveProperty("from");
      expect(transfer).toHaveProperty("to");
      expect(transfer).toHaveProperty("token");
      expect(transfer).toHaveProperty("value");
      expect(transfer).toHaveProperty("chain");
      expect(transfer).toHaveProperty("transactionHash");
    }

    console.log(
      `✅ Successfully fetched ${transfers.length} transfers from Envio.`,
    );
  });
});

// Fallback message when tests are skipped
describe.skipIf(process.env.TEST_LIVE_TRADING !== "true")(
  "IndexerSyncService - Basic E2E",
  () => {
    test("Skipped - Set TEST_LIVE_TRADING=true to run", () => {
      console.log(
        "ℹ️  Envio tests skipped. Run with: TEST_LIVE_TRADING=true pnpm test:e2e",
      );
    });
  },
);
