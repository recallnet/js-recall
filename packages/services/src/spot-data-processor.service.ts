import { randomUUID } from "crypto";
import { Logger } from "pino";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { BalanceRepository } from "@recallnet/db/repositories/balance";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { SpotLiveRepository } from "@recallnet/db/repositories/spot-live";
import { TradeRepository } from "@recallnet/db/repositories/trade";
import { SpecificChainSchema } from "@recallnet/db/repositories/types";
import type {
  InsertSpotLiveTransferHistory,
  InsertTrade,
} from "@recallnet/db/schema/trading/types";

import {
  NATIVE_TOKEN_ADDRESS,
  getNativeTokenSymbol,
  getTokenAddressForPriceLookup,
  getWrappedNativeAddress,
  isNativeToken,
} from "./lib/config-utils.js";
import { PortfolioSnapshotterService } from "./portfolio-snapshotter.service.js";
import { PriceTrackerService } from "./price-tracker.service.js";
import { SpotLiveProviderFactory } from "./providers/spot-live-provider.factory.js";
import { SpotLiveMonitoringService } from "./spot-live-monitoring.service.js";
import {
  PriceReport,
  SpecificChain,
  getBlockchainType,
} from "./types/index.js";
import type { IRpcProvider } from "./types/rpc.js";
import type {
  AgentSpotSyncResult,
  BatchSpotSyncResult,
  FailedSpotAgentSync,
  ISpotLiveDataProvider,
  OnChainTrade,
  SpotCompetitionProcessingResult,
  SpotLiveProviderConfig,
  SpotTransfer,
} from "./types/spot-live.js";

/**
 * Rejected trade with reason
 */
interface RejectedTrade {
  trade: OnChainTrade;
  reason: string;
}

/**
 * Provider-agnostic processor for spot live trading data
 * Orchestrates fetching on-chain trades and storing in database
 */
export class SpotDataProcessor {
  private agentRepo: AgentRepository;
  private competitionRepo: CompetitionRepository;
  private spotLiveRepo: SpotLiveRepository;
  private tradeRepo: TradeRepository;
  private balanceRepo: BalanceRepository;
  private portfolioSnapshotter: PortfolioSnapshotterService;
  private priceTracker: PriceTrackerService;
  private logger: Logger;

  private mockRpcProvider?: IRpcProvider;

  constructor(
    agentRepo: AgentRepository,
    competitionRepo: CompetitionRepository,
    spotLiveRepo: SpotLiveRepository,
    tradeRepo: TradeRepository,
    balanceRepo: BalanceRepository,
    portfolioSnapshotter: PortfolioSnapshotterService,
    priceTracker: PriceTrackerService,
    logger: Logger,
    mockRpcProvider?: IRpcProvider,
  ) {
    this.agentRepo = agentRepo;
    this.competitionRepo = competitionRepo;
    this.spotLiveRepo = spotLiveRepo;
    this.tradeRepo = tradeRepo;
    this.balanceRepo = balanceRepo;
    this.portfolioSnapshotter = portfolioSnapshotter;
    this.priceTracker = priceTracker;
    this.logger = logger;
    this.mockRpcProvider = mockRpcProvider;
  }

  /**
   * Type guard to validate jsonb data is a valid SpotLiveProviderConfig
   */
  private isValidProviderConfig(
    config: unknown,
  ): config is SpotLiveProviderConfig {
    if (typeof config !== "object" || config === null) {
      return false;
    }

    if (
      !("type" in config) ||
      typeof config.type !== "string" ||
      !["rpc_direct", "envio_indexing", "hybrid"].includes(config.type)
    ) {
      return false;
    }

    if (!("chains" in config) || !Array.isArray(config.chains)) {
      return false;
    }

    // Validate each chain value using database SpecificChainSchema
    for (const chain of config.chains) {
      const result = SpecificChainSchema.safeParse(chain);
      if (!result.success) {
        return false;
      }
    }

    return true;
  }

  /**
   * Transform on-chain trade to database insert format WITH price data
   */
  private transformTradeToDb(
    trade: OnChainTrade,
    agentId: string,
    competitionId: string,
    fromPrice: PriceReport,
    toPrice: PriceReport,
  ): InsertTrade {
    const blockchainType = getBlockchainType(trade.chain);
    const tradeAmountUsd = trade.fromAmount * fromPrice.price;

    return {
      id: randomUUID(),
      agentId,
      competitionId,
      timestamp: trade.timestamp,
      fromToken: trade.fromToken,
      toToken: trade.toToken,
      fromAmount: trade.fromAmount,
      toAmount: trade.toAmount,
      fromTokenSymbol: fromPrice.symbol,
      toTokenSymbol: toPrice.symbol,
      price: trade.fromAmount === 0 ? 0 : trade.toAmount / trade.fromAmount,
      tradeAmountUsd,
      success: true,
      reason: "On-chain trade detected",
      fromChain: blockchainType,
      toChain: blockchainType,
      fromSpecificChain: trade.chain,
      toSpecificChain: trade.chain,
      tradeType: "spot_live",
      txHash: trade.txHash,
      blockNumber: trade.blockNumber,
      protocol: trade.protocol,
      gasUsed: trade.gasUsed.toString(),
      gasPrice: trade.gasPrice.toString(),
      gasCostUsd: trade.gasCostUsd?.toString() ?? null,
    };
  }

