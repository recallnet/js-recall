import * as Sentry from "@sentry/node";
import { AssetTransfersWithMetadataResult } from "alchemy-sdk";
import { Logger } from "pino";

import { NATIVE_TOKEN_ADDRESS } from "../../lib/config-utils.js";
import { SpecificChain } from "../../types/index.js";
import { IRpcProvider, TransactionReceipt } from "../../types/rpc.js";
import {
  ISpotLiveDataProvider,
  OnChainTrade,
  ProtocolFilter,
  SpotTransfer,
  TradesResult,
} from "../../types/spot-live.js";

/**
 * Transfer information from Alchemy
 */
interface Transfer {
  from: string;
  to: string;
  value: number;
  asset: string;
  hash: string;
  blockNum: string;
  metadata: {
    blockTimestamp: string;
  };
  rawContract?: {
    address: string | null;
    decimal: string | null;
  };
}

/**
 * Detected swap pattern from transaction transfers
 */
interface DetectedSwap {
  txHash: string;
  blockNumber: number;
  timestamp: Date;
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  protocol: string;
}

/**
 * Transfer parsed from receipt log with deterministic ordering
 */
interface ParsedTransfer {
  tokenAddress: string;
  from: string;
  to: string;
  value: bigint;
  logIndex: number;
}

/** ERC20 Transfer event signature: keccak256("Transfer(address,address,uint256)") */
const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/**
 * Maximum age (in blocks) for tracking skipped transactions.
 * If a transaction is older than this, we log an error and allow sync to progress
 * rather than being permanently stuck. On Base (~2s blocks), 1800 blocks = ~1 hour.
 */
const MAX_SKIP_AGE_BLOCKS = 1800;

/**
 * RPC-based spot live data provider with optional protocol filtering
 * Wraps AlchemyRpcProvider and adds spot-specific logic for trade detection
 *
 * Protocol Filtering:
 * - When protocolFilters is empty: ALL swaps indexed (base case)
 * - When protocolFilters has entries: Two-layer filtering applied
 *   Layer 1: Check tx.to against router addresses (fast, chain-aware)
 *   Layer 2: Verify Swap event signature (validation)
 *
 * Key Characteristics:
 * - DEX-agnostic: Works with any DEX through wallet-based transfer monitoring
 * - Chain-specific filtering: Protocol filters are scoped per chain
 * - Swap detection: Identifies swaps from transfer patterns (outbound + inbound)
 * - Optional filtering: Can run fully open (all DEXs) or restricted (specific protocols)
 */
export class RpcSpotProvider implements ISpotLiveDataProvider {
  private readonly protocolFiltersByChain: Map<string, ProtocolFilter[]>;

  // Cache transfers within a single agent's sync to avoid duplicate API calls
  // Key format: "wallet:chain:fromBlock"
  // Cleared before processing each agent
  private transferCache: Map<string, AssetTransfersWithMetadataResult[]> =
    new Map();

  constructor(
    private readonly rpcProvider: IRpcProvider,
    protocolFilters: ProtocolFilter[],
    private readonly logger: Logger,
  ) {
    // Group filters by chain for efficient lookup
    this.protocolFiltersByChain = new Map();
    for (const filter of protocolFilters) {
      if (!this.protocolFiltersByChain.has(filter.chain)) {
        this.protocolFiltersByChain.set(filter.chain, []);
      }

      const chainFilters = this.protocolFiltersByChain.get(filter.chain);
      if (chainFilters) {
        chainFilters.push(filter);
      }
    }

    if (protocolFilters.length > 0) {
      const chainsWithFilters = Array.from(
        this.protocolFiltersByChain.keys(),
      ).join(", ");
      this.logger.info(
        `[RpcSpotProvider] Protocol filtering enabled for chains: ${chainsWithFilters}`,
      );
    } else {
      this.logger.info(
        `[RpcSpotProvider] No protocol filtering - all DEXs allowed`,
      );
    }
  }

  /**
   * Get current block number for a chain
   * Used for sync state tracking when no trades found
   * @param chain Specific chain
   * @returns Current block number
   */
  async getCurrentBlock(chain: SpecificChain): Promise<number> {
    return await this.rpcProvider.getBlockNumber(chain);
  }

  /**
   * Get provider name for logging and debugging
   * @returns Provider name combining spot provider type with underlying RPC provider
   */
  getName(): string {
    return `RPC Direct (${this.rpcProvider.getName()})`;
  }

  /**
   * Check if provider is healthy and responsive
   * @returns True if provider is operational
   */
  async isHealthy(): Promise<boolean> {
    return await this.rpcProvider.isHealthy();
  }

  /**
   * Clear transfer cache
   * WARNING: Do NOT call per-agent during concurrent processing - this clears ALL keys
   * and causes race conditions. Cache keys are wallet-specific, so no clearing needed.
   * Only call if reusing a provider instance across multiple competition syncs.
   */
  clearTransferCache(): void {
    this.transferCache.clear();
  }

