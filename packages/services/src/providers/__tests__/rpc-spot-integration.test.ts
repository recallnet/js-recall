import dotenv from "dotenv";
import path from "path";
import { Logger } from "pino";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getDexProtocolConfig } from "../../lib/dex-protocols.js";
import type { ProtocolFilter } from "../../types/spot-live.js";
import { AlchemyRpcProvider } from "../spot-live/alchemy-rpc.provider.js";
import { RpcSpotProvider } from "../spot-live/rpc-spot.provider.js";

// Force load .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Mock logger for tests
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

// Known test wallets and transactions on Base mainnet
const TEST_WALLETS = {
  // Wallet with verified Aerodrome swap (USDC → WPAY at block 38606282)
  aerodromeSwapper: "0x3E123511bEaEd5C6E529cFcf4E29bD58cd5e0e86",
  generalUser: "0x0dedd9ed281a4cb7fbc91a4ef7790dd8f669c899",
};

// Known Aerodrome swap transaction (from BaseScan)
// Typical swap: User sends USDC, receives WPAY back to same wallet
const KNOWN_AERODROME_SWAP = {
  txHash: "0x978ca4290edb4c19ed880d2d0921561ecbbf39663e6293cf7b2f411a0d30a9e2",
  blockNumber: 38606282,
  wallet: TEST_WALLETS.aerodromeSwapper,
  // Swap: 2.022104 USDC → 11.08 WPAY
};

// Get Aerodrome protocol config from constants
const aerodromeConfig = getDexProtocolConfig("aerodrome", "base");
if (!aerodromeConfig) {
  throw new Error("Aerodrome config not found in KNOWN_DEX_PROTOCOLS");
}

const AERODROME_FILTER: ProtocolFilter = {
  protocol: "aerodrome",
  chain: "base",
  routerAddress: aerodromeConfig.routerAddress,
  swapEventSignature: aerodromeConfig.swapEventSignature,
  factoryAddress: aerodromeConfig.factoryAddress,
};

