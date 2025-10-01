import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { specificChainTokens } from "../../lib/config-utils.js";
import { PriceTrackerService } from "../../price-tracker.service.js";
import { SpecificChain } from "../../types/index.js";
import { MultiChainProvider } from "../multi-chain.provider.js";

// Set timeout for all tests in this file to 15 seconds
vi.setConfig({ testTimeout: 15_000 });

describe("Batch Functionality Tests", () => {
  let priceTracker: PriceTrackerService;

  const specificChains: SpecificChain[] = ["eth", "base", "svm"];

  // Mock logger for the constructor
  const mockLogger: MockProxy<Logger> = mock<Logger>();

  beforeEach(() => {
    const multiChainProvider = new MultiChainProvider(
      {
        evmChains: specificChains,
        specificChainTokens,
        // Note: use DexScreener since it isn't rate limited by an API key and this test isn't
        // about testing the price provider, but the price tracker itself
        priceProvider: { type: "dexscreener" },
      },
      mockLogger,
    );
    priceTracker = new PriceTrackerService(
      multiChainProvider,
      { priceTracker: { maxCacheSize: 1000, priceTTLMs: 60000 } },
      mockLogger,
    );
  });

  describe("PriceTracker caching and batch functionality", () => {
    it("should use cache for repeated batch requests", async () => {
      const testTokens = [
        specificChainTokens.eth.eth, // WETH
      ];

      // First batch request
      const firstResults = await priceTracker.getBulkPrices(testTokens);

      // Second batch request (should use cache)
      const secondResults = await priceTracker.getBulkPrices(testTokens);

      expect(firstResults).toBeInstanceOf(Map);
      expect(secondResults).toBeInstanceOf(Map);
      expect(firstResults.size).toBe(secondResults.size);

      // Results should be the same (cached)
      testTokens.forEach((token) => {
        const firstResult = firstResults.get(token);
        const secondResult = secondResults.get(token);

        if (firstResult && secondResult) {
          expect(firstResult.price).toBe(secondResult.price);
          expect(firstResult.symbol).toBe(secondResult.symbol);
          expect(firstResult.timestamp).toBe(secondResult.timestamp);
        }
      });
    });

    it("should return equivalent results for batch vs individual requests", async () => {
      // Test with multiple tokens
      const testTokens = [
        specificChainTokens.eth.eth, // WETH
        specificChainTokens.eth.usdc, // USDC
        specificChainTokens.eth.usdt, // USDT
      ];

      // Get batch results (populates cache)
      const batchResults = await priceTracker.getBulkPrices(testTokens);

      // Get individual results (should use cache)
      const individualResults = new Map();
      for (const token of testTokens) {
        const result = await priceTracker.getPrice(token);
        individualResults.set(token, result);
      }

      // Verify both methods return equivalent results
      expect(batchResults.size).toBe(individualResults.size);

      testTokens.forEach((token) => {
        const batchResult = batchResults.get(token);
        const individualResult = individualResults.get(token);

        if (batchResult && individualResult) {
          expect(batchResult.price).toBe(individualResult.price);
          expect(batchResult.symbol).toBe(individualResult.symbol);
          expect(batchResult.chain).toBe(individualResult.chain);
          expect(batchResult.specificChain).toBe(
            individualResult.specificChain,
          );
          expect(batchResult.timestamp).toBe(individualResult.timestamp);
        }
      });
    });
  });
});
