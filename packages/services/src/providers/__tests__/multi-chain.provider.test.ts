import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { specificChainTokens } from "../../lib/config-utils.js";
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
} from "./mocks/coingecko.js";

vi.mock("@coingecko/coingecko-typescript");
vi.setConfig({ testTimeout: 30_000 });

const mockLogger: MockProxy<Logger> = mock<Logger>();

describe("MultiChainProvider", () => {
  let provider: MultiChainProvider;
  let mockCoinGeckoInstance: MockCoinGeckoClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCoinGeckoInstance = setupCoinGeckoMock();
    provider = new MultiChainProvider(multichainCoinGeckoConfig, mockLogger);
  });

  describe("Basic functionality", () => {
    it("should have correct name", () => {
      expect(provider.getName()).toBe("CoinGecko MultiChain");
    });
  });

  describe("Chain detection", () => {
    it("should detect Solana addresses correctly", () => {
      const chain = provider.determineChain(specificChainTokens.svm.sol);
      expect(chain).toBe(BlockchainType.SVM);
    });

    it("should detect Ethereum addresses correctly", () => {
      const chain = provider.determineChain(specificChainTokens.eth.eth);
      expect(chain).toBe(BlockchainType.EVM);
    });
  });

  describe("Ethereum token price fetching", () => {
    it("should fetch ETH price", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);

      const priceReport = await provider.getPrice(specificChainTokens.eth.eth);

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
    });

    it("should fetch USDC price", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.usdc);

      const priceReport = await provider.getPrice(specificChainTokens.eth.usdc);

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1
    });
  });

  describe("Base token price fetching with specific chain", () => {
    it("should fetch ETH on Base with specificChain parameter", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);

      const priceReport = await provider.getPrice(
        specificChainTokens.base.eth,
        BlockchainType.EVM,
        "base",
      );

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
    });

    it("should fetch USDC on Base with specificChain parameter", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.usdc);

      const priceReport = await provider.getPrice(
        specificChainTokens.base.usdc,
        BlockchainType.EVM,
        "base",
      );

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1
    });
  });

  describe("Token price fetching with specific chains", () => {
    it("should get detailed price info for Ethereum tokens", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);

      const priceReport = await provider.getPrice(
        specificChainTokens.eth.eth,
        BlockchainType.EVM,
        "eth",
      );

      expect(priceReport).not.toBeNull();
      if (priceReport) {
        expect(priceReport.chain).toBe(BlockchainType.EVM);
        expect(priceReport.specificChain).toBe("eth");
        expect(priceReport.price).toBeGreaterThan(0);
      }
    });

    it("should return chain and price info for Solana tokens", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.sol);

      const priceReport = await provider.getPrice(
        specificChainTokens.svm.sol,
        BlockchainType.SVM,
        "svm",
      );

      expect(priceReport).not.toBeNull();
      if (priceReport) {
        expect(priceReport.chain).toBe(BlockchainType.SVM);
        expect(priceReport.specificChain).toBe("svm");
        expect(priceReport.price).not.toBeNull();
        expect(typeof priceReport.price).toBe("number");
        expect(priceReport.price).toBeGreaterThan(0);
      }
    });
  });

  describe("Multi-chain detection", () => {
    it("should try multiple chains when specific chain is not provided", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);

      const price = await provider.getPrice(specificChainTokens.eth.eth);

      expect(price).not.toBeNull();
      expect(typeof price?.price).toBe("number");
      expect(price?.price).toBeGreaterThan(0);

      const priceReport = await provider.getPrice(
        specificChainTokens.eth.eth,
        BlockchainType.EVM,
        "eth",
      );
      if (priceReport && priceReport.specificChain) {
        expect(priceReport.specificChain).toBe("eth");
      }
    });
  });

  describe("Configurable price providers", () => {
    describe("With CoinGecko Provider", () => {
      let provider: MultiChainProvider;
      let mockCoinGeckoInstance: MockCoinGeckoClient;

      beforeEach(() => {
        vi.clearAllMocks();
        mockCoinGeckoInstance = setupCoinGeckoMock();
        provider = new MultiChainProvider(
          multichainCoinGeckoConfig,
          mockLogger,
        );
      });

      it("should have CoinGecko in the name", () => {
        expect(provider.getName()).toContain("CoinGecko");
      });

      it("should fetch ETH price using CoinGecko", async () => {
        mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);

        const priceReport = await provider.getPrice(
          specificChainTokens.eth.eth,
        );

        expect(priceReport).not.toBeNull();
        expect(typeof priceReport?.price).toBe("number");
        expect(priceReport?.price).toBeGreaterThan(0);
      });

      it("should fetch batch prices using CoinGecko", async () => {
        const tokens = [
          specificChainTokens.eth.eth,
          specificChainTokens.eth.usdc,
        ];

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
        const priceReport = await provider.getPrice(
          specificChainTokens.eth.eth,
        );

        expect(priceReport).not.toBeNull();
        expect(typeof priceReport?.price).toBe("number");
        expect(priceReport?.price).toBeGreaterThan(0);
      });

      it("should fetch batch prices using DexScreener", async () => {
        const tokens = [
          specificChainTokens.eth.eth,
          specificChainTokens.eth.usdc,
        ];
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

        expect(
          coinGeckoProvider.determineChain(specificChainTokens.eth.eth),
        ).toBe(BlockchainType.EVM);
        expect(
          dexScreenerProvider.determineChain(specificChainTokens.eth.eth),
        ).toBe(BlockchainType.EVM);
      });
    });
  });
});
