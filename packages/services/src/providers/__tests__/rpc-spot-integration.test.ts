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
  expectedFromAmount: 106.83240652919557, // AERO (18 decimals)
  expectedToAmount: 69.824083, // USDC (6 decimals)
  expectedProtocol: "aerodrome",
  expectedChain: "base",
  description:
    "AERO → USDC swap with 0-value ETH contract call (regression test)",
};

// =============================================================================
// SLIPSTREAM ROUTER TEST FIXTURES
// Aerodrome Slipstream uses concentrated liquidity pools (Uniswap V3 style)
// =============================================================================

// Slipstream exactInputSingle: USDC → KRWQ
const KNOWN_SLIPSTREAM_EXACT_INPUT_SINGLE = {
  txHash: "0x7fa109fea467781934b21a91d3dca8bc5ffc7635782b4aa5d1c757a09c50cc29",
  blockNumber: 39299526,
  wallet: "0xBBF09c739fDfC0408BA80fB6e6DCB72A1D4A1Bfe",
  expectedFromToken: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913".toLowerCase(), // USDC
  expectedToToken: "0x370923d39f139c64813f173a1bf0b4f9ba36a24f".toLowerCase(), // KRWQ
  expectedFromAmount: 70.662997,
  expectedToAmount: 101572.91, // Approximate
  expectedProtocol: "aerodrome",
  expectedChain: "base",
  routerFunction: "exactInputSingle",
  description: "USDC → KRWQ via Slipstream exactInputSingle",
};

// Slipstream exactOutputSingle: ANY → WETH
const KNOWN_SLIPSTREAM_EXACT_OUTPUT_SINGLE = {
  txHash: "0x21ee44d7b49715201576bf03d0dffbe58015fc4682aa37b85c21d029a3309254",
  blockNumber: 39299526,
  wallet: "0x004bc7477782fca15508D638e5a9C0C162706D8d",
  expectedFromToken: "0xc17dda248e2d50fc006d8febb5a406dd31972712".toLowerCase(), // ANY
  expectedToToken: "0x4200000000000000000000000000000000000006".toLowerCase(), // WETH
  expectedFromAmount: 1733.916, // Approximate
  expectedToAmount: 0.04391726516278588,
  expectedProtocol: "aerodrome",
  expectedChain: "base",
  routerFunction: "exactOutputSingle",
  description: "ANY → WETH via Slipstream exactOutputSingle",
};

// Slipstream exactInput (single-hop via path): USDC → RIVER
const KNOWN_SLIPSTREAM_EXACT_INPUT = {
  txHash: "0x73391e3a716817714e86d6fc52651d6d631e2e449f9a39eab094c35143a7e184",
  blockNumber: 39299502,
  wallet: "0xD3C2dD3E69997B45e11C9795435f87ef22269CAe",
  expectedFromToken: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913".toLowerCase(), // USDC
  expectedToToken: "0xda7ad9dea9397cffddae2f8a052b82f1484252b3".toLowerCase(), // RIVER
  expectedFromAmount: 50,
  expectedToAmount: 8.028053222696023,
  expectedProtocol: "aerodrome",
  expectedChain: "base",
  routerFunction: "exactInput",
  description: "USDC → RIVER via Slipstream exactInput",
};

// Slipstream exactInput multi-hop: ETH → WETH → EMP → Token
// Input is native ETH (tx.value), 4 ERC-20 transfers
const KNOWN_SLIPSTREAM_MULTIHOP = {
  txHash: "0x2bb56ed06c46c1e2be721231c09fff5a1bf83e33cae5cca4504864c8eeda1f18",
  blockNumber: 38813273,
  wallet: "0xf5c299316699131d29adcb7ef87af8e97bbc7ead",
  expectedFromToken: NATIVE_TOKEN_ADDRESS, // Native ETH (wrapped to WETH in router)
  expectedToToken: "0x288f4eb27400fa220d14b864259ad1b7f77c1594".toLowerCase(), // Output token
  expectedFromAmount: 0.055, // ETH sent as tx.value
  expectedToAmount: 39179573.67, // Approximate
  expectedProtocol: "aerodrome",
  expectedChain: "base",
  routerFunction: "exactInput",
  transferCount: 4, // Multi-hop confirmed
  description: "ETH → WETH → EMP → Token via Slipstream exactInput (multi-hop)",
};

