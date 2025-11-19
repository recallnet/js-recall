import { Decimal } from "decimal.js";
import { Logger } from "pino";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import type {
  InsertPerpetualPosition,
  InsertPerpsAccountSummary,
} from "@recallnet/db/schema/trading/types";

import { PerpsMonitoringService } from "./perps-monitoring.service.js";
import { PerpsProviderFactory } from "./providers/perps-provider.factory.js";
import { RiskMetricsService } from "./risk-metrics.service.js";
import type {
  AgentPerpsSyncResult,
  BatchPerpsSyncResult,
  BatchPerpsSyncWithSummaries,
  CalmarRatioCalculationResult,
  IPerpsDataProvider,
  PerpsAccountSummary,
  PerpsCompetitionProcessingResult,
  PerpsCompetitionStats,
  PerpsPosition,
  PerpsProviderConfig,
  SuccessfulAgentSync,
} from "./types/perps.js";

// Configure Decimal.js for financial calculations
// Setting precision and rounding mode as suggested in the GitHub comment
Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  minE: -40,
  maxE: 40,
  toExpNeg: -40,
  toExpPos: 40,
});

/**
 * Provider-agnostic processor for perpetual futures data
 * Orchestrates fetching data from providers and storing in database
 */
export class PerpsDataProcessor {
  private riskMetricsService: RiskMetricsService;
  private agentRepo: AgentRepository;
  private competitionRepo: CompetitionRepository;
  private perpsRepo: PerpsRepository;
  private logger: Logger;

  constructor(
    riskMetricsService: RiskMetricsService,
    agentRepo: AgentRepository,
    competitionRepo: CompetitionRepository,
    perpsRepo: PerpsRepository,
    logger: Logger,
  ) {
    this.riskMetricsService = riskMetricsService;
    this.agentRepo = agentRepo;
    this.competitionRepo = competitionRepo;
    this.perpsRepo = perpsRepo;
    this.logger = logger;
  }

  /**
   * Transform provider position to database format
   */
  private transformPositionToDb(
    position: PerpsPosition,
    agentId: string,
    competitionId: string,
  ): InsertPerpetualPosition {
    return {
      agentId,
      competitionId,
      providerPositionId: position.providerPositionId || null,
      providerTradeId: position.providerTradeId || null,
      asset: position.symbol,
      isLong: position.side === "long",
      leverage: this.numberToString(position.leverage),
      positionSize: this.numberToString(position.positionSizeUsd) || "0",
      collateralAmount: this.numberToString(position.collateralAmount) || "0",
      entryPrice: this.numberToString(position.entryPrice) || "0",
      currentPrice: this.numberToString(position.currentPrice),
      liquidationPrice: this.numberToString(position.liquidationPrice),
      pnlUsdValue: this.numberToString(position.pnlUsdValue),
      pnlPercentage: this.numberToString(position.pnlPercentage),
      status: position.status,
      // Use provider's openedAt if available, otherwise DB will use current time on first insert
      createdAt: position.openedAt || new Date(),
      lastUpdatedAt: position.lastUpdatedAt || null,
      closedAt: position.closedAt || null,
    };
  }

  /**
   * Type guard to validate jsonb data is a valid PerpsProviderConfig
   */
  private isValidProviderConfig(
    config: unknown,
  ): config is PerpsProviderConfig {
    if (!config || typeof config !== "object" || config === null) {
      return false;
    }

    // Use 'in' operator for type narrowing instead of casting
    if (
      !("type" in config) ||
      typeof config.type !== "string" ||
      !["external_api", "onchain_indexing", "hybrid"].includes(config.type)
    ) {
      return false;
    }

    // For external_api type, provider field is expected
    if (
      config.type === "external_api" &&
      (!("provider" in config) || typeof config.provider !== "string")
    ) {
      return false;
    }

    return true;
  }

  /**
   * Convert number to string using Decimal.js for precise financial calculations
   */
  private numberToString(value: number | undefined | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    // Handle NaN explicitly - treat as null
    if (isNaN(value)) {
      return null;
    }
    // Handle zero explicitly
    if (value === 0) {
      return "0";
    }

    try {
      // Use Decimal.js for precise conversion
      const decimal = new Decimal(value);

      // Convert to fixed notation to avoid scientific notation
      // toFixed() in Decimal.js automatically handles precision
      // and removes unnecessary trailing zeros
      return decimal.toFixed();
    } catch (error) {
      // If Decimal.js can't handle it, log and return null
      this.logger.warn(
        { error },
        `[PerpsDataProcessor] Failed to convert number to string: ${value}`,
      );
      return null;
    }
  }

