import dotenv from "dotenv";
import path from "path";
import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpecificChain } from "../../types/index.js";

// Force load .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const { AlchemyRpcProvider } = await import(
  "../spot-live/alchemy-rpc.provider.js"
);

// Mock logger for tests
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

// Test addresses for different chains
const testAddresses = {
  eth: {
    vitalik: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  base: {
    coinbase: "0x4200000000000000000000000000000000000006", // WETH on Base
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  arbitrum: {
    gmx: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  },
};

describe("AlchemyRpcProvider", () => {
  let provider: InstanceType<typeof AlchemyRpcProvider>;

  beforeEach(() => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.warn(
        "ALCHEMY_API_KEY not set in .env file, tests will be skipped",
      );
      console.warn("Set ALCHEMY_API_KEY in .env to run these tests");
    }

    provider = new AlchemyRpcProvider(
      process.env.ALCHEMY_API_KEY || "test-key",
      3,
      1000,
      mockLogger,
    );
    vi.setConfig({ testTimeout: 30_000 });
  });

  describe("Basic connectivity", () => {
    it("should get the current block number on Ethereum", async () => {
      if (!process.env.ALCHEMY_API_KEY) {
        console.log("Skipping test - no API key");
        return;
      }

      const blockNumber = await provider.getBlockNumber("eth" as SpecificChain);

      expect(typeof blockNumber).toBe("number");
      expect(blockNumber).toBeGreaterThan(18_000_000);
      console.log(`Current Ethereum block: ${blockNumber}`);
    });

    it("should get the current block number on Base", async () => {
      if (!process.env.ALCHEMY_API_KEY) {
        console.log("Skipping test - no API key");
        return;
      }

      const blockNumber = await provider.getBlockNumber(
        "base" as SpecificChain,
      );

      expect(typeof blockNumber).toBe("number");
      expect(blockNumber).toBeGreaterThan(1_000_000);
      console.log(`Current Base block: ${blockNumber}`);
    });
  });

  describe("Transaction receipts", () => {
    it("should fetch a known transaction receipt", async () => {
      if (!process.env.ALCHEMY_API_KEY) {
        console.log("Skipping test - no API key");
        return;
      }

      const txHash =
        "0x2f1c5c2b44f771e942a8506148e256f94f1a464babc938ae0690c6e34cd79190";

      const receipt = await provider.getTransactionReceipt(
        txHash,
        "eth" as SpecificChain,
      );

      expect(receipt).not.toBeNull();
      expect(receipt?.transactionHash.toLowerCase()).toBe(txHash.toLowerCase());
      expect(receipt?.status).toBe(true);
      expect(receipt?.blockNumber).toBeGreaterThan(0);
      expect(receipt?.gasUsed).toBeDefined();
      expect(receipt?.effectiveGasPrice).toBeDefined();
    });
  });

  describe("Token balances", () => {
    it("should get ETH balance for a known address", async () => {
      if (!process.env.ALCHEMY_API_KEY) {
        console.log("Skipping test - no API key");
        return;
      }

      const balance = await provider.getBalance(
        testAddresses.eth.vitalik,
        "eth" as SpecificChain,
      );

      expect(balance).toBeDefined();
      expect(Number(balance)).toBeGreaterThan(0);
      console.log(`Vitalik's ETH balance: ${balance} wei`);
    });

    it("should get token balances for a wallet", async () => {
      if (!process.env.ALCHEMY_API_KEY) {
        console.log("Skipping test - no API key");
        return;
      }

      const balances = await provider.getTokenBalances(
        testAddresses.eth.vitalik,
        "eth" as SpecificChain,
      );

      expect(balances).toBeDefined();
      expect(Array.isArray(balances)).toBe(true);
      expect(balances.length).toBeGreaterThan(0);

      if (balances.length > 0) {
        const firstBalance = balances[0];
        expect(firstBalance).toBeDefined();
        expect(firstBalance?.contractAddress).toBeDefined();
        expect(firstBalance?.balance).toBeDefined();
        expect(typeof firstBalance?.contractAddress).toBe("string");
        expect(typeof firstBalance?.balance).toBe("string");
      }
    });
  });

  describe("Asset transfers", () => {
    it("should get asset transfers for a wallet", async () => {
      if (!process.env.ALCHEMY_API_KEY) {
        console.log("Skipping test - no API key");
        return;
      }

      const currentBlock = await provider.getBlockNumber(
        "eth" as SpecificChain,
      );
      const fromBlock = currentBlock - 10;

      const transfers = await provider.getAssetTransfers(
        testAddresses.eth.vitalik,
        "eth" as SpecificChain,
        fromBlock,
        currentBlock,
      );

      expect(transfers).toBeDefined();
      expect(transfers).toHaveProperty("transfers");
      expect(Array.isArray(transfers.transfers)).toBe(true);
    });
  });

  describe("Token decimals", () => {
    it("should fetch decimals for USDC token", async () => {
      if (!process.env.ALCHEMY_API_KEY) {
        console.log("Skipping test - no API key");
        return;
      }

      const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
      const decimals = await provider.getTokenDecimals(
        usdcAddress,
        "eth" as SpecificChain,
      );
      expect(decimals).toBe(6);
    });

    it("should fetch decimals for DAI token", async () => {
      if (!process.env.ALCHEMY_API_KEY) {
        console.log("Skipping test - no API key");
        return;
      }

      const daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
      const decimals = await provider.getTokenDecimals(
        daiAddress,
        "eth" as SpecificChain,
      );
      expect(decimals).toBe(18);
    });

    it("should throw for native ETH address (not an ERC20 contract)", async () => {
      if (!process.env.ALCHEMY_API_KEY) {
        console.log("Skipping test - no API key");
        return;
      }

      // Native token address is not an ERC20 contract - calling decimals() is invalid
      // Production code (spot-data-processor) checks isNative BEFORE calling getTokenDecimals
      const ethAddress = "0x0000000000000000000000000000000000000000";
      await expect(
        provider.getTokenDecimals(ethAddress, "eth" as SpecificChain),
      ).rejects.toThrow();
    });
  });

  describe("Health check", () => {
    it("should report healthy when provider is working", async () => {
      if (!process.env.ALCHEMY_API_KEY) {
        console.log("Skipping test - no API key");
        return;
      }

      const isHealthy = await provider.isHealthy();
      expect(isHealthy).toBe(true);
    });
  });
});
