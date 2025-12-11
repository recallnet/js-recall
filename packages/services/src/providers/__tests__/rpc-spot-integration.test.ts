import dotenv from "dotenv";
import path from "path";
import { Logger } from "pino";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { NATIVE_TOKEN_ADDRESS } from "../../lib/config-utils.js";
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

// Known Native ETH → ERC20 swap on Base via Aerodrome
// This transaction swaps 0.116 ETH for ~73,509 output tokens
const KNOWN_NATIVE_ETH_SWAP = {
  txHash: "0xf5605f56cf3f38dfbbd9d62361a37df0b3a21c7c0a78403232d5724f0e61b33d",
  blockNumber: 38911955,
  wallet: "0xA6a64eF4424af48B557b1534774b6D064707Bb41",
  // Swap: ~0.116 ETH → ~73,509 tokens
  expectedFromToken: NATIVE_TOKEN_ADDRESS, // Zero address for native ETH
  expectedToToken: "0xc48823ec67720a04a9dfd8c7d109b2c3d6622094".toLowerCase(), // Output token on Base
  description: "Native ETH → Token swap via Aerodrome",
};

// Regression test case: Multi-transfer swap that was incorrectly parsed before logIndex fix
// Transaction has a 0-value ETH external call AND an AERO→USDC swap.
// Before the fix, getAssetTransfers ordering was non-deterministic and the 0-value
// transfer was sometimes picked as fromToken/fromAmount instead of the real AERO transfer.
const KNOWN_MULTI_TRANSFER_SWAP = {
  txHash: "0x193e73f9ab0aae74226d8b19b4d95823a78a0451ec6757126315ea8fd702895b",
  blockNumber: 39235682,
  wallet: "0x91de90c092ba6df8fa714541d4335c08e7d76a0b", // deepseek 3.2 aero agent
  expectedFromToken: "0x940181a94a35a4569e4529a3cdfb74e38fd98631".toLowerCase(), // AERO
  expectedToToken: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913".toLowerCase(), // USDC
  // Exact amounts from blockchain (immutable) - use toBeCloseTo for float comparison
  expectedFromAmount: 106.8348, // AERO (18 decimals, truncated for JS precision)
  expectedToAmount: 69.820741, // USDC (6 decimals)
  expectedProtocol: "aerodrome",
  expectedChain: "base",
  description:
    "AERO → USDC swap with 0-value ETH contract call (regression test)",
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

    const result = await provider.getTradesSince(
      TEST_WALLETS.aerodromeSwapper, // Use known active wallet
      fromBlock,
      ["base"],
      toBlock, // Specify toBlock for faster, deterministic tests
    );
    const trades = result.trades;

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
    const result = await provider.getTradesSince(
      KNOWN_AERODROME_SWAP.wallet,
      fromBlock,
      ["base"],
      toBlock, // Specify toBlock for faster, deterministic test
    );
    const trades = result.trades;

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
      console.error(`  ❌ Swap NOT detected even without filter`);
      console.error(`  This means detectSwapPattern() is broken`);
    }

    // This tests if basic swap detection works
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

    const result = await provider.getTradesSince(
      KNOWN_AERODROME_SWAP.wallet,
      fromBlock,
      ["base"],
      toBlock, // Specify toBlock for faster, deterministic tests
    );
    const trades = result.trades;

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

    const result = await provider.getTradesSince(inactiveWallet, fromBlock, [
      "base",
    ]);

    // Should return empty array, not throw error
    expect(Array.isArray(result.trades)).toBe(true);
    expect(result.trades.length).toBe(0);
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

    const result = await provider.getTradesSince(
      TEST_WALLETS.aerodromeSwapper, // Use known active wallet
      searchStartDate,
      ["base"],
      KNOWN_AERODROME_SWAP.blockNumber + 10, // Narrow range for fast test
    );
    const trades = result.trades;

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

    const aeroResult = await aerodromeProvider.getTradesSince(
      TEST_WALLETS.aerodromeSwapper,
      fromBlock,
      ["base"],
    );
    const aeroTrades = aeroResult.trades;

    const allResult = await openProvider.getTradesSince(
      TEST_WALLETS.aerodromeSwapper,
      fromBlock,
      ["base"],
    );
    const allTrades = allResult.trades;

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

    const result = await provider.getTradesSince(
      KNOWN_AERODROME_SWAP.wallet,
      fromBlock,
      ["base"],
      KNOWN_AERODROME_SWAP.blockNumber + 10, // Narrow range for fast test
    );
    const trades = result.trades;

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
    const toBlock = KNOWN_AERODROME_SWAP.blockNumber + 200; // Fixed end block for deterministic test

    console.log(
      `Fetching transfer history since ${searchStartDate.toISOString()}...`,
    );

    const transfers = await provider.getTransferHistory(
      KNOWN_AERODROME_SWAP.wallet,
      searchStartDate,
      ["base"],
      toBlock, // Use fixed block range like other tests
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

  test("should detect Native ETH → ERC20 swap with zero address as fromToken", async () => {
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

    // Use narrow block range around our known native ETH swap
    const fromBlock = KNOWN_NATIVE_ETH_SWAP.blockNumber - 10;
    const toBlock = KNOWN_NATIVE_ETH_SWAP.blockNumber + 10;

    console.log(`\nScanning blocks ${fromBlock} to ${toBlock} on Base...`);
    console.log(
      `Looking for native ETH swap: ${KNOWN_NATIVE_ETH_SWAP.description}`,
    );

    const result = await provider.getTradesSince(
      KNOWN_NATIVE_ETH_SWAP.wallet,
      fromBlock,
      ["base"],
      toBlock,
    );
    const trades = result.trades;

    console.log(`Found ${trades.length} trades from real blockchain`);

    // Should find at least one trade
    expect(trades.length).toBeGreaterThan(0);

    // Find our specific native ETH swap transaction
    const nativeSwap = trades.find(
      (t) =>
        t.txHash.toLowerCase() === KNOWN_NATIVE_ETH_SWAP.txHash.toLowerCase(),
    );

    expect(nativeSwap).toBeDefined();
    console.log(`\n✓ Found native ETH swap transaction:`);
    console.log(`  TxHash: ${nativeSwap?.txHash}`);
    console.log(`  From Token: ${nativeSwap?.fromToken}`);
    console.log(`  To Token: ${nativeSwap?.toToken}`);
    console.log(`  From Amount: ${nativeSwap?.fromAmount}`);
    console.log(`  To Amount: ${nativeSwap?.toAmount}`);

    // Verify fromToken is the NATIVE_TOKEN_ADDRESS (zero address)
    // This ensures native ETH swaps are correctly identified for price lookups
    expect(nativeSwap?.fromToken.toLowerCase()).toBe(
      KNOWN_NATIVE_ETH_SWAP.expectedFromToken.toLowerCase(),
    );
    console.log(
      `✓ Native ETH correctly identified with zero address: ${NATIVE_TOKEN_ADDRESS}`,
    );

    // Verify toToken is the expected output token
    expect(nativeSwap?.toToken.toLowerCase()).toBe(
      KNOWN_NATIVE_ETH_SWAP.expectedToToken.toLowerCase(),
    );
    console.log(`✓ Output token correctly identified`);

    // Verify amounts are sensible
    expect(nativeSwap?.fromAmount).toBeGreaterThan(0);
    expect(nativeSwap?.toAmount).toBeGreaterThan(0);
    console.log(`✓ Swap amounts are valid`);
  }, 30000);

  test("should return all balances as DECIMAL strings (provider normalizes format)", async () => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.log("Skipping test - no ALCHEMY_API_KEY");
      return;
    }

    // Use Vitalik's address which reliably has both ETH and tokens
    const testWallet = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

    // Native balance from getBalance() should be DECIMAL string
    const nativeBalance = await realRpcProvider.getBalance(testWallet, "eth");
    const nativeIsDecimal = /^\d+$/.test(nativeBalance);
    expect(nativeIsDecimal).toBe(true);

    // Token balances from getTokenBalances() should ALSO be DECIMAL strings
    // (provider normalizes Alchemy's hex response to decimal for consistent format)
    const tokenBalances = await realRpcProvider.getTokenBalances(
      testWallet,
      "eth",
    );
    expect(tokenBalances.length).toBeGreaterThan(0);
    const tokenIsDecimal = /^\d+$/.test(tokenBalances[0]?.balance || "");
    expect(tokenIsDecimal).toBe(true);

    console.log(
      `✓ Format verified: both native and tokens return DECIMAL strings`,
    );
  }, 30000);

  test("should correctly detect AERO→USDC swap when transaction has 0-value ETH transfer (regression)", async () => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.log("Skipping test - no ALCHEMY_API_KEY");
      return;
    }

    // This test verifies the fix for a bug where transactions with multiple outbound
    // transfers (e.g., a real ERC20 swap + a 0-value external call) would sometimes
    // incorrectly identify the 0-value transfer as the fromToken/fromAmount.
    //
    // The fix uses logIndex ordering from transaction receipts to deterministically
    // identify the first outbound and last inbound ERC20 transfers.

    provider = new RpcSpotProvider(
      realRpcProvider,
      [AERODROME_FILTER], // Use Aerodrome filter since this is an Aerodrome swap
      mockLogger,
    );

    const fromBlock = KNOWN_MULTI_TRANSFER_SWAP.blockNumber - 5;
    const toBlock = KNOWN_MULTI_TRANSFER_SWAP.blockNumber + 5;

    console.log(`\n[REGRESSION TEST] ${KNOWN_MULTI_TRANSFER_SWAP.description}`);
    console.log(`  TxHash: ${KNOWN_MULTI_TRANSFER_SWAP.txHash}`);
    console.log(`  Wallet: ${KNOWN_MULTI_TRANSFER_SWAP.wallet}`);
    console.log(`  Scanning blocks ${fromBlock} to ${toBlock}...`);

    const result = await provider.getTradesSince(
      KNOWN_MULTI_TRANSFER_SWAP.wallet,
      fromBlock,
      ["base"],
      toBlock,
    );
    const trades = result.trades;

    console.log(`  Found ${trades.length} trades`);

    // Find our specific transaction
    const targetSwap = trades.find(
      (t) =>
        t.txHash.toLowerCase() ===
        KNOWN_MULTI_TRANSFER_SWAP.txHash.toLowerCase(),
    );

    expect(targetSwap).toBeDefined();
    console.log(`\n✓ Found target swap transaction:`);
    console.log(`  From Token: ${targetSwap?.fromToken}`);
    console.log(`  To Token: ${targetSwap?.toToken}`);
    console.log(`  From Amount: ${targetSwap?.fromAmount}`);
    console.log(`  To Amount: ${targetSwap?.toAmount}`);
    console.log(`  Protocol: ${targetSwap?.protocol}`);
    console.log(`  Chain: ${targetSwap?.chain}`);
    console.log(`  Block: ${targetSwap?.blockNumber}`);

    // Before the fix, fromToken could incorrectly be the zero address (native ETH)
    // and fromAmount could be 0 due to the 0-value external call.

    // Verify fromToken is AERO (not zero address / native ETH)
    expect(targetSwap?.fromToken.toLowerCase()).toBe(
      KNOWN_MULTI_TRANSFER_SWAP.expectedFromToken,
    );
    console.log(`✓ fromToken is correctly AERO (not zero address)`);

    // Verify toToken is USDC
    expect(targetSwap?.toToken.toLowerCase()).toBe(
      KNOWN_MULTI_TRANSFER_SWAP.expectedToToken,
    );
    console.log(`✓ toToken is correctly USDC`);

    // Verify fromAmount matches expected value (blockchain data is immutable)
    expect(targetSwap?.fromAmount).toBeCloseTo(
      KNOWN_MULTI_TRANSFER_SWAP.expectedFromAmount,
      4, // 4 decimal places precision
    );
    console.log(
      `✓ fromAmount (${targetSwap?.fromAmount}) ≈ ${KNOWN_MULTI_TRANSFER_SWAP.expectedFromAmount}`,
    );

    // Verify toAmount matches expected value
    expect(targetSwap?.toAmount).toBeCloseTo(
      KNOWN_MULTI_TRANSFER_SWAP.expectedToAmount,
      4,
    );
    console.log(
      `✓ toAmount (${targetSwap?.toAmount}) ≈ ${KNOWN_MULTI_TRANSFER_SWAP.expectedToAmount}`,
    );

    // Verify protocol and chain
    expect(targetSwap?.protocol).toBe(
      KNOWN_MULTI_TRANSFER_SWAP.expectedProtocol,
    );
    expect(targetSwap?.chain).toBe(KNOWN_MULTI_TRANSFER_SWAP.expectedChain);
    console.log(`✓ protocol is ${targetSwap?.protocol}`);
    console.log(`✓ chain is ${targetSwap?.chain}`);

    // Verify block number
    expect(targetSwap?.blockNumber).toBe(KNOWN_MULTI_TRANSFER_SWAP.blockNumber);
    console.log(`✓ blockNumber is ${targetSwap?.blockNumber}`);

    console.log(`\n✓ REGRESSION TEST PASSED: logIndex-based detection works`);
  }, 30000);
});