  /**
   * Transform provider account summary to database format
   */
  private transformAccountSummaryToDb(
    summary: PerpsAccountSummary,
    agentId: string,
    competitionId: string,
  ): InsertPerpsAccountSummary {
    return {
      agentId,
      competitionId,
      timestamp: new Date(),
      totalEquity: this.numberToString(summary.totalEquity) || "0",
      initialCapital: this.numberToString(summary.initialCapital) || "0",
      totalVolume: this.numberToString(summary.totalVolume),
      totalUnrealizedPnl: this.numberToString(summary.totalUnrealizedPnl),
      totalRealizedPnl: this.numberToString(summary.totalRealizedPnl),
      totalPnl: this.numberToString(summary.totalPnl),
      totalFeesPaid: this.numberToString(summary.totalFeesPaid),
      availableBalance: this.numberToString(summary.availableBalance),
      marginUsed: this.numberToString(summary.marginUsed),
      totalTrades: summary.totalTrades ?? null,
      openPositionsCount: summary.openPositionsCount ?? null,
      closedPositionsCount: summary.closedPositionsCount ?? null,
      liquidatedPositionsCount: summary.liquidatedPositionsCount ?? null,
      roi: this.numberToString(summary.roi),
      roiPercent: this.numberToString(summary.roiPercent),
      averageTradeSize: this.numberToString(summary.averageTradeSize),
      accountStatus: summary.accountStatus ?? undefined,
      rawData: summary.rawData ?? undefined,
    };
  }

