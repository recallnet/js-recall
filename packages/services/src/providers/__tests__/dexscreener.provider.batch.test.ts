import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { specificChainTokens } from "../../lib/config-utils.js";
import { BlockchainType } from "../../types/index.js";
import { DexScreenerProvider } from "../price/dexscreener.provider.js";

vi.setConfig({ testTimeout: 15_000 });

const mockLogger: MockProxy<Logger> = mock<Logger>();

describe("Batch Functionality Tests", () => {
  let provider: DexScreenerProvider;

  beforeEach(() => {
    provider = new DexScreenerProvider(specificChainTokens, mockLogger);
  });

  describe("DexScreenerProvider batch methods", () => {
    it("should fetch batch prices for multiple tokens", async () => {
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

      const wethResult = results.get(testTokens[0] as string);
      expect(wethResult).toBeDefined();
      if (wethResult) {
        expect(wethResult.price).toBeGreaterThan(0);
      }

      const invalidResult = results.get(testTokens[1] as string);
      expect(invalidResult).toBeNull();
    });
  });
});