// Get Aerodrome protocol configs from constants (V2 + Slipstream)
const aerodromeConfigs = getDexProtocolConfig("aerodrome", "base");
if (!aerodromeConfigs || aerodromeConfigs.length === 0) {
  throw new Error("Aerodrome config not found in KNOWN_DEX_PROTOCOLS");
}

// V2 Router config (first in array) - used by existing tests
const aerodromeV2Config = aerodromeConfigs.find((c) => c.routerType === "v2");
if (!aerodromeV2Config) {
  throw new Error("Aerodrome V2 config not found");
}

// Slipstream Router config - used by new Slipstream tests
const aerodromeSlipstreamConfig = aerodromeConfigs.find(
  (c) => c.routerType === "slipstream",
);
if (!aerodromeSlipstreamConfig) {
  throw new Error("Aerodrome Slipstream config not found");
}

// V2 filter for existing tests
const AERODROME_V2_FILTER: ProtocolFilter = {
  protocol: "aerodrome",
  chain: "base",
  routerAddress: aerodromeV2Config.routerAddress,
  swapEventSignature: aerodromeV2Config.swapEventSignature,
  factoryAddress: aerodromeV2Config.factoryAddress,
};

// Slipstream filter for new tests
const AERODROME_SLIPSTREAM_FILTER: ProtocolFilter = {
  protocol: "aerodrome",
  chain: "base",
  routerAddress: aerodromeSlipstreamConfig.routerAddress,
  swapEventSignature: aerodromeSlipstreamConfig.swapEventSignature,
  factoryAddress: aerodromeSlipstreamConfig.factoryAddress,
};

// Combined filter with both routers (for real competition scenarios)
const AERODROME_COMBINED_FILTERS: ProtocolFilter[] = aerodromeConfigs.map(
  (config) => ({
    protocol: "aerodrome",
    chain: "base",
    routerAddress: config.routerAddress,
    swapEventSignature: config.swapEventSignature,
    factoryAddress: config.factoryAddress,
  }),
);

