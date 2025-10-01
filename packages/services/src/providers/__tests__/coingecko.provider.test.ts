import { Coingecko } from "@coingecko/coingecko-typescript";
import { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { BlockchainType } from "../../types/index.js";
import {
  CoinGeckoProvider,
  CoinGeckoProviderConfig,
} from "../coingecko.provider.js";

// Mock the CoinGecko SDK
vi.mock("@coingecko/coingecko-typescript");

// Type for mocking CoinGecko client
interface MockCoinGeckoClient {
  coins: {
    contract: {
      get: ReturnType<typeof vi.fn>;
    };
  };
  simple: {
    tokenPrice: {
      getID: ReturnType<typeof vi.fn>;
    };
  };
}

// Test tokens
const solanaTokens = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
};

const ethereumTokens = {
  ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT on Ethereum
  SHIB: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
};

const baseTokens = {
  ETH: "0x4200000000000000000000000000000000000006", // WETH on Base
  USDC: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", // USDbC on Base
};

const specificChainTokens = {
  svm: {
    sol: "So11111111111111111111111111111111111111112",
    usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
  eth: {
    eth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH on Ethereum
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
  },
  base: {
    eth: "0x4200000000000000000000000000000000000006", // WETH on Base
    usdc: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", // USDbC on Base
  },
};

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

    // Create mock CoinGecko client instance
    mockCoinGeckoInstance = {
      coins: {
        contract: {
          get: vi.fn(),
        },
      },
      simple: {
        tokenPrice: {
          getID: vi.fn(),
        },
      },
    };

    // Mock the CoinGecko constructor to return our mock instance
    vi.mocked(Coingecko).mockImplementation(
      () => mockCoinGeckoInstance as unknown as Coingecko,
    );

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
      // Mock CoinGecko API response for SOL
      mockCoinGeckoInstance.coins.contract.get.mockResolvedValue({
        id: "solana",
        symbol: "sol",
        name: "Solana",
        market_data: {
          current_price: { usd: 150.75 },
          total_volume: { usd: 2500000000 },
          fully_diluted_valuation: { usd: 85000000000 },
        },
      });

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
      // Mock CoinGecko API response for USDC
      mockCoinGeckoInstance.coins.contract.get.mockResolvedValue({
        id: "usd-coin",
        symbol: "usdc",
        name: "USD Coin",
        market_data: {
          current_price: { usd: 1.0001 },
          total_volume: { usd: 5000000000 },
          fully_diluted_valuation: { usd: 30000000000 },
        },
      });

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
      expect(priceReport?.price).toBe(1.0001);
      expect(priceReport?.symbol).toBe("USDC"); // Should be uppercase
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1
    });
  });

  describe("Ethereum token price fetching", () => {
    it("should fetch ETH price", async () => {
      // Mock CoinGecko API response for ETH
      mockCoinGeckoInstance.coins.contract.get.mockResolvedValue({
        id: "weth",
        symbol: "weth",
        name: "Wrapped Ether",
        market_data: {
          current_price: { usd: 2850.45 },
          total_volume: { usd: 12000000000 },
          fully_diluted_valuation: { usd: 350000000000 },
        },
      });

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
      // Mock CoinGecko API response for USDC on Ethereum
      mockCoinGeckoInstance.coins.contract.get.mockResolvedValue({
        id: "usd-coin",
        symbol: "usdc",
        name: "USD Coin",
        market_data: {
          current_price: { usd: 0.9998 },
          total_volume: { usd: 8000000000 },
          fully_diluted_valuation: { usd: 45000000000 },
        },
      });

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
      // Mock CoinGecko API response for ETH with high price
      mockCoinGeckoInstance.coins.contract.get.mockResolvedValue({
        id: "weth",
        symbol: "weth",
        name: "Wrapped Ether",
        market_data: {
          current_price: { usd: 2850.45 },
          total_volume: { usd: 12000000000 },
          fully_diluted_valuation: { usd: 350000000000 },
        },
      });

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
      // Mock CoinGecko API response for USDT
      mockCoinGeckoInstance.coins.contract.get.mockResolvedValue({
        id: "tether",
        symbol: "usdt",
        name: "Tether",
        market_data: {
          current_price: { usd: 1.0002 },
          total_volume: { usd: 65000000000 },
          fully_diluted_valuation: { usd: 100000000000 },
        },
      });

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
      // Mock CoinGecko API response for ETH on Base
      mockCoinGeckoInstance.coins.contract.get.mockResolvedValue({
        id: "weth",
        symbol: "weth",
        name: "Wrapped Ether",
        market_data: {
          current_price: { usd: 2850.45 },
          total_volume: { usd: 500000000 },
          fully_diluted_valuation: { usd: 350000000000 },
        },
      });

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
      // Mock CoinGecko API response for USDC on Base
      mockCoinGeckoInstance.coins.contract.get.mockResolvedValue({
        id: "bridged-usdc-base",
        symbol: "usdbc",
        name: "USD Base Coin",
        market_data: {
          current_price: { usd: 0.9999 },
          total_volume: { usd: 100000000 },
          fully_diluted_valuation: { usd: 1000000000 },
        },
      });

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
      expect(priceReport?.price).toBe(0.9999);
      expect(priceReport?.symbol).toBe("USDBC");
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

      // Mock individual API responses for each token
      mockCoinGeckoInstance.coins.contract.get
        .mockResolvedValueOnce({
          id: "weth",
          symbol: "weth",
          name: "Wrapped Ether",
          market_data: {
            current_price: { usd: 2850.45 },
            total_volume: { usd: 12000000000 },
            fully_diluted_valuation: { usd: 350000000000 },
          },
        })
        .mockResolvedValueOnce({
          id: "usd-coin",
          symbol: "usdc",
          name: "USD Coin",
          market_data: {
            current_price: { usd: 0.9998 },
            total_volume: { usd: 8000000000 },
            fully_diluted_valuation: { usd: 45000000000 },
          },
        })
        .mockResolvedValueOnce({
          id: "tether",
          symbol: "usdt",
          name: "Tether",
          market_data: {
            current_price: { usd: 1.0002 },
            total_volume: { usd: 65000000000 },
            fully_diluted_valuation: { usd: 100000000000 },
          },
        });

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

      // Mock individual API responses for each token
      mockCoinGeckoInstance.coins.contract.get
        .mockResolvedValueOnce({
          id: "weth",
          symbol: "weth",
          name: "Wrapped Ether",
          market_data: {
            current_price: { usd: 2850.45 },
            total_volume: { usd: 500000000 },
            fully_diluted_valuation: { usd: 350000000000 },
          },
        })
        .mockResolvedValueOnce({
          id: "bridged-usdc-base",
          symbol: "usdbc",
          name: "USD Base Coin",
          market_data: {
            current_price: { usd: 0.9999 },
            total_volume: { usd: 100000000 },
            fully_diluted_valuation: { usd: 1000000000 },
          },
        });

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

      // Mock API error response
      mockCoinGeckoInstance.coins.contract.get.mockRejectedValue(
        new Error("Invalid contract address"),
      );

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
      // Mock API error (retries are handled by the SDK internally)
      mockCoinGeckoInstance.coins.contract.get.mockRejectedValue(
        new Error("API error after retries"),
      );

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
      // Since the SDK handles retries internally, we just mock a successful response
      mockCoinGeckoInstance.coins.contract.get.mockResolvedValue({
        id: "weth",
        symbol: "weth",
        name: "Wrapped Ether",
        market_data: {
          current_price: { usd: 2850.45 },
          total_volume: { usd: 12000000000 },
          fully_diluted_valuation: { usd: 350000000000 },
        },
      });

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
