import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { BlockchainType } from "../../types/index.js";
import {
  MultiChainProvider,
  MultiChainProviderConfig,
} from "../multi-chain.provider.js";
import {
  MockCoinGeckoClient,
  commonMockResponses,
  mockBatchTokenPrices,
  mockTokenPrice,
  multichainCoinGeckoConfig,
  setupCoinGeckoMock,
} from "./helpers/coingecko.js";
import { specificChainTokens, testTokens } from "./helpers/tokens.js";

vi.mock("@coingecko/coingecko-typescript");

const ethereumTokens = testTokens.ethereum;
const mockLogger: MockProxy<Logger> = mock<Logger>();

describe("MultiChainProvider Configurable", () => {
  describe("With CoinGecko Provider", () => {
    let provider: MultiChainProvider;
    let mockCoinGeckoInstance: MockCoinGeckoClient;

    beforeEach(() => {
      vi.clearAllMocks();
      mockCoinGeckoInstance = setupCoinGeckoMock();
      provider = new MultiChainProvider(multichainCoinGeckoConfig, mockLogger);
    });

    it("should have CoinGecko in the name", () => {
      expect(provider.getName()).toContain("CoinGecko");
    });

    it("should fetch ETH price using CoinGecko", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);

      const priceReport = await provider.getPrice(ethereumTokens.eth);

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
    });

    it("should fetch batch prices using CoinGecko", async () => {
      const tokens = [ethereumTokens.eth, ethereumTokens.usdc];

      mockBatchTokenPrices(mockCoinGeckoInstance, [
        commonMockResponses.eth,
        commonMockResponses.usdc,
      ]);

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
      specificChainTokens,
    };

    beforeEach(() => {
      provider = new MultiChainProvider(dexScreenerConfig, mockLogger);
    });

    it("should have DexScreener in the name", () => {
      expect(provider.getName()).toContain("DexScreener");
    });

    it("should fetch ETH price using DexScreener", async () => {
      const priceReport = await provider.getPrice(ethereumTokens.eth);

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
    });

    it("should fetch batch prices using DexScreener", async () => {
      const tokens = [ethereumTokens.eth, ethereumTokens.usdc];
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
        coingecko: { apiKey: "test-api-key", mode: "demo" },
      },
      evmChains: ["eth"],
      specificChainTokens,
    };
    const dexScreenerConfig: MultiChainProviderConfig = {
      priceProvider: { type: "dexscreener" },
      evmChains: ["eth"],
      specificChainTokens,
    };

    it("should detect chains correctly with both providers", () => {
      setupCoinGeckoMock();

      const coinGeckoProvider = new MultiChainProvider(
        coingeckoConfig,
        mockLogger,
      );
      const dexScreenerProvider = new MultiChainProvider(
        dexScreenerConfig,
        mockLogger,
      );

      expect(coinGeckoProvider.determineChain(ethereumTokens.eth)).toBe(
        BlockchainType.EVM,
      );
      expect(dexScreenerProvider.determineChain(ethereumTokens.eth)).toBe(
        BlockchainType.EVM,
      );
    });
  });
});