  /**
   * Get current token balances for a wallet on a chain
   * Used during initial sync to establish starting balances
   * @param walletAddress Wallet address to query
   * @param chain Chain to query
   * @returns Array of token balances
   */
  async getTokenBalances(
    walletAddress: string,
    chain: SpecificChain,
  ): Promise<Array<{ contractAddress: string; balance: string }>> {
    // Block Solana - requires different balance fetching logic
    if (chain === "svm") {
      throw new Error(
        "Solana (svm) is not supported for RPC-based spot live trading. Solana uses SPL tokens and requires separate implementation.",
      );
    }

    return await this.rpcProvider.getTokenBalances(walletAddress, chain);
  }

  /**
   * Get native token balance for a wallet on a chain
   * @param walletAddress Wallet address to query
   * @param chain Chain to query
   * @returns Native balance in wei as string
   */
  async getNativeBalance(
    walletAddress: string,
    chain: SpecificChain,
  ): Promise<string> {
    // Block Solana - requires different balance fetching logic
    if (chain === "svm") {
      throw new Error(
        "Solana (svm) is not supported for RPC-based spot live trading. Solana native balance requires separate implementation.",
      );
    }

    return await this.rpcProvider.getBalance(walletAddress, chain);
  }

  /**
   * Get token decimals for proper balance parsing
   * @param tokenAddress Token contract address
   * @param chain Chain where token exists
   * @returns Number of decimals for the token
   */
  async getTokenDecimals(
    tokenAddress: string,
    chain: SpecificChain,
  ): Promise<number> {
    return await this.rpcProvider.getTokenDecimals(tokenAddress, chain);
  }

