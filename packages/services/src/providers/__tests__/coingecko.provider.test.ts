import { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { specificChainTokens } from "../../lib/index.js";
import { BlockchainType } from "../../types/index.js";
import { CoinGeckoProvider } from "../price/coingecko.provider.js";
import {
  MockCoinGeckoClient,
  coingeckoConfig,
  commonMockResponses,
  mockBatchTokenPrices,
  mockTokenPrice,
  mockTokenPriceError,
  setupCoinGeckoMock,
} from "./mocks/coingecko.js";

vi.mock("@coingecko/coingecko-typescript");

const {
  svm: solanaTokens,
  eth: ethereumTokens,
  base: baseTokens,
} = specificChainTokens;
const mockLogger: MockProxy<Logger> = mock<Logger>();

describe("CoinGeckoProvider", () => {
  let provider: CoinGeckoProvider;
  let mockCoinGeckoInstance: MockCoinGeckoClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCoinGeckoInstance = setupCoinGeckoMock();
    provider = new CoinGeckoProvider(coingeckoConfig, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic functionality", () => {
    it("should have correct name", () => {
      expect(provider.getName()).toBe("CoinGecko");
    });
  });

  describe("Solana token price fetching", () => {
    it("should fetch SOL price", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.sol);

      const priceReport = await provider.getPrice(
        solanaTokens.sol,
        BlockchainType.SVM,
        "svm",
      );

      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        solanaTokens.sol.toLowerCase(),
        { id: "solana" },
      );
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(150.75);
      expect(priceReport?.symbol).toBe("SOL");
      expect(priceReport?.volume?.h24).toBe(2500000000);
      expect(priceReport?.fdv).toBe(85000000000);
    });

    it("should fetch USDC price", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.usdc);

      const priceReport = await provider.getPrice(
        solanaTokens.usdc,
        BlockchainType.SVM,
        "svm",
      );

      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        solanaTokens.usdc.toLowerCase(),
        { id: "solana" },
      );
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(0.9998);
      expect(priceReport?.symbol).toBe("USDC"); // Should be uppercase
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1
    });
  });

  describe("Ethereum token price fetching", () => {
    it("should fetch ETH price", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);

      const priceReport = await provider.getPrice(
        ethereumTokens.eth,
        BlockchainType.EVM,
        "eth",
      );

      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        ethereumTokens.eth.toLowerCase(),
        { id: "ethereum" },
      );
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(2850.45);
      expect(priceReport?.symbol).toBe("WETH");
    });

    it("should fetch USDC price", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.usdc);

      const priceReport = await provider.getPrice(
        ethereumTokens.usdc,
        BlockchainType.EVM,
        "eth",
      );

      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        ethereumTokens.usdc.toLowerCase(),
        { id: "ethereum" },
      );
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(0.9998);
      expect(priceReport?.symbol).toBe("USDC");
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1
    });

    it("should fetch ETH price above $1000 on Ethereum mainnet", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);

      const priceReport = await provider.getPrice(
        ethereumTokens.eth,
        BlockchainType.EVM,
        "eth",
      );

      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(2850.45);
      expect(priceReport?.price).toBeGreaterThan(1000); // ETH should be above $1000
    });

    it("should fetch USDT price close to $1 on Ethereum mainnet", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.usdt);

      const priceReport = await provider.getPrice(
        ethereumTokens.usdt,
        BlockchainType.EVM,
        "eth",
      );

      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        ethereumTokens.usdt.toLowerCase(),
        { id: "ethereum" },
      );
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(1.0002);
      expect(priceReport?.symbol).toBe("USDT");
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDT should be close to $1
    });
  });

  describe("Base token price fetching", () => {
    it("should fetch ETH on Base", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);

      const priceReport = await provider.getPrice(
        baseTokens.eth,
        BlockchainType.EVM,
        "base",
      );

      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        baseTokens.eth.toLowerCase(),
        { id: "base" },
      );
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(2850.45);
      expect(priceReport?.symbol).toBe("WETH");
    });

    it("should fetch USDC on Base", async () => {
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.usdc);

      const priceReport = await provider.getPrice(
        baseTokens.usdc,
        BlockchainType.EVM,
        "base",
      );

      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        baseTokens.usdc.toLowerCase(),
        { id: "base" },
      );
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(0.9998);
      expect(priceReport?.symbol).toBe("USDC");
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1
    });
  });

  describe("Chain detection", () => {
    it("should detect Solana addresses correctly", () => {
      const chain = provider.determineChain(solanaTokens.sol);
      expect(chain).toBe(BlockchainType.SVM);
    });

    it("should detect Ethereum addresses correctly", () => {
      const chain = provider.determineChain(ethereumTokens.eth);
      expect(chain).toBe(BlockchainType.EVM);
    });
  });

  describe("Batch price fetching", () => {
    it("should fetch batch prices for Ethereum tokens", async () => {
      const tokens = [
        ethereumTokens.eth,
        ethereumTokens.usdc,
        ethereumTokens.usdt,
      ];

      mockBatchTokenPrices(mockCoinGeckoInstance, [
        commonMockResponses.eth,
        commonMockResponses.usdc,
        commonMockResponses.usdt,
      ]);

      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "eth",
      );

      // Should call the individual API for each token
      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledTimes(3);
      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        ethereumTokens.eth.toLowerCase(),
        { id: "ethereum" },
      );
      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        ethereumTokens.usdc.toLowerCase(),
        { id: "ethereum" },
      );
      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        ethereumTokens.usdt.toLowerCase(),
        { id: "ethereum" },
      );

      expect(results.size).toBe(tokens.length);

      // Check ETH
      const ethInfo = results.get(ethereumTokens.eth);
      expect(ethInfo).not.toBeNull();
      expect(ethInfo?.price).toBe(2850.45);
      expect(ethInfo?.volume?.h24).toBe(12000000000);

      // Check USDC
      const usdcInfo = results.get(ethereumTokens.usdc);
      expect(usdcInfo).not.toBeNull();
      expect(usdcInfo?.price).toBe(0.9998);
      expect(usdcInfo?.volume?.h24).toBe(8000000000);

      // Check USDT
      const usdtInfo = results.get(ethereumTokens.usdt);
      expect(usdtInfo).not.toBeNull();
      expect(usdtInfo?.price).toBe(1.0002);
      expect(usdtInfo?.volume?.h24).toBe(65000000000);
    });

    it("should fetch batch prices for Base tokens", async () => {
      const tokens = [baseTokens.eth, baseTokens.usdc];

      mockBatchTokenPrices(mockCoinGeckoInstance, [
        commonMockResponses.eth,
        commonMockResponses.usdc,
      ]);

      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "base",
      );

      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledTimes(2);
      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        baseTokens.eth.toLowerCase(),
        { id: "base" },
      );
      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        baseTokens.usdc.toLowerCase(),
        { id: "base" },
      );

      expect(results.size).toBe(tokens.length);

      for (const token of tokens) {
        const priceInfo = results.get(token);
        expect(priceInfo).not.toBeNull();
        if (priceInfo) {
          expect(typeof priceInfo.price).toBe("number");
          expect(priceInfo.price).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("Burn address handling", () => {
    it("should return price of 0 for burn addresses", async () => {
      const burnAddress = "0x000000000000000000000000000000000000dead";

      // The provider should not even make an API call for burn addresses
      const priceReport = await provider.getPrice(
        burnAddress,
        BlockchainType.EVM,
        "eth",
      );
      expect(mockCoinGeckoInstance.coins.contract.get).not.toHaveBeenCalled();
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(0);
      expect(priceReport?.symbol).toBe("BURN");
    });
  });

  describe("Error handling", () => {
    it("should return null for invalid token addresses", async () => {
      const invalidToken = "0xinvalid";

      mockTokenPriceError(mockCoinGeckoInstance, "Invalid contract address");

      const priceReport = await provider.getPrice(
        invalidToken,
        BlockchainType.EVM,
        "eth",
      );

      expect(priceReport).toBeNull();
    });

    it("should handle unsupported chains gracefully", async () => {
      const tokens = [ethereumTokens.eth];
      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        // We want to test the error handling for unsupported chains
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "unsupported" as any,
      );
      expect(
        mockCoinGeckoInstance.simple.tokenPrice.getID,
      ).not.toHaveBeenCalled();
      expect(results.size).toBe(1);
      expect(results.get(ethereumTokens.eth)).toBeNull();
    });

    it("should handle API errors gracefully", async () => {
      mockTokenPriceError(mockCoinGeckoInstance, "API error after retries");

      const priceReport = await provider.getPrice(
        ethereumTokens.eth,
        BlockchainType.EVM,
        "eth",
      );

      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledTimes(1);
      expect(priceReport).toBeNull();
    });

    it("should handle successful response after SDK retries", async () => {
      // Since the SDK handles retries internally, we just mock a successful response using helper
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.eth);

      const priceReport = await provider.getPrice(
        ethereumTokens.eth,
        BlockchainType.EVM,
        "eth",
      );

      // Should have been called once (SDK handles retries internally)
      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledTimes(1);
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(2850.45);
    });
  });
});
