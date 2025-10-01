import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { specificChainTokens } from "../../lib/config-utils.js";
import { BlockchainType, SpecificChain } from "../../types/index.js";
import { MultiChainProvider } from "../multi-chain.provider.js";

// Set timeout for all tests in this file to 15 seconds
vi.setConfig({ testTimeout: 15_000 });

describe("Batch Functionality Tests", () => {
  let provider: MultiChainProvider;

  const specificChains: SpecificChain[] = ["eth", "base", "svm"];

  // Mock logger for the constructor
  const mockLogger: MockProxy<Logger> = mock<Logger>();

  beforeEach(() => {
    provider = new MultiChainProvider(
      {
        evmChains: specificChains,
        specificChainTokens,
        priceProvider: { type: "dexscreener" },
      },
      mockLogger,
    );
  });

  describe("MultiChainProvider batch methods", () => {
    it("should fetch batch prices for multiple tokens with comprehensive data", async () => {
      // Test with a few well-known Ethereum tokens
      const testTokens = [
        specificChainTokens.eth.eth, // WETH
        specificChainTokens.eth.usdc, // USDC
      ];

      const results = await provider.getBatchPrices(
        testTokens,
        BlockchainType.EVM,
        "eth",
      );

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(testTokens.length);

      // Check that we got results for each token
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
      // Test with a few well-known Ethereum tokens
      const testTokens = [
        specificChainTokens.eth.eth, // WETH
        specificChainTokens.eth.usdc, // USDC
      ];

      const results = await provider.getBatchPrices(
        testTokens,
        BlockchainType.EVM,
        "eth",
      );

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(testTokens.length);

      // Check that we got results for each token
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
      // Test with Solana tokens
      const testTokens = [
        specificChainTokens.svm.sol, // SOL
        specificChainTokens.svm.usdc, // USDC
      ];

      const results = await provider.getBatchPrices(
        testTokens,
        BlockchainType.SVM,
        "svm",
      );

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(testTokens.length);

      // Check that we got results for each token
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
