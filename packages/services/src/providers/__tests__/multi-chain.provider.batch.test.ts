import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { specificChainTokens } from "../../lib/config-utils.js";
import { BlockchainType } from "../../types/index.js";
import { MultiChainProvider } from "../multi-chain.provider.js";
import {
  MockCoinGeckoClient,
  commonMockResponses,
  mockBatchTokenPrices,
  multichainCoinGeckoConfig,
  setupCoinGeckoMock,
} from "./mocks/coingecko.js";

// Mock the CoinGecko SDK
vi.mock("@coingecko/coingecko-typescript");

vi.setConfig({ testTimeout: 15_000 });

const mockLogger: MockProxy<Logger> = mock<Logger>();

describe("Batch Functionality Tests", () => {
  let provider: MultiChainProvider;
  let mockCoinGeckoInstance: MockCoinGeckoClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCoinGeckoInstance = setupCoinGeckoMock();
    provider = new MultiChainProvider(multichainCoinGeckoConfig, mockLogger);
  });

  describe("MultiChainProvider batch methods", () => {
    it("should fetch batch prices for multiple tokens with comprehensive data", async () => {
      const testTokens = [
        specificChainTokens.eth.eth,
        specificChainTokens.eth.usdc,
      ];

      mockBatchTokenPrices(mockCoinGeckoInstance, [
        commonMockResponses.eth,
        commonMockResponses.usdc,
      ]);

      const results = await provider.getBatchPrices(
        testTokens,
        BlockchainType.EVM,
        "eth",
      );

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(testTokens.length);

      testTokens.forEach((token) => {
        expect(results.has(token)).toBe(true);
        const result = results.get(token);
        if (result) {
          expect(result.price).toBeGreaterThan(0);
          expect(result.symbol).toBeDefined();
          expect(result.chain).toBe(BlockchainType.EVM);
          expect(result.specificChain).toBe("eth");
          expect(result.token).toBe(token);
          expect(result.timestamp).toBeInstanceOf(Date);
        }
      });
    });

    it("should fetch batch prices for multiple tokens", async () => {
      const testTokens = [
        specificChainTokens.eth.eth,
        specificChainTokens.eth.usdc,
      ];

      mockBatchTokenPrices(mockCoinGeckoInstance, [
        commonMockResponses.eth,
        commonMockResponses.usdc,
      ]);

      const results = await provider.getBatchPrices(
        testTokens,
        BlockchainType.EVM,
        "eth",
      );

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(testTokens.length);

      testTokens.forEach((token) => {
        expect(results.has(token)).toBe(true);
        const result = results.get(token);
        if (result) {
          expect(result.price).toBeGreaterThan(0);
          expect(result.symbol).toBeDefined();
          expect(result.chain).toBe(BlockchainType.EVM);
          expect(result.specificChain).toBe("eth");
          expect(result.token).toBe(token);
          expect(result.timestamp).toBeInstanceOf(Date);
        }
      });
    });

    it("should handle empty token array", async () => {
      const results = await provider.getBatchPrices(
        [],
        BlockchainType.EVM,
        "eth",
      );

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(0);
    });

    it("should handle Solana tokens in batch", async () => {
      const testTokens = [
        specificChainTokens.svm.sol,
        specificChainTokens.svm.usdc,
      ];

      mockBatchTokenPrices(mockCoinGeckoInstance, [
        commonMockResponses.sol,
        commonMockResponses.usdc,
      ]);

      const results = await provider.getBatchPrices(
        testTokens,
        BlockchainType.SVM,
        "svm",
      );

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(testTokens.length);

      testTokens.forEach((token) => {
        expect(results.has(token)).toBe(true);
        const result = results.get(token);
        if (result) {
          expect(result.price).toBeGreaterThan(0);
          expect(result.symbol).toBeDefined();
          expect(result.chain).toBe(BlockchainType.SVM);
          expect(result.specificChain).toBe("svm");
          expect(result.token).toBe(token);
          expect(result.timestamp).toBeInstanceOf(Date);
        }
      });
    });
  });
});
