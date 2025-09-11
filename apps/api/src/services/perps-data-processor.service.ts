import type {
  InsertPerpetualPosition,
  InsertPerpsAccountSummary,
} from "@recallnet/db-schema/trading/types";

import { findByIds as findAgentsByIds } from "@/database/repositories/agent-repository.js";
import {
  batchCreatePortfolioSnapshots,
  createPortfolioSnapshot,
  findById as findCompetitionById,
  getCompetitionAgents,
} from "@/database/repositories/competition-repository.js";
import {
  batchSyncAgentsPerpsData,
  getPerpsCompetitionConfig,
  syncAgentPerpsData,
} from "@/database/repositories/perps-repository.js";
import { serviceLogger } from "@/lib/logger.js";
import type {
  AgentPerpsSyncResult,
  BatchPerpsSyncResult,
} from "@/types/index.js";
import type {
  IPerpsDataProvider,
  PerpsAccountSummary,
  PerpsPosition,
} from "@/types/perps.js";

/**
 * Provider-agnostic processor for perpetual futures data
 * Orchestrates fetching data from providers and storing in database
 */
export class PerpsDataProcessor {
  constructor() {}

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
      createdAt: position.openedAt,
      lastUpdatedAt: position.lastUpdatedAt || null,
      closedAt: position.closedAt || null,
    };
  }

  /**
   * Convert number to string, handling scientific notation and zero values
   */
  private numberToString(value: number | undefined | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    // Handle zero explicitly
    if (value === 0) {
      return "0";
    }

    // For very small or very large numbers, use a different approach
    const absValue = Math.abs(value);

    // For very small numbers (like 1e-8), use toFixed with appropriate precision
    if (absValue < 0.0001 && absValue > 0) {
      const str = value.toFixed(20);
      // Remove trailing zeros but keep the number accurate
      return str.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    }

    // For regular numbers, convert to string and check for scientific notation
    let str = value.toString();

    // If it's in scientific notation, convert it
    if (str.includes("e")) {
      // Use toFixed with reasonable precision, then clean up
      const precision = str.includes("e-") ? 20 : 10;
      str = value.toFixed(precision);
      // Remove trailing zeros after decimal point
      str = str.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    }

    return str;
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
      totalEquity: summary.totalEquity.toString(),
      initialCapital: (summary.initialCapital ?? 0).toString(),
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
      accountStatus: summary.accountStatus || undefined,
      rawData: summary.rawData || undefined,
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
      serviceLogger.info(
        `[PerpsDataProcessor] Processing agent ${agentId} for competition ${competitionId}`,
      );

      // 1. Fetch account summary from provider
      const accountSummary = await provider.getAccountSummary(walletAddress);

      // 2. Fetch positions from provider
      const positions = await provider.getPositions(walletAddress);

      // 3. Transform to database format
      const dbPositions = positions.map((p) =>
        this.transformPositionToDb(p, agentId, competitionId),
      );
      const dbAccountSummary = this.transformAccountSummaryToDb(
        accountSummary,
        agentId,
        competitionId,
      );

      // 4. Store everything in a transaction
      const syncResult = await syncAgentPerpsData(
        agentId,
        competitionId,
        dbPositions,
        dbAccountSummary,
      );

      // 5. Create portfolio snapshot for leaderboard
      await createPortfolioSnapshot({
        agentId,
        competitionId,
        timestamp: new Date(),
        totalValue: accountSummary.totalEquity,
      });

      const processingTime = Date.now() - startTime;

      serviceLogger.info(
        `[PerpsDataProcessor] Processed agent ${agentId}: ` +
          `equity=$${accountSummary.totalEquity.toFixed(2)}, ` +
          `positions=${positions.length}, ` +
          `time=${processingTime}ms`,
      );

      return syncResult;
    } catch (error) {
      serviceLogger.error(
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
   * @returns Batch processing results
   */
  async processBatchAgentData(
    agents: Array<{ agentId: string; walletAddress: string }>,
    competitionId: string,
    provider: IPerpsDataProvider,
  ): Promise<BatchPerpsSyncResult> {
    if (!provider) {
      throw new Error("[PerpsDataProcessor] Provider is required");
    }

    const startTime = Date.now();

    serviceLogger.info(
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

        serviceLogger.debug(
          `[PerpsDataProcessor] Processing batch ${Math.floor(i / PROVIDER_BATCH_SIZE) + 1}/${Math.ceil(agents.length / PROVIDER_BATCH_SIZE)} ` +
            `(agents ${i + 1}-${Math.min(i + batch.length, agents.length)} of ${agents.length})`,
        );

        const batchPromises = batch.map(async ({ agentId, walletAddress }) => {
          const accountSummary =
            await provider.getAccountSummary(walletAddress);
          const positions = await provider.getPositions(walletAddress);

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
          };
        });

        // Use allSettled to handle individual failures without failing the entire batch
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

            serviceLogger.error(
              `[PerpsDataProcessor] Failed to fetch data for agent ${agent.agentId}: ${error.message}`,
            );
          }
        }
      }

      // Batch sync all agent data
      const batchResult = await batchSyncAgentsPerpsData(syncDataArray);

      // Create a Map for O(1) lookups instead of using Array.find()
      const syncDataMap = new Map(syncDataArray.map((d) => [d.agentId, d]));

      // Prepare portfolio snapshots for successful syncs
      const now = new Date();
      const snapshotsToCreate = batchResult.successful
        .map((r) => {
          const agentData = syncDataMap.get(r.agentId);
          if (!agentData) return null;

          const totalEquity = parseFloat(agentData.accountSummary.totalEquity);
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
          await batchCreatePortfolioSnapshots(snapshotsToCreate);
          serviceLogger.debug(
            `[PerpsDataProcessor] Created ${snapshotsToCreate.length} portfolio snapshots`,
          );
        } catch (error) {
          serviceLogger.warn(
            `[PerpsDataProcessor] Failed to create portfolio snapshots: ${error}`,
          );
          // Continue processing - snapshot failures shouldn't fail the entire batch
        }
      }

      const processingTime = Date.now() - startTime;

      // Merge fetch failures with sync failures for complete error reporting
      const allFailures = [...fetchFailures, ...batchResult.failed];

      serviceLogger.info(
        `[PerpsDataProcessor] Batch processing completed: ` +
          `${batchResult.successful.length} successful, ` +
          `${allFailures.length} failed (${fetchFailures.length} fetch, ${batchResult.failed.length} sync), ` +
          `time=${processingTime}ms`,
      );

      return {
        successful: batchResult.successful,
        failed: allFailures,
      };
    } catch (error) {
      serviceLogger.error(
        `[PerpsDataProcessor] Batch processing failed: ${error}`,
      );

      // Return failure result for all agents
      return {
        successful: [],
        failed: agents.map(({ agentId }) => ({
          agentId,
          error: error instanceof Error ? error : new Error(String(error)),
        })),
      };
    }
  }

  /**
   * Process all agents in a competition
   * @param competitionId Competition ID
   * @param provider The perps data provider to use
   * @returns Batch processing results
   */
  async processCompetitionAgents(
    competitionId: string,
    provider: IPerpsDataProvider,
  ): Promise<BatchPerpsSyncResult> {
    if (!provider) {
      throw new Error("[PerpsDataProcessor] Provider is required");
    }

    serviceLogger.info(
      `[PerpsDataProcessor] Processing all agents for competition ${competitionId}`,
    );

    // Get all agent IDs in the competition
    const agentIds = await getCompetitionAgents(competitionId);

    if (agentIds.length === 0) {
      serviceLogger.info(
        `[PerpsDataProcessor] No agents found for competition ${competitionId}`,
      );

      return {
        successful: [],
        failed: [],
      };
    }

    // Get full agent details with wallet addresses
    const agents = await findAgentsByIds(agentIds);

    // Filter out agents without wallet addresses and map to required format
    const agentData = agents
      .filter((agent) => agent.walletAddress !== null)
      .map((agent) => ({
        agentId: agent.id,
        walletAddress: agent.walletAddress as string,
      }));

    if (agentData.length < agents.length) {
      const missingCount = agents.length - agentData.length;
      serviceLogger.warn(
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
    return getPerpsCompetitionConfig(competitionId);
  }

  /**
   * Validate competition is a perps competition
   * @param competitionId Competition ID
   * @returns True if competition is configured for perps
   */
  async isPerpsCompetition(competitionId: string): Promise<boolean> {
    const competition = await findCompetitionById(competitionId);

    if (!competition) {
      serviceLogger.warn(
        `[PerpsDataProcessor] Competition ${competitionId} not found`,
      );
      return false;
    }

    return competition.type === "perpetual_futures";
  }
}
