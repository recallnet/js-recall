import { config } from "dotenv";
import { Logger } from "pino";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { BlockchainType } from "../../types/index.js";
import {
  MultiChainProvider,
  MultiChainProviderConfig,
} from "../multi-chain.provider.js";

// Load environment variables
config();

// Set timeout for all tests in this file to 30 seconds
vi.setConfig({ testTimeout: 30_000 });

// Test tokens
const ethereumTokens = {
  ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
};

// Mock logger for the constructor
const mockLogger: MockProxy<Logger> = mock<Logger>();

describe("MultiChainProvider Configurable", () => {
  describe("With CoinGecko Provider", () => {
    let provider: MultiChainProvider;
    let coingeckoConfig: MultiChainProviderConfig;
    beforeAll(() => {
      const apiKey = process.env.COINGECKO_API_KEY!;
      coingeckoConfig = {
        priceProvider: {
          type: "coingecko",
          coingecko: { apiKey, mode: "demo" },
        },
        evmChains: ["eth"],
        specificChainTokens: {
          eth: { ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
        },
      };
    });

    beforeEach(() => {
      provider = new MultiChainProvider(coingeckoConfig, mockLogger);
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
    const dexScreenerConfig: MultiChainProviderConfig = {
      priceProvider: { type: "dexscreener" },
      evmChains: ["eth"],
      specificChainTokens: {
        eth: { ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
      },
    };

    beforeEach(() => {
      provider = new MultiChainProvider(dexScreenerConfig, mockLogger);
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

  describe("Chain Detection", () => {
    const coingeckoConfig: MultiChainProviderConfig = {
      priceProvider: {
        type: "coingecko",
        coingecko: { apiKey: process.env.COINGECKO_API_KEY!, mode: "demo" },
      },
      evmChains: ["eth"],
      specificChainTokens: {
        eth: { ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
      },
    };
    const dexScreenerConfig: MultiChainProviderConfig = {
      priceProvider: { type: "dexscreener" },
      evmChains: ["eth"],
      specificChainTokens: {
        eth: { ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
      },
    };
    it("should detect chains correctly with both providers", () => {
      const coinGeckoProvider = new MultiChainProvider(
        coingeckoConfig,
        mockLogger,
      );
      const dexScreenerProvider = new MultiChainProvider(
        dexScreenerConfig,
        mockLogger,
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
