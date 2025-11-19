import { randomUUID } from "crypto";
import { Logger } from "pino";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { SpotLiveRepository } from "@recallnet/db/repositories/spot-live";
import { TradeRepository } from "@recallnet/db/repositories/trade";
import type { InsertTrade } from "@recallnet/db/schema/trading/types";

import { PortfolioSnapshotterService } from "./portfolio-snapshotter.service.js";
import { PriceTrackerService } from "./price-tracker.service.js";
import { SpotLiveProviderFactory } from "./providers/spot-live-provider.factory.js";
import {
  PriceReport,
  SpecificChain,
  getBlockchainType,
} from "./types/index.js";
import type {
  AgentSpotSyncResult,
  BatchSpotSyncResult,
  FailedSpotAgentSync,
  ISpotLiveDataProvider,
  OnChainTrade,
  SpotCompetitionProcessingResult,
  SpotLiveProviderConfig,
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
  private portfolioSnapshotter: PortfolioSnapshotterService;
  private priceTracker: PriceTrackerService;
  private logger: Logger;

  constructor(
    agentRepo: AgentRepository,
    competitionRepo: CompetitionRepository,
    spotLiveRepo: SpotLiveRepository,
    tradeRepo: TradeRepository,
    portfolioSnapshotter: PortfolioSnapshotterService,
    priceTracker: PriceTrackerService,
    logger: Logger,
  ) {
    this.agentRepo = agentRepo;
    this.competitionRepo = competitionRepo;
    this.spotLiveRepo = spotLiveRepo;
    this.tradeRepo = tradeRepo;
    this.portfolioSnapshotter = portfolioSnapshotter;
    this.priceTracker = priceTracker;
    this.logger = logger;
  }

  /**
   * Type guard to validate jsonb data is a valid SpotLiveProviderConfig
   */
  private isValidProviderConfig(
    config: unknown,
  ): config is SpotLiveProviderConfig {
    if (!config || typeof config !== "object" || config === null) {
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
    const specificChain = trade.chain as SpecificChain;
    const blockchainType = getBlockchainType(specificChain);
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
      price: trade.toAmount / trade.fromAmount,
      tradeAmountUsd,
      success: true,
      reason: "On-chain trade detected",
      fromChain: blockchainType,
      toChain: blockchainType,
      fromSpecificChain: specificChain,
      toSpecificChain: specificChain,
      tradeType: "spot_live",
      txHash: trade.txHash,
      blockNumber: trade.blockNumber,
      protocol: trade.protocol,
      gasUsed: trade.gasUsed.toString(),
      gasPrice: trade.gasPrice.toString(),
      gasCostUsd: trade.gasCostUsd?.toString() || null,
    };
  }

  /**
   * Extract unique tokens from trades for bulk price fetching
   */
  private extractUniqueTokens(
    trades: OnChainTrade[],
  ): Array<{ address: string; chain: SpecificChain }> {
    const uniqueTokensMap = new Map<string, SpecificChain>();

    for (const trade of trades) {
      const chain = trade.chain as SpecificChain;
      uniqueTokensMap.set(trade.fromToken.toLowerCase(), chain);
      uniqueTokensMap.set(trade.toToken.toLowerCase(), chain);
    }

    return Array.from(uniqueTokensMap.entries()).map(([address, chain]) => ({
      address,
      chain,
    }));
  }

  /**
   * Fetch prices for all tokens in trades
   * @returns Map of lowercase token address to price report
   */
  private async fetchPricesForTrades(
    tokens: Array<{ address: string; chain: SpecificChain }>,
  ): Promise<Map<string, PriceReport>> {
    const priceMap = new Map<string, PriceReport>();

    for (const { address, chain } of tokens) {
      try {
        const blockchainType = getBlockchainType(chain);
        const price = await this.priceTracker.getPrice(
          address,
          blockchainType,
          chain,
        );

        if (price) {
          priceMap.set(address.toLowerCase(), price);
        }
      } catch (error) {
        this.logger.warn(
          `[SpotDataProcessor] Failed to fetch price for token ${address} on ${chain}: ${error}`,
        );
        // Continue - will be filtered out
      }
    }

    return priceMap;
  }

  /**
   * Process data for a single agent
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @param walletAddress Agent's wallet address
   * @param provider The spot live data provider
   * @param allowedTokens Map of chain to Set of allowed token addresses
   * @param tokenWhitelistEnabled Whether token filtering is enabled
   * @param lastSyncTime Last time this agent was synced
   * @returns Processing result
   */
  async processAgentData(
    agentId: string,
    competitionId: string,
    walletAddress: string,
    provider: ISpotLiveDataProvider,
    allowedTokens: Map<string, Set<string>>,
    tokenWhitelistEnabled: boolean,
    chains: string[],
    lastSyncTime: Date,
  ): Promise<AgentSpotSyncResult> {
    if (!provider) {
      throw new Error("[SpotDataProcessor] Provider is required");
    }

    const startTime = Date.now();

    try {
      this.logger.info(
        `[SpotDataProcessor] Processing agent ${agentId} for competition ${competitionId}`,
      );

      // 1. Fetch trades from provider
      const onChainTrades = await provider.getTradesSince(
        walletAddress,
        lastSyncTime,
        chains,
      );

      this.logger.debug(
        `[SpotDataProcessor] Fetched ${onChainTrades.length} on-chain trades for agent ${agentId}`,
      );

      if (onChainTrades.length === 0) {
        return {
          agentId,
          tradesProcessed: 0,
          balancesUpdated: 0,
          violationsDetected: 0,
        };
      }

      // 2. Filter by token whitelist (service layer responsibility)
      const whitelistedTrades: OnChainTrade[] = [];
      const rejectedTrades: RejectedTrade[] = [];

      for (const trade of onChainTrades) {
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

      if (whitelistedTrades.length === 0) {
        return {
          agentId,
          tradesProcessed: 0,
          balancesUpdated: 0,
          violationsDetected: 0,
        };
      }

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
        const fromPrice = priceMap.get(trade.fromToken.toLowerCase());
        const toPrice = priceMap.get(trade.toToken.toLowerCase());

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
      let tradesCreated = 0;
      let balancesUpdated = 0;

      if (priceableTrades.length > 0) {
        const result =
          await this.tradeRepo.batchCreateTradesWithBalances(priceableTrades);

        tradesCreated = result.successful.length;
        balancesUpdated = result.successful.reduce(
          (sum, r) => sum + (r.updatedBalances.toTokenBalance ? 2 : 1),
          0,
        );

        if (result.failed.length > 0) {
          this.logger.warn(
            `[SpotDataProcessor] ${result.failed.length} trades failed to create for agent ${agentId}`,
          );
        }
      }

      // 6. Fetch and save transfer history (optional, depends on provider)
      let transfersRecorded = 0;
      if (provider.getTransferHistory) {
        try {
          const transfers = await provider.getTransferHistory(
            walletAddress,
            lastSyncTime,
            chains,
          );

          if (transfers.length > 0) {
            // Extract unique tokens from transfers
            const uniqueTransferTokens = transfers.reduce((acc, t) => {
              const chain = t.chain as SpecificChain;
              acc.set(t.tokenAddress.toLowerCase(), chain);
              return acc;
            }, new Map<string, SpecificChain>());

            const transferTokensList = Array.from(
              uniqueTransferTokens.entries(),
            ).map(([address, chain]) => ({ address, chain }));

            // Fetch prices for unique transfer tokens (best effort)
            const transferPriceMap =
              await this.fetchPricesForTrades(transferTokensList);

            // Enrich transfers with price data
            const enrichedTransferRecords = transfers.map((t) => {
              const price = transferPriceMap.get(t.tokenAddress.toLowerCase());
              const tokenSymbol = price?.symbol ?? "UNKNOWN";
              const amountUsd = price
                ? (t.amount * price.price).toString()
                : null;

              return {
                agentId,
                competitionId,
                type: t.type,
                specificChain: t.chain,
                tokenAddress: t.tokenAddress,
                tokenSymbol,
                amount: t.amount.toString(),
                amountUsd,
                fromAddress: t.from,
                toAddress: t.to,
                txHash: t.txHash,
                blockNumber: 0, // Transfer doesn't include block number
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
    chains: string[],
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
    chains: string[],
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

      if (!competition.startDate) {
        throw new Error(
          `Competition ${competitionId} has no start date, cannot process spot live data`,
        );
      }

      if (competition.startDate > new Date()) {
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

      // Transform protocol records to provider format (chain → specificChain)
      const protocols = protocolRecords.map((p) => ({
        protocol: p.protocol,
        chain: p.specificChain,
        routerAddress: p.routerAddress,
        swapEventSignature: p.swapEventSignature,
        factoryAddress: p.factoryAddress,
      }));

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
        competition.startDate,
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

      // 7. Run monitoring if configured (future: SpotLiveMonitoringService)
      let monitoringResult;
      if (!skipMonitoring && spotLiveConfig.selfFundingThresholdUsd) {
        this.logger.debug(
          `[SpotDataProcessor] Self-funding monitoring not yet implemented`,
        );
        // TODO: Implement in Phase 3.2
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