  /**
   * Process data for a single agent in a competition
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @param walletAddress Agent's wallet address
   * @param provider The perps data provider to use
   * @returns Processing result with sync status
   */
  async processAgentData(
    agentId: string,
    competitionId: string,
    walletAddress: string,
    provider: IPerpsDataProvider,
  ): Promise<AgentPerpsSyncResult> {
    if (!provider) {
      throw new Error("[PerpsDataProcessor] Provider is required");
    }

    const startTime = Date.now();

    try {
      this.logger.info(
        `[PerpsDataProcessor] Processing agent ${agentId} for competition ${competitionId}`,
      );

      // 1. Check for existing snapshots to determine initial capital
      let initialCapital: number | undefined;
      try {
        const { first } = await this.competitionRepo.getFirstAndLastSnapshots(
          competitionId,
          agentId,
        );

        if (first) {
          const capitalValue = Number(first.totalValue);

          // Validate the conversion - protect against NaN or invalid values
          if (isFinite(capitalValue) && capitalValue >= 0) {
            initialCapital = capitalValue;
            this.logger.debug(
              `[PerpsDataProcessor] Found initial capital for agent ${agentId}: ${initialCapital}`,
            );
          } else {
            this.logger.warn(
              `[PerpsDataProcessor] Invalid initial capital value for agent ${agentId}: ${first.totalValue}, will use current equity`,
            );
            // Leave initialCapital as undefined to use provider's default
          }
        } else {
          this.logger.debug(
            `[PerpsDataProcessor] No existing snapshots for agent ${agentId}, will use current equity as initial`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `[PerpsDataProcessor] Error fetching initial capital for agent ${agentId}: ${error}`,
        );
        // Continue without initial capital - provider will use current equity
      }

      // 2. Fetch account data from provider
      // Use batch method if available
      let accountSummary: PerpsAccountSummary;
      let positions: PerpsPosition[];

      if (provider.getAccountDataBatch) {
        // Provider supports batch fetching - more efficient
        const batchResult = await provider.getAccountDataBatch(
          walletAddress,
          initialCapital,
        );
        accountSummary = batchResult.accountSummary;
        positions = batchResult.positions;

        this.logger.debug(
          `[PerpsDataProcessor] Used batch fetch for agent ${agentId}`,
        );
      } else {
        // Fall back to sequential fetching
        accountSummary = await provider.getAccountSummary(
          walletAddress,
          initialCapital,
        );
        positions = await provider.getPositions(walletAddress);
      }

      // 4. Transform to database format
      const dbPositions = positions.map((p) =>
        this.transformPositionToDb(p, agentId, competitionId),
      );
      const dbAccountSummary = this.transformAccountSummaryToDb(
        accountSummary,
        agentId,
        competitionId,
      );

      // 5. Store everything in a transaction
      const syncResult = await this.perpsRepo.syncAgentPerpsData(
        agentId,
        competitionId,
        dbPositions,
        dbAccountSummary,
      );

      // 6. Create portfolio snapshot for leaderboard
      // Use 0 if totalEquity is invalid (consistent with our transform logic)
      const snapshotValue =
        accountSummary.totalEquity != null && !isNaN(accountSummary.totalEquity)
          ? accountSummary.totalEquity
          : 0;
      await this.competitionRepo.createPortfolioSnapshot({
        agentId,
        competitionId,
        timestamp: new Date(),
        totalValue: snapshotValue,
      });

      const processingTime = Date.now() - startTime;

      this.logger.info(
        `[PerpsDataProcessor] Processed agent ${agentId}: ` +
          `equity=$${accountSummary.totalEquity?.toFixed(2) ?? "N/A"}, ` +
          `positions=${positions.length}, ` +
          `time=${processingTime}ms`,
      );

      return syncResult;
    } catch (error) {
      this.logger.error(
        `[PerpsDataProcessor] Error processing agent ${agentId}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Process data for multiple agents in batch
   * @param agents Array of agent data to process
   * @param competitionId Competition ID
   * @param provider The perps data provider to use
   * @returns Batch processing results with raw account summaries
   */
  async processBatchAgentData(
    agents: Array<{ agentId: string; walletAddress: string }>,
    competitionId: string,
    provider: IPerpsDataProvider,
  ): Promise<BatchPerpsSyncWithSummaries> {
    if (!provider) {
      throw new Error("[PerpsDataProcessor] Provider is required");
    }

    const startTime = Date.now();

    this.logger.info(
      `[PerpsDataProcessor] Starting batch processing for ${agents.length} agents`,
    );

    try {
      // Process provider API calls in controlled batches to avoid overwhelming the API
      // Each agent requires 2 API calls (summary + positions), and the provider has
      // a 100ms rate limit between requests. Processing in smaller batches ensures
      // we don't hit rate limits or timeout issues.
      const PROVIDER_BATCH_SIZE = 10; // Process 10 agents at a time (20 API calls)
      const syncDataArray = [];
      const fetchFailures: Array<{ agentId: string; error: Error }> = [];

      for (let i = 0; i < agents.length; i += PROVIDER_BATCH_SIZE) {
        const batch = agents.slice(i, i + PROVIDER_BATCH_SIZE);

        this.logger.debug(
          `[PerpsDataProcessor] Processing batch ${Math.floor(i / PROVIDER_BATCH_SIZE) + 1}/${Math.ceil(agents.length / PROVIDER_BATCH_SIZE)} ` +
            `(agents ${i + 1}-${Math.min(i + batch.length, agents.length)} of ${agents.length})`,
        );

        const batchPromises = batch.map(async ({ agentId, walletAddress }) => {
          // DECISION: Using Promise.all for account summary + positions because:
          // 1. These data points are tightly coupled for perpetual futures
          // 2. Partial data could lead to incorrect PnL calculations
          // 3. The Symphony provider has built-in retry logic (3 retries with exponential backoff)
          // 4. The outer Promise.allSettled provides per-agent resilience - if this agent fails,
          //    others will still be processed
          // Check for initial capital for this agent
          let initialCapital: number | undefined;
          try {
            const { first } =
              await this.competitionRepo.getFirstAndLastSnapshots(
                competitionId,
                agentId,
              );
            if (first) {
              const capitalValue = Number(first.totalValue);

              // Validate the conversion - protect against NaN or invalid values
              if (isFinite(capitalValue) && capitalValue >= 0) {
                initialCapital = capitalValue;
              } else {
                this.logger.warn(
                  `[PerpsDataProcessor] Invalid initial capital value for agent ${agentId}: ${first.totalValue}, will use current equity`,
                );
                // Leave initialCapital as undefined to use provider's default
              }
            }
          } catch {
            // Continue without initial capital
            this.logger.debug(
              `[PerpsDataProcessor] No initial capital found for agent ${agentId}`,
            );
          }

          const [accountSummary, positions] = await Promise.all([
            provider.getAccountSummary(walletAddress, initialCapital),
            provider.getPositions(walletAddress),
          ]);

          // Transform to database format
          const dbPositions = positions.map((p) =>
            this.transformPositionToDb(p, agentId, competitionId),
          );
          const dbAccountSummary = this.transformAccountSummaryToDb(
            accountSummary,
            agentId,
            competitionId,
          );

          return {
            agentId,
            competitionId,
            positions: dbPositions,
            accountSummary: dbAccountSummary,
            // Include raw account summary for monitoring to reuse
            rawAccountSummary: accountSummary,
          };
        });

        // DECISION: Using Promise.allSettled for batch agent processing because:
        // 1. One agent's failure should not prevent processing other agents
        // 2. We want to collect as much data as possible and report failures
        // 3. Competitions may have hundreds of agents - partial success is valuable
        // 4. Failed agents are tracked and reported separately in the result
        const batchResults = await Promise.allSettled(batchPromises);

        // Process results and separate successes from failures
        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          const agent = batch[j];

          // Safety check (should never happen, but TypeScript needs assurance)
          if (!result || !agent) continue;

          if (result.status === "fulfilled") {
            syncDataArray.push(result.value);
          } else {
            // Track the failure but continue processing other agents
            const error =
              result.reason instanceof Error
                ? result.reason
                : new Error(String(result.reason));

            fetchFailures.push({ agentId: agent.agentId, error });

            this.logger.error(
              `[PerpsDataProcessor] Failed to fetch data for agent ${agent.agentId}: ${error.message}`,
            );
          }
        }
      }

      // Build all needed data structures
      const rawAccountSummaries = new Map<string, PerpsAccountSummary>();
      const syncDataMap = new Map<string, (typeof syncDataArray)[0]>();
      const syncDataForDb = [];

      for (const data of syncDataArray) {
        // Store raw account summary for monitoring
        rawAccountSummaries.set(data.agentId, data.rawAccountSummary);

        // Store full data for portfolio snapshot creation (O(1) lookup later)
        syncDataMap.set(data.agentId, data);

        // Add DB data (without rawAccountSummary)
        syncDataForDb.push({
          agentId: data.agentId,
          competitionId: data.competitionId,
          positions: data.positions,
          accountSummary: data.accountSummary,
        });
      }

      // Batch sync all agent data
      const batchResult =
        await this.perpsRepo.batchSyncAgentsPerpsData(syncDataForDb);

      // Prepare portfolio snapshots for successful syncs
      const now = new Date();
      const snapshotsToCreate = batchResult.successful
        .map((r) => {
          const agentData = syncDataMap.get(r.agentId);
          if (!agentData) return null;

          // totalEquity string is guaranteed to be valid ("0" at minimum) due to transform
          // Use Decimal for precise parsing
          const totalEquity = new Decimal(
            agentData.accountSummary.totalEquity,
          ).toNumber();

          return {
            agentId: r.agentId,
            competitionId,
            timestamp: now,
            totalValue: totalEquity,
          };
        })
        .filter(
          (snapshot): snapshot is NonNullable<typeof snapshot> =>
            snapshot !== null,
        );

      // Batch create all portfolio snapshots at once
      if (snapshotsToCreate.length > 0) {
        try {
          await this.competitionRepo.batchCreatePortfolioSnapshots(
            snapshotsToCreate,
          );
          this.logger.debug(
            `[PerpsDataProcessor] Created ${snapshotsToCreate.length} portfolio snapshots`,
          );
        } catch (error) {
          this.logger.warn(
            `[PerpsDataProcessor] Failed to create portfolio snapshots: ${error}`,
          );
          // Continue processing - snapshot failures shouldn't fail the entire batch
        }
      }

      const processingTime = Date.now() - startTime;

      // Merge fetch failures with sync failures for complete error reporting
      const allFailures = [...fetchFailures, ...batchResult.failed];

      this.logger.info(
        `[PerpsDataProcessor] Batch processing completed: ` +
          `${batchResult.successful.length} successful, ` +
          `${allFailures.length} failed (${fetchFailures.length} fetch, ${batchResult.failed.length} sync), ` +
          `time=${processingTime}ms`,
      );

      return {
        successful: batchResult.successful,
        failed: allFailures,
        accountSummaries: rawAccountSummaries,
        agents,
      };
    } catch (error) {
      this.logger.error(
        `[PerpsDataProcessor] Batch processing failed: ${error}`,
      );

      // Return failure result for all agents
      return {
        successful: [],
        failed: agents.map(({ agentId }) => ({
          agentId,
          error: error instanceof Error ? error : new Error(String(error)),
        })),
        accountSummaries: new Map(),
        agents,
      };
    }
  }

  /**
   * Process all agents in a competition
   * @param competitionId Competition ID
   * @param provider The perps data provider to use
   * @returns Batch processing results with account summaries
   */
  async processCompetitionAgents(
    competitionId: string,
    provider: IPerpsDataProvider,
  ): Promise<BatchPerpsSyncWithSummaries> {
    if (!provider) {
      throw new Error("[PerpsDataProcessor] Provider is required");
    }

    this.logger.info(
      `[PerpsDataProcessor] Processing all agents for competition ${competitionId}`,
    );

    // Get competition agents
    const agentIds =
      await this.competitionRepo.getCompetitionAgents(competitionId);

    if (agentIds.length === 0) {
      this.logger.info(
        `[PerpsDataProcessor] No agents found for competition ${competitionId}`,
      );

      return {
        successful: [],
        failed: [],
        accountSummaries: new Map(),
        agents: [],
      };
    }

    // Fetch agent details
    const agents = await this.agentRepo.findByIds(agentIds);

    // Filter out agents without wallet addresses and map to required format
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
        `[PerpsDataProcessor] ${missingCount} agents have no wallet address and will be skipped`,
      );
    }

    return this.processBatchAgentData(agentData, competitionId, provider);
  }

  /**
   * Get competition configuration for perps
   * @param competitionId Competition ID
   * @returns Competition configuration or null if not found
   */
  async getCompetitionConfig(competitionId: string) {
    return this.perpsRepo.getPerpsCompetitionConfig(competitionId);
  }

  /**
   * Validate competition is a perps competition
   * @param competitionId Competition ID
   * @returns True if competition is configured for perps
   */
  async isPerpsCompetition(competitionId: string): Promise<boolean> {
    const competition = await this.competitionRepo.findById(competitionId);

    if (!competition) {
      this.logger.warn(
        `[PerpsDataProcessor] Competition ${competitionId} not found`,
      );
      return false;
    }

    return competition.type === "perpetual_futures";
  }

  /**
   * High-level orchestration method for perps competitions
   * Handles data sync and optional self-funding monitoring
   * @param competitionId Competition ID
   * @returns Combined results from sync and monitoring
   */
  async processPerpsCompetition(
    competitionId: string,
    skipMonitoring: boolean = false,
  ): Promise<PerpsCompetitionProcessingResult> {
    let syncResult: BatchPerpsSyncResult = { successful: [], failed: [] };

    try {
      // 1. Get competition and config
      // DECISION: Using Promise.all here because both are required for processing.
      // If either the competition or config is missing/fails, the entire process
      // should stop - there's no value in partial data at this level.
      const [competition, perpsConfig] = await Promise.all([
        this.competitionRepo.findById(competitionId),
        this.perpsRepo.getPerpsCompetitionConfig(competitionId),
      ]);

      if (!competition) {
        throw new Error(`Competition ${competitionId} not found`);
      }

      if (!perpsConfig) {
        throw new Error(
          `No perps configuration found for competition ${competitionId}`,
        );
      }

      if (competition.type !== "perpetual_futures") {
        throw new Error(
          `Competition ${competitionId} is not a perpetual futures competition`,
        );
      }

      // Parse self-funding threshold early for validation
      const earlyThreshold = perpsConfig.selfFundingThresholdUsd
        ? new Decimal(perpsConfig.selfFundingThresholdUsd).toNumber()
        : null;

      // Validate and extract competition start date (needed for monitoring)
      // Skip all monitoring-related checks during initial sync
      let competitionStartDate: Date | null = null;
      if (!skipMonitoring && this.shouldRunMonitoring(earlyThreshold)) {
        if (!competition.startDate) {
          throw new Error(
            `Competition ${competitionId} has no start date, cannot process perps data`,
          );
        }
        competitionStartDate = competition.startDate;

        if (competitionStartDate > new Date()) {
          this.logger.warn(
            `[PerpsDataProcessor] Competition ${competitionId} hasn't started yet (starts ${competitionStartDate.toISOString()})`,
          );
          // Skip processing for competitions that haven't started
          return {
            syncResult: {
              successful: [],
              failed: [],
            },
          };
        }
      }

      // 2. Validate and create provider
      if (!perpsConfig.dataSourceConfig) {
        throw new Error(
          `No data source configuration found for competition ${competitionId}`,
        );
      }

      if (!this.isValidProviderConfig(perpsConfig.dataSourceConfig)) {
        throw new Error(
          `Invalid data source configuration for competition ${competitionId}`,
        );
      }

      const provider = PerpsProviderFactory.createProvider(
        perpsConfig.dataSourceConfig,
        this.logger,
      );

      this.logger.info(
        `[PerpsDataProcessor] Processing perps competition ${competitionId} with provider ${provider.getName()}`,
      );

      // 3. Process all agents (filtering handled internally)
      const result = await this.processCompetitionAgents(
        competitionId,
        provider,
      );

      syncResult = result;
      const { accountSummaries, agents } = result;

      this.logger.info(
        `[PerpsDataProcessor] Data sync complete: ${syncResult.successful.length} successful, ${syncResult.failed.length} failed`,
      );

      // 4. Run monitoring if configured (reuse pre-fetched account summaries)
      let monitoringResult;

      // Use the threshold we already parsed earlier
      // Skip monitoring during initial sync
      if (
        !skipMonitoring &&
        this.shouldRunMonitoring(earlyThreshold) &&
        syncResult.successful.length > 0
      ) {
        this.logger.info(
          `[PerpsDataProcessor] Running self-funding monitoring for competition ${competitionId}`,
        );

        const monitoring = new PerpsMonitoringService(
          provider,
          this.perpsRepo,
          this.logger,
        );

        // Use agents from the result instead of fetching again
        const successfulAgentIds = new Set(
          syncResult.successful.map((r) => r.agentId),
        );

        // Filter agents to only include those that were successfully synced
        const agentsToMonitor = agents.filter((agent) =>
          successfulAgentIds.has(agent.agentId),
        );

        // competitionStartDate is guaranteed to be non-null here because:
        // 1. We only enter this block if shouldRunMonitoring() returns true
        // 2. We validated and set competitionStartDate when shouldRunMonitoring() was true earlier
        if (!competitionStartDate) {
          throw new Error(
            `Competition ${competitionId} start date validation failed unexpectedly`,
          );
        }

        // Use monitorAgentsWithData to pass pre-fetched summaries and config
        const monitorResult = await monitoring.monitorAgentsWithData(
          agentsToMonitor,
          accountSummaries,
          competitionId,
          competitionStartDate, // Now TypeScript knows this is non-null
          new Decimal(perpsConfig.initialCapital || "500").toNumber(),
          earlyThreshold ?? 0,
        );

        monitoringResult = {
          successful: monitorResult.successful.length,
          failed: monitorResult.failed.length,
          alertsCreated: monitorResult.totalAlertsCreated,
        };

        this.logger.info(
          `[PerpsDataProcessor] Monitoring complete: ${monitoringResult.alertsCreated} alerts created`,
        );
      }

      // 5. Calculate Calmar Ratio for ranking (only for active competitions with successful agents)
      let calmarRatioResult;
      if (competition.status === "active" && syncResult.successful.length > 0) {
        try {
          this.logger.info(
            `[PerpsDataProcessor] Calculating risk metrics (Calmar & Sortino) for ${syncResult.successful.length} agents`,
          );

          calmarRatioResult = await this.calculateCalmarRatiosForCompetition(
            competitionId,
            syncResult.successful,
          );

          this.logger.info(
            `[PerpsDataProcessor] Risk metrics calculations complete: ${calmarRatioResult.successful} successful, ${calmarRatioResult.failed} failed`,
          );
        } catch (error) {
          this.logger.error(
            { error },
            `[PerpsDataProcessor] Error calculating risk metrics:`,
          );
          // Don't fail the entire process if risk metrics calculation fails
          calmarRatioResult = {
            successful: 0,
            failed: syncResult.successful.length,
            errors: [error instanceof Error ? error.message : "Unknown error"],
          };
        }
      }

      return {
        syncResult,
        monitoringResult,
        calmarRatioResult,
      };
    } catch (error) {
      this.logger.error(
        { error },
        `[PerpsDataProcessor] Error processing perps competition ${competitionId}:`,
      );

      return {
        syncResult, // Return any partial results we have
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Determine if self-funding monitoring should run
   * @param threshold Parsed self-funding threshold value (null if not set)
   * @returns True if monitoring should run
   */
  private shouldRunMonitoring(threshold: number | null): boolean {
    return threshold !== null && !isNaN(threshold) && threshold >= 0;
  }

  /**
   * Calculate Calmar Ratios for all successful agents in a competition
   * Processes in batches with retry logic and circuit breaker monitoring
   * @param competitionId Competition ID
   * @param successfulAgents Agents that were successfully synced
   * @returns Summary of calculation results
   */
  private async calculateCalmarRatiosForCompetition(
    competitionId: string,
    successfulAgents: SuccessfulAgentSync[],
  ): Promise<CalmarRatioCalculationResult> {
    if (successfulAgents.length === 0) {
      return { successful: 0, failed: 0 };
    }

    const results: Required<CalmarRatioCalculationResult> = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    // Configuration
    const BATCH_SIZE = 10;
    const MAX_ERRORS_TO_STORE = 100; // Cap errors array to prevent memory issues
    const MAX_RETRIES = 3; // Max retries per agent (like portfolio snapshotter)

    // Separate thresholds for different failure patterns
    const BATCH_FAILURE_THRESHOLD = 0.8; // 80% - Individual batch concern
    const SYSTEMIC_FAILURE_THRESHOLD = 0.5; // 50% - System-wide alert (industry standard)

    let totalBatches = 0;
    let failedBatches = 0; // Batches with >= 80% failure rate

    for (let i = 0; i < successfulAgents.length; i += BATCH_SIZE) {
      const batch = successfulAgents.slice(i, i + BATCH_SIZE);
      totalBatches++;

      // Process batch with retries for each agent
      const batchResults = await this.processBatchWithRetries(
        batch,
        competitionId,
        MAX_RETRIES,
      );

      // Count successes and failures in this batch
      let batchFailures = 0;

      batchResults.forEach((result, idx) => {
        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
          batchFailures++;

          const agent = batch[idx];
          if (!agent) {
            this.logger.error(
              `[PerpsDataProcessor] Batch index mismatch at index ${idx}`,
            );
            return;
          }
          const errorMsg = `Agent ${agent.agentId}: ${result.error || "Unknown error"}`;

          // Only store first N errors to prevent memory issues
          if (results.errors.length < MAX_ERRORS_TO_STORE) {
            results.errors.push(errorMsg);
          } else if (results.errors.length === MAX_ERRORS_TO_STORE) {
            results.errors.push(
              `... and ${successfulAgents.length - i - batch.length} more errors`,
            );
          }
        }
      });

      // Monitor for batch and systemic failures with different thresholds
      const batchFailureRate = batchFailures / batch.length;

      // Check if this individual batch has high failure rate
      if (batchFailureRate >= BATCH_FAILURE_THRESHOLD) {
        failedBatches++;

        this.logger.warn(
          `[PerpsDataProcessor] Batch failure detected: ${batchFailures}/${batch.length} agents failed ` +
            `(${Math.round(batchFailureRate * 100)}% failure rate)`,
        );
      }

      // Check for systemic failure across all batches (lower threshold)
      const systemicFailureRate = failedBatches / totalBatches;
      if (systemicFailureRate >= SYSTEMIC_FAILURE_THRESHOLD) {
        this.logger.error(
          `[PerpsDataProcessor] SYSTEMIC FAILURE DETECTED: ${Math.round(systemicFailureRate * 100)}% of batches ` +
            `are failing (${failedBatches}/${totalBatches} batches with ≥${Math.round(BATCH_FAILURE_THRESHOLD * 100)}% failure). ` +
            `Latest batch: ${batchFailures}/${batch.length} failed. ` +
            `Continuing to process remaining ${successfulAgents.length - i - batch.length} agents.`,
        );

        // Add alert to errors for visibility (but don't stop)
        if (results.errors.length < MAX_ERRORS_TO_STORE) {
          results.errors.push(
            `SYSTEMIC ALERT: ${Math.round(systemicFailureRate * 100)}% of batches failing ` +
              `(threshold: ${Math.round(SYSTEMIC_FAILURE_THRESHOLD * 100)}%)`,
          );
        }
      }

      // Log batch progress
      if (
        (i + batch.length) % 50 === 0 ||
        i + batch.length >= successfulAgents.length
      ) {
        this.logger.info(
          `[PerpsDataProcessor] Calmar calculation progress: ${i + batch.length}/${successfulAgents.length} agents processed`,
        );
      }
    }

    // Log final summary
    if (failedBatches > 0) {
      const finalSystemicRate = failedBatches / totalBatches;
      const logLevel =
        finalSystemicRate >= SYSTEMIC_FAILURE_THRESHOLD ? "error" : "warn";

      this.logger[logLevel](
        `[PerpsDataProcessor] Completed with degraded performance: ${failedBatches}/${totalBatches} batches ` +
          `had ≥${Math.round(BATCH_FAILURE_THRESHOLD * 100)}% failure rate ` +
          `(systemic rate: ${Math.round(finalSystemicRate * 100)}%). ` +
          `Final: ${results.successful} successful, ${results.failed} failed`,
      );
    }

    // Log if we hit the error cap
    if (results.errors.length > MAX_ERRORS_TO_STORE) {
      this.logger.warn(
        `[PerpsDataProcessor] Error array capped at ${MAX_ERRORS_TO_STORE} entries. Total failures: ${results.failed}`,
      );
    }

    // Only include errors field if there are actual errors
    return {
      successful: results.successful,
      failed: results.failed,
      ...(results.errors.length > 0 && { errors: results.errors }),
    };
  }

  /**
   * Process a batch of agents with retry logic for each agent
   * @param batch Batch of agents to process
   * @param competitionId Competition ID
   * @param calmarService Calmar ratio service instance
   * @param maxRetries Maximum number of retries per agent
   * @returns Array of results for each agent
   */
  private async processBatchWithRetries(
    batch: SuccessfulAgentSync[],
    competitionId: string,
    maxRetries: number,
  ): Promise<Array<{ success: boolean; error?: string }>> {
    return Promise.all(
      batch.map(async (agent) => {
        // Try up to maxRetries + 1 times (initial + retries)
        for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
          try {
            // Add exponential backoff for retries
            if (attempt > 1) {
              const backoffDelay = Math.min(
                1000 * Math.pow(2, attempt - 2), // 1s, 2s, 4s
                10000, // Max 10 seconds
              );
              this.logger.debug(
                `[PerpsDataProcessor] Retrying risk metrics calculation for agent ${agent.agentId} ` +
                  `(attempt ${attempt}/${maxRetries + 1}) after ${backoffDelay}ms`,
              );
              await new Promise((resolve) => setTimeout(resolve, backoffDelay));
            }

            // Calculate all risk metrics atomically using orchestrator service
            // RiskMetricsService wraps Calmar + Sortino + snapshot in a single transaction
            await this.riskMetricsService.calculateAndSaveAllRiskMetrics(
              agent.agentId,
              competitionId,
            );

            // Success! Log if it was a retry
            if (attempt > 1) {
              this.logger.info(
                `[PerpsDataProcessor] Risk metrics calculation succeeded for agent ${agent.agentId} on attempt ${attempt}`,
              );
            }

            return { success: true };
          } catch (error) {
            // Log the failure
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            this.logger.warn(
              `[PerpsDataProcessor] Calmar calculation failed for agent ${agent.agentId} ` +
                `(attempt ${attempt}/${maxRetries + 1}): ${errorMsg}`,
            );

            // If this was the last attempt, return failure
            if (attempt === maxRetries + 1) {
              this.logger.error(
                `[PerpsDataProcessor] Calmar calculation failed for agent ${agent.agentId} after ${maxRetries + 1} attempts`,
              );
              return { success: false, error: errorMsg };
            }
            // Otherwise, continue to next attempt
          }
        }

        // Should never reach here, but handle it defensively
        return { success: false, error: "Max retries exhausted" };
      }),
    );
  }

