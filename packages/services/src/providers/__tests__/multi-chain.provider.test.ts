import dotenv from "dotenv";
import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { BlockchainType, SpecificChain } from "../../types/index.js";
import { MultiChainProvider } from "../multi-chain.provider.js";

// Load environment variables
dotenv.config();

// Set timeout for all tests in this file to 30 seconds
vi.setConfig({ testTimeout: 30_000 });

const evmChains: SpecificChain[] = ["svm", "eth", "base"];
const specificChainTokens = {
  svm: {
    sol: "So11111111111111111111111111111111111111112",
    usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
  eth: {
    eth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  base: {
    eth: "0x4200000000000000000000000000000000000006", // WETH on Base
    usdc: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", // USDbC on Base
  },
};

// Mock logger for the constructor
const mockLogger: MockProxy<Logger> = mock<Logger>();

describe("MultiChainProvider", () => {
  let provider: MultiChainProvider;

  beforeEach(() => {
    provider = new MultiChainProvider(
      { evmChains, specificChainTokens },
      mockLogger,
    );
  });

  describe("Basic functionality", () => {
    it("should have correct name", () => {
      expect(provider.getName()).toBe("DexScreener MultiChain");
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
      const priceReport = await provider.getPrice(specificChainTokens.eth.eth);

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
    });

    it("should fetch USDC price", async () => {
      const priceReport = await provider.getPrice(specificChainTokens.eth.usdc);

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe("number");
      expect(priceReport?.price).toBeGreaterThan(0);
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1
    });
  });

  describe("Base token price fetching with specific chain", () => {
    it("should fetch ETH on Base with specificChain parameter", async () => {
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
      const priceReport = await provider.getPrice(
        specificChainTokens.svm.sol,
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
      const price = await provider.getPrice(specificChainTokens.eth.eth);

      expect(price).not.toBeNull();
      expect(typeof price?.price).toBe("number");
      expect(price?.price).toBeGreaterThan(0);

      // Verify it detected the right chain
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
});
