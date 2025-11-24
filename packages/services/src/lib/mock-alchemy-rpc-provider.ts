import { AssetTransfersWithMetadataResult } from "alchemy-sdk";
import { Logger } from "pino";

import { SpecificChain } from "../types/index.js";
import {
  IRpcProvider,
  TokenBalance,
  TransactionData,
  TransactionReceipt,
} from "../types/rpc.js";

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

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeDefaultMockData();
  }

  /**
   * Initialize default mock data for test wallets
   * Pre-configured wallets with known swaps and transfers
   */
  private initializeDefaultMockData(): void {
    // Default data for new wallets - no activity
    this.setDefaultWalletData("default", {
      transfers: [],
      transactions: new Map(),
      receipts: new Map(),
      balances: new Map(),
    });

    // Pre-configured test wallet #1: Multiple Aerodrome swaps showing positive ROI progression
    // Simulates successful trading with portfolio growth across multiple syncs
    // Initial: 5000 USDC
    // After Swap 1 (block 2000000): 4900 USDC + 50 AERO (net: ~$5000)
    // After Swap 2 (block 2000010): 4900 USDC + 40 AERO + 0.005 ETH (net: ~$5015 if AERO/ETH price up)
    // After Swap 3 (block 2000020): 4900 USDC + 35 AERO + 0.005 ETH + small gain (net: ~$5025)
    this.setWalletData("0x1111111111111111111111111111111111111111", {
      transfers: [
        // Swap 1: USDC → AERO (Block 2000000)
        {
          from: "0x1111111111111111111111111111111111111111",
          to: "0xd35fcf71834c4a4ae98ff22f68c05e13e5fdee01", // Aerodrome pool
          value: 100,
          asset: "USDC",
          hash: "0xmock_swap_1",
          blockNum: "0x1e8480", // Block 2000000 in hex
          metadata: {
            blockTimestamp: "2024-01-15T12:00:00Z",
          },
          rawContract: {
            address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
            decimal: "6",
            value: null,
          },
        },
        {
          from: "0xd35fcf71834c4a4ae98ff22f68c05e13e5fdee01",
          to: "0x1111111111111111111111111111111111111111",
          value: 50,
          asset: "AERO",
          hash: "0xmock_swap_1",
          blockNum: "0x1e8480",
          metadata: {
            blockTimestamp: "2024-01-15T12:00:00Z",
          },
          rawContract: {
            address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", // AERO
            decimal: "18",
            value: null,
          },
        },
        // Swap 2: AERO → ETH (Block 2000010) - Second sync will catch this
        {
          from: "0x1111111111111111111111111111111111111111",
          to: "0xaeropool2222222222222222222222222222222",
          value: 10,
          asset: "AERO",
          hash: "0xmock_swap_2",
          blockNum: "0x1e848a", // Block 2000010 in hex
          metadata: {
            blockTimestamp: "2024-01-15T12:05:00Z",
          },
          rawContract: {
            address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", // AERO
            decimal: "18",
            value: null,
          },
        },
        {
          from: "0xaeropool2222222222222222222222222222222",
          to: "0x1111111111111111111111111111111111111111",
          value: 0.005,
          asset: "ETH",
          hash: "0xmock_swap_2",
          blockNum: "0x1e848a",
          metadata: {
            blockTimestamp: "2024-01-15T12:05:00Z",
          },
          rawContract: {
            address: "0x4200000000000000000000000000000000000006", // WETH on Base
            decimal: "18",
            value: null,
          },
        },
        // Swap 3: AERO → USDC (Block 2000020) - Third sync will catch this
        {
          from: "0x1111111111111111111111111111111111111111",
          to: "0xaeropool3333333333333333333333333333333",
          value: 5,
          asset: "AERO",
          hash: "0xmock_swap_3",
          blockNum: "0x1e8494", // Block 2000020 in hex
          metadata: {
            blockTimestamp: "2024-01-15T12:10:00Z",
          },
          rawContract: {
            address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", // AERO
            decimal: "18",
            value: null,
          },
        },
        {
          from: "0xaeropool3333333333333333333333333333333",
          to: "0x1111111111111111111111111111111111111111",
          value: 6,
          asset: "USDC",
          hash: "0xmock_swap_3",
          blockNum: "0x1e8494",
          metadata: {
            blockTimestamp: "2024-01-15T12:10:00Z",
          },
          rawContract: {
            address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
            decimal: "6",
            value: null,
          },
        },
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
              {
                address: "0xd35fcf71834c4a4ae98ff22f68c05e13e5fdee01",
                blockNumber: 2000000,
                blockHash: "0xmockblockhash1",
                transactionIndex: 0,
                removed: false,
                logIndex: 0,
                transactionHash: "0xmock_swap_1",
                topics: [
                  "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b", // Aerodrome Swap
                  "0x000000000000000000000000cf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
                  "0x0000000000000000000000001111111111111111111111111111111111111111",
                ],
                data: "0x",
              },
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
              {
                address: "0xaeropool2222222222222222222222222222222",
                blockNumber: 2000010,
                blockHash: "0xmockblockhash2",
                transactionIndex: 0,
                removed: false,
                logIndex: 0,
                transactionHash: "0xmock_swap_2",
                topics: [
                  "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b", // Aerodrome Swap
                ],
                data: "0x",
              },
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
              {
                address: "0xaeropool3333333333333333333333333333333",
                blockNumber: 2000020,
                blockHash: "0xmockblockhash3",
                transactionIndex: 0,
                removed: false,
                logIndex: 0,
                transactionHash: "0xmock_swap_3",
                topics: [
                  "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b", // Aerodrome Swap
                ],
                data: "0x",
              },
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
    this.setWalletData("0x2222222222222222222222222222222222222222", {
      transfers: [
        // Deposit: External wallet → Agent
        {
          from: "0xexternal1111111111111111111111111111111111",
          to: "0x2222222222222222222222222222222222222222",
          value: 1000,
          asset: "USDC",
          hash: "0xmock_deposit_1",
          blockNum: "0x1e8481",
          metadata: {
            blockTimestamp: "2024-01-16T10:00:00Z",
          },
          rawContract: {
            address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
            decimal: "6",
            value: null,
          },
        },
      ],
      transactions: new Map(),
      receipts: new Map(),
      balances: new Map([["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 6000]]),
    });

    // Pre-configured test wallet #3: Agent with withdrawal (transfer violation)
    this.setWalletData("0x3333333333333333333333333333333333333333", {
      transfers: [
        // Withdrawal: Agent → External wallet
        {
          from: "0x3333333333333333333333333333333333333333",
          to: "0xexternal2222222222222222222222222222222222",
          value: 500,
          asset: "USDC",
          hash: "0xmock_withdraw_1",
          blockNum: "0x1e8482",
          metadata: {
            blockTimestamp: "2024-01-16T11:00:00Z",
          },
          rawContract: {
            address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
            decimal: "6",
            value: null,
          },
        },
      ],
      transactions: new Map(),
      receipts: new Map(),
      balances: new Map([["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 4500]]),
    });

    // Pre-configured test wallet #4: Multiple swaps at different blocks (protocol filtering test)
    // Aerodrome swap at block 2000030 (should pass filter)
    // Uniswap swap at block 2000031 (should be filtered out)
    this.setWalletData("0x4444444444444444444444444444444444444444", {
      transfers: [
        // Swap 1: Aerodrome USDC → AERO (Block 2000030)
        {
          from: "0x4444444444444444444444444444444444444444",
          to: "0xaeropool1111111111111111111111111111111",
          value: 50,
          asset: "USDC",
          hash: "0xmock_aerodrome_swap",
          blockNum: "0x1e849e", // Block 2000030 in hex
          metadata: {
            blockTimestamp: "2024-01-15T13:00:00Z",
          },
          rawContract: {
            address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
            decimal: "6",
            value: null,
          },
        },
        {
          from: "0xaeropool1111111111111111111111111111111",
          to: "0x4444444444444444444444444444444444444444",
          value: 25,
          asset: "AERO",
          hash: "0xmock_aerodrome_swap",
          blockNum: "0x1e849e", // Block 2000030
          metadata: {
            blockTimestamp: "2024-01-15T13:00:00Z",
          },
          rawContract: {
            address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
            decimal: "18",
            value: null,
          },
        },
        // Swap 2: Uniswap AERO → ETH (Block 2000031) - different protocol
        {
          from: "0x4444444444444444444444444444444444444444",
          to: "0xunipool2222222222222222222222222222222",
          value: 10,
          asset: "AERO",
          hash: "0xmock_uniswap_swap",
          blockNum: "0x1e849f", // Block 2000031 in hex
          metadata: {
            blockTimestamp: "2024-01-15T13:01:00Z",
          },
          rawContract: {
            address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
            decimal: "18",
            value: null,
          },
        },
        {
          from: "0xunipool2222222222222222222222222222222",
          to: "0x4444444444444444444444444444444444444444",
          value: 0.05,
          asset: "ETH",
          hash: "0xmock_uniswap_swap",
          blockNum: "0x1e849f", // Block 2000031
          metadata: {
            blockTimestamp: "2024-01-15T13:01:00Z",
          },
          rawContract: {
            address: "0x4200000000000000000000000000000000000006", // WETH
            decimal: "18",
            value: null,
          },
        },
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
              {
                address: "0xaeropool1111111111111111111111111111111",
                blockNumber: 2000030,
                blockHash: "0xmockblockhash_aero",
                transactionIndex: 0,
                removed: false,
                logIndex: 0,
                transactionHash: "0xmock_aerodrome_swap",
                topics: [
                  "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b", // Aerodrome Swap
                ],
                data: "0x",
              },
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
              {
                address: "0xunipool2222222222222222222222222222222",
                blockNumber: 2000031,
                blockHash: "0xmockblockhash_uni",
                transactionIndex: 0,
                removed: false,
                logIndex: 0,
                transactionHash: "0xmock_uniswap_swap",
                topics: [
                  "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822", // Uniswap V2 Swap (different signature)
                ],
                data: "0x",
              },
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
   */
  async getAssetTransfers(
    walletAddress: string,
    chain: SpecificChain,
    fromBlock: number | string,
    toBlock: number | string,
  ): Promise<{
    transfers: AssetTransfersWithMetadataResult[];
    pageKey?: string;
  }> {
    void toBlock; // Not used in mock - all transfers returned
    const data = this.getWalletData(walletAddress);

    // Convert fromBlock to number if it's hex
    const fromBlockNum =
      typeof fromBlock === "string" && fromBlock.startsWith("0x")
        ? parseInt(fromBlock, 16)
        : typeof fromBlock === "string" && fromBlock === "latest"
          ? 0
          : Number(fromBlock);

    // Filter transfers by block range
    const filteredTransfers = data.transfers.filter((t) => {
      const transferBlock = parseInt(t.blockNum ?? "0x0", 16);
      return transferBlock >= fromBlockNum;
    });

    this.logger.debug(
      {
        wallet: walletAddress.slice(0, 10),
        chain,
        fromBlock: fromBlockNum,
        totalTransfers: filteredTransfers.length,
      },
      `[MockAlchemyRpcProvider] Returning ${filteredTransfers.length} transfers`,
    );

    return {
      transfers: filteredTransfers as AssetTransfersWithMetadataResult[],
      pageKey: undefined, // No pagination in mock
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
   */
  async getBlockNumber(chain: SpecificChain): Promise<number> {
    void chain; // Not used in mock - returns static block number
    // Return a reasonable mock block number
    return 2000100; // Slightly ahead of our test data
  }

  /**
   * Get ETH balance for a wallet
   */
  async getBalance(
    walletAddress: string,
    chain: SpecificChain,
  ): Promise<string> {
    void walletAddress; // Not used in mock
    void chain; // Not used in mock
    // Return mock ETH balance (not used in spot live trading, but required by interface)
    return "1000000000000000000"; // 1 ETH in wei
  }

  /**
   * Get token balances for a wallet
   */
  async getTokenBalances(
    walletAddress: string,
    chain: SpecificChain,
  ): Promise<TokenBalance[]> {
    void chain; // Not used in mock
    const data = this.getWalletData(walletAddress);

    return Array.from(data.balances.entries()).map(
      ([tokenAddress, balance]) => ({
        contractAddress: tokenAddress,
        balance: `0x${balance.toString(16)}`, // Hex string
      }),
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
   * Reset all mock data (called between tests)
   */
  public reset(): void {
    this.mockData.clear();
    this.initializeDefaultMockData();
    this.logger.info("[MockAlchemyRpcProvider] Reset mock data");
  }
}

// Type definitions for mock data
// Using Partial for Alchemy SDK types since mock doesn't need all fields
interface MockWalletData {
  transfers: Partial<AssetTransfersWithMetadataResult>[];
  transactions: Map<string, TransactionData>;
  receipts: Map<string, TransactionReceipt>;
  balances: Map<string, number>;
}