  /**
   * Initialize agent balances from blockchain during first sync
   * Applies same constraints as trade processing: chain filter, token whitelist, price availability
   */
  private async initializeAgentBalancesFromBlockchain(
    agentId: string,
    competitionId: string,
    walletAddress: string,
    provider: ISpotLiveDataProvider,
    chains: SpecificChain[],
    allowedTokens: Map<string, Set<string>>,
    tokenWhitelistEnabled: boolean,
  ): Promise<void> {
    try {
      // 1. Fetch token balances from all enabled chains
      const allTokenBalances: Array<{
        chain: SpecificChain;
        tokenAddress: string;
        balance: string;
      }> = [];

      for (const chain of chains) {
        // Fetch ERC20 token balances
        const balances = await provider.getTokenBalances?.(
          walletAddress,
          chain,
        );
        if (balances) {
          for (const b of balances) {
            allTokenBalances.push({
              chain,
              tokenAddress: b.contractAddress.toLowerCase(),
              balance: b.balance,
            });
          }
        }

        // Fetch native token balance (ETH, MATIC, etc.)
        if (provider.getNativeBalance) {
          try {
            const nativeBalance = await provider.getNativeBalance(
              walletAddress,
              chain,
            );
            // Only add if balance is non-zero
            if (nativeBalance && nativeBalance !== "0") {
              allTokenBalances.push({
                chain,
                tokenAddress: NATIVE_TOKEN_ADDRESS,
                balance: nativeBalance,
              });
              this.logger.debug(
                `[SpotDataProcessor] Found native balance ${nativeBalance} wei on ${chain}`,
              );
            }
          } catch (nativeError) {
            this.logger.warn(
              {
                error:
                  nativeError instanceof Error
                    ? nativeError.message
                    : String(nativeError),
                chain,
              },
              `[SpotDataProcessor] Failed to fetch native balance for chain ${chain}`,
            );
          }
        }
      }

      this.logger.debug(
        `[SpotDataProcessor] Fetched ${allTokenBalances.length} token balances from blockchain`,
      );

      // 2. Filter by token whitelist if enabled
      const filteredBalances = tokenWhitelistEnabled
        ? allTokenBalances.filter((b) => {
            const chainTokens = allowedTokens.get(b.chain);
            return chainTokens?.has(b.tokenAddress);
          })
        : allTokenBalances;

      if (
        tokenWhitelistEnabled &&
        filteredBalances.length < allTokenBalances.length
      ) {
        this.logger.debug(
          `[SpotDataProcessor] Token whitelist filtered ${allTokenBalances.length} → ${filteredBalances.length} balances`,
        );
      }

      if (filteredBalances.length === 0) {
        this.logger.info(
          `[SpotDataProcessor] No token balances to initialize for agent ${agentId}`,
        );
        return;
      }

      // 3. Fetch prices for all tokens
      // Map native token addresses (zero address) to WETH for price lookup
      const tokenPriceRequests = filteredBalances.map((b) => ({
        tokenAddress: getTokenAddressForPriceLookup(b.tokenAddress, b.chain),
        specificChain: b.chain,
      }));

      const priceMap =
        await this.priceTracker.getBulkPrices(tokenPriceRequests);

      // 4. Only create balances for tokens that can be priced
      const balanceRecordsToInsert: Array<{
        tokenAddress: string;
        chain: SpecificChain;
        amount: number;
        symbol: string;
      }> = [];

      for (const b of filteredBalances) {
        // Use mapped address for price lookup (WETH for native tokens)
        const lookupAddress = getTokenAddressForPriceLookup(
          b.tokenAddress,
          b.chain,
        );
        const priceKey = `${lookupAddress}:${b.chain}`;
        const price = priceMap.get(priceKey);

        if (!price) {
          this.logger.debug(
            `[SpotDataProcessor] Skipping balance for unpriceable token ${b.tokenAddress} on ${b.chain}`,
          );
          continue;
        }

        // Check if this is a native token (zero address)
        const isNative = b.tokenAddress === NATIVE_TOKEN_ADDRESS;

        // Get token decimals for proper parsing
        // Native tokens always use 18 decimals (ETH, MATIC, etc.)
        let decimals = 18;
        if (!isNative) {
          const tokenDecimals = await provider.getTokenDecimals?.(
            b.tokenAddress,
            b.chain,
          );
          decimals = tokenDecimals ?? 18;
        }
        const decimalsPower = Math.pow(10, decimals);

        // Parse balance as decimal string (provider normalizes all formats to decimal)
        // BigInt handles large numbers safely before converting to Number
        const balanceNum = Number(BigInt(b.balance)) / decimalsPower;

        // Use native symbol (ETH, MATIC) for native tokens, otherwise use price symbol
        const symbol = isNative ? getNativeTokenSymbol(b.chain) : price.symbol;

        balanceRecordsToInsert.push({
          tokenAddress: b.tokenAddress,
          chain: b.chain,
          amount: balanceNum,
          symbol,
        });
      }

      this.logger.info(
        `[SpotDataProcessor] Creating ${balanceRecordsToInsert.length} initial balance records for agent ${agentId}`,
      );

      // 5. Create balance records in database with proper chain info
      if (balanceRecordsToInsert.length > 0) {
        await this.balanceRepo.createInitialSpotLiveBalances(
          agentId,
          competitionId,
          balanceRecordsToInsert,
        );
      }
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          agentId,
        },
        `[SpotDataProcessor] Error initializing balances from blockchain`,
      );
      // Don't throw - allow competition to start even if balance init fails
    }
  }

  /**
   * Extract unique tokens from trades for bulk price fetching
   */
  private extractUniqueTokens(
    trades: OnChainTrade[],
  ): Array<{ address: string; chain: SpecificChain }> {
    const uniqueTokensMap = new Map<string, SpecificChain>();

    for (const trade of trades) {
      const chain = trade.chain;
      uniqueTokensMap.set(trade.fromToken.toLowerCase(), chain);
      uniqueTokensMap.set(trade.toToken.toLowerCase(), chain);
    }

    return Array.from(uniqueTokensMap.entries()).map(([address, chain]) => ({
      address,
      chain,
    }));
  }

  /**
   * Fetch prices for all tokens using bulk price API
   * Maps native token addresses (zero address) to WETH for price lookup
   * @returns Map of "address:chain" key to price report (keyed by ORIGINAL address)
   */
  private async fetchPricesForTrades(
    tokens: Array<{ address: string; chain: SpecificChain }>,
  ): Promise<Map<string, PriceReport>> {
    const priceMap = new Map<string, PriceReport>();

    if (tokens.length === 0) {
      return priceMap;
    }

    // Transform to TokenPriceRequest format for bulk API
    // Map native token addresses (zero address) to WETH for price lookup
    const priceRequests = tokens.map((t) => ({
      tokenAddress: getTokenAddressForPriceLookup(t.address, t.chain),
      specificChain: t.chain,
    }));

    // Use bulk price API (batches up to 30 tokens per request)
    const bulkPriceMap = await this.priceTracker.getBulkPrices(priceRequests);

    // Transform results to use "address:chain" keying
    // Key by ORIGINAL address so callers can look up by the address they know
    let successCount = 0;
    let failCount = 0;

    for (const { address, chain } of tokens) {
      // Look up price using the mapped address (WETH for native)
      const lookupAddress = getTokenAddressForPriceLookup(address, chain);
      const lookupKey = `${lookupAddress.toLowerCase()}:${chain}`;
      const price = bulkPriceMap.get(lookupKey);

      if (price) {
        // Store using ORIGINAL address so callers can find it
        const originalKey = `${address.toLowerCase()}:${chain}`;
        priceMap.set(originalKey, price);
        successCount++;
      } else {
        failCount++;
      }
    }

    this.logger.debug(
      `[SpotDataProcessor] Bulk price fetch complete: ${successCount}/${tokens.length} tokens priced` +
        (failCount > 0 ? `, ${failCount} failed` : ""),
    );

    return priceMap;
  }

  /**
   * Process data for a single agent
   *
   * Gap Prevention Strategy:
   * This method uses incremental block-based syncing with overlapping scans to guarantee
   * no missed transactions even when partial failures occur.
   *
   * How it works:
   * 1. Query latest processed block number per chain from trades table
   * 2. Sync from latestBlock (with overlap), NOT latestBlock+1
   * 3. Unique constraint (txHash, competitionId, agentId) prevents duplicates
   * 4. Duplicate check BEFORE balance updates (efficient)
   *
   * Why overlap prevents gaps:
   * - Block 1000: [Trade A ✅, Trade B ❌, Trade C ✅] - B fails, A & C succeed
   * - MAX(block_number) = 1000 (from A or C)
   * - Next sync from block 1000 (overlap) → Retries B ✅
   * - Duplicates from A & C are caught by duplicate check (no balance impact)
   *
   * Cost vs Safety:
   * - Overhead: ~1 block worth of duplicate checks per sync (minimal)
   * - Benefit: Zero transaction gaps, automatic retry of failures
   *
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @param walletAddress Agent's wallet address
   * @param provider The spot live data provider
   * @param allowedTokens Map of chain to Set of allowed token addresses
   * @param tokenWhitelistEnabled Whether token filtering is enabled
   * @param chains Array of chains to scan
   * @param competitionStartDate Competition start date (fallback for first sync)
   * @returns Processing result
   */
  async processAgentData(
    agentId: string,
    competitionId: string,
    walletAddress: string,
    provider: ISpotLiveDataProvider,
    allowedTokens: Map<string, Set<string>>,
    tokenWhitelistEnabled: boolean,
    chains: SpecificChain[],
    competitionStartDate: Date,
  ): Promise<AgentSpotSyncResult> {
    if (!provider) {
      throw new Error("[SpotDataProcessor] Provider is required");
    }

    const startTime = Date.now();

    try {
      // Note: Transfer cache is NOT cleared per-agent because:
      // 1. Cache keys are wallet-specific (walletAddress:chain:block)
      // 2. Agents are processed concurrently - clearing would wipe other agents' data
      // 3. Provider is ephemeral (created/discarded per competition sync)

      this.logger.info(
        `[SpotDataProcessor] Processing agent ${agentId} for competition ${competitionId}`,
      );

      // 0. Initialize token balances if this is the first sync
      // Check if agent has any existing balances for this competition
      const existingBalances = await this.balanceRepo.getAgentBalances(
        agentId,
        competitionId,
      );

      if (existingBalances.length === 0 && provider.getTokenBalances) {
        this.logger.info(
          `[SpotDataProcessor] First sync for agent ${agentId} - initializing token balances from blockchain`,
        );

        await this.initializeAgentBalancesFromBlockchain(
          agentId,
          competitionId,
          walletAddress,
          provider,
          chains,
          allowedTokens,
          tokenWhitelistEnabled,
        );

        // Return early after balance initialization
        // Current blockchain balances already reflect all past trading activity
        // Subsequent syncs will process NEW swaps incrementally
        this.logger.info(
          `[SpotDataProcessor] Completed initial balance setup for agent ${agentId} - skipping historical trade processing`,
        );

        return {
          agentId,
          tradesProcessed: 0,
          balancesUpdated: 0,
          violationsDetected: 0,
        };
      }

      // 1. Determine sync start point per chain for incremental processing
      // Uses sync state + bounded overlap for gap-free syncing with retry capability
      const allTrades: OnChainTrade[] = [];
      const syncStateUpdates: Array<{
        chain: SpecificChain;
        highestBlock: number;
      }> = [];

      const RETRY_WINDOW_BLOCKS = 10; // Retry last 10 blocks for transient failures

      for (const chain of chains) {
        // Query sync state (highest block SCANNED, regardless of success/failure)
        let lastScannedBlock = await this.spotLiveRepo.getAgentSyncState(
          agentId,
          competitionId,
          chain,
        );

        // Fallback: If sync state unavailable, use highest SAVED block from trades
        if (lastScannedBlock === null) {
          lastScannedBlock = await this.tradeRepo.getLatestSpotLiveTradeBlock(
            agentId,
            competitionId,
            chain,
          );
        }

        let since: Date | number;

        if (lastScannedBlock !== null) {
          // Bounded overlap: Retry last N blocks for transient failures
          // Example: lastScanned=1000 → scan from 991 (retry 991-1000, scan new 1001+)
          // This handles: Price API temporarily down, network blips, rate limits
          // Sync state prevents infinite loops by always moving forward
          since = Math.max(lastScannedBlock - (RETRY_WINDOW_BLOCKS - 1), 0);

          this.logger.debug(
            `[SpotDataProcessor] Agent ${agentId} on ${chain}: incremental sync from block ${since} (retry window: ${RETRY_WINDOW_BLOCKS} blocks)`,
          );
        } else {
          // First sync - use competition start date
          since = competitionStartDate;

          this.logger.debug(
            `[SpotDataProcessor] Agent ${agentId} on ${chain}: first sync from competition start`,
          );
        }

        // Fetch trades for this chain only (per-chain incremental sync)
        const tradesResult = await provider.getTradesSince(
          walletAddress,
          since,
          [chain], // Single chain per request
        );

        const chainTrades = tradesResult.trades;
        allTrades.push(...chainTrades);

        // Determine safe highest block for sync state
        // If any transactions were skipped due to missing receipts, don't advance past them
        let safeHighestBlock: number;

        if (chainTrades.length > 0) {
          const highestBlockSeen = Math.max(
            ...chainTrades.map((t) => t.blockNumber),
          );

          // Limit to lowest skipped block - 1 to ensure retry
          if (tradesResult.lowestSkippedBlock !== undefined) {
            safeHighestBlock = Math.min(
              highestBlockSeen,
              tradesResult.lowestSkippedBlock - 1,
            );
            this.logger.warn(
              `[SpotDataProcessor] Agent ${agentId} on ${chain}: limiting sync state to block ${safeHighestBlock} due to skipped transaction at block ${tradesResult.lowestSkippedBlock}`,
            );
          } else {
            safeHighestBlock = highestBlockSeen;
          }

          syncStateUpdates.push({ chain, highestBlock: safeHighestBlock });

          this.logger.debug(
            `[SpotDataProcessor] Fetched ${chainTrades.length} trades for agent ${agentId} on ${chain}, sync state: ${safeHighestBlock}`,
          );
        } else {
          // No trades found - still need to update state to move forward
          // Get current chain tip to know what range we scanned
          const currentBlock = await provider.getCurrentBlock(chain);

          // Limit to lowest skipped block - 1 to ensure retry
          if (tradesResult.lowestSkippedBlock !== undefined) {
            safeHighestBlock = Math.min(
              currentBlock,
              tradesResult.lowestSkippedBlock - 1,
            );
            this.logger.warn(
              `[SpotDataProcessor] Agent ${agentId} on ${chain}: limiting sync state to block ${safeHighestBlock} due to skipped transaction at block ${tradesResult.lowestSkippedBlock}`,
            );
          } else {
            safeHighestBlock = currentBlock;
          }

          syncStateUpdates.push({ chain, highestBlock: safeHighestBlock });

          this.logger.debug(
            `[SpotDataProcessor] No trades for agent ${agentId} on ${chain}, sync state: ${safeHighestBlock}`,
          );
        }
      }

      this.logger.debug(
        `[SpotDataProcessor] Fetched ${allTrades.length} total on-chain trades for agent ${agentId} across ${chains.length} chains`,
      );

      // Update sync state BEFORE continuing
      // This ensures we move forward even if all trades are filtered/rejected
      // Parallel updates are safe with GREATEST() - database handles conflicts
      await Promise.all(
        syncStateUpdates.map(({ chain, highestBlock }) =>
          this.spotLiveRepo.upsertAgentSyncState(
            agentId,
            competitionId,
            chain,
            highestBlock,
          ),
        ),
      );

      // Don't return early if no trades - we still need to check for transfer violations!

      // 2. Process trades if any were found
      let tradesCreated = 0;
      let balancesUpdated = 0;

      if (allTrades.length > 0) {
        // Filter by token whitelist (service layer responsibility)
        const whitelistedTrades: OnChainTrade[] = [];
        const rejectedTrades: RejectedTrade[] = [];

        for (const trade of allTrades) {
          // Continue with whitelist filtering
          if (tokenWhitelistEnabled) {
            const chainTokens = allowedTokens.get(trade.chain);

            if (
              !chainTokens?.has(trade.fromToken.toLowerCase()) ||
              !chainTokens?.has(trade.toToken.toLowerCase())
            ) {
              rejectedTrades.push({
                trade,
                reason: "Token not whitelisted",
              });
              continue;
            }
          }

          whitelistedTrades.push(trade);
        }

        if (rejectedTrades.length > 0) {
          this.logger.warn(
            `[SpotDataProcessor] Rejected ${rejectedTrades.length} trades for agent ${agentId} due to token whitelist`,
          );
        }

        if (whitelistedTrades.length > 0) {
          // 3. Extract unique tokens and fetch prices
          const uniqueTokens = this.extractUniqueTokens(whitelistedTrades);
          this.logger.debug(
            `[SpotDataProcessor] Fetching prices for ${uniqueTokens.length} unique tokens`,
          );

          const priceMap = await this.fetchPricesForTrades(uniqueTokens);

          // 4. Filter trades by price availability - only insert complete data
          const priceableTrades: InsertTrade[] = [];
          const unpriceableTrades: RejectedTrade[] = [];

          for (const trade of whitelistedTrades) {
            // Key by address:chain for multi-chain support
            const fromPriceKey = `${trade.fromToken.toLowerCase()}:${trade.chain}`;
            const toPriceKey = `${trade.toToken.toLowerCase()}:${trade.chain}`;
            const fromPrice = priceMap.get(fromPriceKey);
            const toPrice = priceMap.get(toPriceKey);

            if (!fromPrice || !toPrice) {
              unpriceableTrades.push({
                trade,
                reason:
                  `Cannot price tokens: ${!fromPrice ? trade.fromToken : ""} ${!toPrice ? trade.toToken : ""}`.trim(),
              });
              continue;
            }

            priceableTrades.push(
              this.transformTradeToDb(
                trade,
                agentId,
                competitionId,
                fromPrice,
                toPrice,
              ),
            );
          }

          if (unpriceableTrades.length > 0) {
            this.logger.error(
              `[SpotDataProcessor] CRITICAL: ${unpriceableTrades.length} trades cannot be priced for agent ${agentId}. ` +
                `These trades will be LOST. Tokens: ${unpriceableTrades.map((r) => r.reason).join(", ")}`,
            );
          }

          // 5. Batch create trades with balance updates (only complete trades)
          if (priceableTrades.length > 0) {
            const result =
              await this.tradeRepo.batchCreateTradesWithBalances(
                priceableTrades,
              );

            tradesCreated = result.successful.length;
            balancesUpdated = result.successful.reduce(
              (sum, r) => sum + (r.updatedBalances.toTokenBalance ? 2 : 1),
              0,
            );

            if (result.failed.length > 0) {
              this.logger.warn(
                {
                  agentId,
                  failedCount: result.failed.length,
                  errors: result.failed.map((f) => ({
                    hash: f.trade.txHash,
                    error: f.error.message,
                  })),
                },
                `[SpotDataProcessor] ${result.failed.length} trades failed to create for agent ${agentId}`,
              );
            }
          }
        }
      }

      // 6. Fetch and save transfer history (optional, depends on provider)
      // Use incremental sync for transfers too (same pattern as trades)
      let transfersRecorded = 0;
      if (provider.getTransferHistory) {
        try {
          // Determine sync start point per chain for transfers (same as trades)
          const allTransfers: SpotTransfer[] = [];

          for (const chain of chains) {
            // Use SAME sync state as trades (both come from getAssetTransfers)
            // This enables caching and simplifies state tracking
            let lastScannedBlock = await this.spotLiveRepo.getAgentSyncState(
              agentId,
              competitionId,
              chain,
            );

            // Fallback: If sync state unavailable, use highest SAVED block from trades
            if (lastScannedBlock === null) {
              lastScannedBlock =
                await this.tradeRepo.getLatestSpotLiveTradeBlock(
                  agentId,
                  competitionId,
                  chain,
                );
            }

            let since: Date | number;

            if (lastScannedBlock !== null) {
              // Use same overlap logic as trades
              since = Math.max(lastScannedBlock - (RETRY_WINDOW_BLOCKS - 1), 0);
              this.logger.debug(
                `[SpotDataProcessor] Agent ${agentId} on ${chain}: transfer sync from block ${since} (shared state with trades)`,
              );
            } else {
              // First sync: from competition start
              since = competitionStartDate;
              this.logger.debug(
                `[SpotDataProcessor] Agent ${agentId} on ${chain}: first transfer sync from competition start`,
              );
            }

            // Fetch transfers for this chain only
            const chainTransfers = await provider.getTransferHistory(
              walletAddress,
              since,
              [chain],
            );

            allTransfers.push(...chainTransfers);
          }

          if (allTransfers.length > 0) {
            // Extract unique tokens from transfers
            const uniqueTransferTokens = allTransfers.reduce((acc, t) => {
              acc.set(t.tokenAddress.toLowerCase(), t.chain);
              return acc;
            }, new Map<string, SpecificChain>());

            const transferTokensList: Array<{
              address: string;
              chain: SpecificChain;
            }> = Array.from(uniqueTransferTokens.entries()).map(
              ([address, chain]) => ({ address, chain }),
            );

            // Fetch prices for unique transfer tokens (best effort)
            const transferPriceMap =
              await this.fetchPricesForTrades(transferTokensList);

            // Enrich transfers with price data
            const enrichedTransferRecords: InsertSpotLiveTransferHistory[] =
              allTransfers.map((t): InsertSpotLiveTransferHistory => {
                // Key by address:chain for multi-chain support
                const priceKey = `${t.tokenAddress.toLowerCase()}:${t.chain}`;
                const price = transferPriceMap.get(priceKey);
                // Use native token symbol for native tokens (zero address), not the price API's wrapped symbol
                const tokenSymbol = isNativeToken(t.tokenAddress)
                  ? getNativeTokenSymbol(t.chain)
                  : (price?.symbol ?? "UNKNOWN");
                const amountUsd = price
                  ? (t.amount * price.price).toString()
                  : null;

                return {
                  agentId,
                  competitionId,
                  type: t.type,
                  specificChain: t.chain, // Already typed as SpecificChain from SpotTransfer
                  tokenAddress: t.tokenAddress,
                  tokenSymbol,
                  amount: t.amount.toString(),
                  amountUsd,
                  fromAddress: t.from,
                  toAddress: t.to,
                  txHash: t.txHash,
                  blockNumber: t.blockNumber,
                  transferTimestamp: t.timestamp,
                };
              });

            const savedTransfers =
              await this.spotLiveRepo.batchSaveSpotLiveTransfers(
                enrichedTransferRecords,
              );
            transfersRecorded = savedTransfers.length;

            if (transfersRecorded > 0) {
              const unpricedCount = enrichedTransferRecords.filter(
                (t) => t.tokenSymbol === "UNKNOWN",
              ).length;
              const warningMsg =
                `[SpotDataProcessor] Recorded ${transfersRecorded} transfers for agent ${agentId} (potential violations)` +
                (unpricedCount > 0
                  ? `. ${unpricedCount} transfers could not be priced`
                  : "");

              this.logger.warn(warningMsg);
            }
          }
        } catch (error) {
          this.logger.warn(
            `[SpotDataProcessor] Failed to fetch transfer history for agent ${agentId}: ${error}`,
          );
          // Continue processing - transfers are audit only
        }
      }

      const processingTime = Date.now() - startTime;

      this.logger.info(
        `[SpotDataProcessor] Processed agent ${agentId}: ` +
          `trades=${tradesCreated}, ` +
          `transfers=${transfersRecorded}, ` +
          `syncStateUpdates=${syncStateUpdates.length}, ` +
          `time=${processingTime}ms`,
      );

      return {
        agentId,
        tradesProcessed: tradesCreated,
        balancesUpdated,
        violationsDetected: transfersRecorded,
      };
    } catch (error) {
      this.logger.error(
        `[SpotDataProcessor] Error processing agent ${agentId}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Process data for multiple agents in batch
   * @param agents Array of agent data to process
   * @param competitionId Competition ID
   * @param provider The spot live data provider
   * @param allowedTokens Map of chain to allowed token addresses
   * @param tokenWhitelistEnabled Whether token filtering is enabled
   * @param chains Array of enabled chains
   * @param competitionStartDate Competition start date for sync baseline
   * @returns Batch processing results
   */
  async processBatchAgentData(
    agents: Array<{ agentId: string; walletAddress: string }>,
    competitionId: string,
    provider: ISpotLiveDataProvider,
    allowedTokens: Map<string, Set<string>>,
    tokenWhitelistEnabled: boolean,
    chains: SpecificChain[],
    competitionStartDate: Date,
  ): Promise<BatchSpotSyncResult> {
    if (!provider) {
      throw new Error("[SpotDataProcessor] Provider is required");
    }

    const startTime = Date.now();

    this.logger.info(
      `[SpotDataProcessor] Starting batch processing for ${agents.length} agents`,
    );

    try {
      const PROVIDER_BATCH_SIZE = 10;
      const successful: AgentSpotSyncResult[] = [];
      const failed: FailedSpotAgentSync[] = [];

      for (let i = 0; i < agents.length; i += PROVIDER_BATCH_SIZE) {
        const batch = agents.slice(i, i + PROVIDER_BATCH_SIZE);

        this.logger.debug(
          `[SpotDataProcessor] Processing batch ${Math.floor(i / PROVIDER_BATCH_SIZE) + 1}/${Math.ceil(agents.length / PROVIDER_BATCH_SIZE)} ` +
            `(agents ${i + 1}-${Math.min(i + batch.length, agents.length)} of ${agents.length})`,
        );

        const batchPromises = batch.map(async ({ agentId, walletAddress }) => {
          return this.processAgentData(
            agentId,
            competitionId,
            walletAddress,
            provider,
            allowedTokens,
            tokenWhitelistEnabled,
            chains,
            competitionStartDate, // Use competition start as baseline for first sync
          );
        });

        const batchResults = await Promise.allSettled(batchPromises);

        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          const agent = batch[j];

          if (!result || !agent) continue;

          if (result.status === "fulfilled") {
            successful.push(result.value);
          } else {
            const error =
              result.reason instanceof Error
                ? result.reason
                : new Error(String(result.reason));

            failed.push({ agentId: agent.agentId, error: error.message });

            this.logger.error(
              `[SpotDataProcessor] Failed to process agent ${agent.agentId}: ${error.message}`,
            );
          }
        }
      }

      const processingTime = Date.now() - startTime;

      this.logger.info(
        `[SpotDataProcessor] Batch processing completed: ` +
          `${successful.length} successful, ` +
          `${failed.length} failed, ` +
          `time=${processingTime}ms`,
      );

      return { successful, failed };
    } catch (error) {
      this.logger.error(
        `[SpotDataProcessor] Batch processing failed: ${error}`,
      );

      return {
        successful: [],
        failed: agents.map(({ agentId }) => ({
          agentId,
          error: error instanceof Error ? error.message : String(error),
        })),
      };
    }
  }

  /**
   * Process all agents in a competition
   * @param competitionId Competition ID
   * @param provider The spot live data provider
   * @param allowedTokens Map of chain to allowed token addresses
   * @param tokenWhitelistEnabled Whether token filtering is enabled
   * @param chains Array of enabled chains
   * @param competitionStartDate Competition start date
   * @returns Batch processing results
   */
  async processCompetitionAgents(
    competitionId: string,
    provider: ISpotLiveDataProvider,
    allowedTokens: Map<string, Set<string>>,
    tokenWhitelistEnabled: boolean,
    chains: SpecificChain[],
    competitionStartDate: Date,
  ): Promise<BatchSpotSyncResult> {
    if (!provider) {
      throw new Error("[SpotDataProcessor] Provider is required");
    }

    this.logger.info(
      `[SpotDataProcessor] Processing all agents for competition ${competitionId}`,
    );

    const agentIds =
      await this.competitionRepo.getCompetitionAgents(competitionId);

    if (agentIds.length === 0) {
      this.logger.info(
        `[SpotDataProcessor] No agents found for competition ${competitionId}`,
      );

      return {
        successful: [],
        failed: [],
      };
    }

    const agents = await this.agentRepo.findByIds(agentIds);

    const agentData = agents
      .filter(
        (agent): agent is typeof agent & { walletAddress: string } =>
          agent.walletAddress !== null,
      )
      .map((agent) => ({
        agentId: agent.id,
        walletAddress: agent.walletAddress,
      }));

    if (agentData.length < agents.length) {
      const missingCount = agents.length - agentData.length;
      this.logger.warn(
        `[SpotDataProcessor] ${missingCount} agents have no wallet address and will be skipped`,
      );
    }

    return this.processBatchAgentData(
      agentData,
      competitionId,
      provider,
      allowedTokens,
      tokenWhitelistEnabled,
      chains,
      competitionStartDate,
    );
  }

  /**
   * High-level orchestration method for spot live competitions
   * Handles data sync and portfolio snapshots
   * @param competitionId Competition ID
   * @param skipMonitoring Optional flag to skip self-funding monitoring
   * @returns Combined results from sync
   */
  async processSpotLiveCompetition(
    competitionId: string,
    skipMonitoring: boolean = false,
  ): Promise<SpotCompetitionProcessingResult> {
    let syncResult: BatchSpotSyncResult = { successful: [], failed: [] };

    try {
      // 1. Get competition and config
      const [competition, spotLiveConfig] = await Promise.all([
        this.competitionRepo.findById(competitionId),
        this.spotLiveRepo.getSpotLiveCompetitionConfig(competitionId),
      ]);

      if (!competition) {
        throw new Error(`Competition ${competitionId} not found`);
      }

      if (!spotLiveConfig) {
        throw new Error(
          `No spot live configuration found for competition ${competitionId}`,
        );
      }

      if (competition.type !== "spot_live_trading") {
        throw new Error(
          `Competition ${competitionId} is not a spot live trading competition`,
        );
      }

      // For initial sync during startCompetition, start date may not be set yet
      // Use current time as fallback since we're about to activate the competition
      const competitionStartDate = competition.startDate || new Date();

      if (competition.startDate && competition.startDate > new Date()) {
        this.logger.warn(
          `[SpotDataProcessor] Competition ${competitionId} hasn't started yet (starts ${competition.startDate.toISOString()})`,
        );
        return { syncResult: { successful: [], failed: [] } };
      }

      // 2. Validate and extract provider config
      if (!spotLiveConfig.dataSourceConfig) {
        throw new Error(
          `No data source configuration found for competition ${competitionId}`,
        );
      }

      if (!this.isValidProviderConfig(spotLiveConfig.dataSourceConfig)) {
        throw new Error(
          `Invalid data source configuration for competition ${competitionId}`,
        );
      }

      // 3. Load protocol filters, chains, and token whitelist
      const [protocolRecords, chains, allowedTokens] = await Promise.all([
        this.spotLiveRepo.getAllowedProtocols(competitionId),
        this.spotLiveRepo.getEnabledChains(competitionId),
        this.spotLiveRepo.getAllowedTokenAddresses(competitionId),
      ]);

      // Transform protocol records to provider format
      // No casting needed - database schema properly types specificChain
      const protocols = protocolRecords.map((p) => ({
        protocol: p.protocol,
        chain: p.specificChain,
        routerAddress: p.routerAddress,
        swapEventSignature: p.swapEventSignature,
        factoryAddress: p.factoryAddress,
      }));

      // If whitelist includes wrapped native token, also allow native token (zero address)
      // Native ETH and WETH are economically equivalent - if WETH is whitelisted, native ETH should be tracked too
      for (const [chain, tokenSet] of allowedTokens.entries()) {
        const wrappedNative = getWrappedNativeAddress(chain);
        if (wrappedNative && tokenSet.has(wrappedNative.toLowerCase())) {
          tokenSet.add(NATIVE_TOKEN_ADDRESS.toLowerCase());
        }
      }

      const tokenWhitelistEnabled = allowedTokens.size > 0;

      this.logger.info(
        `[SpotDataProcessor] Loaded config: ` +
          `${protocols.length} protocol filters, ` +
          `${chains.length} chains, ` +
          `${allowedTokens.size} chain token whitelists, ` +
          `whitelist enabled=${tokenWhitelistEnabled}`,
      );

      // 4. Create provider with protocol filters
      const provider = SpotLiveProviderFactory.createProvider(
        spotLiveConfig.dataSourceConfig,
        protocols,
        this.logger,
        this.mockRpcProvider,
      );

      this.logger.info(
        `[SpotDataProcessor] Processing spot live competition ${competitionId} with provider ${provider.getName()}`,
      );

      // 5. Process all agents
      syncResult = await this.processCompetitionAgents(
        competitionId,
        provider,
        allowedTokens,
        tokenWhitelistEnabled,
        chains,
        competitionStartDate,
      );

      this.logger.info(
        `[SpotDataProcessor] Data sync complete: ${syncResult.successful.length} successful, ${syncResult.failed.length} failed`,
      );

      // 6. Create portfolio snapshots for all agents
      if (syncResult.successful.length > 0) {
        try {
          await this.portfolioSnapshotter.takePortfolioSnapshots(competitionId);
          this.logger.info(
            `[SpotDataProcessor] Portfolio snapshots updated for competition ${competitionId}`,
          );
        } catch (error) {
          this.logger.warn(
            `[SpotDataProcessor] Failed to create portfolio snapshots: ${error}`,
          );
          // Continue - snapshot failures shouldn't fail entire sync
        }
      }

      // 7. Run monitoring if configured
      let monitoringResult;
      if (
        !skipMonitoring &&
        spotLiveConfig.selfFundingThresholdUsd &&
        syncResult.successful.length > 0
      ) {
        this.logger.info(
          `[SpotDataProcessor] Running self-funding monitoring for competition ${competitionId}`,
        );

        const monitoring = new SpotLiveMonitoringService(
          this.spotLiveRepo,
          this.logger,
        );

        // Get agents to monitor (only successfully synced ones)
        const successfulAgentIds = new Set(
          syncResult.successful.map((r) => r.agentId),
        );

        const agentIds =
          await this.competitionRepo.getCompetitionAgents(competitionId);
        const agents = await this.agentRepo.findByIds(agentIds);

        const agentsToMonitor = agents
          .filter(
            (agent): agent is typeof agent & { walletAddress: string } =>
              agent.walletAddress !== null && successfulAgentIds.has(agent.id),
          )
          .map((agent) => ({
            agentId: agent.id,
            walletAddress: agent.walletAddress,
          }));

        const monitorResult = await monitoring.monitorAgents(
          agentsToMonitor,
          competitionId,
          competitionStartDate,
          competition.endDate,
        );

        monitoringResult = {
          agentsMonitored: monitorResult.successful.length,
          alertsCreated: monitorResult.totalAlertsCreated,
        };

        this.logger.info(
          `[SpotDataProcessor] Monitoring complete: ${monitoringResult.alertsCreated} alerts created`,
        );
      }

      return {
        syncResult,
        monitoringResult,
      };
    } catch (error) {
      this.logger.error(
        { error },
        `[SpotDataProcessor] Error processing spot live competition ${competitionId}:`,
      );

      return {
        syncResult,
      };
    }
  }

  /**
   * Get spot live competition configuration
   * @param competitionId Competition ID
   * @returns Competition configuration or null if not found
   */
  async getCompetitionConfig(competitionId: string) {
    return this.spotLiveRepo.getSpotLiveCompetitionConfig(competitionId);
  }

  /**
   * Validate competition is a spot live competition
   * @param competitionId Competition ID
   * @returns True if competition is configured for spot live
   */
  async isSpotLiveCompetition(competitionId: string): Promise<boolean> {
    const competition = await this.competitionRepo.findById(competitionId);

    if (!competition) {
      this.logger.warn(
        `[SpotDataProcessor] Competition ${competitionId} not found`,
      );
      return false;
    }

    return competition.type === "spot_live_trading";
  }
}
