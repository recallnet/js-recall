import dotenv from "dotenv";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MultiChainProvider } from "@/services/providers/multi-chain.provider.js";
import { BlockchainType } from "@/types/index.js";

// Load environment variables
dotenv.config();

// Test tokens
const solanaTokens = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

const ethereumTokens = {
  ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
};

const baseTokens = {
  ETH: "0x4200000000000000000000000000000000000006", // WETH on Base
  USDC: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", // USDbC on Base
};

describe("MultiChainProvider", () => {
  let provider: MultiChainProvider;

  beforeEach(() => {
    provider = new MultiChainProvider();
    vi.setConfig({ testTimeout: 30_000 }); // Increase timeout for API calls
  });

  describe("Basic functionality", () => {
    it("should have correct name", () => {
      expect(provider.getName()).toBe("DexScreener MultiChain");
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

  describe("Ethereum token price fetching", () => {
    it("should fetch ETH price", async () => {
      const priceReport = await provider.getPrice(ethereumTokens.ETH);

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
    });

    it("should fetch USDC price", async () => {
      const priceReport = await provider.getPrice(ethereumTokens.USDC);

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1
    });
  });

  describe("Base token price fetching with specific chain", () => {
    it("should fetch ETH on Base with specificChain parameter", async () => {
      const priceReport = await provider.getPrice(
        baseTokens.ETH,
        BlockchainType.EVM,
        "base",
      );

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
    });

    it("should fetch USDC on Base with specificChain parameter", async () => {
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

  describe("Token price fetching with specific chains", () => {
    it("should get detailed price info for Ethereum tokens", async () => {
      const priceReport = await provider.getPrice(
        ethereumTokens.ETH,
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
      const priceReport = await provider.getPrice(
        solanaTokens.SOL,
        BlockchainType.SVM,
        "svm",
      );

      expect(priceReport).not.toBeNull();
      if (priceReport) {
        expect(priceReport.chain).toBe(BlockchainType.SVM);
        expect(priceReport.specificChain).toBe("svm");
        // MultiChainProvider now supports Solana tokens
        expect(priceReport.price).not.toBeNull();
        expect(typeof priceReport.price).toBe("number");
        expect(priceReport.price).toBeGreaterThan(0);
      }
    });
  });

  describe("Multi-chain detection", () => {
    it("should try multiple chains when specific chain is not provided", async () => {
      // Don't specify chain, let provider detect it
      const price = await provider.getPrice(ethereumTokens.ETH);

      expect(price).not.toBeNull();
      expect(typeof price?.price).toBe("number");
      expect(price?.price).toBeGreaterThan(0);

      // Verify it detected the right chain
      const priceReport = await provider.getPrice(
        ethereumTokens.ETH,
        BlockchainType.EVM,
        "eth",
      );
      if (priceReport && priceReport.specificChain) {
        expect(priceReport.specificChain).toBe("eth");
      }
    });
  });
});