  /**
   * Get all trades for a wallet since a given time
   * Detects swaps from transfer patterns and applies protocol filtering if configured
   * @param walletAddress Wallet address to monitor
   * @param since Start time or block number for scanning
   * @param chains Array of chains to scan
   * @returns TradesResult with detected trades and skipped block metadata
   */
  async getTradesSince(
    walletAddress: string,
    since: Date | number,
    chains: SpecificChain[],
    toBlock?: number | string,
  ): Promise<TradesResult> {
    const startTime = Date.now();
    const maskedAddress = this.maskAddress(walletAddress);

    // Validate inputs
    if (chains.length === 0) {
      this.logger.warn(
        `[RpcSpotProvider] No chains provided for trade scanning`,
      );
      return { trades: [] };
    }

    const firstChain = chains[0];
    if (!firstChain) {
      this.logger.warn(`[RpcSpotProvider] Empty chains array`);
      return { trades: [] };
    }

    const sinceBlock =
      typeof since === "number"
        ? since
        : await this.dateToBlockNumber(since, firstChain);

    // Add Sentry breadcrumb for debugging
    Sentry.addBreadcrumb({
      category: "spot.rpc",
      message: `Trades request`,
      level: "info",
      data: {
        walletAddress: maskedAddress,
        chains,
        sinceBlock,
      },
    });

    this.logger.debug(
      {
        wallet: maskedAddress,
        chains,
        sinceBlock,
      },
      `[RpcSpotProvider] Fetching trades`,
    );

    const allTrades: OnChainTrade[] = [];
    // Track lowest block of any skipped transaction for safe sync state management
    let lowestSkippedBlock: number | undefined;

    for (const chain of chains) {
      try {
        // Fetch current block for max-age check on skipped transactions
        const currentBlock = await this.rpcProvider.getBlockNumber(chain);

        // Check cache first (unified sync state means getTransferHistory will reuse this)
        const cacheKey = `${walletAddress}:${chain}:${sinceBlock}`;
        let allTransfers = this.transferCache.get(cacheKey);

        if (!allTransfers) {
          // Cache miss - fetch from API
          // AlchemyRpcProvider handles all pagination internally and returns complete results
          const transfersResponse = await this.rpcProvider.getAssetTransfers(
            walletAddress,
            chain,
            sinceBlock,
            toBlock || "latest",
          );

          allTransfers = transfersResponse.transfers;

          // Cache for reuse by getTransferHistory
          this.transferCache.set(cacheKey, allTransfers);

          this.logger.debug(
            {
              chain,
              totalTransfers: allTransfers.length,
            },
            `[RpcSpotProvider] Fetched and cached transfers`,
          );
        } else {
          this.logger.debug(
            {
              chain,
              cachedTransfers: allTransfers.length,
            },
            `[RpcSpotProvider] Using cached transfers`,
          );
        }

        // Group transfers by transaction
        const transfersByTx = this.groupTransfersByTransaction(allTransfers);

        this.logger.debug(
          {
            chain,
            transactionCount: transfersByTx.size,
          },
          `[RpcSpotProvider] Found transactions with transfers`,
        );

        // Get filters for this specific chain
        const chainFilters = this.protocolFiltersByChain.get(chain) || [];
        const hasFilters = chainFilters.length > 0;

        // Process each transaction to detect swaps
        // Uses receipt logs with logIndex ordering for deterministic from/to detection
        for (const [txHash, txTransfers] of transfersByTx) {
          // Quick pre-filter: check if this could be a swap (has both directions)
          if (!this.isSwapCandidate(txTransfers, walletAddress)) {
            continue;
          }

          // Fetch receipt for accurate detection using logIndex ordering
          let receipt: TransactionReceipt | null = null;
          try {
            receipt = await this.rpcProvider.getTransactionReceipt(
              txHash,
              chain,
            );
          } catch (receiptError) {
            // Receipt fetch failed - track for retry unless too old
            const firstTransfer = txTransfers[0];
            if (firstTransfer) {
              const blockNum = parseInt(firstTransfer.blockNum, 16);
              const blockAge = currentBlock - blockNum;

              if (blockAge > MAX_SKIP_AGE_BLOCKS) {
                // Transaction too old - log error and skip (prevent permanent blocking)
                this.logger.error(
                  {
                    txHash,
                    chain,
                    blockNum,
                    currentBlock,
                    blockAge,
                    maxAge: MAX_SKIP_AGE_BLOCKS,
                    error:
                      receiptError instanceof Error
                        ? receiptError.message
                        : String(receiptError),
                  },
                  "[RpcSpotProvider] Receipt fetch failed for transaction older than max age - skipping permanently",
                );
                Sentry.captureMessage(
                  `Skipped old transaction ${txHash} - receipt unavailable after ${blockAge} blocks`,
                  {
                    level: "error",
                    extra: { txHash, chain, blockNum, blockAge },
                  },
                );
              } else {
                // Track for retry
                if (
                  lowestSkippedBlock === undefined ||
                  blockNum < lowestSkippedBlock
                ) {
                  lowestSkippedBlock = blockNum;
                }
                this.logger.warn(
                  {
                    txHash,
                    chain,
                    blockNum,
                    blockAge,
                    error:
                      receiptError instanceof Error
                        ? receiptError.message
                        : String(receiptError),
                  },
                  "[RpcSpotProvider] Receipt fetch failed - tracking for retry",
                );
              }
            }
            continue;
          }

          if (!receipt || !receipt.status) {
            // Transaction not found or reverted - track for retry if missing (not if reverted)
            if (!receipt) {
              const firstTransfer = txTransfers[0];
              if (firstTransfer) {
                const blockNum = parseInt(firstTransfer.blockNum, 16);
                const blockAge = currentBlock - blockNum;

                if (blockAge > MAX_SKIP_AGE_BLOCKS) {
                  // Transaction too old - log error and skip (prevent permanent blocking)
                  this.logger.error(
                    {
                      txHash,
                      chain,
                      blockNum,
                      currentBlock,
                      blockAge,
                      maxAge: MAX_SKIP_AGE_BLOCKS,
                    },
                    "[RpcSpotProvider] Receipt not found for transaction older than max age - skipping permanently",
                  );
                  Sentry.captureMessage(
                    `Skipped old transaction ${txHash} - receipt not found after ${blockAge} blocks`,
                    {
                      level: "error",
                      extra: { txHash, chain, blockNum, blockAge },
                    },
                  );
                } else {
                  // Track for retry
                  if (
                    lowestSkippedBlock === undefined ||
                    blockNum < lowestSkippedBlock
                  ) {
                    lowestSkippedBlock = blockNum;
                  }
                  this.logger.debug(
                    { txHash, chain, blockNum, blockAge },
                    "[RpcSpotProvider] Receipt not found - tracking for retry",
                  );
                }
              }
            }
            continue;
          }

          // Build token decimals map from getAssetTransfers data
          // getAssetTransfers returns decimal-adjusted values, so we use 0 decimals
          // to pass raw amounts through (the values are already adjusted)
          const tokenDecimals = new Map<string, number>();
          for (const t of txTransfers) {
            const tokenAddr = this.getTokenAddress(t);
            // Mark as 0 decimals since getAssetTransfers values are already adjusted
            // We'll extract amounts from txTransfers, not from raw receipt logs
            tokenDecimals.set(tokenAddr.toLowerCase(), 0);
          }

          // Detect swap using receipt logs (deterministic logIndex ordering)
          // This handles ERC20 <-> ERC20 swaps with accurate from/to detection
          let swap = this.detectSwapFromReceiptLogs(
            receipt,
            walletAddress,
            tokenDecimals,
          );

          // Fallback to transfer-based detection when native ETH is involved
          // Native ETH doesn't emit ERC20 Transfer events - only visible via getAssetTransfers
          // Fallback if:
          //   1. Receipt-based detection failed (detectSwapFromReceiptLogs returned null)
          //   2. AND native ETH is involved (EXTERNAL category in getAssetTransfers)
          // This handles both ETH→ERC20 and ERC20→ETH swaps
          // Do NOT fallback for pure ERC20 swaps that failed (e.g., 0-value) - those are invalid
          if (!swap) {
            const hasNativeEthTransfer = this.hasNativeEthTransfer(txTransfers);
            if (hasNativeEthTransfer) {
              // Native ETH is involved - use transfer-based detection
              swap = this.detectSwapPattern(txTransfers, walletAddress);
            }
          }

          if (!swap) {
            continue;
          }

          // Override amounts from getAssetTransfers (already decimal-adjusted)
          // The receipt logs give us correct token addresses, but raw amounts
          // Use getAssetTransfers amounts which are properly adjusted
          const wallet = walletAddress.toLowerCase();
          const outboundTransfer = txTransfers.find(
            (t) =>
              t.from.toLowerCase() === wallet &&
              this.getTokenAddress(t).toLowerCase() === swap.fromToken,
          );
          const inboundTransfer = txTransfers.find(
            (t) =>
              t.to.toLowerCase() === wallet &&
              this.getTokenAddress(t).toLowerCase() === swap.toToken,
          );

          if (outboundTransfer) {
            swap.fromAmount = outboundTransfer.value;
          }
          if (inboundTransfer) {
            swap.toAmount = inboundTransfer.value;
          }

          // Set timestamp from transfer metadata
          const firstTransfer = txTransfers[0];
          if (firstTransfer) {
            swap.timestamp = new Date(firstTransfer.metadata.blockTimestamp);
          }

          // Apply protocol filter if configured for this chain (reuse receipt)
          if (hasFilters) {
            const tx = await this.rpcProvider.getTransaction(txHash, chain);
            const filterResult = this.checkProtocolFilterWithReceipt(
              receipt,
              tx?.to ?? undefined,
              chainFilters,
            );

            if (!filterResult.allowed) {
              this.logger.debug(
                {
                  txHash,
                  chain,
                },
                `[RpcSpotProvider] Skipped swap - not from allowed protocol`,
              );
              continue;
            }

            // Set protocol from filter result
            if (filterResult.protocol) {
              swap.protocol = filterResult.protocol;
            }
          }

          // Transform to OnChainTrade format (receipt already available)
          const trade = this.enrichSwapFromReceipt(swap, receipt, chain);
          allTrades.push(trade);
        }
      } catch (error) {
        // Capture exception with context
        Sentry.captureException(error, {
          extra: {
            walletAddress: maskedAddress,
            chain,
            method: "getTradesSince",
          },
        });

        this.logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            chain,
            wallet: maskedAddress,
          },
          `[RpcSpotProvider] Error fetching trades for chain`,
        );
        // Continue with other chains instead of failing entirely
      }
    }

    const processingTime = Date.now() - startTime;

    this.logger.debug(
      {
        wallet: maskedAddress,
        tradeCount: allTrades.length,
        processingTime,
        lowestSkippedBlock,
      },
      `[RpcSpotProvider] Detected swaps`,
    );

    return {
      trades: allTrades,
      lowestSkippedBlock,
    };
  }

  /**
   * Get transfer history for self-funding detection
   * Returns deposits/withdrawals (not swaps)
   * @param walletAddress Wallet address to monitor
   * @param since Start date or block number for transfer scanning
   * @param chains Array of chains to scan
   * @param toBlock Optional end block number for scanning (defaults to "latest")
   * @returns Array of deposits/withdrawals
   */
  async getTransferHistory(
    walletAddress: string,
    since: Date | number,
    chains: SpecificChain[],
    toBlock?: number,
  ): Promise<SpotTransfer[]> {
    const startTime = Date.now();
    const maskedAddress = this.maskAddress(walletAddress);

    // Validate inputs
    if (chains.length === 0) {
      this.logger.warn(
        `[RpcSpotProvider] No chains provided for transfer history`,
      );
      return [];
    }

    // Block Solana - requires different transfer detection logic
    if (chains.includes("svm")) {
      throw new Error(
        "Solana (svm) is not supported for RPC-based spot live trading. Solana uses programs model and requires separate implementation.",
      );
    }

    const firstChain = chains[0];
    if (!firstChain) {
      return [];
    }

    const sinceBlock =
      typeof since === "number"
        ? since
        : await this.dateToBlockNumber(since, firstChain);

    // Add Sentry breadcrumb for debugging
    Sentry.addBreadcrumb({
      category: "spot.rpc",
      message: `Transfer history request`,
      level: "info",
      data: {
        walletAddress: maskedAddress,
        since:
          typeof since === "number" ? `block ${since}` : since.toISOString(),
        chains,
      },
    });

    this.logger.debug(
      {
        wallet: maskedAddress,
        since:
          typeof since === "number" ? `block ${since}` : since.toISOString(),
        chains,
      },
      `[RpcSpotProvider] Fetching transfer history`,
    );

    const allTransfers: SpotTransfer[] = [];

    for (const chain of chains) {
      try {
        // Check cache first (should be populated by getTradesSince with unified sync state)
        const cacheKey = `${walletAddress}:${chain}:${sinceBlock}`;
        let chainTransfers = this.transferCache.get(cacheKey);

        if (!chainTransfers) {
          // Cache miss - fetch from API
          // AlchemyRpcProvider handles all pagination internally and returns complete results
          const transfersResponse = await this.rpcProvider.getAssetTransfers(
            walletAddress,
            chain,
            sinceBlock,
            toBlock || "latest",
          );

          chainTransfers = transfersResponse.transfers;

          // Cache for consistency (though getTradesSince usually caches first)
          this.transferCache.set(cacheKey, chainTransfers);

          this.logger.debug(
            {
              chain,
              totalTransfers: chainTransfers.length,
            },
            `[RpcSpotProvider] Fetched transfers for transfer history`,
          );
        } else {
          this.logger.debug(
            {
              chain,
              cachedTransfers: chainTransfers.length,
            },
            `[RpcSpotProvider] Using cached transfers for transfer history`,
          );
        }

        // Group by transaction to identify swaps (which we want to exclude)
        const transfersByTx = this.groupTransfersByTransaction(chainTransfers);

        // Only include transactions that are NOT swaps (deposits/withdrawals)
        for (const [, txTransfers] of transfersByTx) {
          const isSwap = this.detectSwapPattern(txTransfers, walletAddress);

          if (!isSwap) {
            // Not a swap - these are deposits/withdrawals
            for (const transfer of txTransfers) {
              // Skip 0-value transfers (approvals, contract interactions, etc.)
              if (transfer.value === 0) {
                continue;
              }

              const type = this.classifyTransfer(transfer, walletAddress);
              const tokenAddress = this.getTokenAddress(transfer);

              allTransfers.push({
                type,
                tokenAddress,
                amount: transfer.value,
                from: transfer.from,
                to: transfer.to,
                timestamp: new Date(transfer.metadata.blockTimestamp),
                txHash: transfer.hash,
                blockNumber: parseInt(transfer.blockNum, 16),
                chain: chain,
              });
            }
          }
        }
      } catch (error) {
        // Capture exception with context
        Sentry.captureException(error, {
          extra: {
            walletAddress: maskedAddress,
            chain,
            since:
              typeof since === "number"
                ? `block ${since}`
                : since.toISOString(),
            method: "getTransferHistory",
          },
        });

        this.logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            chain,
          },
          `[RpcSpotProvider] Error fetching transfer history`,
        );
      }
    }

    const processingTime = Date.now() - startTime;

    this.logger.debug(
      {
        wallet: maskedAddress,
        transferCount: allTransfers.length,
        processingTime,
      },
      `[RpcSpotProvider] Fetched transfer history`,
    );

    return allTransfers;
  }

  /**
   * Get token address from transfer
   * For ERC20 tokens, returns the contract address
   * For native tokens (ETH, MATIC, etc.), returns NATIVE_TOKEN_ADDRESS (zero address)
   * @param transfer Transfer object from Alchemy
   * @returns Token address (contract address for ERC20, zero address for native)
   */
  private getTokenAddress(transfer: Transfer): string {
    // ERC20 tokens have rawContract.address
    if (transfer.rawContract?.address) {
      return transfer.rawContract.address;
    }

    // Native transfers (EXTERNAL/INTERNAL category) don't have rawContract
    // Return zero address instead of "ETH" string for proper price lookup
    // The getTokenAddressForPriceLookup() utility maps zero address to WETH/WMATIC for pricing (used by multiple services)
    return NATIVE_TOKEN_ADDRESS;
  }

  /**
   * Group transfers by transaction hash for swap detection
   * @param transfers Array of transfer events from Alchemy
   * @returns Map of transaction hash to transfers in that transaction
   */
  private groupTransfersByTransaction(
    transfers: AssetTransfersWithMetadataResult[],
  ): Map<string, Transfer[]> {
    const byTx = new Map<string, Transfer[]>();

    for (const transfer of transfers) {
      // Normalize hash to lowercase for consistent grouping
      const normalizedHash = transfer.hash.toLowerCase();

      const normalizedTransfer: Transfer = {
        from: transfer.from.toLowerCase(),
        to: transfer.to ? transfer.to.toLowerCase() : "",
        value: Number(transfer.value) || 0,
        asset: transfer.asset || "ETH",
        hash: normalizedHash,
        blockNum: transfer.blockNum,
        metadata: transfer.metadata,
        rawContract: transfer.rawContract,
      };

      const existing = byTx.get(normalizedHash);
      if (existing) {
        existing.push(normalizedTransfer);
      } else {
        byTx.set(normalizedHash, [normalizedTransfer]);
      }
    }

    return byTx;
  }

  /**
   * Detect swap pattern from transaction transfers
   * A swap has both outbound and inbound transfers for the same wallet
   * @param transfers Transfers in a single transaction
   * @param walletAddress Wallet address being monitored
   * @returns Detected swap or null if not a swap pattern
   */
  private detectSwapPattern(
    transfers: Transfer[],
    walletAddress: string,
  ): DetectedSwap | null {
    const wallet = walletAddress.toLowerCase();

    // Separate outbound and inbound transfers
    const outbound = transfers.filter((t) => t.from === wallet);
    const inbound = transfers.filter((t) => t.to === wallet);

    // Swap requires at least one outbound and one inbound
    if (outbound.length === 0 || inbound.length === 0) {
      return null;
    }

    // Use first outbound and first inbound (handles most cases)
    // Note: Multi-hop swaps may have multiple transfers, taking first of each is reasonable heuristic
    const out = outbound[0];
    const inc = inbound[0];

    if (!out || !inc) {
      return null;
    }

    const fromToken = this.getTokenAddress(out);
    const toToken = this.getTokenAddress(inc);

    return {
      txHash: out.hash,
      blockNumber: parseInt(out.blockNum, 16),
      timestamp: new Date(out.metadata.blockTimestamp),
      fromToken,
      toToken,
      fromAmount: out.value,
      toAmount: inc.value,
      protocol: "Unknown", // Will be set by protocol filter or left as Unknown
    };
  }

  /**
   * Parse ERC20 Transfer log into structured transfer data
   * @param log Log entry from transaction receipt
   * @returns Parsed transfer with token address, from/to addresses, value, and logIndex
   */
  private parseTransferLog(log: {
    address: string;
    topics: string[];
    data: string;
    logIndex: number;
  }): ParsedTransfer {
    // topics[1] = from (bytes32, address is last 20 bytes)
    // topics[2] = to (bytes32, address is last 20 bytes)
    // data = amount (uint256)
    const from = "0x" + (log.topics[1]?.slice(26) ?? "");
    const to = "0x" + (log.topics[2]?.slice(26) ?? "");

    // Parse raw uint256 value from data
    const value = log.data && log.data !== "0x" ? BigInt(log.data) : BigInt(0);

    return {
      tokenAddress: log.address.toLowerCase(),
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      value,
      logIndex: log.logIndex,
    };
  }

  /**
   * Detect swap from transaction receipt logs using deterministic logIndex ordering
   * Uses ERC20 Transfer events sorted by execution order to identify from/to tokens
   *
   * For multi-hop swaps (A -> B -> C), this correctly identifies:
   * - First outbound transfer as input token (A)
   * - Last inbound transfer as output token (C)
   *
   * @param receipt Transaction receipt with logs
   * @param walletAddress Wallet address being monitored
   * @param tokenDecimals Map of token address to decimals for amount conversion
   * @returns Detected swap or null if not a swap pattern
   */
  private detectSwapFromReceiptLogs(
    receipt: TransactionReceipt,
    walletAddress: string,
    tokenDecimals: Map<string, number>,
  ): DetectedSwap | null {
    const wallet = walletAddress.toLowerCase();

    // Parse ERC20 Transfer events from logs, sorted by logIndex (deterministic execution order)
    const transfers = receipt.logs
      .filter((log) => log.topics[0] === ERC20_TRANSFER_TOPIC)
      .sort((a, b) => a.logIndex - b.logIndex)
      .map((log) => this.parseTransferLog(log));

    // Find first outbound (FROM wallet) and last inbound (TO wallet)
    // First outbound = input token, Last inbound = output token (handles multi-hop)
    const outbound = transfers.find((t) => t.from === wallet);
    const inbound = [...transfers].reverse().find((t) => t.to === wallet);

    if (!outbound || !inbound) {
      return null;
    }

    // Convert BigInt values to numbers with proper decimals
    const fromDecimals = tokenDecimals.get(outbound.tokenAddress) ?? 18;
    const toDecimals = tokenDecimals.get(inbound.tokenAddress) ?? 18;

    const fromAmount = Number(outbound.value) / Math.pow(10, fromDecimals);
    const toAmount = Number(inbound.value) / Math.pow(10, toDecimals);

    // Validate: reject 0-value swaps as invalid
    if (fromAmount === 0) {
      this.logger.warn(
        {
          txHash: receipt.transactionHash,
          fromToken: outbound.tokenAddress,
          transferCount: transfers.length,
        },
        "[RpcSpotProvider] Detected swap with 0 outbound value - skipping",
      );
      return null;
    }

    return {
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      timestamp: new Date(), // Will be set from transfer metadata by caller
      fromToken: outbound.tokenAddress,
      toToken: inbound.tokenAddress,
      fromAmount,
      toAmount,
      protocol: "Unknown",
    };
  }

  /**
   * Quick check if transaction might be a swap (has both outbound and inbound transfers)
   * Used as pre-filter before fetching receipt for accurate detection
   * @param transfers Transfers from getAssetTransfers
   * @param walletAddress Wallet address being monitored
   * @returns True if transaction has both directions (potential swap)
   */
  private isSwapCandidate(
    transfers: Transfer[],
    walletAddress: string,
  ): boolean {
    const wallet = walletAddress.toLowerCase();
    const hasOutbound = transfers.some((t) => t.from === wallet);
    const hasInbound = transfers.some((t) => t.to === wallet);
    return hasOutbound && hasInbound;
  }

  /**
   * Check if transfers include native ETH
   * Used to determine whether to fallback to transfer-based detection
   * Native ETH swaps (ETH→ERC20 or ERC20→ETH) have EXTERNAL transfers that don't emit ERC20 logs
   * Native transfers have null/undefined rawContract.address
   * @param transfers Transfers from getAssetTransfers
   * @returns True if any transfer is a native ETH transfer
   */
  private hasNativeEthTransfer(transfers: Transfer[]): boolean {
    return transfers.some(
      (t) =>
        // Native transfers (EXTERNAL/INTERNAL category) have null rawContract.address
        !t.rawContract?.address,
    );
  }

  /**
   * Check protocol filter using already-fetched receipt
   * Avoids duplicate RPC calls when receipt is already available
   * @param receipt Transaction receipt
   * @param txTo Transaction target address
   * @param chainFilters Protocol filters for this chain
   * @returns Filter result with allowed flag and protocol name if matched
   */
  private checkProtocolFilterWithReceipt(
    receipt: TransactionReceipt,
    txTo: string | undefined,
    chainFilters: ProtocolFilter[],
  ): { allowed: boolean; protocol?: string } {
    if (!txTo) {
      return { allowed: false };
    }

    for (const filter of chainFilters) {
      if (txTo.toLowerCase() !== filter.routerAddress.toLowerCase()) {
        continue;
      }

      const hasSwapEvent = receipt.logs.some(
        (log) => log.topics[0] === filter.swapEventSignature,
      );

      if (hasSwapEvent) {
        this.logger.debug(
          {
            txHash: receipt.transactionHash,
            protocol: filter.protocol,
          },
          `[RpcSpotProvider] Swap matched protocol (receipt reuse)`,
        );
        return { allowed: true, protocol: filter.protocol };
      }
    }

    return { allowed: false };
  }

  /**
   * Enrich swap with gas data from already-fetched receipt
   * Avoids duplicate receipt fetch when used with receipt-based detection
   * @param swap Detected swap
   * @param receipt Transaction receipt
   * @param chain Chain where swap occurred
   * @returns Complete OnChainTrade with gas data
   */
  private enrichSwapFromReceipt(
    swap: DetectedSwap,
    receipt: TransactionReceipt,
    chain: SpecificChain,
  ): OnChainTrade {
    return {
      txHash: swap.txHash,
      blockNumber: swap.blockNumber,
      timestamp: swap.timestamp,
      chain,
      fromToken: swap.fromToken,
      toToken: swap.toToken,
      fromAmount: swap.fromAmount,
      toAmount: swap.toAmount,
      protocol: swap.protocol,
      gasUsed: Number(receipt.gasUsed),
      gasPrice: Number(receipt.effectiveGasPrice),
      gasCostUsd: undefined,
    };
  }

  /**
   * Two-layer protocol filtering (chain-specific)
   * Layer 1: Router address check (fast rejection)
   * Layer 2: Swap event signature verification (validation)
   * @param txHash Transaction hash to check
   * @param chain Chain where transaction occurred
   * @param chainFilters Protocol filters for this chain
   * @returns Filter result with allowed flag and protocol name if matched
   */
  private async checkProtocolFilter(
    txHash: string,
    chain: SpecificChain,
    chainFilters: ProtocolFilter[],
  ): Promise<{ allowed: boolean; protocol?: string }> {
    try {
      // Fetch transaction and receipt in parallel
      const [tx, receipt] = await Promise.all([
        this.rpcProvider.getTransaction(txHash, chain),
        this.rpcProvider.getTransactionReceipt(txHash, chain),
      ]);

      if (!tx || !receipt) {
        this.logger.debug(
          {
            txHash,
            chain,
          },
          `[RpcSpotProvider] Could not fetch tx/receipt`,
        );
        return { allowed: false };
      }

      // Check each protocol filter for this chain
      for (const filter of chainFilters) {
        // Layer 1: Router address check (fast)
        if (!tx.to) {
          continue;
        }

        if (tx.to.toLowerCase() !== filter.routerAddress.toLowerCase()) {
          continue; // Try next filter
        }

        // Layer 2: Verify Swap event signature in logs
        const hasSwapEvent = receipt.logs.some(
          (log) => log.topics[0] === filter.swapEventSignature,
        );

        if (hasSwapEvent) {
          this.logger.debug(
            {
              txHash,
              protocol: filter.protocol,
            },
            `[RpcSpotProvider] Swap matched protocol`,
          );
          return { allowed: true, protocol: filter.protocol };
        }
      }

      // No filters matched - reject
      return { allowed: false };
    } catch (error) {
      // Capture exception with context
      Sentry.captureException(error, {
        extra: {
          txHash,
          chain,
          method: "checkProtocolFilter",
        },
      });

      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          txHash,
          chain,
        },
        `[RpcSpotProvider] Error checking protocol filter`,
      );
      return { allowed: false };
    }
  }

  /**
   * Enrich detected swap with gas cost data from transaction receipt
   * @param swap Detected swap from transfer pattern
   * @param chain Chain where swap occurred
   * @returns Complete OnChainTrade with gas data, or null if transaction failed/reverted
   */
  private async enrichSwapWithGasData(
    swap: DetectedSwap,
    chain: SpecificChain,
  ): Promise<OnChainTrade | null> {
    let gasUsed = 0;
    let gasPrice = 0;
    let gasCostUsd: number | undefined;

    try {
      const receipt = await this.rpcProvider.getTransactionReceipt(
        swap.txHash,
        chain,
      );

      if (receipt) {
        // Check transaction status - true = success, false = failure/reverted
        // While getAssetTransfers typically only returns successful transfers,
        // this is a defensive check to ensure we don't include reverted swaps
        if (!receipt.status) {
          this.logger.debug(
            {
              txHash: swap.txHash,
              chain,
            },
            `[RpcSpotProvider] Skipping reverted/failed transaction`,
          );
          return null;
        }

        gasUsed = Number(receipt.gasUsed);
        gasPrice = Number(receipt.effectiveGasPrice);

        // Gas cost in wei - can be converted to USD later with ETH price
        // Leave gasCostUsd as undefined for now - calculated by service layer if needed
        gasCostUsd = undefined;
      }
    } catch (error) {
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          txHash: swap.txHash,
        },
        `[RpcSpotProvider] Could not fetch gas data for trade`,
      );
    }

    return {
      txHash: swap.txHash,
      blockNumber: swap.blockNumber,
      timestamp: swap.timestamp,
      chain,
      fromToken: swap.fromToken,
      toToken: swap.toToken,
      fromAmount: swap.fromAmount,
      toAmount: swap.toAmount,
      protocol: swap.protocol,
      gasUsed,
      gasPrice,
      gasCostUsd,
    };
  }

  /**
   * Classify a transfer as deposit, withdraw, or transfer
   * @param transfer Transfer object
   * @param walletAddress Wallet address being monitored
   * @returns Transfer type classification
   */
  private classifyTransfer(
    transfer: Transfer,
    walletAddress: string,
  ): "deposit" | "withdraw" | "transfer" {
    const wallet = walletAddress.toLowerCase();

    if (transfer.to === wallet) {
      return "deposit";
    }

    if (transfer.from === wallet) {
      return "withdraw";
    }

    return "transfer";
  }

  /**
   * Convert date to approximate block number
   * Uses current block and estimates blocks per second for the chain
   * @param date Date to convert
   * @param chain Chain to estimate block for
   * @returns Estimated block number
   */
  private async dateToBlockNumber(
    date: Date,
    chain: SpecificChain,
  ): Promise<number> {
    const now = new Date();
    const secondsAgo = (now.getTime() - date.getTime()) / 1000;

    // Get current block number
    const currentBlock = await this.rpcProvider.getBlockNumber(chain);

    // Estimate blocks per second by chain
    const blocksPerSecond = this.getBlocksPerSecond(chain);
    const blocksAgo = Math.floor(secondsAgo * blocksPerSecond);

    const estimatedBlock = Math.max(0, currentBlock - blocksAgo);

    this.logger.debug(
      {
        chain,
        date: date.toISOString(),
        estimatedBlock,
      },
      `[RpcSpotProvider] Estimated block for date`,
    );

    return estimatedBlock;
  }

  /**
   * Get estimated blocks per second for a chain
   * These are approximate values for block estimation
   * @param chain Chain identifier
   * @returns Blocks per second estimate
   */
  private getBlocksPerSecond(chain: SpecificChain): number {
    const blockTimes: Record<string, number> = {
      eth: 12, // ~12 seconds per block
      base: 2, // ~2 seconds per block
      arbitrum: 0.25, // ~0.25 seconds per block (4 blocks/sec)
      optimism: 2, // ~2 seconds per block
      polygon: 2, // ~2 seconds per block
      avalanche: 2, // ~2 seconds per block
      bsc: 3, // ~3 seconds per block
      linea: 3, // ~3 seconds per block
      zksync: 1, // ~1 second per block
      scroll: 3, // ~3 seconds per block
      mantle: 3, // ~3 seconds per block
    };

    const blockTime = blockTimes[chain] || 12; // Default to Ethereum timing
    return 1 / blockTime;
  }

  /**
   * Mask wallet address for privacy in logs
   * @param address Wallet address to mask
   * @returns Masked address (first 6 + last 4 characters)
   */
  private maskAddress(address: string): string {
    if (!address || address.length < 10) {
      return address;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}
