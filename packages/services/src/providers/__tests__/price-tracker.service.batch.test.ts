import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { PriceTrackerService } from "../../price-tracker.service.js";
import { SpecificChain } from "../../types/index.js";
import { MultiChainProvider } from "../multi-chain.provider.js";

// Set timeout for all tests in this file to 15 seconds
vi.setConfig({ testTimeout: 15_000 });

describe("Batch Functionality Tests", () => {
  let priceTracker: PriceTrackerService;

  const specificChains: SpecificChain[] = ["eth", "base", "svm"];

  // SpecificChainTokens for the constructor
  const specificChainTokens = {
    eth: {
      eth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH on Ethereum
      usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
      usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT on Ethereum
      shib: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
    },
    base: {
      eth: "0x4200000000000000000000000000000000000006", // WETH on Base
      usdc: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", // USDbC on Base
    },
    svm: {
      sol: "So11111111111111111111111111111111111111112",
      usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      bonk: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    },
  };

  // Mock logger for the constructor
  const mockLogger: MockProxy<Logger> = mock<Logger>();

  beforeEach(() => {
    const multiChainProvider = new MultiChainProvider(
      { evmChains: specificChains, specificChainTokens },
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
