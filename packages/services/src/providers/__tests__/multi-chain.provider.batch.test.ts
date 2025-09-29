import { beforeEach, describe, expect, it, vi } from "vitest";

import { BlockchainType, SpecificChain } from "../../types/index.js";
import { MultiChainProvider } from "../multi-chain.provider.js";

// Set timeout for all tests in this file to 15 seconds
vi.setConfig({ testTimeout: 15_000 });

describe("Batch Functionality Tests", () => {
  let provider: MultiChainProvider;

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
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as any;

  beforeEach(() => {
    provider = new MultiChainProvider(
      specificChains,
      specificChainTokens,
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