// Backward compatibility: alias for V2 filter used by existing tests
const AERODROME_FILTER = AERODROME_V2_FILTER;

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

  // ===========================================================================
  // SLIPSTREAM ROUTER TESTS
  // These tests verify Aerodrome Slipstream (concentrated liquidity) detection
  // ===========================================================================

  test("should detect Slipstream exactInputSingle swap (USDC → KRWQ)", async () => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.log("Skipping test - no ALCHEMY_API_KEY");
      return;
    }

    provider = new RpcSpotProvider(
      realRpcProvider,
      [AERODROME_SLIPSTREAM_FILTER],
      mockLogger,
    );

    const fromBlock = KNOWN_SLIPSTREAM_EXACT_INPUT_SINGLE.blockNumber - 5;
    const toBlock = KNOWN_SLIPSTREAM_EXACT_INPUT_SINGLE.blockNumber + 5;

    console.log(
      `\n[SLIPSTREAM TEST] ${KNOWN_SLIPSTREAM_EXACT_INPUT_SINGLE.description}`,
    );
    console.log(`  TxHash: ${KNOWN_SLIPSTREAM_EXACT_INPUT_SINGLE.txHash}`);
    console.log(`  Scanning blocks ${fromBlock} to ${toBlock}...`);

    const result = await provider.getTradesSince(
      KNOWN_SLIPSTREAM_EXACT_INPUT_SINGLE.wallet,
      fromBlock,
      ["base"],
      toBlock,
    );
    const trades = result.trades;

    console.log(`  Found ${trades.length} trades`);

    const targetSwap = trades.find(
      (t) =>
        t.txHash.toLowerCase() ===
        KNOWN_SLIPSTREAM_EXACT_INPUT_SINGLE.txHash.toLowerCase(),
    );

    expect(targetSwap).toBeDefined();
    console.log(`✓ Found Slipstream exactInputSingle swap`);
    console.log(`  From: ${targetSwap?.fromToken} (${targetSwap?.fromAmount})`);
    console.log(`  To: ${targetSwap?.toToken} (${targetSwap?.toAmount})`);

    // Verify tokens
    expect(targetSwap?.fromToken.toLowerCase()).toBe(
      KNOWN_SLIPSTREAM_EXACT_INPUT_SINGLE.expectedFromToken,
    );
    expect(targetSwap?.toToken.toLowerCase()).toBe(
      KNOWN_SLIPSTREAM_EXACT_INPUT_SINGLE.expectedToToken,
    );
    console.log(`✓ Tokens correctly identified`);

    // Verify amounts are sensible
    expect(targetSwap?.fromAmount).toBeGreaterThan(0);
    expect(targetSwap?.toAmount).toBeGreaterThan(0);
    console.log(`✓ Amounts are valid`);
  }, 30000);

  test("should detect Slipstream exactOutputSingle swap (ANY → WETH)", async () => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.log("Skipping test - no ALCHEMY_API_KEY");
      return;
    }

    provider = new RpcSpotProvider(
      realRpcProvider,
      [AERODROME_SLIPSTREAM_FILTER],
      mockLogger,
    );

    const fromBlock = KNOWN_SLIPSTREAM_EXACT_OUTPUT_SINGLE.blockNumber - 5;
    const toBlock = KNOWN_SLIPSTREAM_EXACT_OUTPUT_SINGLE.blockNumber + 5;

    console.log(
      `\n[SLIPSTREAM TEST] ${KNOWN_SLIPSTREAM_EXACT_OUTPUT_SINGLE.description}`,
    );
    console.log(`  TxHash: ${KNOWN_SLIPSTREAM_EXACT_OUTPUT_SINGLE.txHash}`);
    console.log(`  Scanning blocks ${fromBlock} to ${toBlock}...`);

    const result = await provider.getTradesSince(
      KNOWN_SLIPSTREAM_EXACT_OUTPUT_SINGLE.wallet,
      fromBlock,
      ["base"],
      toBlock,
    );
    const trades = result.trades;

    console.log(`  Found ${trades.length} trades`);

    const targetSwap = trades.find(
      (t) =>
        t.txHash.toLowerCase() ===
        KNOWN_SLIPSTREAM_EXACT_OUTPUT_SINGLE.txHash.toLowerCase(),
    );

    expect(targetSwap).toBeDefined();
    console.log(`✓ Found Slipstream exactOutputSingle swap`);
    console.log(`  From: ${targetSwap?.fromToken} (${targetSwap?.fromAmount})`);
    console.log(`  To: ${targetSwap?.toToken} (${targetSwap?.toAmount})`);

    // Verify tokens
    expect(targetSwap?.fromToken.toLowerCase()).toBe(
      KNOWN_SLIPSTREAM_EXACT_OUTPUT_SINGLE.expectedFromToken,
    );
    expect(targetSwap?.toToken.toLowerCase()).toBe(
      KNOWN_SLIPSTREAM_EXACT_OUTPUT_SINGLE.expectedToToken,
    );
    console.log(`✓ Tokens correctly identified`);
  }, 30000);

  test("should detect Slipstream exactInput swap (USDC → RIVER)", async () => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.log("Skipping test - no ALCHEMY_API_KEY");
      return;
    }

    provider = new RpcSpotProvider(
      realRpcProvider,
      [AERODROME_SLIPSTREAM_FILTER],
      mockLogger,
    );

    const fromBlock = KNOWN_SLIPSTREAM_EXACT_INPUT.blockNumber - 5;
    const toBlock = KNOWN_SLIPSTREAM_EXACT_INPUT.blockNumber + 5;

    console.log(
      `\n[SLIPSTREAM TEST] ${KNOWN_SLIPSTREAM_EXACT_INPUT.description}`,
    );
    console.log(`  TxHash: ${KNOWN_SLIPSTREAM_EXACT_INPUT.txHash}`);
    console.log(`  Scanning blocks ${fromBlock} to ${toBlock}...`);

    const result = await provider.getTradesSince(
      KNOWN_SLIPSTREAM_EXACT_INPUT.wallet,
      fromBlock,
      ["base"],
      toBlock,
    );
    const trades = result.trades;

    console.log(`  Found ${trades.length} trades`);

    const targetSwap = trades.find(
      (t) =>
        t.txHash.toLowerCase() ===
        KNOWN_SLIPSTREAM_EXACT_INPUT.txHash.toLowerCase(),
    );

    expect(targetSwap).toBeDefined();
    console.log(`✓ Found Slipstream exactInput swap`);
    console.log(`  From: ${targetSwap?.fromToken} (${targetSwap?.fromAmount})`);
    console.log(`  To: ${targetSwap?.toToken} (${targetSwap?.toAmount})`);

    // Verify tokens
    expect(targetSwap?.fromToken.toLowerCase()).toBe(
      KNOWN_SLIPSTREAM_EXACT_INPUT.expectedFromToken,
    );
    expect(targetSwap?.toToken.toLowerCase()).toBe(
      KNOWN_SLIPSTREAM_EXACT_INPUT.expectedToToken,
    );
    console.log(`✓ Tokens correctly identified`);

    // Verify amounts match expected (blockchain data is immutable)
    expect(targetSwap?.fromAmount).toBeCloseTo(
      KNOWN_SLIPSTREAM_EXACT_INPUT.expectedFromAmount,
      4,
    );
    expect(targetSwap?.toAmount).toBeCloseTo(
      KNOWN_SLIPSTREAM_EXACT_INPUT.expectedToAmount,
      4,
    );
    console.log(`✓ Amounts match expected values`);
  }, 30000);

  test("should detect Slipstream multi-hop swap with native ETH input", async () => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.log("Skipping test - no ALCHEMY_API_KEY");
      return;
    }

    provider = new RpcSpotProvider(
      realRpcProvider,
      [AERODROME_SLIPSTREAM_FILTER],
      mockLogger,
    );

    const fromBlock = KNOWN_SLIPSTREAM_MULTIHOP.blockNumber - 5;
    const toBlock = KNOWN_SLIPSTREAM_MULTIHOP.blockNumber + 5;

    console.log(`\n[SLIPSTREAM TEST] ${KNOWN_SLIPSTREAM_MULTIHOP.description}`);
    console.log(`  TxHash: ${KNOWN_SLIPSTREAM_MULTIHOP.txHash}`);
    console.log(
      `  Expected: ${KNOWN_SLIPSTREAM_MULTIHOP.transferCount} ERC-20 transfers (multi-hop)`,
    );
    console.log(`  Scanning blocks ${fromBlock} to ${toBlock}...`);

    const result = await provider.getTradesSince(
      KNOWN_SLIPSTREAM_MULTIHOP.wallet,
      fromBlock,
      ["base"],
      toBlock,
    );
    const trades = result.trades;

    console.log(`  Found ${trades.length} trades`);

    const targetSwap = trades.find(
      (t) =>
        t.txHash.toLowerCase() ===
        KNOWN_SLIPSTREAM_MULTIHOP.txHash.toLowerCase(),
    );

    expect(targetSwap).toBeDefined();
    console.log(`✓ Found Slipstream multi-hop swap`);
    console.log(`  From: ${targetSwap?.fromToken} (${targetSwap?.fromAmount})`);
    console.log(`  To: ${targetSwap?.toToken} (${targetSwap?.toAmount})`);

    // Verify input is detected as native ETH (zero address)
    expect(targetSwap?.fromToken.toLowerCase()).toBe(
      KNOWN_SLIPSTREAM_MULTIHOP.expectedFromToken.toLowerCase(),
    );
    console.log(`✓ Native ETH input correctly detected (zero address)`);

    // Verify output token
    expect(targetSwap?.toToken.toLowerCase()).toBe(
      KNOWN_SLIPSTREAM_MULTIHOP.expectedToToken,
    );
    console.log(`✓ Output token correctly identified`);

    // Verify amounts are sensible
    expect(targetSwap?.fromAmount).toBeGreaterThan(0);
    expect(targetSwap?.toAmount).toBeGreaterThan(0);
    console.log(`✓ Multi-hop swap amounts are valid`);
  }, 30000);

  test("should detect swaps from both V2 and Slipstream routers with combined filters", async () => {
    if (!process.env.ALCHEMY_API_KEY) {
      console.log("Skipping test - no ALCHEMY_API_KEY");
      return;
    }

    // Use combined filters (both V2 and Slipstream) like a real competition would
    provider = new RpcSpotProvider(
      realRpcProvider,
      AERODROME_COMBINED_FILTERS,
      mockLogger,
    );

    // Test with a V2 transaction
    const fromBlock = KNOWN_AERODROME_SWAP.blockNumber - 5;
    const toBlock = KNOWN_AERODROME_SWAP.blockNumber + 5;

    console.log(`\n[COMBINED FILTER TEST] Testing V2 + Slipstream detection`);
    console.log(
      `  Using ${AERODROME_COMBINED_FILTERS.length} protocol filters`,
    );
    console.log(
      `  Testing V2 swap at block ${KNOWN_AERODROME_SWAP.blockNumber}`,
    );

    const result = await provider.getTradesSince(
      KNOWN_AERODROME_SWAP.wallet,
      fromBlock,
      ["base"],
      toBlock,
    );
    const trades = result.trades;

    const v2Swap = trades.find(
      (t) =>
        t.txHash.toLowerCase() === KNOWN_AERODROME_SWAP.txHash.toLowerCase(),
    );

    expect(v2Swap).toBeDefined();
    console.log(`✓ V2 swap detected with combined filters`);
    console.log(`  Protocol: ${v2Swap?.protocol}`);

    // Verify it's still identified as aerodrome
    expect(v2Swap?.protocol).toBe("aerodrome");
    console.log(`✓ Combined filter test passed`);
  }, 30000);

  // ===========================================================================
  // TOKEN SYMBOL RETRIEVAL TESTS
  // These tests verify on-chain symbol() retrieval works correctly
  // Used as fallback when price providers return contract address as symbol
  // ===========================================================================

  // Test fixture: PONKE token on Base
  // CoinGecko returns the contract address as symbol for this token
  // On-chain symbol() call returns "PONKE"
  const PONKE_TOKEN = {
    address: "0x4a0c64af541439898448659aedcec8e8e819fc53",
    expectedSymbol: "PONKE",
    expectedDecimals: 18,
    chain: "base" as const,
    description:
      "Token where CoinGecko returns address as symbol (discovered in production)",
  };

  // Known tokens with proper symbols for comparison
  const KNOWN_TOKENS = {
    USDC: {
      address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      expectedSymbol: "USDC",
      expectedDecimals: 6,
      chain: "base" as const,
    },
    WETH: {
      address: "0x4200000000000000000000000000000000000006",
      expectedSymbol: "WETH",
      expectedDecimals: 18,
      chain: "base" as const,
    },
    AERO: {
      address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
      expectedSymbol: "AERO",
      expectedDecimals: 18,
      chain: "base" as const,
    },
  };

  test.skipIf(!process.env.ALCHEMY_API_KEY)(
    "should retrieve PONKE token symbol from on-chain (CoinGecko returns address)",
    async () => {
      const symbol = await realRpcProvider.getTokenSymbol(
        PONKE_TOKEN.address,
        PONKE_TOKEN.chain,
      );

      expect(symbol).toBe(PONKE_TOKEN.expectedSymbol);
      expect(symbol?.length).toBeLessThanOrEqual(20); // Must fit in varchar(20)
    },
    30000,
  );

  test.skipIf(!process.env.ALCHEMY_API_KEY)(
    "should retrieve symbols for known tokens (USDC, WETH, AERO)",
    async () => {
      for (const [, token] of Object.entries(KNOWN_TOKENS)) {
        const symbol = await realRpcProvider.getTokenSymbol(
          token.address,
          token.chain,
        );

        expect(symbol).toBe(token.expectedSymbol);
        expect(symbol?.length).toBeLessThanOrEqual(20);
      }
    },
    30000,
  );

  test.skipIf(!process.env.ALCHEMY_API_KEY)(
    "should retrieve correct decimals for PONKE token",
    async () => {
      const decimals = await realRpcProvider.getTokenDecimals(
        PONKE_TOKEN.address,
        PONKE_TOKEN.chain,
      );

      expect(decimals).toBe(PONKE_TOKEN.expectedDecimals);
    },
    30000,
  );

  test.skipIf(!process.env.ALCHEMY_API_KEY)(
    "should retrieve correct decimals for known tokens",
    async () => {
      for (const [, token] of Object.entries(KNOWN_TOKENS)) {
        const decimals = await realRpcProvider.getTokenDecimals(
          token.address,
          token.chain,
        );

        expect(decimals).toBe(token.expectedDecimals);
      }
    },
    30000,
  );

  test.skipIf(!process.env.ALCHEMY_API_KEY)(
    "should return null for invalid token address symbol",
    async () => {
      // Use a non-contract address (EOA or zero address)
      const invalidAddress = "0x0000000000000000000000000000000000000001";

      const symbol = await realRpcProvider.getTokenSymbol(
        invalidAddress,
        "base",
      );

      // Should return null for non-contract addresses
      expect(symbol).toBeNull();
    },
    30000,
  );

  test.skipIf(!process.env.ALCHEMY_API_KEY)(
    "RpcSpotProvider should delegate getTokenSymbol to AlchemyRpcProvider",
    async () => {
      provider = new RpcSpotProvider(realRpcProvider, [], mockLogger);

      const symbol = await provider.getTokenSymbol(
        PONKE_TOKEN.address,
        PONKE_TOKEN.chain,
      );

      expect(symbol).toBe(PONKE_TOKEN.expectedSymbol);
    },
    30000,
  );
});
