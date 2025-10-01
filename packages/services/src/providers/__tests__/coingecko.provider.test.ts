import dotenv from "dotenv";
import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { BlockchainType } from "../../types/index.js";
import {
  CoinGeckoProvider,
  CoinGeckoProviderConfig,
} from "../coingecko.provider.js";

// Load environment variables
dotenv.config();

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || "";
console.log("COINGECKO_API_KEY", COINGECKO_API_KEY);

// Set timeout for all tests in this file to 30 seconds
vi.setConfig({ testTimeout: 30_000 });

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

// Mock logger for the constructor
const mockLogger: MockProxy<Logger> = mock<Logger>();

const config: CoinGeckoProviderConfig = {
  apiKey: COINGECKO_API_KEY,
  mode: "demo",
  specificChainTokens,
};

describe("CoinGeckoProvider", () => {
  let provider: CoinGeckoProvider;

  beforeEach(() => {
    provider = new CoinGeckoProvider(config, mockLogger);
  });

  describe("Basic functionality", () => {
    it("should have correct name", () => {
      expect(provider.getName()).toBe("CoinGecko");
    });
  });

  describe("Solana token price fetching", () => {
    it("should fetch SOL price", async () => {
      const priceReport = await provider.getPrice(
        solanaTokens.SOL,
        BlockchainType.SVM,
        "svm",
      );

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
    }, 15000);

    it("should fetch USDC price", async () => {
      const priceReport = await provider.getPrice(
        solanaTokens.USDC,
        BlockchainType.SVM,
        "svm",
      );

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1
    }, 15000);
  });

  describe("Ethereum token price fetching", () => {
    it("should fetch ETH price", async () => {
      const priceReport = await provider.getPrice(
        ethereumTokens.ETH,
        BlockchainType.EVM,
        "eth",
      );

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
    });

    it("should fetch USDC price", async () => {
      const priceReport = await provider.getPrice(
        ethereumTokens.USDC,
        BlockchainType.EVM,
        "eth",
      );

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1
    });

    it("should fetch ETH price above $1000 on Ethereum mainnet", async () => {
      const priceReport = await provider.getPrice(
        ethereumTokens.ETH,
        BlockchainType.EVM,
        "eth",
      );

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(1000); // ETH should be above $1000
    }, 15000);

    it("should fetch USDT price close to $1 on Ethereum mainnet", async () => {
      const priceReport = await provider.getPrice(
        ethereumTokens.USDT,
        BlockchainType.EVM,
        "eth",
      );

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDT should be close to $1
    }, 15000);
  });

  describe("Base token price fetching", () => {
    it("should fetch ETH on Base", async () => {
      const priceReport = await provider.getPrice(
        baseTokens.ETH,
        BlockchainType.EVM,
        "base",
      );

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
    });

    it("should fetch USDC on Base", async () => {
      const priceReport = await provider.getPrice(
        baseTokens.USDC,
        BlockchainType.EVM,
        "base",
      );

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
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
      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "eth",
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

    it("should fetch batch prices for Base tokens", async () => {
      const tokens = [baseTokens.ETH, baseTokens.USDC];
      const results = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "base",
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
      const priceReport = await provider.getPrice(
        burnAddress,
        BlockchainType.EVM,
        "eth",
      );

      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(0);
      expect(priceReport?.symbol).toBe("BURN");
    });
  });

  describe("Error handling", () => {
    it("should return null for invalid token addresses", async () => {
      const invalidToken = "0xinvalid";
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

      expect(results.size).toBe(1);
      expect(results.get(ethereumTokens.ETH)).toBeNull();
    });
  });
});
