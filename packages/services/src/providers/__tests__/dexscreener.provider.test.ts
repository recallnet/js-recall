import dotenv from "dotenv";
import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { specificChainTokens } from "../../lib/config-utils.js";
import { BlockchainType, SpecificChain } from "../../types/index.js";
import { DexScreenerProvider } from "../price/dexscreener.provider.js";

dotenv.config();

vi.setConfig({ testTimeout: 30_000 });

const mockLogger: MockProxy<Logger> = mock<Logger>();

describe("DexScreenerProvider", () => {
  let provider: DexScreenerProvider;

  beforeEach(() => {
    provider = new DexScreenerProvider(specificChainTokens, mockLogger);
  });

  describe("Basic functionality", () => {
    it("should have correct name", () => {
      expect(provider.getName()).toBe("DexScreener");
    });
  });

  describe("Solana token price fetching", () => {
    it("should fetch SOL price", async () => {
      const priceReport = await provider.getPrice(
        specificChainTokens.svm.sol,
        BlockchainType.SVM,
        "svm",
      );

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
    }, 15000);

    it("should fetch USDC price", async () => {
      const priceReport = await provider.getPrice(
        specificChainTokens.svm.usdc,
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
        specificChainTokens.eth.eth,
        BlockchainType.EVM,
        "eth",
      );

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
    });

    it("should fetch USDC price", async () => {
      const priceReport = await provider.getPrice(
        specificChainTokens.eth.usdc,
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
        specificChainTokens.eth.eth,
        BlockchainType.EVM,
        "eth",
      );

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(1000); // ETH should be above $1000
    }, 15000);

    it("should fetch USDT price close to $1 on Ethereum mainnet", async () => {
      const priceReport = await provider.getPrice(
        specificChainTokens.eth.usdt,
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
        specificChainTokens.base.eth,
        BlockchainType.EVM,
        "base",
      );

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
    });

    it("should fetch USDC on Base", async () => {
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

  describe("Chain detection", () => {
    it("should detect Solana addresses correctly", async () => {
      const chain = provider.determineChain(specificChainTokens.svm.sol);
      expect(chain).toBe(BlockchainType.SVM);
    });

    it("should detect Ethereum addresses correctly", async () => {
      const chain = provider.determineChain(specificChainTokens.eth.eth);
      expect(chain).toBe(BlockchainType.EVM);
    });
  });

  describe("Burn address handling", () => {
    it("should return price of 0 for EVM burn address", async () => {
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

    it("should return price of 0 for Solana burn address", async () => {
      const burnAddress = "1nc1nerator11111111111111111111111111111111";
      const priceReport = await provider.getPrice(
        burnAddress,
        BlockchainType.SVM,
        "svm",
      );

      expect(priceReport).not.toBeNull();
      expect(priceReport?.price).toBe(0);
      expect(priceReport?.symbol).toBe("BURN");
    });
  });

  describe("Stablecoin detection", () => {
    it("should correctly identify USDC as stablecoin on Ethereum", () => {
      const isStable = provider.isStablecoin(
        specificChainTokens.eth.usdc,
        "eth",
      );
      expect(isStable).toBe(true);
    });

    it("should correctly identify USDT as stablecoin on Ethereum", () => {
      const isStable = provider.isStablecoin(
        specificChainTokens.eth.usdt,
        "eth",
      );
      expect(isStable).toBe(true);
    });

    it("should correctly identify ETH as not a stablecoin", () => {
      const isStable = provider.isStablecoin(
        specificChainTokens.eth.eth,
        "eth",
      );
      expect(isStable).toBe(false);
    });

    it("should return false for unknown chain", () => {
      const isStable = provider.isStablecoin(
        specificChainTokens.eth.usdc,
        "unknown" as SpecificChain,
      );
      expect(isStable).toBe(false);
    });
  });

  describe("Batch price fetching", () => {
    it("should fetch prices for multiple tokens", async () => {
      const tokens = [
        specificChainTokens.eth.eth,
        specificChainTokens.eth.usdc,
        specificChainTokens.eth.usdt,
      ];

      const prices = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "eth",
      );
      expect(prices.size).toBe(3);

      const ethPrice = prices.get(specificChainTokens.eth.eth);
      expect(ethPrice).not.toBeNull();
      expect(ethPrice?.price).toBeGreaterThan(0);

      const usdcPrice = prices.get(specificChainTokens.eth.usdc);
      expect(usdcPrice).not.toBeNull();
      expect(usdcPrice?.price).toBeGreaterThan(0);
      expect(usdcPrice?.price).toBeCloseTo(1, 1);

      const usdtPrice = prices.get(specificChainTokens.eth.usdt);
      expect(usdtPrice).not.toBeNull();
      expect(usdtPrice?.price).toBeGreaterThan(0);
    }, 10000);

    it("should handle batch with burn addresses", async () => {
      const tokens = [
        specificChainTokens.eth.eth,
        "0x000000000000000000000000000000000000dead", // Burn address
      ];

      const prices = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "eth",
      );
      expect(prices.size).toBe(2);

      const burnPrice = prices.get(
        "0x000000000000000000000000000000000000dead",
      );
      expect(burnPrice).not.toBeNull();
      expect(burnPrice?.price).toBe(0);
      expect(burnPrice?.symbol).toBe("BURN");

      const ethPrice = prices.get(specificChainTokens.eth.eth);
      expect(ethPrice).not.toBeNull();
      expect(ethPrice?.price).toBeGreaterThan(0);
    }, 10000);

    it("should handle empty batch", async () => {
      const tokens: string[] = [];

      const prices = await provider.getBatchPrices(
        tokens,
        BlockchainType.EVM,
        "eth",
      );

      expect(prices.size).toBe(0);
    });

    it("should handle batch with only burn addresses", async () => {
      const tokens = [
        "0x000000000000000000000000000000000000dead",
        "1nc1nerator11111111111111111111111111111111",
      ];

      const prices = await provider.getBatchPrices(
        tokens,
        BlockchainType.SVM,
        "svm",
      );

      expect(prices.size).toBe(2);

      tokens.forEach((token) => {
        const price = prices.get(token);
        expect(price?.price).toBe(0);
        expect(price?.symbol).toBe("BURN");
      });
    });

    it("should fetch Solana tokens in batch", async () => {
      const tokens = [
        specificChainTokens.svm.sol,
        specificChainTokens.svm.usdc,
      ];

      const prices = await provider.getBatchPrices(
        tokens,
        BlockchainType.SVM,
        "svm",
      );
      expect(prices.size).toBe(2);

      const solPrice = prices.get(specificChainTokens.svm.sol);
      expect(solPrice).not.toBeNull();
      expect(solPrice?.price).toBeGreaterThan(0);

      const usdcPrice = prices.get(specificChainTokens.svm.usdc);
      expect(usdcPrice).not.toBeNull();
      expect(usdcPrice?.price).toBeCloseTo(1, 1);
    }, 10000);
  });

  describe("Error handling", () => {
    it("should handle invalid token address gracefully", async () => {
      const invalidAddress = "0xinvalidaddress123";
      const priceReport = await provider.getPrice(
        invalidAddress,
        BlockchainType.EVM,
        "eth",
      );

      // Should return null for invalid addresses
      expect(priceReport).toBeNull();
    });
  });
});
