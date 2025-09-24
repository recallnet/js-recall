import dotenv from "dotenv";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MultiChainProvider } from "@/services/providers/multi-chain.provider.js";
import { BlockchainType, PriceProvider } from "@/types/index.js";

// Load environment variables
dotenv.config();

// Set timeout for all tests in this file to 30 seconds
vi.setConfig({ testTimeout: 30_000 });

// Test tokens
const ethereumTokens = {
  ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
};

describe("MultiChainProvider Configurable", () => {
  describe("With CoinGecko Provider", () => {
    let provider: MultiChainProvider;

    beforeEach(() => {
      provider = new MultiChainProvider(PriceProvider.COINGECKO);
    });

    it("should have CoinGecko in the name", () => {
      expect(provider.getName()).toContain("CoinGecko");
    });

    it("should fetch ETH price using CoinGecko", async () => {
      const priceReport = await provider.getPrice(ethereumTokens.ETH);

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
    });

    it("should fetch batch prices using CoinGecko", async () => {
      const tokens = [ethereumTokens.ETH, ethereumTokens.USDC];
      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "eth",
      );

      expect(results.size).toBe(tokens.length);
      for (const token of tokens) {
        const priceInfo = results.get(token);
        expect(priceInfo).not.toBeNull();
      }
    });
  });

  describe("With DexScreener provider", () => {
    let provider: MultiChainProvider;

    beforeEach(() => {
      process.env.PRICE_PROVIDER = PriceProvider.DEXSCREENER;
      provider = new MultiChainProvider();
    });

    it("should have DexScreener in the name", () => {
      expect(provider.getName()).toContain("DexScreener");
    });

    it("should fetch ETH price using DexScreener", async () => {
      const priceReport = await provider.getPrice(ethereumTokens.ETH);

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
    });

    it("should fetch batch prices using DexScreener", async () => {
      const tokens = [ethereumTokens.ETH, ethereumTokens.USDC];
      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "eth",
      );

      expect(results.size).toBe(tokens.length);
      for (const token of tokens) {
        const priceInfo = results.get(token);
        expect(priceInfo).not.toBeNull();
      }
    });
  });

  describe("Default Provider", () => {
    it("should default to CoinGecko when no provider is specified", () => {
      const provider = new MultiChainProvider();
      expect(provider.getName()).toContain("CoinGecko");
    });
  });

  describe("Chain Detection", () => {
    it("should detect chains correctly with both providers", () => {
      const coinGeckoProvider = new MultiChainProvider(PriceProvider.COINGECKO);
      const dexScreenerProvider = new MultiChainProvider(
        PriceProvider.DEXSCREENER,
      );

      // Both providers should detect chains the same way
      expect(coinGeckoProvider.determineChain(ethereumTokens.ETH)).toBe(
        BlockchainType.EVM,
      );
      expect(dexScreenerProvider.determineChain(ethereumTokens.ETH)).toBe(
        BlockchainType.EVM,
      );
    });
  });
});
