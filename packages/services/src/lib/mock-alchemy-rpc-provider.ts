import {
  AssetTransfersCategory,
  AssetTransfersWithMetadataResponse,
  AssetTransfersWithMetadataResult,
} from "alchemy-sdk";
import { Logger } from "pino";

import { SpecificChain } from "../types/index.js";
import {
  IRpcProvider,
  TokenBalance,
  TransactionData,
  TransactionReceipt,
} from "../types/rpc.js";

/**
 * ERC20 Transfer event signature (keccak256 of "Transfer(address,address,uint256)")
 */
const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/**
 * Aerodrome V2 Swap event signature (Classic AMM pools)
 * Swap(address indexed sender, address indexed to, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out)
 */
const AERODROME_V2_SWAP_TOPIC =
  "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b";

/**
 * Aerodrome Slipstream (CL) Swap event signature (Concentrated Liquidity pools)
 * Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)
 */
const AERODROME_CL_SWAP_TOPIC =
  "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";

/**
 * Helper to create an Aerodrome V2 Swap event log for mock receipts
 * Required for protocol filtering validation (Classic AMM pools)
 */
function createAerodromeV2SwapLog(params: {
  poolAddress: string;
  sender: string;
  to: string;
  logIndex: number;
  blockNumber: number;
  txHash: string;
}): {
  address: string;
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;
  removed: boolean;
  logIndex: number;
  transactionHash: string;
  topics: string[];
  data: string;
} {
  // Pad addresses to 32 bytes (64 hex chars) for topics
  const senderPadded =
    "0x" + params.sender.slice(2).toLowerCase().padStart(64, "0");
  const toPadded = "0x" + params.to.slice(2).toLowerCase().padStart(64, "0");

  // Data contains 4 uint256 values (amount0In, amount1In, amount0Out, amount1Out) - mock values
  const mockData =
    "0x" +
    "0000000000000000000000000000000000000000000000000000000000000001" + // amount0In
    "0000000000000000000000000000000000000000000000000000000000000000" + // amount1In
    "0000000000000000000000000000000000000000000000000000000000000000" + // amount0Out
    "0000000000000000000000000000000000000000000000000000000000000001"; // amount1Out

  return {
    address: params.poolAddress.toLowerCase(),
    blockNumber: params.blockNumber,
    blockHash: `0xmockhash${params.blockNumber}`,
    transactionIndex: 0,
    removed: false,
    logIndex: params.logIndex,
    transactionHash: params.txHash,
    topics: [AERODROME_V2_SWAP_TOPIC, senderPadded, toPadded],
    data: mockData,
  };
}

/**
 * Helper to create an Aerodrome Slipstream (CL) Swap event log for mock receipts
 * Required for protocol filtering validation (Concentrated Liquidity pools)
 * Event: Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)
 */
function createSlipstreamSwapLog(params: {
  poolAddress: string;
  sender: string;
  recipient: string;
  logIndex: number;
  blockNumber: number;
  txHash: string;
}): {
  address: string;
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;
  removed: boolean;
  logIndex: number;
  transactionHash: string;
  topics: string[];
  data: string;
} {
  // Pad addresses to 32 bytes (64 hex chars) for topics
  const senderPadded =
    "0x" + params.sender.slice(2).toLowerCase().padStart(64, "0");
  const recipientPadded =
    "0x" + params.recipient.slice(2).toLowerCase().padStart(64, "0");

  // Data contains: int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick
  // Mock values representing a typical CL swap
  const mockData =
    "0x" +
    "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" + // amount0 (negative = token out)
    "0000000000000000000000000000000000000000000000000000000000000001" + // amount1 (positive = token in)
    "0000000000000000000000000000000001000000000000000000000000000000" + // sqrtPriceX96
    "0000000000000000000000000000000000000000000000000000000000001000" + // liquidity
    "0000000000000000000000000000000000000000000000000000000000000064"; // tick

  return {
    address: params.poolAddress.toLowerCase(),
    blockNumber: params.blockNumber,
    blockHash: `0xmockhash${params.blockNumber}`,
    transactionIndex: 0,
    removed: false,
    logIndex: params.logIndex,
    transactionHash: params.txHash,
    topics: [AERODROME_CL_SWAP_TOPIC, senderPadded, recipientPadded],
    data: mockData,
  };
}

/**
 * Helper to create an ERC20 Transfer log for mock receipts
 * The logIndex ordering is critical for swap detection
 */
function createTransferLog(params: {
  tokenAddress: string;
  from: string;
  to: string;
  value: number;
  decimals: number;
  logIndex: number;
  blockNumber: number;
  txHash: string;
}): {
  address: string;
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;
  removed: boolean;
  logIndex: number;
  transactionHash: string;
  topics: string[];
  data: string;
} {
  // Pad addresses to 32 bytes (64 hex chars) for topics
  const fromPadded =
    "0x" + params.from.slice(2).toLowerCase().padStart(64, "0");
  const toPadded = "0x" + params.to.slice(2).toLowerCase().padStart(64, "0");

  // Encode value as uint256 (multiply by decimals, then hex encode to 32 bytes)
  const rawValue = BigInt(
    Math.floor(params.value * Math.pow(10, params.decimals)),
  );
  const valuePadded = "0x" + rawValue.toString(16).padStart(64, "0");

  return {
    address: params.tokenAddress.toLowerCase(),
    blockNumber: params.blockNumber,
    blockHash: `0xmockhash${params.blockNumber}`,
    transactionIndex: 0,
    removed: false,
    logIndex: params.logIndex,
    transactionHash: params.txHash,
    topics: [ERC20_TRANSFER_TOPIC, fromPadded, toPadded],
    data: valuePadded,
  };
}

/**
 * Helper to create properly formatted transfer objects
 * Ensures all required Alchemy SDK fields are populated
 */
function createMockTransfer(params: {
  from: string;
  to: string;
  value: number;
  asset: string;
  hash: string;
  blockNum: string;
  blockTimestamp: string;
  tokenAddress: string;
  decimal: string;
  category?: AssetTransfersCategory;
}): AssetTransfersWithMetadataResult {
  // Use EXTERNAL category for native tokens (ETH, MATIC, etc.)
  const isNativeTransfer = params.asset === "ETH" || params.asset === "MATIC";
  const category =
    params.category ??
    (isNativeTransfer
      ? AssetTransfersCategory.EXTERNAL
      : AssetTransfersCategory.ERC20);

  return {
    uniqueId: `${params.hash}-${params.from}-${params.to}`.toLowerCase(),
    category,
    blockNum: params.blockNum,
    from: params.from,
    to: params.to,
    value: params.value,
    erc721TokenId: null,
    erc1155Metadata: null,
    tokenId: null,
    asset: params.asset,
    hash: params.hash,
    rawContract: isNativeTransfer
      ? { address: null, decimal: null, value: null }
      : {
          address: params.tokenAddress,
          decimal: params.decimal,
          value: null,
        },
    metadata: {
      blockTimestamp: params.blockTimestamp,
    },
  };
}

/**
 * Mock Alchemy RPC Provider for E2E Testing
 * Implements IRpcProvider interface to provide deterministic blockchain data for testing
 *
 * Pattern matches MockPrivyClient:
 * - Lives in services/lib (same package)
 * - Used via runtime check in SpotLiveProviderFactory
 * - Pre-configured wallet addresses with mock swap data
 * - Reset method for cleanup between tests
 * - Deterministic data for reproducible tests
 *
 * Injected by SpotLiveProviderFactory when process.env.TEST_MODE === "true"
 */
export class MockAlchemyRpcProvider implements IRpcProvider {
  private mockData: Map<string, MockWalletData> = new Map();
  private logger: Logger;

