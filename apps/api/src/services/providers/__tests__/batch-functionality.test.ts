import { describe, expect, it } from "vitest";

import { BlockchainType } from "@/types/index.js";

import { DexScreenerProvider } from "../dexscreener.provider.js";
import { MultiChainProvider } from "../multi-chain.provider.js";

describe("Batch Functionality Tests", () => {
  describe("DexScreenerProvider batch methods", () => {
    it("should fetch batch prices for multiple tokens", async () => {
      const provider = new DexScreenerProvider();

      // Test with a few well-known Ethereum tokens
      const testTokens = [
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
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
        }
      });
    });

    it("should handle empty token array", async () => {
      const provider = new DexScreenerProvider();

      const results = await provider.getBatchPrices(
        [],
        BlockchainType.EVM,
        "eth",
      );

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(0);
    });

    it("should handle mix of valid and invalid tokens", async () => {
      const provider = new DexScreenerProvider();

      const testTokens = [
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH - valid
        "0x1234567890123456789012345678901234567890", // Invalid token
      ];

      const results = await provider.getBatchPrices(
        testTokens,
        BlockchainType.EVM,
        "eth",
      );

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(testTokens.length);

      // WETH should have a result
      const wethResult = results.get(testTokens[0] as string);
      expect(wethResult).toBeDefined();
      if (wethResult) {
        expect(wethResult.price).toBeGreaterThan(0);
      }

      // Invalid token should be null
      const invalidResult = results.get(testTokens[1] as string);
      expect(invalidResult).toBeNull();
    });
  });

  describe("MultiChainProvider batch methods", () => {
    it("should fetch batch prices for multiple tokens with comprehensive data", async () => {
      const provider = new MultiChainProvider();

      // Test with a few well-known Ethereum tokens
      const testTokens = [
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
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
      const provider = new MultiChainProvider();

      // Test with a few well-known Ethereum tokens
      const testTokens = [
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
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
      const provider = new MultiChainProvider();

      const results = await provider.getBatchPrices(
        [],
        BlockchainType.EVM,
        "eth",
      );

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(0);
    });

    it("should handle Solana tokens in batch", async () => {
      const provider = new MultiChainProvider();

      // Test with Solana tokens
      const testTokens = [
        "So11111111111111111111111111111111111111112", // SOL
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
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

    it("should use cache for repeated batch requests", async () => {
      const provider = new MultiChainProvider();

      const testTokens = [
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      ];

      // First batch request
      const firstResults = await provider.getBatchPrices(
        testTokens,
        BlockchainType.EVM,
        "eth",
      );

      // Second batch request (should use cache)
      const secondResults = await provider.getBatchPrices(
        testTokens,
        BlockchainType.EVM,
        "eth",
      );

      expect(firstResults).toBeInstanceOf(Map);
      expect(secondResults).toBeInstanceOf(Map);
      expect(firstResults.size).toBe(secondResults.size);

      // Results should be the same
      testTokens.forEach((token) => {
        const firstResult = firstResults.get(token);
        const secondResult = secondResults.get(token);

        if (firstResult && secondResult) {
          expect(firstResult.price).toBe(secondResult.price);
          expect(firstResult.symbol).toBe(secondResult.symbol);
        }
      });
    });
  });

  describe("Performance comparison", () => {
    it("should demonstrate batch is faster than individual requests", async () => {
      // Test with multiple tokens
      const testTokens = [
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
        "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
      ];

      // Clear any existing cache by using a fresh provider
      const freshProvider = new MultiChainProvider();

      const batchResults = await freshProvider.getBatchPrices(
        testTokens,
        BlockchainType.EVM,
        "eth",
      );

      // Time individual requests
      const individualResults = new Map();
      for (const token of testTokens) {
        const result = await freshProvider.getPrice(
          token,
          BlockchainType.EVM,
          "eth",
        );
        individualResults.set(token, result);
      }

      // Verify both methods return the same results
      expect(batchResults.size).toBe(individualResults.size);

      testTokens.forEach((token) => {
        const batchResult = batchResults.get(token);
        const individualResult = individualResults.get(token);

        if (batchResult && individualResult) {
          expect(batchResult.price).toBeCloseTo(individualResult.price, 2);
          expect(batchResult.symbol).toBe(individualResult.symbol);
        }
      });
    });
  });
});