  /**
   * Get competition statistics for a perpetual futures competition
   * @param competitionId Competition ID
   * @returns Competition statistics including positions, volume, and agents
   */
  async getCompetitionStats(
    competitionId: string,
  ): Promise<PerpsCompetitionStats> {
    try {
      return await this.perpsRepo.getPerpsCompetitionStats(competitionId);
    } catch (error) {
      this.logger.error(
        { error },
        `[PerpsDataProcessor] Error getting competition stats for ${competitionId}:`,
      );
      throw error;
    }
  }

  /**
   * Get perps positions for an agent in a competition
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @param status Optional status filter ("Open", "Closed", etc.)
   * @returns Array of positions
   */
  async getAgentPositions(
    agentId: string,
    competitionId: string,
    status?: string,
  ) {
    try {
      return await this.perpsRepo.getPerpsPositions(
        agentId,
        competitionId,
        status,
      );
    } catch (error) {
      this.logger.error(
        { error },
        `[PerpsDataProcessor] Error getting positions for agent ${agentId}:`,
      );
      throw error;
    }
  }

  /**
   * Get latest perps account summary for an agent
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @returns Latest account summary or null
   */
  async getAgentAccountSummary(agentId: string, competitionId: string) {
    try {
      return await this.perpsRepo.getLatestPerpsAccountSummary(
        agentId,
        competitionId,
      );
    } catch (error) {
      this.logger.error(
        { error },
        `[PerpsDataProcessor] Error getting account summary for agent ${agentId}:`,
      );
      throw error;
    }
  }
}