  // Track API calls for testing progression (matches MockHyperliquidServer pattern)
  private callIndex: Map<string, number> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeDefaultMockData();
  }

  /**
   * Initialize default mock data for test wallets
   * Pre-configured wallets with known swaps and transfers
   * Uses relative timestamps (like MockHyperliquidServer) to ensure data is "recent"
   */
  private initializeDefaultMockData(): void {
    // Default data for new wallets - no activity
    this.setDefaultWalletData("default", {
      transfers: [],
      transactions: new Map(),
      receipts: new Map(),
      balances: new Map(),
    });

    // Generate timestamps relative to NOW (like Hyperliquid mock)
    // Swaps happened 10min, 20min, 30min ago - ensures they're captured in competition sync
    const swap1Time = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
    const swap2Time = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 minutes ago
    const swap3Time = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 minutes ago

    // Pre-configured test wallet #1: Multiple Aerodrome swaps showing positive ROI progression
    // Simulates successful trading with portfolio growth across multiple syncs
    // Initial: 5000 USDC
    // After Swap 1 (block 2000000): 4900 USDC + 50 AERO (net: ~$5000)
    // After Swap 2 (block 2000010): 4900 USDC + 40 AERO + 0.005 ETH (net: ~$5015 if AERO/ETH price up)
    // After Swap 3 (block 2000020): 4900 USDC + 35 AERO + 0.005 ETH + small gain (net: ~$5025)
    this.setWalletData("0x1111111111111111111111111111111111111111", {
      transfers: [
        // Swap 1: USDC → AERO (Block 2000000) - 30 minutes ago
        createMockTransfer({
          from: "0x1111111111111111111111111111111111111111",
          to: "0xd35fcf71834c4a4ae98ff22f68c05e13e5fdee01",
          value: 100,
          asset: "USDC",
          hash: "0xmock_swap_1",
          blockNum: "0x1e8480",
          blockTimestamp: swap3Time,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
        createMockTransfer({
          from: "0xd35fcf71834c4a4ae98ff22f68c05e13e5fdee01",
          to: "0x1111111111111111111111111111111111111111",
          value: 50,
          asset: "AERO",
          hash: "0xmock_swap_1",
          blockNum: "0x1e8480",
          blockTimestamp: swap3Time,
          tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
          decimal: "18",
        }),
        // Swap 2: AERO → ETH (Block 2000010) - 20 minutes ago
        createMockTransfer({
          from: "0x1111111111111111111111111111111111111111",
          to: "0xaeropool22222222222222222222222222222222", // Valid 40-char hex
          value: 10,
          asset: "AERO",
          hash: "0xmock_swap_2",
          blockNum: "0x1e848a",
          blockTimestamp: swap2Time,
          tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
          decimal: "18",
        }),
        createMockTransfer({
          from: "0xaeropool22222222222222222222222222222222", // Valid 40-char hex
          to: "0x1111111111111111111111111111111111111111",
          value: 0.005,
          asset: "ETH",
          hash: "0xmock_swap_2",
          blockNum: "0x1e848a",
          blockTimestamp: swap2Time,
          tokenAddress: "0x4200000000000000000000000000000000000006",
          decimal: "18",
        }),
        // Swap 3: AERO → USDC (Block 2000020) - 10 minutes ago
        createMockTransfer({
          from: "0x1111111111111111111111111111111111111111",
          to: "0xaeropool33333333333333333333333333333333", // Valid 40-char hex
          value: 5,
          asset: "AERO",
          hash: "0xmock_swap_3",
          blockNum: "0x1e8494",
          blockTimestamp: swap1Time,
          tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
          decimal: "18",
        }),
        createMockTransfer({
          from: "0xaeropool33333333333333333333333333333333", // Valid 40-char hex
          to: "0x1111111111111111111111111111111111111111",
          value: 6,
          asset: "USDC",
          hash: "0xmock_swap_3",
          blockNum: "0x1e8494",
          blockTimestamp: swap1Time,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
      ],
      transactions: new Map([
        [
          "0xmock_swap_1",
          {
            hash: "0xmock_swap_1",
            from: "0x1111111111111111111111111111111111111111",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43", // Aerodrome router
            blockNumber: 2000000,
          },
        ],
        [
          "0xmock_swap_2",
          {
            hash: "0xmock_swap_2",
            from: "0x1111111111111111111111111111111111111111",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43", // Aerodrome router
            blockNumber: 2000010,
          },
        ],
        [
          "0xmock_swap_3",
          {
            hash: "0xmock_swap_3",
            from: "0x1111111111111111111111111111111111111111",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43", // Aerodrome router
            blockNumber: 2000020,
          },
        ],
      ]),
      receipts: new Map([
        [
          "0xmock_swap_1",
          {
            transactionHash: "0xmock_swap_1",
            blockNumber: 2000000,
            gasUsed: "150000",
            effectiveGasPrice: "50000000000",
            status: true,
            from: "0x1111111111111111111111111111111111111111",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            logs: [
              // ERC20 Transfer: USDC from wallet to pool (outbound)
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
                from: "0x1111111111111111111111111111111111111111",
                to: "0xd35fcf71834c4a4ae98ff22f68c05e13e5fdee01", // pool
                value: 100,
                decimals: 6,
                logIndex: 0,
                blockNumber: 2000000,
                txHash: "0xmock_swap_1",
              }),
              // ERC20 Transfer: AERO from pool to wallet (inbound)
              createTransferLog({
                tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", // AERO
                from: "0xd35fcf71834c4a4ae98ff22f68c05e13e5fdee01", // pool
                to: "0x1111111111111111111111111111111111111111",
                value: 50,
                decimals: 18,
                logIndex: 1,
                blockNumber: 2000000,
                txHash: "0xmock_swap_1",
              }),
              // Aerodrome Swap event (required for protocol filtering)
              createAerodromeV2SwapLog({
                poolAddress: "0xd35fcf71834c4a4ae98ff22f68c05e13e5fdee01",
                sender: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43", // router
                to: "0x1111111111111111111111111111111111111111",
                logIndex: 2,
                blockNumber: 2000000,
                txHash: "0xmock_swap_1",
              }),
            ],
          },
        ],
        [
          "0xmock_swap_2",
          {
            transactionHash: "0xmock_swap_2",
            blockNumber: 2000010,
            gasUsed: "160000",
            effectiveGasPrice: "51000000000",
            status: true,
            from: "0x1111111111111111111111111111111111111111",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            logs: [
              // ERC20 Transfer: AERO from wallet to pool (outbound)
              createTransferLog({
                tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", // AERO
                from: "0x1111111111111111111111111111111111111111",
                to: "0xaeropool22222222222222222222222222222222", // Valid 40-char hex
                value: 10,
                decimals: 18,
                logIndex: 0,
                blockNumber: 2000010,
                txHash: "0xmock_swap_2",
              }),
              // ERC20 Transfer: WETH from pool to wallet (inbound)
              createTransferLog({
                tokenAddress: "0x4200000000000000000000000000000000000006", // WETH
                from: "0xaeropool22222222222222222222222222222222", // Valid 40-char hex
                to: "0x1111111111111111111111111111111111111111",
                value: 0.005,
                decimals: 18,
                logIndex: 1,
                blockNumber: 2000010,
                txHash: "0xmock_swap_2",
              }),
              // Aerodrome Swap event
              createAerodromeV2SwapLog({
                poolAddress: "0xaeropool22222222222222222222222222222222",
                sender: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
                to: "0x1111111111111111111111111111111111111111",
                logIndex: 2,
                blockNumber: 2000010,
                txHash: "0xmock_swap_2",
              }),
            ],
          },
        ],
        [
          "0xmock_swap_3",
          {
            transactionHash: "0xmock_swap_3",
            blockNumber: 2000020,
            gasUsed: "155000",
            effectiveGasPrice: "49000000000",
            status: true,
            from: "0x1111111111111111111111111111111111111111",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            logs: [
              // ERC20 Transfer: AERO from wallet to pool (outbound)
              createTransferLog({
                tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", // AERO
                from: "0x1111111111111111111111111111111111111111",
                to: "0xaeropool33333333333333333333333333333333", // Valid 40-char hex
                value: 5,
                decimals: 18,
                logIndex: 0,
                blockNumber: 2000020,
                txHash: "0xmock_swap_3",
              }),
              // ERC20 Transfer: USDC from pool to wallet (inbound)
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
                from: "0xaeropool33333333333333333333333333333333", // Valid 40-char hex
                to: "0x1111111111111111111111111111111111111111",
                value: 6,
                decimals: 6,
                logIndex: 1,
                blockNumber: 2000020,
                txHash: "0xmock_swap_3",
              }),
              // Aerodrome Swap event
              createAerodromeV2SwapLog({
                poolAddress: "0xaeropool33333333333333333333333333333333",
                sender: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
                to: "0x1111111111111111111111111111111111111111",
                logIndex: 2,
                blockNumber: 2000020,
                txHash: "0xmock_swap_3",
              }),
            ],
          },
        ],
      ]),
      balances: new Map([
        ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 5000], // USDC - initial balance
        ["0x940181a94a35a4569e4529a3cdfb74e38fd98631", 0], // AERO - will accumulate
        ["0x4200000000000000000000000000000000000006", 0], // WETH - will accumulate
      ]),
    });

    // Pre-configured test wallet #2: Agent with deposit (transfer violation)
    // Note: Timestamp generated at QUERY time (in getAssetTransfers), not at init time
    // This ensures deposit happens AFTER competition starts
    this.setWalletData("0x2222222222222222222222222222222222222222", {
      transfers: [
        // Deposit: External wallet → Agent
        // Timestamp set dynamically in getAssetTransfers
        createMockTransfer({
          from: "0xexternal1111111111111111111111111111111111",
          to: "0x2222222222222222222222222222222222222222",
          value: 1000,
          asset: "USDC",
          hash: "0xmock_deposit_1",
          blockNum: "0x1e8481",
          blockTimestamp: "DYNAMIC", // Will be replaced at query time
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
      ],
      transactions: new Map(),
      receipts: new Map(),
      balances: new Map([["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 6000]]),
    });

    // Pre-configured test wallet #3: Agent with withdrawal (transfer violation)
    // Timestamp set dynamically in getAssetTransfers
    this.setWalletData("0x3333333333333333333333333333333333333333", {
      transfers: [
        // Withdrawal: Agent → External wallet
        createMockTransfer({
          from: "0x3333333333333333333333333333333333333333",
          to: "0xexternal2222222222222222222222222222222222",
          value: 500,
          asset: "USDC",
          hash: "0xmock_withdraw_1",
          blockNum: "0x1e8482",
          blockTimestamp: "DYNAMIC", // Will be replaced at query time
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
      ],
      transactions: new Map(),
      receipts: new Map(),
      balances: new Map([["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 4500]]),
    });

    // Pre-configured test wallet #4: Multiple swaps at different blocks (protocol filtering test)
    // Aerodrome swap at block 2000030 (should pass filter)
    // Uniswap swap at block 2000031 (should be filtered out)
    const aerodromeSwapTime = new Date(
      Date.now() - 15 * 60 * 1000,
    ).toISOString(); // 15 minutes ago
    const uniswapSwapTime = new Date(Date.now() - 14 * 60 * 1000).toISOString(); // 14 minutes ago
    const aeroPool4 = "0xaeropool444444444444444444444444444444a4"; // Valid 40-char hex
    const uniPool4 = "0xunipool4444444444444444444444444444444b4"; // Valid 40-char hex
    this.setWalletData("0x4444444444444444444444444444444444444444", {
      transfers: [
        // Swap 1: Aerodrome USDC → AERO (Block 2000030)
        createMockTransfer({
          from: "0x4444444444444444444444444444444444444444",
          to: aeroPool4,
          value: 50,
          asset: "USDC",
          hash: "0xmock_aerodrome_swap",
          blockNum: "0x1e849e",
          blockTimestamp: aerodromeSwapTime,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
        createMockTransfer({
          from: aeroPool4,
          to: "0x4444444444444444444444444444444444444444",
          value: 25,
          asset: "AERO",
          hash: "0xmock_aerodrome_swap",
          blockNum: "0x1e849e",
          blockTimestamp: aerodromeSwapTime,
          tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
          decimal: "18",
        }),
        // Swap 2: Uniswap AERO → ETH (Block 2000031) - different protocol
        createMockTransfer({
          from: "0x4444444444444444444444444444444444444444",
          to: uniPool4,
          value: 10,
          asset: "AERO",
          hash: "0xmock_uniswap_swap",
          blockNum: "0x1e849f",
          blockTimestamp: uniswapSwapTime,
          tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
          decimal: "18",
        }),
        createMockTransfer({
          from: uniPool4,
          to: "0x4444444444444444444444444444444444444444",
          value: 0.05,
          asset: "ETH",
          hash: "0xmock_uniswap_swap",
          blockNum: "0x1e849f",
          blockTimestamp: uniswapSwapTime,
          tokenAddress: "0x4200000000000000000000000000000000000006",
          decimal: "18",
        }),
      ],
      transactions: new Map([
        [
          "0xmock_aerodrome_swap",
          {
            hash: "0xmock_aerodrome_swap",
            from: "0x4444444444444444444444444444444444444444",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43", // Aerodrome router
            blockNumber: 2000030,
          },
        ],
        [
          "0xmock_uniswap_swap",
          {
            hash: "0xmock_uniswap_swap",
            from: "0x4444444444444444444444444444444444444444",
            to: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap router (different)
            blockNumber: 2000031,
          },
        ],
      ]),
      receipts: new Map([
        [
          "0xmock_aerodrome_swap",
          {
            transactionHash: "0xmock_aerodrome_swap",
            blockNumber: 2000030,
            gasUsed: "150000",
            effectiveGasPrice: "50000000000",
            status: true,
            from: "0x4444444444444444444444444444444444444444",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            logs: [
              // ERC20 Transfer: USDC from wallet to pool (outbound)
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
                from: "0x4444444444444444444444444444444444444444",
                to: aeroPool4,
                value: 50,
                decimals: 6,
                logIndex: 0,
                blockNumber: 2000030,
                txHash: "0xmock_aerodrome_swap",
              }),
              // ERC20 Transfer: AERO from pool to wallet (inbound)
              createTransferLog({
                tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", // AERO
                from: aeroPool4,
                to: "0x4444444444444444444444444444444444444444",
                value: 25,
                decimals: 18,
                logIndex: 1,
                blockNumber: 2000030,
                txHash: "0xmock_aerodrome_swap",
              }),
              // Aerodrome Swap event (required for protocol filtering)
              createAerodromeV2SwapLog({
                poolAddress: aeroPool4,
                sender: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
                to: "0x4444444444444444444444444444444444444444",
                logIndex: 2,
                blockNumber: 2000030,
                txHash: "0xmock_aerodrome_swap",
              }),
            ],
          },
        ],
        [
          "0xmock_uniswap_swap",
          {
            transactionHash: "0xmock_uniswap_swap",
            blockNumber: 2000031,
            gasUsed: "180000",
            effectiveGasPrice: "50000000000",
            status: true,
            from: "0x4444444444444444444444444444444444444444",
            to: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
            logs: [
              // ERC20 Transfer: AERO from wallet to pool (outbound)
              createTransferLog({
                tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", // AERO
                from: "0x4444444444444444444444444444444444444444",
                to: uniPool4,
                value: 10,
                decimals: 18,
                logIndex: 0,
                blockNumber: 2000031,
                txHash: "0xmock_uniswap_swap",
              }),
              // ERC20 Transfer: WETH from pool to wallet (inbound)
              createTransferLog({
                tokenAddress: "0x4200000000000000000000000000000000000006", // WETH
                from: uniPool4,
                to: "0x4444444444444444444444444444444444444444",
                value: 0.05,
                decimals: 18,
                logIndex: 1,
                blockNumber: 2000031,
                txHash: "0xmock_uniswap_swap",
              }),
            ],
          },
        ],
      ]),
      balances: new Map([
        ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 5000], // USDC - initial
        ["0x940181a94a35a4569e4529a3cdfb74e38fd98631", 0], // AERO - will accumulate
        ["0x4200000000000000000000000000000000000006", 0], // WETH - will accumulate
      ]),
    });

    // Pre-configured test wallet #5: Empty wallet (no activity)
    this.setWalletData("0x5555555555555555555555555555555555555555", {
      transfers: [],
      transactions: new Map(),
      receipts: new Map(),
      balances: new Map(),
    });

    // Test wallet for initial balance verification - 2000 USDC on Base
    // After one sync: trades 100 USDC → 50 AERO, ending with 1900 USDC + 50 AERO
    const simpleSwap1Time = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
    const simplePool1 = "0xaeropool111111111111111111111111111111a1"; // Valid 40-char hex
    this.setWalletData("0xaaaa000000000000000000000000000000000001", {
      transfers: [
        createMockTransfer({
          from: "0xaaaa000000000000000000000000000000000001",
          to: simplePool1,
          value: 100,
          asset: "USDC",
          hash: "0xsimple_swap_1",
          blockNum: "0x1e8500", // Block 2001152
          blockTimestamp: simpleSwap1Time,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
        createMockTransfer({
          from: simplePool1,
          to: "0xaaaa000000000000000000000000000000000001",
          value: 50,
          asset: "AERO",
          hash: "0xsimple_swap_1",
          blockNum: "0x1e8500",
          blockTimestamp: simpleSwap1Time,
          tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
          decimal: "18",
        }),
      ],
      transactions: new Map([
        [
          "0xsimple_swap_1",
          {
            hash: "0xsimple_swap_1",
            from: "0xaaaa000000000000000000000000000000000001",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43", // Aerodrome router
            blockNumber: 2001152,
          },
        ],
      ]),
      receipts: new Map([
        [
          "0xsimple_swap_1",
          {
            transactionHash: "0xsimple_swap_1",
            blockNumber: 2001152,
            gasUsed: "150000",
            effectiveGasPrice: "50000000000",
            status: true,
            from: "0xaaaa000000000000000000000000000000000001",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            logs: [
              // ERC20 Transfer: USDC from wallet to pool (outbound)
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
                from: "0xaaaa000000000000000000000000000000000001",
                to: simplePool1,
                value: 100,
                decimals: 6,
                logIndex: 0,
                blockNumber: 2001152,
                txHash: "0xsimple_swap_1",
              }),
              // ERC20 Transfer: AERO from pool to wallet (inbound)
              createTransferLog({
                tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", // AERO
                from: simplePool1,
                to: "0xaaaa000000000000000000000000000000000001",
                value: 50,
                decimals: 18,
                logIndex: 1,
                blockNumber: 2001152,
                txHash: "0xsimple_swap_1",
              }),
              // Aerodrome Swap event
              createAerodromeV2SwapLog({
                poolAddress: simplePool1,
                sender: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
                to: "0xaaaa000000000000000000000000000000000001",
                logIndex: 2,
                blockNumber: 2001152,
                txHash: "0xsimple_swap_1",
              }),
            ],
          },
        ],
      ]),
      balances: new Map([
        ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 2000], // Initial: 2000 USDC
      ]),
    });

    // Test wallet for initial balance verification - 3000 USDC on Ethereum
    // After one sync: trades 200 USDC → 100 AERO, ending with 2800 USDC + 100 AERO
    const simpleSwap2Time = new Date(Date.now() - 6 * 60 * 1000).toISOString(); // 6 min ago
    const simplePool2 = "0xaeropool222222222222222222222222222222b2"; // Valid 40-char hex
    this.setWalletData("0xbbbb000000000000000000000000000000000002", {
      transfers: [
        createMockTransfer({
          from: "0xbbbb000000000000000000000000000000000002",
          to: simplePool2,
          value: 200,
          asset: "USDC",
          hash: "0xsimple_swap_2",
          blockNum: "0x1e8501", // Block 2001153
          blockTimestamp: simpleSwap2Time,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
        createMockTransfer({
          from: simplePool2,
          to: "0xbbbb000000000000000000000000000000000002",
          value: 100,
          asset: "AERO",
          hash: "0xsimple_swap_2",
          blockNum: "0x1e8501",
          blockTimestamp: simpleSwap2Time,
          tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
          decimal: "18",
        }),
      ],
      transactions: new Map([
        [
          "0xsimple_swap_2",
          {
            hash: "0xsimple_swap_2",
            from: "0xbbbb000000000000000000000000000000000002",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43", // Aerodrome router
            blockNumber: 2001153,
          },
        ],
      ]),
      receipts: new Map([
        [
          "0xsimple_swap_2",
          {
            transactionHash: "0xsimple_swap_2",
            blockNumber: 2001153,
            gasUsed: "155000",
            effectiveGasPrice: "51000000000",
            status: true,
            from: "0xbbbb000000000000000000000000000000000002",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            logs: [
              // ERC20 Transfer: USDC from wallet to pool (outbound)
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
                from: "0xbbbb000000000000000000000000000000000002",
                to: simplePool2,
                value: 200,
                decimals: 6,
                logIndex: 0,
                blockNumber: 2001153,
                txHash: "0xsimple_swap_2",
              }),
              // ERC20 Transfer: AERO from pool to wallet (inbound)
              createTransferLog({
                tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", // AERO
                from: simplePool2,
                to: "0xbbbb000000000000000000000000000000000002",
                value: 100,
                decimals: 18,
                logIndex: 1,
                blockNumber: 2001153,
                txHash: "0xsimple_swap_2",
              }),
              // Aerodrome Swap event
              createAerodromeV2SwapLog({
                poolAddress: simplePool2,
                sender: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
                to: "0xbbbb000000000000000000000000000000000002",
                logIndex: 2,
                blockNumber: 2001153,
                txHash: "0xsimple_swap_2",
              }),
            ],
          },
        ],
      ]),
      balances: new Map([
        ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 3000], // Initial: 3000 USDC
      ]),
    });

    // Test wallet for token whitelist filtering - has swap to non-whitelisted token
    // Swap: USDC → AERO, but AERO is NOT whitelisted
    const nonWhitelistedSwapTime = new Date(
      Date.now() - 5 * 60 * 1000,
    ).toISOString();
    const rejectPool6 = "0xaeropool666666666666666666666666666666a6"; // Valid 40-char hex
    this.setWalletData("0x6666666666666666666666666666666666666666", {
      transfers: [
        createMockTransfer({
          from: "0x6666666666666666666666666666666666666666",
          to: rejectPool6,
          value: 100,
          asset: "USDC",
          hash: "0xmock_nonwhitelisted_swap",
          blockNum: "0x1e8550", // Block 2001232
          blockTimestamp: nonWhitelistedSwapTime,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
        createMockTransfer({
          from: rejectPool6,
          to: "0x6666666666666666666666666666666666666666",
          value: 50,
          asset: "AERO",
          hash: "0xmock_nonwhitelisted_swap",
          blockNum: "0x1e8550",
          blockTimestamp: nonWhitelistedSwapTime,
          tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", // AERO - not whitelisted
          decimal: "18",
        }),
      ],
      transactions: new Map([
        [
          "0xmock_nonwhitelisted_swap",
          {
            hash: "0xmock_nonwhitelisted_swap",
            from: "0x6666666666666666666666666666666666666666",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43", // Aerodrome router
            blockNumber: 2001232,
          },
        ],
      ]),
      receipts: new Map([
        [
          "0xmock_nonwhitelisted_swap",
          {
            transactionHash: "0xmock_nonwhitelisted_swap",
            blockNumber: 2001232,
            gasUsed: "150000",
            effectiveGasPrice: "50000000000",
            status: true,
            from: "0x6666666666666666666666666666666666666666",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            logs: [
              // ERC20 Transfer: USDC from wallet to pool (outbound)
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
                from: "0x6666666666666666666666666666666666666666",
                to: rejectPool6,
                value: 100,
                decimals: 6,
                logIndex: 0,
                blockNumber: 2001232,
                txHash: "0xmock_nonwhitelisted_swap",
              }),
              // ERC20 Transfer: AERO from pool to wallet (inbound)
              createTransferLog({
                tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", // AERO
                from: rejectPool6,
                to: "0x6666666666666666666666666666666666666666",
                value: 50,
                decimals: 18,
                logIndex: 1,
                blockNumber: 2001232,
                txHash: "0xmock_nonwhitelisted_swap",
              }),
              // Aerodrome Swap event
              createAerodromeV2SwapLog({
                poolAddress: rejectPool6,
                sender: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
                to: "0x6666666666666666666666666666666666666666",
                logIndex: 2,
                blockNumber: 2001232,
                txHash: "0xmock_nonwhitelisted_swap",
              }),
            ],
          },
        ],
      ]),
      balances: new Map([
        ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 5000], // Initial: 5000 USDC
      ]),
    });

    // Test wallet for min funding threshold - below threshold
    this.setWalletData("0x7777777777777777777777777777777777777777", {
      transfers: [],
      transactions: new Map(),
      receipts: new Map(),
      balances: new Map([
        ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 50], // Only $50 USDC - below threshold
      ]),
    });

    // Test wallet for portfolio filtering - has multiple tokens but only USDC whitelisted
    this.setWalletData("0x8888888888888888888888888888888888888888", {
      transfers: [],
      transactions: new Map(),
      receipts: new Map(),
      balances: new Map([
        ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 1000], // USDC - whitelisted
        ["0x940181a94a35a4569e4529a3cdfb74e38fd98631", 500], // AERO - NOT whitelisted
        ["0x4200000000000000000000000000000000000006", 0.5], // ETH - NOT whitelisted (in this specific test)
      ]),
    });

    // =============================================================================
    // ROI-BASED RANKING TEST WALLETS
    // These wallets are designed to DEFINITIVELY prove ROI-based ranking works.
    // Portfolio values are INVERSE of ROI to catch any bugs ranking by portfolio value.
    // =============================================================================

    // ROI Test Wallet 1: HIGHEST ROI (50%), LOWEST portfolio value ($150)
    // Starting: $100 USDC → Ending: $150 USDC
    // If ranking by portfolio value (incorrectly), this would be rank 3
    // If ranking by ROI (correctly), this should be rank 1
    const roiSwap1Time = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const roiPool1 = "0xaeropool0001000000000000000000000000001a"; // Valid 40-char hex
    this.setWalletData("0x0001000000000000000000000000000000000001", {
      transfers: [
        // Swap: 100 USDC → 150 USDC worth of tokens (simulated profitable trade)
        createMockTransfer({
          from: "0x0001000000000000000000000000000000000001",
          to: roiPool1,
          value: 50,
          asset: "USDC",
          hash: "0xroi_swap_1",
          blockNum: "0x1e8600",
          blockTimestamp: roiSwap1Time,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
        createMockTransfer({
          from: roiPool1,
          to: "0x0001000000000000000000000000000000000001",
          value: 100, // Profitable trade - got 100 USDC worth back
          asset: "USDC",
          hash: "0xroi_swap_1",
          blockNum: "0x1e8600",
          blockTimestamp: roiSwap1Time,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
      ],
      transactions: new Map([
        [
          "0xroi_swap_1",
          {
            hash: "0xroi_swap_1",
            from: "0x0001000000000000000000000000000000000001",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            blockNumber: 2002432,
          },
        ],
      ]),
      receipts: new Map([
        [
          "0xroi_swap_1",
          {
            transactionHash: "0xroi_swap_1",
            blockNumber: 2002432,
            gasUsed: "150000",
            effectiveGasPrice: "50000000000",
            status: true,
            from: "0x0001000000000000000000000000000000000001",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            logs: [
              // ERC20 Transfer: USDC from wallet to pool (outbound)
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
                from: "0x0001000000000000000000000000000000000001",
                to: roiPool1,
                value: 50,
                decimals: 6,
                logIndex: 0,
                blockNumber: 2002432,
                txHash: "0xroi_swap_1",
              }),
              // ERC20 Transfer: USDC from pool to wallet (inbound - profitable)
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
                from: roiPool1,
                to: "0x0001000000000000000000000000000000000001",
                value: 100,
                decimals: 6,
                logIndex: 1,
                blockNumber: 2002432,
                txHash: "0xroi_swap_1",
              }),
              // Aerodrome Swap event
              createAerodromeV2SwapLog({
                poolAddress: roiPool1,
                sender: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
                to: "0x0001000000000000000000000000000000000001",
                logIndex: 2,
                blockNumber: 2002432,
                txHash: "0xroi_swap_1",
              }),
            ],
          },
        ],
      ]),
      balances: new Map([
        ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 100], // Initial: $100 USDC
      ]),
    });

    // ROI Test Wallet 2: MEDIUM ROI (20%), HIGHEST portfolio value ($1200)
    // Starting: $1000 USDC → Ending: $1200 USDC
    // If ranking by portfolio value (incorrectly), this would be rank 1
    // If ranking by ROI (correctly), this should be rank 2
    const roiSwap2Time = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const roiPool2 = "0xaeropool0002000000000000000000000000002b"; // Valid 40-char hex
    this.setWalletData("0x0002000000000000000000000000000000000002", {
      transfers: [
        createMockTransfer({
          from: "0x0002000000000000000000000000000000000002",
          to: roiPool2,
          value: 500,
          asset: "USDC",
          hash: "0xroi_swap_2",
          blockNum: "0x1e8601",
          blockTimestamp: roiSwap2Time,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
        createMockTransfer({
          from: roiPool2,
          to: "0x0002000000000000000000000000000000000002",
          value: 700, // Profitable trade - 20% gain on the traded portion
          asset: "USDC",
          hash: "0xroi_swap_2",
          blockNum: "0x1e8601",
          blockTimestamp: roiSwap2Time,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
      ],
      transactions: new Map([
        [
          "0xroi_swap_2",
          {
            hash: "0xroi_swap_2",
            from: "0x0002000000000000000000000000000000000002",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            blockNumber: 2002433,
          },
        ],
      ]),
      receipts: new Map([
        [
          "0xroi_swap_2",
          {
            transactionHash: "0xroi_swap_2",
            blockNumber: 2002433,
            gasUsed: "150000",
            effectiveGasPrice: "50000000000",
            status: true,
            from: "0x0002000000000000000000000000000000000002",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            logs: [
              // ERC20 Transfer: USDC from wallet to pool (outbound)
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
                from: "0x0002000000000000000000000000000000000002",
                to: roiPool2,
                value: 500,
                decimals: 6,
                logIndex: 0,
                blockNumber: 2002433,
                txHash: "0xroi_swap_2",
              }),
              // ERC20 Transfer: USDC from pool to wallet (inbound - profitable)
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
                from: roiPool2,
                to: "0x0002000000000000000000000000000000000002",
                value: 700,
                decimals: 6,
                logIndex: 1,
                blockNumber: 2002433,
                txHash: "0xroi_swap_2",
              }),
              // Aerodrome Swap event
              createAerodromeV2SwapLog({
                poolAddress: roiPool2,
                sender: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
                to: "0x0002000000000000000000000000000000000002",
                logIndex: 2,
                blockNumber: 2002433,
                txHash: "0xroi_swap_2",
              }),
            ],
          },
        ],
      ]),
      balances: new Map([
        ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 1000], // Initial: $1000 USDC
      ]),
    });

    // ROI Test Wallet 3: LOWEST ROI (10%), MEDIUM portfolio value ($550)
    // Starting: $500 USDC → Ending: $550 USDC
    // If ranking by portfolio value (incorrectly), this would be rank 2
    // If ranking by ROI (correctly), this should be rank 3
    const roiSwap3Time = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const roiPool3 = "0xaeropool0003000000000000000000000000003c"; // Valid 40-char hex
    this.setWalletData("0x0003000000000000000000000000000000000003", {
      transfers: [
        createMockTransfer({
          from: "0x0003000000000000000000000000000000000003",
          to: roiPool3,
          value: 200,
          asset: "USDC",
          hash: "0xroi_swap_3",
          blockNum: "0x1e8602",
          blockTimestamp: roiSwap3Time,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
        createMockTransfer({
          from: roiPool3,
          to: "0x0003000000000000000000000000000000000003",
          value: 250, // Small gain - 10% ROI overall
          asset: "USDC",
          hash: "0xroi_swap_3",
          blockNum: "0x1e8602",
          blockTimestamp: roiSwap3Time,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
      ],
      transactions: new Map([
        [
          "0xroi_swap_3",
          {
            hash: "0xroi_swap_3",
            from: "0x0003000000000000000000000000000000000003",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            blockNumber: 2002434,
          },
        ],
      ]),
      receipts: new Map([
        [
          "0xroi_swap_3",
          {
            transactionHash: "0xroi_swap_3",
            blockNumber: 2002434,
            gasUsed: "150000",
            effectiveGasPrice: "50000000000",
            status: true,
            from: "0x0003000000000000000000000000000000000003",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            logs: [
              // ERC20 Transfer: USDC from wallet to pool (outbound)
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
                from: "0x0003000000000000000000000000000000000003",
                to: roiPool3,
                value: 200,
                decimals: 6,
                logIndex: 0,
                blockNumber: 2002434,
                txHash: "0xroi_swap_3",
              }),
              // ERC20 Transfer: USDC from pool to wallet (inbound - profitable)
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
                from: roiPool3,
                to: "0x0003000000000000000000000000000000000003",
                value: 250,
                decimals: 6,
                logIndex: 1,
                blockNumber: 2002434,
                txHash: "0xroi_swap_3",
              }),
              // Aerodrome Swap event
              createAerodromeV2SwapLog({
                poolAddress: roiPool3,
                sender: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
                to: "0x0003000000000000000000000000000000000003",
                logIndex: 2,
                blockNumber: 2002434,
                txHash: "0xroi_swap_3",
              }),
            ],
          },
        ],
      ]),
      balances: new Map([
        ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 500], // Initial: $500 USDC
      ]),
    });

    // =============================================================================
    // UNIQUE ROI TEST WALLETS (for isolated ROI ranking test)
    // Same logic as above ROI wallets but with unique addresses to prevent test interference
    // =============================================================================

    // Unique ROI Wallet 1: HIGHEST ROI (50%), LOWEST portfolio value ($150)
    const uniqueRoiSwap1Time = new Date(
      Date.now() - 5 * 60 * 1000,
    ).toISOString();
    const uniqueRoiPool1 = "0xae00000001000000000000000000000000000001";
    this.setWalletData("0xa011000000000000000000000000000000000001", {
      transfers: [
        createMockTransfer({
          from: "0xa011000000000000000000000000000000000001",
          to: uniqueRoiPool1,
          value: 50,
          asset: "USDC",
          hash: "0xunique_roi_swap_1",
          blockNum: "0x1e8700",
          blockTimestamp: uniqueRoiSwap1Time,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
        createMockTransfer({
          from: uniqueRoiPool1,
          to: "0xa011000000000000000000000000000000000001",
          value: 100,
          asset: "USDC",
          hash: "0xunique_roi_swap_1",
          blockNum: "0x1e8700",
          blockTimestamp: uniqueRoiSwap1Time,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
      ],
      transactions: new Map([
        [
          "0xunique_roi_swap_1",
          {
            hash: "0xunique_roi_swap_1",
            from: "0xa011000000000000000000000000000000000001",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            blockNumber: 2003712,
          },
        ],
      ]),
      receipts: new Map([
        [
          "0xunique_roi_swap_1",
          {
            transactionHash: "0xunique_roi_swap_1",
            blockNumber: 2003712,
            gasUsed: "150000",
            effectiveGasPrice: "50000000000",
            status: true,
            from: "0xa011000000000000000000000000000000000001",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            logs: [
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
                from: "0xa011000000000000000000000000000000000001",
                to: uniqueRoiPool1,
                value: 50,
                decimals: 6,
                logIndex: 0,
                blockNumber: 2003712,
                txHash: "0xunique_roi_swap_1",
              }),
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
                from: uniqueRoiPool1,
                to: "0xa011000000000000000000000000000000000001",
                value: 100,
                decimals: 6,
                logIndex: 1,
                blockNumber: 2003712,
                txHash: "0xunique_roi_swap_1",
              }),
              createAerodromeV2SwapLog({
                poolAddress: uniqueRoiPool1,
                sender: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
                to: "0xa011000000000000000000000000000000000001",
                logIndex: 2,
                blockNumber: 2003712,
                txHash: "0xunique_roi_swap_1",
              }),
            ],
          },
        ],
      ]),
      balances: new Map([["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 100]]),
    });

    // Unique ROI Wallet 2: MEDIUM ROI (20%), HIGHEST portfolio value ($1200)
    const uniqueRoiSwap2Time = new Date(
      Date.now() - 5 * 60 * 1000,
    ).toISOString();
    const uniqueRoiPool2 = "0xae00000002000000000000000000000000000002";
    this.setWalletData("0xa022000000000000000000000000000000000002", {
      transfers: [
        createMockTransfer({
          from: "0xa022000000000000000000000000000000000002",
          to: uniqueRoiPool2,
          value: 500,
          asset: "USDC",
          hash: "0xunique_roi_swap_2",
          blockNum: "0x1e8701",
          blockTimestamp: uniqueRoiSwap2Time,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
        createMockTransfer({
          from: uniqueRoiPool2,
          to: "0xa022000000000000000000000000000000000002",
          value: 700,
          asset: "USDC",
          hash: "0xunique_roi_swap_2",
          blockNum: "0x1e8701",
          blockTimestamp: uniqueRoiSwap2Time,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
      ],
      transactions: new Map([
        [
          "0xunique_roi_swap_2",
          {
            hash: "0xunique_roi_swap_2",
            from: "0xa022000000000000000000000000000000000002",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            blockNumber: 2003713,
          },
        ],
      ]),
      receipts: new Map([
        [
          "0xunique_roi_swap_2",
          {
            transactionHash: "0xunique_roi_swap_2",
            blockNumber: 2003713,
            gasUsed: "150000",
            effectiveGasPrice: "50000000000",
            status: true,
            from: "0xa022000000000000000000000000000000000002",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            logs: [
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
                from: "0xa022000000000000000000000000000000000002",
                to: uniqueRoiPool2,
                value: 500,
                decimals: 6,
                logIndex: 0,
                blockNumber: 2003713,
                txHash: "0xunique_roi_swap_2",
              }),
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
                from: uniqueRoiPool2,
                to: "0xa022000000000000000000000000000000000002",
                value: 700,
                decimals: 6,
                logIndex: 1,
                blockNumber: 2003713,
                txHash: "0xunique_roi_swap_2",
              }),
              createAerodromeV2SwapLog({
                poolAddress: uniqueRoiPool2,
                sender: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
                to: "0xa022000000000000000000000000000000000002",
                logIndex: 2,
                blockNumber: 2003713,
                txHash: "0xunique_roi_swap_2",
              }),
            ],
          },
        ],
      ]),
      balances: new Map([["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 1000]]),
    });

    // Unique ROI Wallet 3: LOWEST ROI (10%), MEDIUM portfolio value ($550)
    const uniqueRoiSwap3Time = new Date(
      Date.now() - 5 * 60 * 1000,
    ).toISOString();
    const uniqueRoiPool3 = "0xae00000003000000000000000000000000000003";
    this.setWalletData("0xa033000000000000000000000000000000000003", {
      transfers: [
        createMockTransfer({
          from: "0xa033000000000000000000000000000000000003",
          to: uniqueRoiPool3,
          value: 200,
          asset: "USDC",
          hash: "0xunique_roi_swap_3",
          blockNum: "0x1e8702",
          blockTimestamp: uniqueRoiSwap3Time,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
        createMockTransfer({
          from: uniqueRoiPool3,
          to: "0xa033000000000000000000000000000000000003",
          value: 250,
          asset: "USDC",
          hash: "0xunique_roi_swap_3",
          blockNum: "0x1e8702",
          blockTimestamp: uniqueRoiSwap3Time,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
        }),
      ],
      transactions: new Map([
        [
          "0xunique_roi_swap_3",
          {
            hash: "0xunique_roi_swap_3",
            from: "0xa033000000000000000000000000000000000003",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            blockNumber: 2003714,
          },
        ],
      ]),
      receipts: new Map([
        [
          "0xunique_roi_swap_3",
          {
            transactionHash: "0xunique_roi_swap_3",
            blockNumber: 2003714,
            gasUsed: "150000",
            effectiveGasPrice: "50000000000",
            status: true,
            from: "0xa033000000000000000000000000000000000003",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            logs: [
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
                from: "0xa033000000000000000000000000000000000003",
                to: uniqueRoiPool3,
                value: 200,
                decimals: 6,
                logIndex: 0,
                blockNumber: 2003714,
                txHash: "0xunique_roi_swap_3",
              }),
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
                from: uniqueRoiPool3,
                to: "0xa033000000000000000000000000000000000003",
                value: 250,
                decimals: 6,
                logIndex: 1,
                blockNumber: 2003714,
                txHash: "0xunique_roi_swap_3",
              }),
              createAerodromeV2SwapLog({
                poolAddress: uniqueRoiPool3,
                sender: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
                to: "0xa033000000000000000000000000000000000003",
                logIndex: 2,
                blockNumber: 2003714,
                txHash: "0xunique_roi_swap_3",
              }),
            ],
          },
        ],
      ]),
      balances: new Map([["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 500]]),
    });

    // =============================================================================
    // NATIVE ETH TEST WALLET
    // Tests native token support: initial balance, swap detection, portfolio pricing
    // =============================================================================

    // Native ETH Test Wallet: 0.5 ETH + 100 USDC initial
    // Swap: 0.1 ETH → ~275 USDC (at ~$2750/ETH)
    // Final: 0.4 ETH + 375 USDC
    const nativeSwapTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const nativePool9 = "0xaeropool999900000000000000000000000009d"; // Valid 40-char hex
    this.setWalletData("0x9999000000000000000000000000000000000009", {
      transfers: [
        // Native ETH → USDC swap via Aerodrome
        // Agent sends 0.1 ETH (native, EXTERNAL category)
        createMockTransfer({
          from: "0x9999000000000000000000000000000000000009",
          to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43", // Aerodrome router
          value: 0.1,
          asset: "ETH",
          hash: "0xnative_eth_swap_1",
          blockNum: "0x1e8700", // Block 2003712
          blockTimestamp: nativeSwapTime,
          tokenAddress: "0x0000000000000000000000000000000000000000", // Zero address for native
          decimal: "18",
          category: AssetTransfersCategory.EXTERNAL, // Native transfer
        }),
        // Agent receives USDC back
        createMockTransfer({
          from: nativePool9,
          to: "0x9999000000000000000000000000000000000009",
          value: 275,
          asset: "USDC",
          hash: "0xnative_eth_swap_1",
          blockNum: "0x1e8700",
          blockTimestamp: nativeSwapTime,
          tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          decimal: "6",
          category: AssetTransfersCategory.ERC20,
        }),
      ],
      transactions: new Map([
        [
          "0xnative_eth_swap_1",
          {
            hash: "0xnative_eth_swap_1",
            from: "0x9999000000000000000000000000000000000009",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43", // Aerodrome router
            blockNumber: 2003712,
          },
        ],
      ]),
      receipts: new Map([
        [
          "0xnative_eth_swap_1",
          {
            transactionHash: "0xnative_eth_swap_1",
            blockNumber: 2003712,
            gasUsed: "180000",
            effectiveGasPrice: "50000000000",
            status: true,
            from: "0x9999000000000000000000000000000000000009",
            to: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
            logs: [
              // Only USDC inbound transfer - native ETH has no ERC20 Transfer log
              // The native ETH outbound will be detected via hasNativeEthTransfer fallback
              createTransferLog({
                tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
                from: nativePool9,
                to: "0x9999000000000000000000000000000000000009",
                value: 275,
                decimals: 6,
                logIndex: 0,
                blockNumber: 2003712,
                txHash: "0xnative_eth_swap_1",
              }),
              // Aerodrome Swap event (required for protocol filtering)
              createAerodromeV2SwapLog({
                poolAddress: nativePool9,
                sender: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
                to: "0x9999000000000000000000000000000000000009",
                logIndex: 1,
                blockNumber: 2003712,
                txHash: "0xnative_eth_swap_1",
              }),
            ],
          },
        ],
      ]),
      balances: new Map([
        ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 100], // Initial: 100 USDC
      ]),
      nativeBalance: "500000000000000000", // Initial: 0.5 ETH in wei
    });

    // =============================================================================
    // SLIPSTREAM (CONCENTRATED LIQUIDITY) TEST WALLET
    // Tests Aerodrome Slipstream router detection alongside V2 router
    // Uses real token addresses from integration tests for accuracy
    // =============================================================================

    // Slipstream Test Wallet: 1000 USDC initial
    // Swap: 50 USDC → ~8 RIVER via Slipstream router (matches integration test fixture)
    // This tests that CL Swap events are correctly recognized for protocol filtering
    const slipstreamSwapTime = new Date(
      Date.now() - 5 * 60 * 1000,
    ).toISOString();
    // Real Slipstream CL pool address (USDC/RIVER)
    const slipstreamPool = "0x0fab3dd0d4faea49fc8dcda6f5c0e847434ad99c";
    // Real Slipstream router address
    const slipstreamRouter = "0xbe6d8f0d05cc4be24d5167a3ef062215be6d18a5";
    // Real token addresses
    const usdcAddress = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
    const riverAddress = "0xda7ad9dea9397cffddae2f8a052b82f1484252b3";

    this.setWalletData("0x5110000000000000000000000000000000000001", {
      transfers: [
        // Swap: USDC → RIVER via Slipstream
        createMockTransfer({
          from: "0x5110000000000000000000000000000000000001",
          to: slipstreamPool,
          value: 50,
          asset: "USDC",
          hash: "0xslipstream_swap_1",
          blockNum: "0x1e8800", // Block 2004992
          blockTimestamp: slipstreamSwapTime,
          tokenAddress: usdcAddress,
          decimal: "6",
        }),
        createMockTransfer({
          from: slipstreamPool,
          to: "0x5110000000000000000000000000000000000001",
          value: 8.028, // ~8 RIVER (matches integration test)
          asset: "RIVER",
          hash: "0xslipstream_swap_1",
          blockNum: "0x1e8800",
          blockTimestamp: slipstreamSwapTime,
          tokenAddress: riverAddress,
          decimal: "18",
        }),
      ],
      transactions: new Map([
        [
          "0xslipstream_swap_1",
          {
            hash: "0xslipstream_swap_1",
            from: "0x5110000000000000000000000000000000000001",
            to: slipstreamRouter, // Slipstream router (NOT V2 router!)
            blockNumber: 2004992,
          },
        ],
      ]),
      receipts: new Map([
        [
          "0xslipstream_swap_1",
          {
            transactionHash: "0xslipstream_swap_1",
            blockNumber: 2004992,
            gasUsed: "200000",
            effectiveGasPrice: "50000000000",
            status: true,
            from: "0x5110000000000000000000000000000000000001",
            to: slipstreamRouter,
            logs: [
              // ERC20 Transfer: USDC from wallet to pool (outbound)
              createTransferLog({
                tokenAddress: usdcAddress,
                from: "0x5110000000000000000000000000000000000001",
                to: slipstreamPool,
                value: 50,
                decimals: 6,
                logIndex: 0,
                blockNumber: 2004992,
                txHash: "0xslipstream_swap_1",
              }),
              // ERC20 Transfer: RIVER from pool to wallet (inbound)
              createTransferLog({
                tokenAddress: riverAddress,
                from: slipstreamPool,
                to: "0x5110000000000000000000000000000000000001",
                value: 8.028,
                decimals: 18,
                logIndex: 1,
                blockNumber: 2004992,
                txHash: "0xslipstream_swap_1",
              }),
              // Slipstream CL Swap event (required for protocol filtering)
              createSlipstreamSwapLog({
                poolAddress: slipstreamPool,
                sender: slipstreamRouter,
                recipient: "0x5110000000000000000000000000000000000001",
                logIndex: 2,
                blockNumber: 2004992,
                txHash: "0xslipstream_swap_1",
              }),
            ],
          },
        ],
      ]),
      balances: new Map([
        [usdcAddress, 1000], // Initial: 1000 USDC
      ]),
    });

    // =============================================================================
    // COMBINED V2 + SLIPSTREAM TEST WALLET
    // Tests that a single agent using both routers has all swaps detected
    // =============================================================================

    const combinedV2Time = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const combinedSlipTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const v2Pool = "0xaeropool0comb00000000000000000000000001";
    const v2Router = "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43";
    const aeroAddress = "0x940181a94a35a4569e4529a3cdfb74e38fd98631";

    this.setWalletData("0xc0b0000000000000000000000000000000000001", {
      transfers: [
        // V2 Swap: USDC → AERO (block 2005000)
        createMockTransfer({
          from: "0xc0b0000000000000000000000000000000000001",
          to: v2Pool,
          value: 100,
          asset: "USDC",
          hash: "0xcombined_v2_swap",
          blockNum: "0x1e8808", // Block 2005000
          blockTimestamp: combinedV2Time,
          tokenAddress: usdcAddress,
          decimal: "6",
        }),
        createMockTransfer({
          from: v2Pool,
          to: "0xc0b0000000000000000000000000000000000001",
          value: 50,
          asset: "AERO",
          hash: "0xcombined_v2_swap",
          blockNum: "0x1e8808",
          blockTimestamp: combinedV2Time,
          tokenAddress: aeroAddress,
          decimal: "18",
        }),
        // Slipstream Swap: USDC → RIVER (block 2005010)
        createMockTransfer({
          from: "0xc0b0000000000000000000000000000000000001",
          to: slipstreamPool,
          value: 50,
          asset: "USDC",
          hash: "0xcombined_slip_swap",
          blockNum: "0x1e8812", // Block 2005010
          blockTimestamp: combinedSlipTime,
          tokenAddress: usdcAddress,
          decimal: "6",
        }),
        createMockTransfer({
          from: slipstreamPool,
          to: "0xc0b0000000000000000000000000000000000001",
          value: 8,
          asset: "RIVER",
          hash: "0xcombined_slip_swap",
          blockNum: "0x1e8812",
          blockTimestamp: combinedSlipTime,
          tokenAddress: riverAddress,
          decimal: "18",
        }),
      ],
      transactions: new Map([
        [
          "0xcombined_v2_swap",
          {
            hash: "0xcombined_v2_swap",
            from: "0xc0b0000000000000000000000000000000000001",
            to: v2Router, // V2 router
            blockNumber: 2005000,
          },
        ],
        [
          "0xcombined_slip_swap",
          {
            hash: "0xcombined_slip_swap",
            from: "0xc0b0000000000000000000000000000000000001",
            to: slipstreamRouter, // Slipstream router
            blockNumber: 2005010,
          },
        ],
      ]),
      receipts: new Map([
        [
          "0xcombined_v2_swap",
          {
            transactionHash: "0xcombined_v2_swap",
            blockNumber: 2005000,
            gasUsed: "150000",
            effectiveGasPrice: "50000000000",
            status: true,
            from: "0xc0b0000000000000000000000000000000000001",
            to: v2Router,
            logs: [
              createTransferLog({
                tokenAddress: usdcAddress,
                from: "0xc0b0000000000000000000000000000000000001",
                to: v2Pool,
                value: 100,
                decimals: 6,
                logIndex: 0,
                blockNumber: 2005000,
                txHash: "0xcombined_v2_swap",
              }),
              createTransferLog({
                tokenAddress: aeroAddress,
                from: v2Pool,
                to: "0xc0b0000000000000000000000000000000000001",
                value: 50,
                decimals: 18,
                logIndex: 1,
                blockNumber: 2005000,
                txHash: "0xcombined_v2_swap",
              }),
              createAerodromeV2SwapLog({
                poolAddress: v2Pool,
                sender: v2Router,
                to: "0xc0b0000000000000000000000000000000000001",
                logIndex: 2,
                blockNumber: 2005000,
                txHash: "0xcombined_v2_swap",
              }),
            ],
          },
        ],
        [
          "0xcombined_slip_swap",
          {
            transactionHash: "0xcombined_slip_swap",
            blockNumber: 2005010,
            gasUsed: "200000",
            effectiveGasPrice: "50000000000",
            status: true,
            from: "0xc0b0000000000000000000000000000000000001",
            to: slipstreamRouter,
            logs: [
              createTransferLog({
                tokenAddress: usdcAddress,
                from: "0xc0b0000000000000000000000000000000000001",
                to: slipstreamPool,
                value: 50,
                decimals: 6,
                logIndex: 0,
                blockNumber: 2005010,
                txHash: "0xcombined_slip_swap",
              }),
              createTransferLog({
                tokenAddress: riverAddress,
                from: slipstreamPool,
                to: "0xc0b0000000000000000000000000000000000001",
                value: 8,
                decimals: 18,
                logIndex: 1,
                blockNumber: 2005010,
                txHash: "0xcombined_slip_swap",
              }),
              createSlipstreamSwapLog({
                poolAddress: slipstreamPool,
                sender: slipstreamRouter,
                recipient: "0xc0b0000000000000000000000000000000000001",
                logIndex: 2,
                blockNumber: 2005010,
                txHash: "0xcombined_slip_swap",
              }),
            ],
          },
        ],
      ]),
      balances: new Map([
        [usdcAddress, 2000], // Initial: 2000 USDC
      ]),
    });
  }

  /**
   * Set mock data for a specific wallet
   */
  public setWalletData(walletAddress: string, data: MockWalletData): void {
    this.mockData.set(walletAddress.toLowerCase(), data);
  }

  /**
   * Set default data template for new wallets
   */
  public setDefaultWalletData(key: string, data: MockWalletData): void {
    this.mockData.set(key, data);
  }

  /**
   * Get or create mock data for a wallet
   */
  private getWalletData(walletAddress: string): MockWalletData {
    const address = walletAddress.toLowerCase();
    if (!this.mockData.has(address)) {
      // Clone default data for new wallet
      const defaultData = this.mockData.get("default")!;
      this.mockData.set(address, { ...defaultData });
    }
    return this.mockData.get(address)!;
  }

  /**
   * Get provider name for logging
   */
  getName(): string {
    return "Mock Alchemy";
  }

  /**
   * Check if provider is healthy
   */
  async isHealthy(): Promise<boolean> {
    return true;
  }

  /**
   * Get asset transfers for a wallet
   * Mimics Alchemy's getAssetTransfers API
   * Uses callIndex pattern (like MockHyperliquidServer) to simulate swaps happening between syncs
   */
  async getAssetTransfers(
    walletAddress: string,
    chain: SpecificChain,
    fromBlock: number | string,
    toBlock: number | string,
  ): Promise<AssetTransfersWithMetadataResponse> {
    void toBlock; // Not used in mock
    const data = this.getWalletData(walletAddress);
    const lowerAddress = walletAddress.toLowerCase();

    // Track call index and derive sync number
    // NOTE: getAssetTransfers is called TWICE per sync even with unified sync state:
    // 1. From getTradesSince (to detect swaps)
    // 2. From getTransferHistory (to detect deposits/withdrawals)
    // Divide by 2 to get actual sync number
    const currentCallIdx = this.callIndex.get(lowerAddress) || 0;
    this.callIndex.set(lowerAddress, currentCallIdx + 1);
    const actualCallIdx = currentCallIdx + 1;

    // Sync number: calls 1-2 = sync 1, calls 3-4 = sync 2, etc.
    const syncNumber = Math.ceil(actualCallIdx / 2);

    // Convert fromBlock to number if it's hex
    const fromBlockNum =
      typeof fromBlock === "string" && fromBlock.startsWith("0x")
        ? parseInt(fromBlock, 16)
        : typeof fromBlock === "string" && fromBlock === "latest"
          ? 0
          : Number(fromBlock);

    // Progressive swap revelation based on call index (simulates swaps happening between syncs)
    // This matches the Hyperliquid pattern where each sync picks up NEW activity
    let transfersToReturn: AssetTransfersWithMetadataResult[] = [];

    if (lowerAddress === "0x1111111111111111111111111111111111111111") {
      // Wallet with 3 swaps - reveal progressively AND respect fromBlock filtering
      // Progressive revelation simulates swaps happening between syncs
      // Block filtering ensures we respect the processor's sync state tracking

      // Determine which swaps are "available" based on call index
      let availableTransfers: AssetTransfersWithMetadataResult[] = [];

      // Additive reveal pattern (like blockchain - past swaps stay visible)
      // Sync 1 (calls 1-2): Swap 1 only (block 2000000)
      // Sync 2 (calls 3-4): Swaps 1 + 2 (blocks 2000000, 2000010)
      // Sync 3+ (calls 5+): All swaps (blocks 2000000, 2000010, 2000020)
      if (syncNumber === 1) {
        availableTransfers = data.transfers.filter(
          (t) => t.blockNum === "0x1e8480",
        ); // Swap 1 only
      } else if (syncNumber === 2) {
        availableTransfers = data.transfers.filter(
          (t) => t.blockNum === "0x1e8480" || t.blockNum === "0x1e848a",
        ); // Swaps 1+2
      } else if (syncNumber >= 3) {
        availableTransfers = data.transfers; // All swaps
      }

      // Apply block range filtering on top of progressive revelation
      transfersToReturn = availableTransfers.filter((t) => {
        const transferBlock = parseInt(t.blockNum ?? "0x0", 16);
        return transferBlock >= fromBlockNum;
      });

      this.logger.info(
        `[MockAlchemyRpcProvider] Wallet 0x1111 sync #${syncNumber}: ${availableTransfers.length} available, ${transfersToReturn.length} after fromBlock filter`,
      );
    } else if (
      lowerAddress === "0xaaaa000000000000000000000000000000000001" ||
      lowerAddress === "0xbbbb000000000000000000000000000000000002" ||
      lowerAddress === "0x2222222222222222222222222222222222222222" || // Deposit violations
      lowerAddress === "0x3333333333333333333333333333333333333333" || // Withdrawal violations
      lowerAddress === "0x4444444444444444444444444444444444444444" || // Protocol filtering test
      lowerAddress === "0x6666666666666666666666666666666666666666" || // Token whitelist test
      lowerAddress === "0x7777777777777777777777777777777777777777" || // Min funding threshold test
      lowerAddress === "0x8888888888888888888888888888888888888888" || // Portfolio filter test
      lowerAddress === "0x0001000000000000000000000000000000000001" || // ROI ranking test - highest ROI
      lowerAddress === "0x0002000000000000000000000000000000000002" || // ROI ranking test - medium ROI
      lowerAddress === "0x0003000000000000000000000000000000000003" || // ROI ranking test - lowest ROI
      lowerAddress === "0xa011000000000000000000000000000000000001" || // Unique ROI test - highest ROI
      lowerAddress === "0xa022000000000000000000000000000000000002" || // Unique ROI test - medium ROI
      lowerAddress === "0xa033000000000000000000000000000000000003" || // Unique ROI test - lowest ROI
      lowerAddress === "0x9999000000000000000000000000000000000009" || // Native ETH swap test
      lowerAddress === "0x5110000000000000000000000000000000000001" || // Slipstream swap test
      lowerAddress === "0xc0b0000000000000000000000000000000000001" // Combined V2+Slipstream test
    ) {
      // Test wallets with swaps/transfers - reveal on first manual sync (sync 1+)
      // This simulates the swap/transfer happening AFTER competition starts
      if (syncNumber >= 1) {
        transfersToReturn = data.transfers.filter((t) => {
          const transferBlock = parseInt(t.blockNum ?? "0x0", 16);
          return transferBlock >= fromBlockNum;
        });
      } else {
        transfersToReturn = [];
      }

      this.logger.info(
        `[MockAlchemyRpcProvider] Wallet ${walletAddress.slice(0, 10)} sync #${syncNumber}, returning ${transfersToReturn.length} transfers`,
      );
    } else {
      // For other wallets (like 0x5555 - empty wallet), use standard block filtering
      transfersToReturn = data.transfers.filter((t) => {
        const transferBlock = parseInt(t.blockNum ?? "0x0", 16);
        return transferBlock >= fromBlockNum;
      });
    }

    // Replace DYNAMIC timestamps with actual recent times (ensures violations happen AFTER competition starts)
    const transfersWithDynamicTimestamps = transfersToReturn.map((t) => {
      if (t.metadata.blockTimestamp === "DYNAMIC") {
        // Generate timestamp at query time (always "now" = after competition started)
        // Subtract small amount to avoid edge case where transfer timestamp === query timestamp
        const recentTime = new Date(Date.now() - 500).toISOString(); // Half second ago
        return {
          ...t,
          metadata: {
            ...t.metadata,
            blockTimestamp: recentTime,
          },
        };
      }
      return t;
    });

    return {
      transfers: transfersWithDynamicTimestamps,
      pageKey: undefined,
    };
  }

  /**
   * Get transaction data
   */
  async getTransaction(
    txHash: string,
    chain: SpecificChain,
  ): Promise<TransactionData | null> {
    void chain; // Not used in mock - transactions are global
    // Search through all wallet data for this transaction
    for (const [, data] of this.mockData) {
      if (data.transactions.has(txHash)) {
        return data.transactions.get(txHash)!;
      }
    }

    this.logger.warn(
      {
        txHash,
      },
      `[MockAlchemyRpcProvider] Transaction not found`,
    );
    return null;
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(
    txHash: string,
    chain: SpecificChain,
  ): Promise<TransactionReceipt | null> {
    void chain; // Not used in mock - receipts are global
    // Search through all wallet data for this receipt
    for (const [, data] of this.mockData) {
      if (data.receipts.has(txHash)) {
        return data.receipts.get(txHash)!;
      }
    }

    this.logger.warn(
      {
        txHash,
      },
      `[MockAlchemyRpcProvider] Receipt not found`,
    );
    return null;
  }

  /**
   * Get current block number for a chain
   * Uses callIndex to simulate block progression (like Hyperliquid's equity progression)
   */
  async getBlockNumber(chain: SpecificChain): Promise<number> {
    void chain; // Not used in mock

    // Return a progressive "current block" based on global call state
    // This simulates blockchain progressing over time
    // Sync 1: Current block 2000005 (only swap 1 at 2000000 is "mined")
    // Sync 2: Current block 2000015 (swaps 1-2 are "mined")
    // Sync 3: Current block 2000025 (all swaps are "mined")

    // Use highest callIndex across all wallets, divided by 2 for sync number
    const allCallIndices = Array.from(this.callIndex.values());
    const maxCallIdx =
      allCallIndices.length > 0 ? Math.max(...allCallIndices) : 0;
    const maxSyncNumber = Math.ceil(maxCallIdx / 2);

    let currentBlock;
    if (maxSyncNumber === 0) {
      currentBlock = 1999990; // Initial state
    } else if (maxSyncNumber === 1) {
      currentBlock = 2000005; // After first sync - swap 1 visible
    } else if (maxSyncNumber === 2) {
      currentBlock = 2000015; // After second sync - swaps 1-2 visible
    } else {
      currentBlock = 2000025; // After third+ sync - all swaps visible
    }

    this.logger.info(
      `[MockAlchemyRpcProvider] getBlockNumber: maxCallIdx=${maxCallIdx}, syncNumber=${maxSyncNumber}, block=${currentBlock}`,
    );
    return currentBlock;
  }

  /**
   * Get native token balance for a wallet (ETH, MATIC, etc.)
   * Used by spot live trading to initialize native balances
   */
  async getBalance(
    walletAddress: string,
    chain: SpecificChain,
  ): Promise<string> {
    void chain; // Not used in mock - single chain per wallet
    const data = this.getWalletData(walletAddress);
    const lowerAddress = walletAddress.toLowerCase();

    // Read call index to determine sync number (for progressive balance updates)
    const callIdx = this.callIndex.get(lowerAddress) || 0;
    const syncNumber = Math.ceil(callIdx / 2);

    // Special handling for native ETH test wallet
    if (lowerAddress === "0x9999000000000000000000000000000000000009") {
      // Native ETH swap test wallet - balance decreases after swap
      if (syncNumber === 0) {
        return "500000000000000000"; // 0.5 ETH initial
      } else {
        return "400000000000000000"; // 0.4 ETH after swap (0.1 ETH sold)
      }
    }

    // Return wallet-specific native balance or default
    return data.nativeBalance ?? "0";
  }

  /**
   * Get token balances for a wallet
   * Uses callIndex to simulate balance changes from swaps between syncs
   * Does NOT increment callIndex - just reads current state set by getAssetTransfers
   */
  async getTokenBalances(
    walletAddress: string,
    chain: SpecificChain,
  ): Promise<TokenBalance[]> {
    void chain; // Not used in mock
    const data = this.getWalletData(walletAddress);
    const lowerAddress = walletAddress.toLowerCase();

    // Read call index (do NOT increment - getAssetTransfers owns the counter)
    const callIdx = this.callIndex.get(lowerAddress) || 0;

    // Convert to sync number (getAssetTransfers called twice per sync)
    const syncNumber = Math.ceil(callIdx / 2);

    // Progressive balance updates to match swap progression
    let balancesToReturn = data.balances;

    if (lowerAddress === "0x1111111111111111111111111111111111111111") {
      // Simulate balance progression as swaps execute
      // Sync 0: Initial state during startCompetition (5000 USDC, 0 AERO, 0 WETH)
      // Sync 1: After swap 1 processed (4900 USDC, 50 AERO, 0 WETH)
      // Sync 2: After swap 2 processed (4900 USDC, 40 AERO, 0.005 WETH)
      // Sync 3+: After swap 3 processed (4906 USDC, 35 AERO, 0.005 WETH)
      balancesToReturn = new Map();

      if (syncNumber === 0) {
        // Initial state before any swaps (called during startCompetition)
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          5000,
        ); // USDC
        balancesToReturn.set("0x940181a94a35a4569e4529a3cdfb74e38fd98631", 0); // AERO
        balancesToReturn.set("0x4200000000000000000000000000000000000006", 0); // WETH
      } else if (syncNumber === 1) {
        // After swap 1: USDC → AERO (100 USDC out, 50 AERO in)
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          4900,
        );
        balancesToReturn.set("0x940181a94a35a4569e4529a3cdfb74e38fd98631", 50);
        balancesToReturn.set("0x4200000000000000000000000000000000000006", 0);
      } else if (syncNumber === 2) {
        // After swap 2: AERO → ETH (10 AERO out, 0.005 ETH in)
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          4900,
        );
        balancesToReturn.set("0x940181a94a35a4569e4529a3cdfb74e38fd98631", 40);
        balancesToReturn.set(
          "0x4200000000000000000000000000000000000006",
          0.005,
        );
      } else {
        // After swap 3: AERO → USDC (5 AERO out, 6 USDC in)
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          4906,
        );
        balancesToReturn.set("0x940181a94a35a4569e4529a3cdfb74e38fd98631", 35);
        balancesToReturn.set(
          "0x4200000000000000000000000000000000000006",
          0.005,
        );
      }

      this.logger.info(
        `[MockAlchemyRpcProvider] Wallet 0x1111 getTokenBalances at sync #${syncNumber}: USDC=${balancesToReturn.get("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913")}, AERO=${balancesToReturn.get("0x940181a94a35a4569e4529a3cdfb74e38fd98631")}`,
      );
    } else if (lowerAddress === "0xaaaa000000000000000000000000000000000001") {
      // Simple test wallet - 2000 USDC initially, after swap: 1900 USDC + 50 AERO
      balancesToReturn = new Map();

      if (syncNumber === 0) {
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          2000,
        ); // Initial USDC
      } else {
        // After swap: 100 USDC → 50 AERO
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          1900,
        ); // USDC after swap
        balancesToReturn.set("0x940181a94a35a4569e4529a3cdfb74e38fd98631", 50); // AERO received
      }
    } else if (lowerAddress === "0xbbbb000000000000000000000000000000000002") {
      // Simple test wallet - 3000 USDC initially, after swap: 2800 USDC + 100 AERO
      balancesToReturn = new Map();

      if (syncNumber === 0) {
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          3000,
        ); // Initial USDC
      } else {
        // After swap: 200 USDC → 100 AERO
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          2800,
        ); // USDC after swap
        balancesToReturn.set("0x940181a94a35a4569e4529a3cdfb74e38fd98631", 100); // AERO received
      }
    } else if (lowerAddress === "0x2222222222222222222222222222222222222222") {
      // Agent with deposit - balance increases due to external deposit
      balancesToReturn = new Map();

      if (syncNumber === 0) {
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          5000,
        ); // Initial USDC
      } else {
        // After deposit: 5000 + 1000 = 6000 USDC
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          6000,
        );
      }
    } else if (lowerAddress === "0x3333333333333333333333333333333333333333") {
      // Agent with withdrawal - balance decreases due to external withdrawal
      balancesToReturn = new Map();

      if (syncNumber === 0) {
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          5000,
        ); // Initial USDC
      } else {
        // After withdrawal: 5000 - 500 = 4500 USDC
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          4500,
        );
      }
    } else if (lowerAddress === "0x4444444444444444444444444444444444444444") {
      // Multi-protocol agent - has both Aerodrome and Uniswap swaps
      balancesToReturn = new Map();

      if (syncNumber === 0) {
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          5000,
        ); // Initial USDC
        balancesToReturn.set("0x940181a94a35a4569e4529a3cdfb74e38fd98631", 0); // AERO
        balancesToReturn.set("0x4200000000000000000000000000000000000006", 0); // WETH
      } else {
        // After swaps (Aerodrome: 50 USDC → 25 AERO, Uniswap: 10 AERO → 0.05 ETH)
        // Note: If Aerodrome filter enabled, only first swap processed
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          4950,
        ); // 50 USDC spent
        balancesToReturn.set("0x940181a94a35a4569e4529a3cdfb74e38fd98631", 25); // 25 AERO (or 15 if both swaps)
        balancesToReturn.set("0x4200000000000000000000000000000000000006", 0); // ETH (0.05 if Uniswap processed)
      }
    } else if (lowerAddress === "0x6666666666666666666666666666666666666666") {
      // Token whitelist test - has swap to non-whitelisted AERO
      balancesToReturn = new Map();

      if (syncNumber === 0) {
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          5000,
        ); // Initial USDC
      } else {
        // Balance unchanged because swap to non-whitelisted token was rejected
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          5000,
        ); // Still 5000 USDC (swap rejected)
        // Note: AERO balance not included since swap was rejected
      }
    } else if (lowerAddress === "0x7777777777777777777777777777777777777777") {
      // Min funding threshold test - below threshold
      balancesToReturn = new Map();
      balancesToReturn.set("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 50); // Only $50 - below $100 threshold
    } else if (lowerAddress === "0x8888888888888888888888888888888888888888") {
      // Portfolio filter test - multiple tokens but only USDC should be tracked
      balancesToReturn = new Map();

      if (syncNumber === 0) {
        // Initial state - has multiple tokens
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          1000,
        ); // USDC
        balancesToReturn.set("0x940181a94a35a4569e4529a3cdfb74e38fd98631", 500); // AERO
        balancesToReturn.set("0x4200000000000000000000000000000000000006", 0.5); // ETH
      } else {
        // Same balances (no swaps)
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          1000,
        );
        balancesToReturn.set("0x940181a94a35a4569e4529a3cdfb74e38fd98631", 500);
        balancesToReturn.set("0x4200000000000000000000000000000000000006", 0.5);
      }
    } else if (lowerAddress === "0x0001000000000000000000000000000000000001") {
      // ROI Test Wallet 1: HIGHEST ROI (50%), LOWEST portfolio value ($150)
      // Starting: $100 USDC → Ending: $150 USDC
      balancesToReturn = new Map();

      if (syncNumber === 0) {
        balancesToReturn.set("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 100); // Initial: $100 USDC
      } else {
        // After profitable trade: $100 → $150 (50% ROI)
        balancesToReturn.set("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 150);
      }
    } else if (lowerAddress === "0x0002000000000000000000000000000000000002") {
      // ROI Test Wallet 2: MEDIUM ROI (20%), HIGHEST portfolio value ($1200)
      // Starting: $1000 USDC → Ending: $1200 USDC
      balancesToReturn = new Map();

      if (syncNumber === 0) {
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          1000,
        ); // Initial: $1000 USDC
      } else {
        // After trade: $1000 → $1200 (20% ROI)
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          1200,
        );
      }
    } else if (lowerAddress === "0x0003000000000000000000000000000000000003") {
      // ROI Test Wallet 3: LOWEST ROI (10%), MEDIUM portfolio value ($550)
      // Starting: $500 USDC → Ending: $550 USDC
      balancesToReturn = new Map();

      if (syncNumber === 0) {
        balancesToReturn.set("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 500); // Initial: $500 USDC
      } else {
        // After trade: $500 → $550 (10% ROI)
        balancesToReturn.set("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 550);
      }
    } else if (lowerAddress === "0xa011000000000000000000000000000000000001") {
      // Unique ROI Wallet 1: HIGHEST ROI (50%), LOWEST portfolio value ($150)
      balancesToReturn = new Map();

      if (syncNumber === 0) {
        balancesToReturn.set("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 100);
      } else {
        balancesToReturn.set("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 150);
      }
    } else if (lowerAddress === "0xa022000000000000000000000000000000000002") {
      // Unique ROI Wallet 2: MEDIUM ROI (20%), HIGHEST portfolio value ($1200)
      balancesToReturn = new Map();

      if (syncNumber === 0) {
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          1000,
        );
      } else {
        balancesToReturn.set(
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
          1200,
        );
      }
    } else if (lowerAddress === "0xa033000000000000000000000000000000000003") {
      // Unique ROI Wallet 3: LOWEST ROI (10%), MEDIUM portfolio value ($550)
      balancesToReturn = new Map();

      if (syncNumber === 0) {
        balancesToReturn.set("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 500);
      } else {
        balancesToReturn.set("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 550);
      }
    } else if (lowerAddress === "0x9999000000000000000000000000000000000009") {
      // Native ETH Test Wallet: Tests native balance + swap
      // Initial: 100 USDC (native ETH handled separately via getBalance)
      // After swap: 375 USDC (100 + 275 from selling 0.1 ETH)
      balancesToReturn = new Map();

      if (syncNumber === 0) {
        balancesToReturn.set("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 100); // Initial: 100 USDC
      } else {
        // After native ETH swap: +275 USDC
        balancesToReturn.set("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 375);
      }

      this.logger.info(
        `[MockAlchemyRpcProvider] Native ETH wallet 0x9999 getTokenBalances at sync #${syncNumber}: USDC=${balancesToReturn.get("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913")}`,
      );
    } else if (lowerAddress === "0x5110000000000000000000000000000000000001") {
      // Slipstream Test Wallet: Tests CL swap detection
      // Initial: 1000 USDC
      // After swap: 950 USDC + ~8 RIVER
      balancesToReturn = new Map();
      const usdcAddr = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
      const riverAddr = "0xda7ad9dea9397cffddae2f8a052b82f1484252b3";

      if (syncNumber === 0) {
        balancesToReturn.set(usdcAddr, 1000); // Initial: 1000 USDC
      } else {
        // After Slipstream swap: 50 USDC → ~8 RIVER
        balancesToReturn.set(usdcAddr, 950); // 1000 - 50 = 950 USDC
        balancesToReturn.set(riverAddr, 8.028); // ~8 RIVER received
      }

      this.logger.info(
        `[MockAlchemyRpcProvider] Slipstream wallet 0xslip getTokenBalances at sync #${syncNumber}: USDC=${balancesToReturn.get(usdcAddr)}`,
      );
    } else if (lowerAddress === "0xc0b0000000000000000000000000000000000001") {
      // Combined V2+Slipstream Test Wallet: Tests both router types
      // Initial: 2000 USDC
      // After V2 swap (sync 1): 1900 USDC + 50 AERO
      // After Slipstream swap (sync 2): 1850 USDC + 50 AERO + 8 RIVER
      balancesToReturn = new Map();
      const usdcAddr = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
      const aeroAddr = "0x940181a94a35a4569e4529a3cdfb74e38fd98631";
      const riverAddr = "0xda7ad9dea9397cffddae2f8a052b82f1484252b3";

      if (syncNumber === 0) {
        balancesToReturn.set(usdcAddr, 2000); // Initial: 2000 USDC
      } else if (syncNumber === 1) {
        // After V2 swap: 100 USDC → 50 AERO
        balancesToReturn.set(usdcAddr, 1900);
        balancesToReturn.set(aeroAddr, 50);
      } else {
        // After both swaps: V2 (100 USDC → 50 AERO) + Slipstream (50 USDC → 8 RIVER)
        balancesToReturn.set(usdcAddr, 1850);
        balancesToReturn.set(aeroAddr, 50);
        balancesToReturn.set(riverAddr, 8);
      }

      this.logger.info(
        `[MockAlchemyRpcProvider] Combined wallet 0xcomb getTokenBalances at sync #${syncNumber}: USDC=${balancesToReturn.get(usdcAddr)}, AERO=${balancesToReturn.get(aeroAddr) ?? 0}`,
      );
    }

    return Array.from(balancesToReturn.entries()).map(
      ([tokenAddress, balance]) => {
        // Use proper decimals for each token
        const decimals =
          tokenAddress.toLowerCase() ===
          "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
            ? 6
            : 18;
        const rawBalance = Math.floor(balance * Math.pow(10, decimals));
        return {
          contractAddress: tokenAddress,
          // Return decimal string (same format as real AlchemyRpcProvider after normalization)
          balance: rawBalance.toString(),
        };
      },
    );
  }

  /**
   * Get token decimals
   */
  async getTokenDecimals(
    tokenAddress: string,
    chain: SpecificChain,
  ): Promise<number> {
    void chain; // Not used in mock
    // Return standard decimals based on token
    if (
      tokenAddress.toLowerCase() ===
      "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
    ) {
      return 6; // USDC
    }
    return 18; // Default for ERC20
  }

  /**
   * Get token symbol from on-chain contract
   * Returns known symbols for common tokens, null for others
   */
  async getTokenSymbol(
    tokenAddress: string,
    chain: SpecificChain,
  ): Promise<string | null> {
    void chain; // Not used in mock
    const address = tokenAddress.toLowerCase();

    // Known token symbols
    const knownSymbols: Record<string, string> = {
      "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
      "0x4200000000000000000000000000000000000006": "WETH",
      "0x940181a94a35a4569e4529a3cdfb74e38fd98631": "AERO",
      "0x4a0c64af541439898448659aedcec8e8e819fc53": "PONKE",
      "0x6502f90d06be80fdb758d88ac00cb9ca6c808dc9": "WARMAX",
      "0xe73cfcdb88b8334934280942c6fdd35171e3a157": "SANTA",
    };

    return knownSymbols[address] ?? null;
  }

  /**
   * Reset all mock data (called between tests)
   */
  public reset(): void {
    this.mockData.clear();
    this.callIndex.clear();
    this.initializeDefaultMockData();
    this.logger.info("[MockAlchemyRpcProvider] Reset mock data");
  }
}

// Type definitions for mock data
interface MockWalletData {
  transfers: AssetTransfersWithMetadataResult[];
  transactions: Map<string, TransactionData>;
  receipts: Map<string, TransactionReceipt>;
  balances: Map<string, number>;
  /** Native token balance in wei (e.g., ETH balance) */
  nativeBalance?: string;
}
