import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { specificChainTokens } from "../../lib/config-utils.js";
import { BlockchainType } from "../../types/index.js";
import { DexScreenerProvider } from "../price/dexscreener.provider.js";

// Set timeout for all tests in this file to 15 seconds
vi.setConfig({ testTimeout: 15_000 });

describe("Batch Functionality Tests", () => {
  let provider: DexScreenerProvider;

  // Mock logger for the constructor
  const mockLogger: MockProxy<Logger> = mock<Logger>();

  beforeEach(() => {
    provider = new DexScreenerProvider(specificChainTokens, mockLogger);
  });

  describe("DexScreenerProvider batch methods", () => {
    it("should fetch batch prices for multiple tokens", async () => {
      // Test with a few well-known Ethereum tokens
      const testTokens = [
        specificChainTokens.eth.eth,
        specificChainTokens.eth.usdc,
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
      const results = await provider.getBatchPrices(
        [],
        BlockchainType.EVM,
        "eth",
      );

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(0);
    });

    it("should handle mix of valid and invalid tokens", async () => {
      const testTokens = [
        specificChainTokens.eth.eth, // WETH - valid
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
});
