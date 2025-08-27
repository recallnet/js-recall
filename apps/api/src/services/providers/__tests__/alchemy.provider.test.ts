import dotenv from "dotenv";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import the type separately (doesn't trigger config loading)
import type { LiveTradingChain } from "@/types/index.js";

// Force load the regular .env file BEFORE importing modules that use config
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Dynamically import AlchemyProvider to ensure env vars are loaded first
const { AlchemyProvider } = await import(
  "@/services/providers/alchemy.provider.js"
);

// Test addresses for different chains
const testAddresses = {
  eth: {
    vitalik: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // vitalik.eth
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  base: {
    coinbase: "0x4200000000000000000000000000000000000006", // WETH on Base
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  },
  arbitrum: {
    gmx: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a", // GMX token
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC on Arbitrum
  },
};

describe("AlchemyProvider", () => {
  let provider: InstanceType<typeof AlchemyProvider>;

  beforeEach(() => {
    // Check if API key is loaded
    if (!process.env.ALCHEMY_API_KEY) {
      console.warn("ALCHEMY_API_KEY not set in .env file, tests will fail");
      console.warn(
        "Make sure your .env file contains ALCHEMY_API_KEY=your_actual_key",
      );
    } else {
      console.log("ALCHEMY_API_KEY loaded successfully");
    }

    provider = new AlchemyProvider();
    vi.setConfig({ testTimeout: 30_000 }); // Increase timeout for API calls
  });

  describe("Basic connectivity", () => {
    it("should get the current block number on Ethereum", async () => {
      const blockNumber = await provider.getBlockNumber(
        "eth" as LiveTradingChain,
      );

      expect(typeof blockNumber).toBe("number");
      expect(blockNumber).toBeGreaterThan(18_000_000); // Ethereum is well past block 18M
      console.log(`Current Ethereum block: ${blockNumber}`);
    });

    it("should get the current block number on Base", async () => {
      const blockNumber = await provider.getBlockNumber(
        "base" as LiveTradingChain,
      );

      expect(typeof blockNumber).toBe("number");
      expect(blockNumber).toBeGreaterThan(1_000_000); // Base should be past 1M blocks
      console.log(`Current Base block: ${blockNumber}`);
    });

    it("should get the current block number on Arbitrum", async () => {
      const blockNumber = await provider.getBlockNumber(
        "arbitrum" as LiveTradingChain,
      );

      expect(typeof blockNumber).toBe("number");
      expect(blockNumber).toBeGreaterThan(100_000_000); // Arbitrum has much higher block numbers
      console.log(`Current Arbitrum block: ${blockNumber}`);
    });
  });

  describe("Transaction receipts", () => {
    it("should fetch a known transaction receipt", async () => {
      // This is a well-known transaction: first USDC transfer on Ethereum
      const txHash =
        "0x2f1c5c2b44f771e942a8506148e256f94f1a464babc938ae0690c6e34cd79190";

      const receipt = await provider.getTransactionReceipt(
        txHash,
        "eth" as LiveTradingChain,
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
      const balance = await provider.getBalance(
        testAddresses.eth.vitalik,
        "eth" as LiveTradingChain,
      );

      expect(balance).toBeDefined();
      expect(Number(balance)).toBeGreaterThan(0); // Vitalik should have some ETH
      console.log(`Vitalik's ETH balance: ${balance} wei`);
    });

    it("should get token balances for a wallet", async () => {
      const balances = await provider.getTokenBalances(
        testAddresses.eth.vitalik,
        "eth" as LiveTradingChain,
      );

      expect(balances).toBeDefined();
      expect(Array.isArray(balances)).toBe(true);
      // Vitalik likely has many tokens
      expect(balances.length).toBeGreaterThan(0);

      // Check structure of returned balances
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
      // Get recent block for testing
      const currentBlock = await provider.getBlockNumber(
        "eth" as LiveTradingChain,
      );
      const fromBlock = currentBlock - 10; // Look back 10 blocks (shorter range for test)

      const transfers = await provider.getAssetTransfers(
        testAddresses.eth.vitalik,
        "eth" as LiveTradingChain,
        fromBlock,
        currentBlock,
      );

      expect(transfers).toBeDefined();
      expect(transfers).toHaveProperty("transfers");
      expect(Array.isArray(transfers.transfers)).toBe(true);

      // Check structure if there are transfers
      if (transfers.transfers.length > 0) {
        const firstTransfer = transfers.transfers[0];
        expect(firstTransfer).toBeDefined();
        expect(firstTransfer).toHaveProperty("from");
        expect(firstTransfer).toHaveProperty("to");
        expect(firstTransfer).toHaveProperty("blockNum");
        expect(firstTransfer).toHaveProperty("hash");
      }
    });
  });

  describe("Batch operations", () => {
    it("should batch get transaction receipts", async () => {
      // Use some known transaction hashes
      const txHashes = [
        "0x2f1c5c2b44f771e942a8506148e256f94f1a464babc938ae0690c6e34cd79190", // Known USDC tx
        "0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060", // Another known tx
      ];

      const receipts = await provider.batchGetTransactionReceipts(
        txHashes,
        "eth" as LiveTradingChain,
      );

      expect(receipts).toBeDefined();
      expect(Array.isArray(receipts)).toBe(true);
      expect(receipts.length).toBe(2);

      // Check each receipt
      receipts.forEach((receipt, index) => {
        if (receipt !== null) {
          expect(receipt.transactionHash.toLowerCase()).toBe(
            txHashes[index]?.toLowerCase(),
          );
          expect(receipt.blockNumber).toBeGreaterThan(0);
          expect(receipt.gasUsed).toBeDefined();
        }
      });
    });

    it("should handle empty batch gracefully", async () => {
      const receipts = await provider.batchGetTransactionReceipts(
        [],
        "eth" as LiveTradingChain,
      );

      expect(receipts).toEqual([]);
    });
  });

  describe("Health check", () => {
    it("should report healthy when provider is working", async () => {
      const isHealthy = await provider.isHealthy();
      expect(isHealthy).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should handle invalid transaction hash gracefully", async () => {
      const invalidTxHash = "0xinvalid";

      await expect(
        provider.getTransactionReceipt(
          invalidTxHash,
          "eth" as LiveTradingChain,
        ),
      ).rejects.toThrow();
    });

    it("should handle unsupported chain gracefully", async () => {
      const unsupportedChain = "unsupported" as LiveTradingChain;

      await expect(provider.getBlockNumber(unsupportedChain)).rejects.toThrow(
        "No Alchemy provider configured for chain",
      );
    });
  });

  describe("Token decimals", () => {
    it("should fetch decimals for USDC token", async () => {
      // USDC on Ethereum has 6 decimals
      const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
      const decimals = await provider.getTokenDecimals(
        usdcAddress,
        "eth" as LiveTradingChain,
      );
      expect(decimals).toBe(6);
    });

    it("should fetch decimals for DAI token", async () => {
      // DAI on Ethereum has 18 decimals
      const daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
      const decimals = await provider.getTokenDecimals(
        daiAddress,
        "eth" as LiveTradingChain,
      );
      expect(decimals).toBe(18);
    });

    it("should return 18 for native ETH address", async () => {
      // Native ETH doesn't have a decimals function, should default to 18
      const ethAddress = "0x0000000000000000000000000000000000000000";
      const decimals = await provider.getTokenDecimals(
        ethAddress,
        "eth" as LiveTradingChain,
      );
      expect(decimals).toBe(18);
    });

    it("should return 18 for invalid contract address", async () => {
      // Random address that's not a token contract
      const randomAddress = "0x1234567890123456789012345678901234567890";
      const decimals = await provider.getTokenDecimals(
        randomAddress,
        "eth" as LiveTradingChain,
      );
      expect(decimals).toBe(18);
    });
  });
});
