import { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { BlockchainType } from "../../types/index.js";
import {
  CoinGeckoProvider,
  CoinGeckoProviderConfig,
} from "../coingecko.provider.js";
import {
  MockCoinGeckoClient,
  commonMockResponses,
  mockBatchTokenPrices,
  mockTokenPrice,
  mockTokenPriceError,
  setupCoinGeckoMock,
  specificChainTokens,
  testTokens,
} from "./helpers/coingecko.helpers.js";

// Mock the CoinGecko SDK
vi.mock("@coingecko/coingecko-typescript");

// Extract token references for easier use
const {
  solana: solanaTokens,
  ethereum: ethereumTokens,
  base: baseTokens,
} = testTokens;

// Mock logger
const mockLogger: MockProxy<Logger> = mock<Logger>();

const config: CoinGeckoProviderConfig = {
  apiKey: "test-api-key",
  mode: "demo",
  specificChainTokens,
};

describe("CoinGeckoProvider", () => {
  let provider: CoinGeckoProvider;
  let mockCoinGeckoInstance: MockCoinGeckoClient;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Set up CoinGecko mock using helper
    mockCoinGeckoInstance = setupCoinGeckoMock();

    // Create provider instance
    provider = new CoinGeckoProvider(config, mockLogger);
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
      // Mock CoinGecko API response for SOL using helper
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.SOL);

      const priceReport = await provider.getPrice(
        solanaTokens.SOL,
        BlockchainType.SVM,
        "svm",
      );

      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        solanaTokens.SOL.toLowerCase(),
        { id: "solana" },
      );
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(150.75);
      expect(priceReport?.symbol).toBe("SOL");
      expect(priceReport?.volume?.h24).toBe(2500000000);
      expect(priceReport?.fdv).toBe(85000000000);
    });

    it("should fetch USDC price", async () => {
      // Mock CoinGecko API response for USDC using helper
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.USDC);

      const priceReport = await provider.getPrice(
        solanaTokens.USDC,
        BlockchainType.SVM,
        "svm",
      );

      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        solanaTokens.USDC.toLowerCase(),
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
      // Mock CoinGecko API response for ETH using helper
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.ETH);

      const priceReport = await provider.getPrice(
        ethereumTokens.ETH,
        BlockchainType.EVM,
        "eth",
      );

      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        ethereumTokens.ETH.toLowerCase(),
        { id: "ethereum" },
      );
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(2850.45);
      expect(priceReport?.symbol).toBe("WETH");
    });

    it("should fetch USDC price", async () => {
      // Mock CoinGecko API response for USDC on Ethereum using helper
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.USDC);

      const priceReport = await provider.getPrice(
        ethereumTokens.USDC,
        BlockchainType.EVM,
        "eth",
      );

      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        ethereumTokens.USDC.toLowerCase(),
        { id: "ethereum" },
      );
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(0.9998);
      expect(priceReport?.symbol).toBe("USDC");
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1
    });

    it("should fetch ETH price above $1000 on Ethereum mainnet", async () => {
      // Mock CoinGecko API response for ETH with high price using helper
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.ETH);

      const priceReport = await provider.getPrice(
        ethereumTokens.ETH,
        BlockchainType.EVM,
        "eth",
      );

      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(2850.45);
      expect(priceReport?.price).toBeGreaterThan(1000); // ETH should be above $1000
    });

    it("should fetch USDT price close to $1 on Ethereum mainnet", async () => {
      // Mock CoinGecko API response for USDT using helper
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.USDT);

      const priceReport = await provider.getPrice(
        ethereumTokens.USDT,
        BlockchainType.EVM,
        "eth",
      );

      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        ethereumTokens.USDT.toLowerCase(),
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
      // Mock CoinGecko API response for ETH on Base using helper
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.ETH);

      const priceReport = await provider.getPrice(
        baseTokens.ETH,
        BlockchainType.EVM,
        "base",
      );

      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        baseTokens.ETH.toLowerCase(),
        { id: "base" },
      );
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(2850.45);
      expect(priceReport?.symbol).toBe("WETH");
    });

    it("should fetch USDC on Base", async () => {
      // Mock CoinGecko API response for USDC on Base using helper
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.USDC);

      const priceReport = await provider.getPrice(
        baseTokens.USDC,
        BlockchainType.EVM,
        "base",
      );

      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        baseTokens.USDC.toLowerCase(),
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
      const chain = provider.determineChain(solanaTokens.SOL);
      expect(chain).toBe(BlockchainType.SVM);
    });

    it("should detect Ethereum addresses correctly", () => {
      const chain = provider.determineChain(ethereumTokens.ETH);
      expect(chain).toBe(BlockchainType.EVM);
    });
  });

  describe("Batch price fetching", () => {
    it("should fetch batch prices for Ethereum tokens", async () => {
      const tokens = [
        ethereumTokens.ETH,
        ethereumTokens.USDC,
        ethereumTokens.USDT,
      ];

      // Mock individual API responses for each token using batch helper
      mockBatchTokenPrices(mockCoinGeckoInstance, [
        commonMockResponses.ETH,
        commonMockResponses.USDC,
        commonMockResponses.USDT,
      ]);

      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "eth",
      );

      // Should call the individual API for each token
      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledTimes(3);
      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        ethereumTokens.ETH.toLowerCase(),
        { id: "ethereum" },
      );
      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        ethereumTokens.USDC.toLowerCase(),
        { id: "ethereum" },
      );
      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        ethereumTokens.USDT.toLowerCase(),
        { id: "ethereum" },
      );

      expect(results.size).toBe(tokens.length);

      // Check ETH
      const ethInfo = results.get(ethereumTokens.ETH);
      expect(ethInfo).not.toBeNull();
      expect(ethInfo?.price).toBe(2850.45);
      expect(ethInfo?.volume?.h24).toBe(12000000000);

      // Check USDC
      const usdcInfo = results.get(ethereumTokens.USDC);
      expect(usdcInfo).not.toBeNull();
      expect(usdcInfo?.price).toBe(0.9998);
      expect(usdcInfo?.volume?.h24).toBe(8000000000);

      // Check USDT
      const usdtInfo = results.get(ethereumTokens.USDT);
      expect(usdtInfo).not.toBeNull();
      expect(usdtInfo?.price).toBe(1.0002);
      expect(usdtInfo?.volume?.h24).toBe(65000000000);
    });

    it("should fetch batch prices for Base tokens", async () => {
      const tokens = [baseTokens.ETH, baseTokens.USDC];

      // Mock individual API responses for each token using batch helper
      mockBatchTokenPrices(mockCoinGeckoInstance, [
        commonMockResponses.ETH,
        commonMockResponses.USDC,
      ]);

      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "base",
      );

      // Should call the individual API for each token
      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledTimes(2);
      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        baseTokens.ETH.toLowerCase(),
        { id: "base" },
      );
      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledWith(
        baseTokens.USDC.toLowerCase(),
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

      // Should not call the API for burn addresses
      expect(mockCoinGeckoInstance.coins.contract.get).not.toHaveBeenCalled();
      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(0);
      expect(priceReport?.symbol).toBe("BURN");
    });
  });

  describe("Error handling", () => {
    it("should return null for invalid token addresses", async () => {
      const invalidToken = "0xinvalid";

      // Mock API error response using helper
      mockTokenPriceError(mockCoinGeckoInstance, "Invalid contract address");

      const priceReport = await provider.getPrice(
        invalidToken,
        BlockchainType.EVM,
        "eth",
      );

      expect(priceReport).toBeNull();
    });

    it("should handle unsupported chains gracefully", async () => {
      const tokens = [ethereumTokens.ETH];
      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        // We want to test the error handling for unsupported chains
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "unsupported" as any,
      );

      // Should not call the API for unsupported chains
      expect(
        mockCoinGeckoInstance.simple.tokenPrice.getID,
      ).not.toHaveBeenCalled();
      expect(results.size).toBe(1);
      expect(results.get(ethereumTokens.ETH)).toBeNull();
    });

    it("should handle API errors gracefully", async () => {
      // Mock API error (retries are handled by the SDK internally) using helper
      mockTokenPriceError(mockCoinGeckoInstance, "API error after retries");

      const priceReport = await provider.getPrice(
        ethereumTokens.ETH,
        BlockchainType.EVM,
        "eth",
      );

      // The provider should catch the error and return null
      expect(mockCoinGeckoInstance.coins.contract.get).toHaveBeenCalledTimes(1);
      expect(priceReport).toBeNull();
    });

    it("should handle successful response after SDK retries", async () => {
      // Since the SDK handles retries internally, we just mock a successful response using helper
      mockTokenPrice(mockCoinGeckoInstance, commonMockResponses.ETH);

      const priceReport = await provider.getPrice(
        ethereumTokens.ETH,
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
