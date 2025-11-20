import * as Sentry from "@sentry/node";
import { AssetTransfersWithMetadataResult } from "alchemy-sdk";
import { Logger } from "pino";

import { SpecificChain } from "../../types/index.js";
import { IRpcProvider } from "../../types/rpc.js";
import {
  ISpotLiveDataProvider,
  OnChainTrade,
  ProtocolFilter,
  SpotTransfer,
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
   * Get all trades for a wallet since a given time
   * Detects swaps from transfer patterns and applies protocol filtering if configured
   * @param walletAddress Wallet address to monitor
   * @param since Start time or block number for scanning
   * @param chains Array of chains to scan
   * @returns Array of detected on-chain trades
   */
  async getTradesSince(
    walletAddress: string,
    since: Date | number,
    chains: SpecificChain[],
  ): Promise<OnChainTrade[]> {
    const startTime = Date.now();
    const maskedAddress = this.maskAddress(walletAddress);

    // Validate inputs
    if (chains.length === 0) {
      this.logger.warn(
        `[RpcSpotProvider] No chains provided for trade scanning`,
      );
      return [];
    }

    const firstChain = chains[0];
    if (!firstChain) {
      this.logger.warn(`[RpcSpotProvider] Empty chains array`);
      return [];
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

    for (const chain of chains) {
      try {
        // Fetch all transfers with pagination support
        // Alchemy limits responses to 1000 results per request
        const allTransfers: AssetTransfersWithMetadataResult[] = [];
        let pageKey: string | undefined;

        do {
          const transfersResponse = await this.rpcProvider.getAssetTransfers(
            walletAddress,
            chain,
            sinceBlock,
            pageKey || "latest",
          );

          allTransfers.push(...transfersResponse.transfers);
          pageKey = transfersResponse.pageKey;

          if (pageKey) {
            this.logger.debug(
              {
                chain,
                currentCount: allTransfers.length,
              },
              `[RpcSpotProvider] Fetching next page of transfers`,
            );
          }
        } while (pageKey);

        this.logger.debug(
          {
            chain,
            totalTransfers: allTransfers.length,
          },
          `[RpcSpotProvider] Fetched all transfers`,
        );

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
        for (const [txHash, txTransfers] of transfersByTx) {
          const swap = this.detectSwapPattern(txTransfers, walletAddress);
          if (!swap) {
            continue;
          }

          // Apply protocol filter if configured for this chain
          if (hasFilters) {
            const filterResult = await this.checkProtocolFilter(
              txHash,
              chain,
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

          // Transform to OnChainTrade format
          const trade = await this.enrichSwapWithGasData(swap, chain);
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
      },
      `[RpcSpotProvider] Detected swaps`,
    );

    return allTrades;
  }

  /**
   * Get transfer history for self-funding detection
   * Returns deposits/withdrawals (not swaps)
   * @param walletAddress Wallet address to monitor
   * @param since Start date for transfer scanning
   * @param chains Array of chains to scan
   * @returns Array of deposits/withdrawals
   */
  async getTransferHistory(
    walletAddress: string,
    since: Date | number,
    chains: SpecificChain[],
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
        // Fetch all transfers with pagination support
        // Alchemy limits responses to 1000 results per request
        const chainTransfers: AssetTransfersWithMetadataResult[] = [];
        let pageKey: string | undefined;

        do {
          const transfersResponse = await this.rpcProvider.getAssetTransfers(
            walletAddress,
            chain,
            sinceBlock,
            pageKey || "latest",
          );

          chainTransfers.push(...transfersResponse.transfers);
          pageKey = transfersResponse.pageKey;

          if (pageKey) {
            this.logger.debug(
              {
                chain,
                currentCount: chainTransfers.length,
              },
              `[RpcSpotProvider] Fetching next page of transfers`,
            );
          }
        } while (pageKey);

        this.logger.debug(
          {
            chain,
            totalTransfers: chainTransfers.length,
          },
          `[RpcSpotProvider] Fetched all transfers for transfer history`,
        );

        // Group by transaction to identify swaps (which we want to exclude)
        const transfersByTx = this.groupTransfersByTransaction(chainTransfers);

        // Only include transactions that are NOT swaps (deposits/withdrawals)
        for (const [, txTransfers] of transfersByTx) {
          const isSwap = this.detectSwapPattern(txTransfers, walletAddress);

          if (!isSwap) {
            // Not a swap - these are deposits/withdrawals
            for (const transfer of txTransfers) {
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
   * Get token address from transfer with fallback logic
   * @param transfer Transfer object from Alchemy
   * @returns Token address (contract address or asset symbol)
   */
  private getTokenAddress(transfer: Transfer): string {
    if (transfer.rawContract?.address) {
      return transfer.rawContract.address;
    }

    if (transfer.asset) {
      return transfer.asset;
    }

    // Default to ETH for native transfers
    return "ETH";
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
      const normalizedTransfer: Transfer = {
        from: transfer.from.toLowerCase(),
        to: transfer.to ? transfer.to.toLowerCase() : "",
        value: Number(transfer.value) || 0,
        asset: transfer.asset || "ETH",
        hash: transfer.hash,
        blockNum: transfer.blockNum,
        metadata: transfer.metadata,
        rawContract: transfer.rawContract,
      };

      const existing = byTx.get(transfer.hash);
      if (existing) {
        existing.push(normalizedTransfer);
      } else {
        byTx.set(transfer.hash, [normalizedTransfer]);
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
   * @returns Complete OnChainTrade with gas data
   */
  private async enrichSwapWithGasData(
    swap: DetectedSwap,
    chain: SpecificChain,
  ): Promise<OnChainTrade> {
    let gasUsed = 0;
    let gasPrice = 0;
    let gasCostUsd: number | undefined;

    try {
      const receipt = await this.rpcProvider.getTransactionReceipt(
        swap.txHash,
        chain,
      );

      if (receipt) {
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
