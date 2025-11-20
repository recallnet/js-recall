import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { specificChainTokens } from "../../lib/config-utils.js";
import { PriceTrackerService } from "../../price-tracker.service.js";
import { MultiChainProvider } from "../multi-chain.provider.js";
import {
  MockCoinGeckoClient,
  commonMockResponses,
  mockBatchTokenPrices,
  mockTokenPrice,
  multichainCoinGeckoConfig,
  setupCoinGeckoMock,
} from "./mocks/coingecko.js";

vi.mock("@coingecko/coingecko-typescript");
vi.setConfig({ testTimeout: 15_000 });

const mockLogger: MockProxy<Logger> = mock<Logger>();

describe("Batch Functionality Tests", () => {
  let priceTracker: PriceTrackerService;
  let mockCoinGeckoInstance: MockCoinGeckoClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCoinGeckoInstance = setupCoinGeckoMock();
    const multiChainProvider = new MultiChainProvider(
      multichainCoinGeckoConfig,
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

      const testRequests = testTokens.map((tokenAddress) => ({
        tokenAddress,
        specificChain: "eth" as const,
      }));

      // Mock CoinGecko API response for the first request
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);
      const firstResults = await priceTracker.getBulkPrices(testRequests);
      // Second batch request (should use cache, no additional mock needed)
      const secondResults = await priceTracker.getBulkPrices(testRequests);

      expect(firstResults).toBeInstanceOf(Map);
      expect(secondResults).toBeInstanceOf(Map);
      expect(firstResults.size).toBe(secondResults.size);

      // Check using chain-specific keys
      testTokens.forEach((token) => {
        const key = `${token.toLowerCase()}:eth`;
        const firstResult = firstResults.get(key);
        const secondResult = secondResults.get(key);

        if (firstResult && secondResult) {
          expect(firstResult.price).toBe(secondResult.price);
          expect(firstResult.symbol).toBe(secondResult.symbol);
          expect(firstResult.timestamp).toBe(secondResult.timestamp);
        }
      });
    });

    it("should return equivalent results for batch vs individual requests", async () => {
      const testTokens = [
        specificChainTokens.eth.eth,
        specificChainTokens.eth.usdc,
        specificChainTokens.eth.usdt,
      ];

      const testRequests = testTokens.map((tokenAddress) => ({
        tokenAddress,
        specificChain: "eth" as const,
      }));

      mockBatchTokenPrices(mockCoinGeckoInstance, [
        commonMockResponses.eth,
        commonMockResponses.usdc,
        commonMockResponses.usdt,
      ]);

      const batchResults = await priceTracker.getBulkPrices(testRequests);
      const individualResults = new Map();
      for (const token of testTokens) {
        const result = await priceTracker.getPrice(token);
        const key = `${token.toLowerCase()}:eth`;
        individualResults.set(key, result);
      }

      expect(batchResults.size).toBe(individualResults.size);

      // Check using chain-specific keys
      testTokens.forEach((token) => {
        const key = `${token.toLowerCase()}:eth`;
        const batchResult = batchResults.get(key);
        const individualResult = individualResults.get(key);

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