describe("RpcSpotProvider - Integration Tests (Real Blockchain)", () => {
  let realRpcProvider: InstanceType<typeof AlchemyRpcProvider>;
  let provider: InstanceType<typeof RpcSpotProvider>;

  beforeEach(() => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.warn(
        "ALCHEMY_API_KEY not set in .env file, integration tests will be skipped",
      );
      console.warn("Set ALCHEMY_API_KEY in .env to run these tests");
    }

    // Real Alchemy RPC provider
    realRpcProvider = new AlchemyRpcProvider(
      process.env.ALCHEMY_API_KEY || "test-key",
      3, // maxRetries
      1000, // retryDelay
      mockLogger,
    );

    // Set higher timeout for network calls
    vi.setConfig({ testTimeout: 30_000 });
  });

  test("should get current block number for Base", async () => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.log("Skipping test - no ALCHEMY_API_KEY");
      return;
    }

    const blockNumber = await realRpcProvider.getBlockNumber("base");

    expect(typeof blockNumber).toBe("number");
    expect(blockNumber).toBeGreaterThan(1_000_000);
    console.log(`✓ Current Base block: ${blockNumber}`);
  });

  test("should detect swaps without protocol filter from real blockchain", async () => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.log("Skipping test - no ALCHEMY_API_KEY");
      return;
    }

    // Create provider without protocol filter (all DEXs allowed)
    provider = new RpcSpotProvider(
      realRpcProvider,
      [], // No protocol filter
      mockLogger,
    );

    // Use static block range where we know the test wallet has activity
    const fromBlock = KNOWN_AERODROME_SWAP.blockNumber - 100;
    const toBlock = KNOWN_AERODROME_SWAP.blockNumber + 100;

    console.log(`Scanning blocks ${fromBlock} to ${toBlock} on Base...`);

    const trades = await provider.getTradesSince(
      TEST_WALLETS.aerodromeSwapper, // Use known active wallet
      fromBlock,
      ["base"],
      toBlock, // Specify toBlock for faster, deterministic tests
    );

    console.log(`Found ${trades.length} trades from real blockchain`);

    // Should find at least one trade (our known swap)
    expect(trades.length).toBeGreaterThan(0);

    // Verify trade structure
    trades.forEach((trade) => {
      expect(trade.fromToken).toBeDefined();
      expect(trade.toToken).toBeDefined();
      expect(trade.fromAmount).toBeGreaterThan(0);
      expect(trade.toAmount).toBeGreaterThan(0);
      expect(trade.chain).toBe("base");
      expect(trade.txHash).toBeDefined();
      expect(trade.blockNumber).toBeGreaterThanOrEqual(fromBlock);
    });

    if (trades.length > 0) {
      const firstTrade = trades[0]!;
      console.log(`✓ First trade detected:`);
      console.log(`  From: ${firstTrade.fromToken}`);
      console.log(`  To: ${firstTrade.toToken}`);
      console.log(`  Protocol: ${firstTrade.protocol}`);
      console.log(`  TxHash: ${firstTrade.txHash}`);
    }
  }, 30000);

  test("should detect known Aerodrome swap WITHOUT protocol filter (baseline test)", async () => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.log("Skipping test - no ALCHEMY_API_KEY");
      return;
    }

    // Create provider WITHOUT protocol filter (all DEXs allowed)
    provider = new RpcSpotProvider(
      realRpcProvider,
      [], // ← NO FILTER - This tests if basic swap detection works
      mockLogger,
    );

    // Use known block range with verified Aerodrome swap (from BaseScan)
    // Transaction: 0x978ca4290edb4c19ed880d2d0921561ecbbf39663e6293cf7b2f411a0d30a9e2
    // Block: 38606282
    // BaseScan shows: Interacted With (To): 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43 (Aerodrome: Router)
    // Swap: 2.022104 USDC → 11.08 WPAY on Aerodrome
    const fromBlock = KNOWN_AERODROME_SWAP.blockNumber - 100;
    const toBlock = KNOWN_AERODROME_SWAP.blockNumber + 100;

    console.log(
      `[BASELINE TEST] Scanning blocks ${fromBlock} to ${toBlock} WITHOUT protocol filter...`,
    );
    console.log(`  Wallet: ${KNOWN_AERODROME_SWAP.wallet}`);
    console.log(`  Known tx at block ${KNOWN_AERODROME_SWAP.blockNumber}`);

    // First, verify Alchemy can see transfers for this wallet
    const rawTransfers = await realRpcProvider.getAssetTransfers(
      KNOWN_AERODROME_SWAP.wallet,
      "base",
      fromBlock,
      toBlock,
    );

    console.log(
      `  Alchemy returned ${rawTransfers.transfers.length} raw transfers`,
    );

    // Check if our known transaction is in the transfers
    const knownTxTransfers = rawTransfers.transfers.filter(
      (t) => t.hash.toLowerCase() === KNOWN_AERODROME_SWAP.txHash.toLowerCase(),
    );

    if (knownTxTransfers.length > 0) {
      console.log(
        `  ✓ Found ${knownTxTransfers.length} transfers for known tx`,
      );
      knownTxTransfers.forEach((t) => {
        console.log(`    From: ${t.from} → To: ${t.to}`);
        console.log(`    Asset: ${t.asset}, Value: ${t.value}`);
      });
    } else {
      console.error(
        `  ⚠️  Alchemy did not return transfers for known transaction`,
      );
    }

    // Now test swap detection WITHOUT protocol filter
    const trades = await provider.getTradesSince(
      KNOWN_AERODROME_SWAP.wallet,
      fromBlock,
      ["base"],
      toBlock, // Specify toBlock for faster, deterministic test
    );

    console.log(
      `  RpcSpotProvider detected ${trades.length} swaps (no filter)`,
    );

    // Look for our known transaction
    const knownSwap = trades.find(
      (t) =>
        t.txHash.toLowerCase() === KNOWN_AERODROME_SWAP.txHash.toLowerCase(),
    );

    if (knownSwap) {
      console.log(`  ✓ Detected known swap WITHOUT protocol filter:`);
      console.log(`    TxHash: ${knownSwap.txHash}`);
      console.log(`    Block: ${knownSwap.blockNumber}`);
      console.log(`    From: ${knownSwap.fromToken} (${knownSwap.fromAmount})`);
      console.log(`    To: ${knownSwap.toToken} (${knownSwap.toAmount})`);
      console.log(`    Protocol: ${knownSwap.protocol}`);
    } else {
      console.error(`  ❌ CRITICAL: Swap NOT detected even without filter`);
      console.error(`  This means detectSwapPattern() is broken`);
    }

    // CRITICAL: This tests if basic swap detection works
    expect(knownSwap).toBeDefined();
    expect(knownSwap?.blockNumber).toBe(KNOWN_AERODROME_SWAP.blockNumber);
  }, 30000);

  test("should detect specific Aerodrome swaps from known historical blocks WITH protocol filter", async () => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.log("Skipping test - no ALCHEMY_API_KEY");
      return;
    }

    // Create provider with Aerodrome protocol filter
    provider = new RpcSpotProvider(
      realRpcProvider,
      [AERODROME_FILTER],
      mockLogger,
    );

    // Use known block range with verified Aerodrome swap (from BaseScan)
    // Transaction: 0x978ca4290edb4c19ed880d2d0921561ecbbf39663e6293cf7b2f411a0d30a9e2
    // Block: 38606282
    // Swap: 2.022104 USDC → 11.08 WPAY on Aerodrome (typical pattern - same wallet sends/receives)
    const fromBlock = KNOWN_AERODROME_SWAP.blockNumber - 100; // Scan around known swap
    const toBlock = KNOWN_AERODROME_SWAP.blockNumber + 200; // Wider range to account for Alchemy pagination

    console.log(
      `[FILTER TEST] Scanning blocks ${fromBlock} to ${toBlock} WITH Aerodrome filter...`,
    );
    console.log(`  Wallet: ${KNOWN_AERODROME_SWAP.wallet}`);
    console.log(
      `  Known tx should be at block ${KNOWN_AERODROME_SWAP.blockNumber}`,
    );

    // First, test if Alchemy can see transfers for this wallet
    const rawTransfers = await realRpcProvider.getAssetTransfers(
      KNOWN_AERODROME_SWAP.wallet,
      "base",
      fromBlock,
      toBlock,
    );

    console.log(
      `  Alchemy returned ${rawTransfers.transfers.length} raw transfers`,
    );

    // Check if our known transaction is in the transfers
    const knownTxTransfers = rawTransfers.transfers.filter(
      (t) => t.hash.toLowerCase() === KNOWN_AERODROME_SWAP.txHash.toLowerCase(),
    );

    if (knownTxTransfers.length > 0) {
      console.log(
        `  ✓ Found ${knownTxTransfers.length} transfers for known tx`,
      );
      knownTxTransfers.forEach((t) => {
        console.log(`    From: ${t.from} → To: ${t.to}`);
        console.log(`    Asset: ${t.asset}, Value: ${t.value}`);
      });
    } else {
      console.error(
        `  ⚠️  Alchemy did not return transfers for known transaction`,
      );
      console.error(`  This means either:`);
      console.error(`    1. Block range is wrong`);
      console.error(`    2. Wallet address is wrong`);
      console.error(`    3. Alchemy API issue`);
    }

    const trades = await provider.getTradesSince(
      KNOWN_AERODROME_SWAP.wallet,
      fromBlock,
      ["base"],
      toBlock, // Specify toBlock for faster, deterministic tests
    );

    console.log(
      `  RpcSpotProvider detected ${trades.length} swaps WITH filter`,
    );

    // Should detect at least the known swap
    expect(trades.length).toBeGreaterThanOrEqual(1);

    // All detected trades should be from Aerodrome protocol
    trades.forEach((trade) => {
      expect(trade.protocol).toBe("aerodrome");
      expect(trade.chain).toBe("base");
      expect(trade.blockNumber).toBeGreaterThanOrEqual(fromBlock);
      // Note: Alchemy may return results slightly outside range due to pagination
    });

    // Look for our known transaction
    const knownSwap = trades.find(
      (t) =>
        t.txHash.toLowerCase() === KNOWN_AERODROME_SWAP.txHash.toLowerCase(),
    );

    expect(knownSwap).toBeDefined();
    expect(knownSwap?.blockNumber).toBe(KNOWN_AERODROME_SWAP.blockNumber);
    expect(knownSwap?.protocol).toBe("aerodrome");

    console.log(`  ✓ Detected known Aerodrome swap WITH filter:`);
    console.log(`    TxHash: ${knownSwap?.txHash}`);
    console.log(`    Block: ${knownSwap?.blockNumber}`);
    console.log(`    From: ${knownSwap?.fromToken} (${knownSwap?.fromAmount})`);
    console.log(`    To: ${knownSwap?.toToken} (${knownSwap?.toAmount})`);
  }, 30000);

  test("should return empty array for wallet with no activity in block range", async () => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.log("Skipping test - no ALCHEMY_API_KEY");
      return;
    }

    provider = new RpcSpotProvider(realRpcProvider, [], mockLogger);

    // Use a random wallet address unlikely to have activity
    const inactiveWallet = "0x0000000000000000000000000000000000000001";
    const currentBlock = await realRpcProvider.getBlockNumber("base");
    const fromBlock = currentBlock - 100;

    const trades = await provider.getTradesSince(inactiveWallet, fromBlock, [
      "base",
    ]);

    // Should return empty array, not throw error
    expect(Array.isArray(trades)).toBe(true);
    expect(trades.length).toBe(0);
    console.log("✓ Correctly returned empty array for inactive wallet");
  });

  test("should handle Date parameter for since", async () => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.log("Skipping test - no ALCHEMY_API_KEY");
      return;
    }

    provider = new RpcSpotProvider(realRpcProvider, [], mockLogger);

    // Use a static date that we know has activity (day of our known swap)
    // Known swap was at block 38606282 on Nov-24-2025 04:31:51 PM +UTC
    const knownSwapDate = new Date("2025-11-24T16:31:00Z"); // Just before our known swap
    const searchStartDate = new Date(knownSwapDate.getTime() - 3600000); // 1 hour before

    console.log(`Scanning trades since ${searchStartDate.toISOString()}...`);

    const trades = await provider.getTradesSince(
      TEST_WALLETS.aerodromeSwapper, // Use known active wallet
      searchStartDate,
      ["base"],
      KNOWN_AERODROME_SWAP.blockNumber + 10, // Narrow range for fast test
    );

    console.log(`Found ${trades.length} trades`);

    // Should find at least our known swap
    expect(trades.length).toBeGreaterThan(0);

    // Verify all trades are after the specified date
    trades.forEach((trade) => {
      expect(trade.timestamp.getTime()).toBeGreaterThanOrEqual(
        searchStartDate.getTime(),
      );
    });

    // Verify our known swap is in the results
    const knownSwap = trades.find(
      (t) =>
        t.txHash.toLowerCase() === KNOWN_AERODROME_SWAP.txHash.toLowerCase(),
    );
    expect(knownSwap).toBeDefined();

    console.log("✓ Date-based scanning works");
  }, 30000);

  test("should verify protocol filter prevents non-Aerodrome swaps", async () => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.log("Skipping test - no ALCHEMY_API_KEY");
      return;
    }

    const currentBlock = await realRpcProvider.getBlockNumber("base");
    const fromBlock = currentBlock - 1000;

    // Provider WITH Aerodrome filter
    const aerodromeProvider = new RpcSpotProvider(
      realRpcProvider,
      [AERODROME_FILTER],
      mockLogger,
    );

    // Provider WITHOUT filter (all DEXs)
    const openProvider = new RpcSpotProvider(realRpcProvider, [], mockLogger);

    const aeroTrades = await aerodromeProvider.getTradesSince(
      TEST_WALLETS.aerodromeSwapper,
      fromBlock,
      ["base"],
    );

    const allTrades = await openProvider.getTradesSince(
      TEST_WALLETS.aerodromeSwapper,
      fromBlock,
      ["base"],
    );

    console.log(`Aerodrome filter: ${aeroTrades.length} trades`);
    console.log(`No filter: ${allTrades.length} trades`);

    // With Aerodrome filter, should be <= trades without filter
    expect(aeroTrades.length).toBeLessThanOrEqual(allTrades.length);

    // All filtered trades must be Aerodrome
    aeroTrades.forEach((trade) => {
      expect(trade.protocol).toBe("aerodrome");
    });

    if (aeroTrades.length < allTrades.length) {
      console.log(
        `✓ Protocol filter excluded ${allTrades.length - aeroTrades.length} non-Aerodrome swaps`,
      );
    } else if (aeroTrades.length === allTrades.length && allTrades.length > 0) {
      console.log("✓ All swaps detected were Aerodrome (filter working)");
    }
  }, 30000);

  test("should verify gas data is populated for detected swaps", async () => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.log("Skipping test - no ALCHEMY_API_KEY");
      return;
    }

    provider = new RpcSpotProvider(realRpcProvider, [], mockLogger);

    // Use narrow range around known swap for fast test
    const fromBlock = KNOWN_AERODROME_SWAP.blockNumber - 10;

    const trades = await provider.getTradesSince(
      KNOWN_AERODROME_SWAP.wallet,
      fromBlock,
      ["base"],
      KNOWN_AERODROME_SWAP.blockNumber + 10, // Narrow range for fast test
    );

    expect(trades.length).toBeGreaterThan(0);

    // Verify our known swap has gas data
    const knownSwap = trades.find(
      (t) =>
        t.txHash.toLowerCase() === KNOWN_AERODROME_SWAP.txHash.toLowerCase(),
    );

    expect(knownSwap).toBeDefined();
    expect(knownSwap!.gasUsed).toBeGreaterThan(0);
    expect(knownSwap!.gasPrice).toBeGreaterThan(0);

    console.log(`✓ Gas data populated:`);
    console.log(`  Gas Used: ${knownSwap!.gasUsed}`);
    console.log(`  Gas Price: ${knownSwap!.gasPrice}`);
  }, 30000);

  test("should detect transfer history excluding swaps", async () => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.log("Skipping test - no ALCHEMY_API_KEY");
      return;
    }

    provider = new RpcSpotProvider(realRpcProvider, [], mockLogger);

    // Use static date range around our known swap
    const searchStartDate = new Date("2025-11-24T16:00:00Z");

    console.log(
      `Fetching transfer history since ${searchStartDate.toISOString()}...`,
    );

    const transfers = await provider.getTransferHistory(
      KNOWN_AERODROME_SWAP.wallet,
      searchStartDate,
      ["base"],
    );

    console.log(
      `Found ${transfers.length} transfers (deposits/withdrawals, swaps excluded)`,
    );

    // Verify structure
    transfers.forEach((transfer) => {
      expect(transfer.type).toMatch(/^(deposit|withdraw|transfer)$/);
      expect(transfer.tokenAddress).toBeDefined();
      expect(transfer.amount).toBeGreaterThan(0);
      expect(transfer.txHash).toBeDefined();
      expect(transfer.blockNumber).toBeGreaterThan(0);
      expect(transfer.chain).toBe("base");
    });

    // Verify our known swap transaction is NOT in transfer history (swaps are excluded)
    const swapFoundInTransfers = transfers.some(
      (t) =>
        t.txHash.toLowerCase() === KNOWN_AERODROME_SWAP.txHash.toLowerCase(),
    );

    expect(swapFoundInTransfers).toBe(false);
    console.log(`✓ Swap transaction correctly excluded from transfer history`);
  }, 30000);
});
