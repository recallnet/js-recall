import {
  and,
  avg,
  desc,
  count as drizzleCount,
  eq,
  getTableColumns,
  gt,
  gte,
  inArray,
  lte,
  not,
  sql,
  sum,
} from "drizzle-orm";
import { Logger } from "pino";

import { agents, competitionAgents } from "../schema/core/defs.js";
import {
  perpetualPositions,
  perpsAccountSummaries,
  perpsCompetitionConfig,
  perpsRiskMetrics,
  perpsSelfFundingAlerts,
  perpsTransferHistory,
  riskMetricsSnapshots,
} from "../schema/trading/defs.js";
import {
  InsertPerpetualPosition,
  InsertPerpsAccountSummary,
  InsertPerpsCompetitionConfig,
  InsertPerpsRiskMetrics,
  InsertPerpsSelfFundingAlert,
  InsertPerpsTransferHistory,
  InsertRiskMetricsSnapshot,
  PerpetualPositionWithAgent,
  RiskAdjustedLeaderboardEntry,
  SelectPerpetualPosition,
  SelectPerpsAccountSummary,
  SelectPerpsCompetitionConfig,
  SelectPerpsRiskMetrics,
  SelectPerpsSelfFundingAlert,
  SelectPerpsTransferHistory,
  SelectRiskMetricsSnapshot,
} from "../schema/trading/types.js";
import { Database, Transaction } from "../types.js";

// Type definitions for perps operations
export interface AgentPerpsSyncData {
  agentId: string;
  competitionId: string;
  positions: InsertPerpetualPosition[];
  accountSummary: InsertPerpsAccountSummary;
}

export interface AgentPerpsSyncResult {
  positions: SelectPerpetualPosition[];
  summary: SelectPerpsAccountSummary;
}

export interface BatchPerpsSyncResult {
  successful: Array<{
    agentId: string;
    positions: SelectPerpetualPosition[];
    summary: SelectPerpsAccountSummary;
  }>;
  failed: Array<{ agentId: string; error: Error }>;
}

export interface PerpsCompetitionStats {
  totalAgents: number;
  totalPositions: number;
  totalVolume: number;
  averageEquity: number;
}

export interface PerpsSelfFundingAlertReview {
  reviewed: boolean;
  reviewedBy: string | null;
  reviewNote: string | null;
  actionTaken: string | null;
}

export interface RiskMetricsTimeSeriesOptions {
  agentId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Perps Repository
 * Handles database operations for perpetual futures competitions
 */
export class PerpsRepository {
  readonly #db: Database;
  readonly #dbRead: Database;
  readonly #logger: Logger;

  constructor(database: Database, readDatabase: Database, logger: Logger) {
    this.#db = database;
    this.#dbRead = readDatabase;
    this.#logger = logger;
  }

  // =============================================================================
  // PERPS COMPETITION CONFIG
  // =============================================================================

  /**
   * Create perps competition configuration
   * @param config Configuration to create
   * @returns Created configuration
   */
  async createPerpsCompetitionConfig(
    config: InsertPerpsCompetitionConfig,
    tx?: Transaction,
  ): Promise<SelectPerpsCompetitionConfig> {
    try {
      const executor = tx || this.#db;
      const [result] = await executor
        .insert(perpsCompetitionConfig)
        .values(config)
        .returning();

      if (!result) {
        throw new Error("Failed to create perps competition config");
      }

      this.#logger.debug(
        `[PerpsRepository] Created perps config for competition ${config.competitionId}`,
      );

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in createPerpsCompetitionConfig");
      throw error;
    }
  }

  /**
   * Get perps competition configuration
   * @param competitionId Competition ID
   * @returns Configuration or null if not found
   */
  async getPerpsCompetitionConfig(
    competitionId: string,
  ): Promise<SelectPerpsCompetitionConfig | null> {
    try {
      const [result] = await this.#dbRead
        .select()
        .from(perpsCompetitionConfig)
        .where(eq(perpsCompetitionConfig.competitionId, competitionId))
        .limit(1);

      return result || null;
    } catch (error) {
      this.#logger.error({ error }, "Error in getPerpsCompetitionConfig");
      throw error;
    }
  }

  /**
   * Update perps competition configuration
   * @param competitionId Competition ID
   * @param updates Partial config updates
   * @param tx Optional transaction
   * @returns Updated configuration or null if not found
   */
  async updatePerpsCompetitionConfig(
    competitionId: string,
    updates: Partial<
      Omit<InsertPerpsCompetitionConfig, "competitionId" | "createdAt">
    >,
    tx?: Transaction,
  ): Promise<SelectPerpsCompetitionConfig | null> {
    try {
      const executor = tx || this.#db;
      const [result] = await executor
        .update(perpsCompetitionConfig)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(perpsCompetitionConfig.competitionId, competitionId))
        .returning();

      if (result) {
        this.#logger.debug(
          `[PerpsRepository] Updated perps config for competition ${competitionId}`,
        );
      }

      return result || null;
    } catch (error) {
      this.#logger.error({ error }, "Error in updatePerpsCompetitionConfig");
      throw error;
    }
  }

  /**
   * Delete perps competition configuration
   * @param competitionId Competition ID
   * @param tx Optional transaction
   * @returns True if deleted, false if not found
   */
  async deletePerpsCompetitionConfig(
    competitionId: string,
    tx?: Transaction,
  ): Promise<boolean> {
    try {
      const executor = tx || this.#db;
      const result = await executor
        .delete(perpsCompetitionConfig)
        .where(eq(perpsCompetitionConfig.competitionId, competitionId));

      const deleted = (result?.rowCount ?? 0) > 0;

      if (deleted) {
        this.#logger.debug(
          `[PerpsRepository] Deleted perps config for competition ${competitionId}`,
        );
      }

      return deleted;
    } catch (error) {
      this.#logger.error({ error }, "Error in deletePerpsCompetitionConfig");
      throw error;
    }
  }

  // =============================================================================
  // PERPETUAL POSITIONS
  // =============================================================================

  /**
   * Batch upsert perpetual positions within a transaction
   * @param tx Database transaction (optional)
   * @param positions Array of positions to upsert
   * @returns Array of upserted positions
   */
  async batchUpsertPerpsPositionsInTransaction(
    tx: Transaction | Database,
    positions: InsertPerpetualPosition[],
  ): Promise<SelectPerpetualPosition[]> {
    if (positions.length === 0) {
      return [];
    }

    try {
      const database = tx || this.#db;
      const now = new Date();

      // Batch insert with conflict resolution
      const results = await database
        .insert(perpetualPositions)
        .values(
          positions.map((p) => ({
            ...p,
            capturedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: [
            perpetualPositions.providerPositionId,
            perpetualPositions.competitionId,
          ],
          set: {
            currentPrice: sql`excluded.current_price`,
            pnlUsdValue: sql`excluded.pnl_usd_value`,
            pnlPercentage: sql`excluded.pnl_percentage`,
            status: sql`excluded.status`,
            lastUpdatedAt: sql`excluded.last_updated_at`,
            closedAt: sql`excluded.closed_at`,
            capturedAt: now,
          },
        })
        .returning();

      this.#logger.debug(
        `[PerpsRepository] Batch upserted ${results.length} positions`,
      );

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in batchUpsertPerpsPositions");
      throw error;
    }
  }

  /**
   * Upsert perpetual position (single position convenience wrapper)
   * @param position Position data to upsert
   * @returns Upserted position
   */
  async upsertPerpsPosition(
    position: InsertPerpetualPosition,
  ): Promise<SelectPerpetualPosition> {
    const results = await this.batchUpsertPerpsPositionsInTransaction(
      this.#db,
      [position],
    );
    if (!results[0]) {
      throw new Error("Failed to upsert perpetual position");
    }
    return results[0];
  }

  /**
   * Batch upsert perpetual positions (public method)
   * @param positions Array of positions to upsert
   * @returns Array of upserted positions
   */
  async batchUpsertPerpsPositions(
    positions: InsertPerpetualPosition[],
  ): Promise<SelectPerpetualPosition[]> {
    return this.batchUpsertPerpsPositionsInTransaction(this.#db, positions);
  }

  /**
   * Get perps positions for an agent in a competition
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @param status Optional status filter
   * @returns Array of positions
   */
  async getPerpsPositions(
    agentId: string,
    competitionId: string,
    status?: string,
  ): Promise<SelectPerpetualPosition[]> {
    try {
      const conditions = [
        eq(perpetualPositions.agentId, agentId),
        eq(perpetualPositions.competitionId, competitionId),
      ];

      if (status) {
        conditions.push(eq(perpetualPositions.status, status));
      }

      const results = await this.#dbRead
        .select()
        .from(perpetualPositions)
        .where(and(...conditions))
        .orderBy(desc(perpetualPositions.createdAt));

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in getPerpsPositions");
      throw error;
    }
  }

  // =============================================================================
  // PERPS ACCOUNT SUMMARIES
  // =============================================================================

  /**
   * Create perps account summary within a transaction
   * @param tx Database transaction (optional)
   * @param summary Summary data to create
   * @returns Created summary
   */
  async createPerpsAccountSummaryInTransaction(
    tx: Transaction | Database,
    summary: InsertPerpsAccountSummary,
  ): Promise<SelectPerpsAccountSummary> {
    try {
      const database = tx || this.#db;
      const [result] = await database
        .insert(perpsAccountSummaries)
        .values(summary)
        .returning();

      if (!result) {
        throw new Error("Failed to create perps account summary");
      }

      this.#logger.debug(
        `[PerpsRepository] Created account summary for agent ${summary.agentId}`,
      );

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in createPerpsAccountSummary");
      throw error;
    }
  }

  /**
   * Create perps account summary (convenience wrapper)
   * @param summary Summary data to create
   * @returns Created summary
   */
  async createPerpsAccountSummary(
    summary: InsertPerpsAccountSummary,
  ): Promise<SelectPerpsAccountSummary> {
    return this.createPerpsAccountSummaryInTransaction(this.#db, summary);
  }

  /**
   * Batch create multiple account summaries
   * @param summaries Array of summary data to create
   * @returns Array of created summaries
   */
  async batchCreatePerpsAccountSummaries(
    summaries: InsertPerpsAccountSummary[],
  ): Promise<SelectPerpsAccountSummary[]> {
    if (summaries.length === 0) {
      return [];
    }

    try {
      const results = await this.#db
        .insert(perpsAccountSummaries)
        .values(summaries)
        .returning();

      this.#logger.debug(
        `[PerpsRepository] Batch created ${results.length} account summaries`,
      );

      return results;
    } catch (error) {
      this.#logger.error(
        { error },
        "Error in batchCreatePerpsAccountSummaries",
      );
      throw error;
    }
  }

  /**
   * Get latest perps account summary for an agent
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @returns Latest summary or null
   */
  async getLatestPerpsAccountSummary(
    agentId: string,
    competitionId: string,
  ): Promise<SelectPerpsAccountSummary | null> {
    try {
      const [result] = await this.#dbRead
        .select()
        .from(perpsAccountSummaries)
        .where(
          and(
            eq(perpsAccountSummaries.agentId, agentId),
            eq(perpsAccountSummaries.competitionId, competitionId),
          ),
        )
        .orderBy(desc(perpsAccountSummaries.timestamp))
        .limit(1);

      return result || null;
    } catch (error) {
      this.#logger.error({ error }, "Error in getLatestPerpsAccountSummary");
      throw error;
    }
  }

  // =============================================================================
  // SELF-FUNDING ALERTS
  // =============================================================================

  /**
   * Create self-funding alert
   * @param alert Alert data to create
   * @returns Created alert
   */
  async createPerpsSelfFundingAlert(
    alert: InsertPerpsSelfFundingAlert,
  ): Promise<SelectPerpsSelfFundingAlert> {
    try {
      const [result] = await this.#db
        .insert(perpsSelfFundingAlerts)
        .values(alert)
        .returning();

      if (!result) {
        throw new Error("Failed to create perps self-funding alert");
      }

      this.#logger.warn(
        `[PerpsRepository] Created self-funding alert for agent ${alert.agentId}: $${alert.unexplainedAmount}`,
      );

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in createPerpsSelfFundingAlert");
      throw error;
    }
  }

  /**
   * Batch create multiple self-funding alerts in a single transaction
   * @param alerts Array of alert data to create
   * @returns Array of created alerts
   */
  async batchCreatePerpsSelfFundingAlerts(
    alerts: InsertPerpsSelfFundingAlert[],
  ): Promise<SelectPerpsSelfFundingAlert[]> {
    if (alerts.length === 0) {
      return [];
    }

    try {
      const results = await this.#db
        .insert(perpsSelfFundingAlerts)
        .values(alerts)
        .returning();

      for (const alert of results) {
        this.#logger.warn(
          `[PerpsRepository] Created self-funding alert for agent ${alert.agentId}: $${alert.unexplainedAmount}`,
        );
      }

      this.#logger.info(
        `[PerpsRepository] Batch created ${results.length} self-funding alerts`,
      );

      return results;
    } catch (error) {
      this.#logger.error(
        { error },
        "Error in batchCreatePerpsSelfFundingAlerts",
      );
      throw error;
    }
  }

  /**
   * Get unreviewed self-funding alerts for a competition
   * @param competitionId Competition ID
   * @returns Array of unreviewed alerts
   */
  async getUnreviewedPerpsAlerts(
    competitionId: string,
  ): Promise<SelectPerpsSelfFundingAlert[]> {
    try {
      const alerts = await this.#dbRead
        .select()
        .from(perpsSelfFundingAlerts)
        .where(
          and(
            eq(perpsSelfFundingAlerts.competitionId, competitionId),
            eq(perpsSelfFundingAlerts.reviewed, false),
          ),
        )
        .orderBy(desc(perpsSelfFundingAlerts.detectedAt));

      return alerts;
    } catch (error) {
      this.#logger.error({ error }, "Error in getUnreviewedPerpsAlerts");
      throw error;
    }
  }

  /**
   * Get self-funding alerts for a competition with optional filters
   * @param competitionId Competition ID
   * @param filters Optional filters for reviewed status and detection method
   * @returns Array of alerts matching filters
   */
  async getPerpsAlerts(
    competitionId: string,
    filters?: {
      reviewed?: boolean;
      detectionMethod?: string;
    },
  ): Promise<SelectPerpsSelfFundingAlert[]> {
    try {
      const conditions = [
        eq(perpsSelfFundingAlerts.competitionId, competitionId),
      ];

      if (filters?.reviewed !== undefined) {
        conditions.push(eq(perpsSelfFundingAlerts.reviewed, filters.reviewed));
      }

      if (filters?.detectionMethod) {
        conditions.push(
          eq(perpsSelfFundingAlerts.detectionMethod, filters.detectionMethod),
        );
      }

      const alerts = await this.#dbRead
        .select()
        .from(perpsSelfFundingAlerts)
        .where(and(...conditions))
        .orderBy(desc(perpsSelfFundingAlerts.detectedAt));

      return alerts;
    } catch (error) {
      this.#logger.error({ error }, "Error in getPerpsAlerts");
      throw error;
    }
  }

  /**
   * Get a single self-funding alert by ID
   * @param alertId Alert ID
   * @returns Alert or null if not found
   */
  async getPerpsAlertById(
    alertId: string,
  ): Promise<SelectPerpsSelfFundingAlert | null> {
    try {
      const [alert] = await this.#dbRead
        .select()
        .from(perpsSelfFundingAlerts)
        .where(eq(perpsSelfFundingAlerts.id, alertId))
        .limit(1);

      return alert || null;
    } catch (error) {
      this.#logger.error({ error }, "Error in getPerpsAlertById");
      throw error;
    }
  }

  /**
   * Review a self-funding alert
   * @param alertId Alert ID
   * @param reviewData Review information
   * @returns Updated alert or null
   */
  async reviewPerpsSelfFundingAlert(
    alertId: string,
    reviewData: PerpsSelfFundingAlertReview,
  ): Promise<SelectPerpsSelfFundingAlert | null> {
    try {
      const [result] = await this.#db
        .update(perpsSelfFundingAlerts)
        .set(reviewData)
        .where(eq(perpsSelfFundingAlerts.id, alertId))
        .returning();

      if (!result) {
        return null;
      }

      this.#logger.info(
        `[PerpsRepository] Reviewed self-funding alert ${alertId}: action=${reviewData.actionTaken}`,
      );

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in reviewPerpsSelfFundingAlert");
      throw error;
    }
  }

  /**
   * Get self-funding alerts for an agent
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @returns Array of alerts
   */
  async getAgentSelfFundingAlerts(
    agentId: string,
    competitionId: string,
  ): Promise<SelectPerpsSelfFundingAlert[]> {
    try {
      const alerts = await this.#dbRead
        .select()
        .from(perpsSelfFundingAlerts)
        .where(
          and(
            eq(perpsSelfFundingAlerts.agentId, agentId),
            eq(perpsSelfFundingAlerts.competitionId, competitionId),
          ),
        )
        .orderBy(desc(perpsSelfFundingAlerts.detectedAt));

      return alerts;
    } catch (error) {
      this.#logger.error({ error }, "Error in getAgentSelfFundingAlerts");
      throw error;
    }
  }

  /**
   * Batch get self-funding alerts for multiple agents
   * @param agentIds Array of agent IDs
   * @param competitionId Competition ID
   * @returns Map of agent ID to their alerts
   */
  async batchGetAgentsSelfFundingAlerts(
    agentIds: string[],
    competitionId: string,
  ): Promise<Map<string, SelectPerpsSelfFundingAlert[]>> {
    try {
      // Initialize map with empty arrays for all agents
      const alertsMap = new Map<string, SelectPerpsSelfFundingAlert[]>();
      agentIds.forEach((agentId) => {
        alertsMap.set(agentId, []);
      });

      // Return empty map if no agent IDs provided
      if (agentIds.length === 0) {
        return alertsMap;
      }

      // Process in batches to avoid query size limits (PostgreSQL IN clause limit)
      const batchSize = 500;
      const allAlerts: SelectPerpsSelfFundingAlert[] = [];

      for (let i = 0; i < agentIds.length; i += batchSize) {
        const batchAgentIds = agentIds.slice(i, i + batchSize);

        const batchAlerts = await this.#dbRead
          .select()
          .from(perpsSelfFundingAlerts)
          .where(
            and(
              inArray(perpsSelfFundingAlerts.agentId, batchAgentIds),
              eq(perpsSelfFundingAlerts.competitionId, competitionId),
            ),
          )
          .orderBy(desc(perpsSelfFundingAlerts.detectedAt));

        allAlerts.push(...batchAlerts);
      }

      // Populate alerts for each agent
      allAlerts.forEach((alert) => {
        const agentAlerts = alertsMap.get(alert.agentId);
        if (agentAlerts) {
          agentAlerts.push(alert);
        }
      });

      this.#logger.debug(
        `[PerpsRepository] Batch fetched alerts for ${agentIds.length} agents in ${Math.ceil(agentIds.length / batchSize)} batches: found ${allAlerts.length} total alerts`,
      );

      return alertsMap;
    } catch (error) {
      this.#logger.error({ error }, "Error in batchGetAgentsSelfFundingAlerts");
      throw error;
    }
  }

  // =============================================================================
  // ATOMIC SYNC OPERATIONS
  // =============================================================================

  /**
   * Atomically sync agent perps data (positions and account summary)
   * This is the main operation used by the sync service
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @param positions Array of positions to sync
   * @param accountSummary Account summary data
   * @returns Object with synced positions and account summary
   */
  async syncAgentPerpsData(
    agentId: string,
    competitionId: string,
    positions: InsertPerpetualPosition[],
    accountSummary: InsertPerpsAccountSummary,
  ): Promise<AgentPerpsSyncResult> {
    return await this.#db.transaction(async (tx) => {
      try {
        // 1. Batch upsert all current positions
        const syncedPositions =
          await this.batchUpsertPerpsPositionsInTransaction(tx, positions);

        // 2. Close positions that weren't in the update (no longer open)
        // Only include IDs from positions with status="Open" to avoid mixing
        // with closed fill records that have different ID formats
        const updatedPositionIds = positions
          .filter((p) => p.status === "Open")
          .map((p) => p.providerPositionId)
          .filter((id): id is string => Boolean(id));

        // Only update if we have positions from the provider
        // If no positions, close all open positions for this agent
        const closeConditions = [
          eq(perpetualPositions.agentId, agentId),
          eq(perpetualPositions.competitionId, competitionId),
          eq(perpetualPositions.status, "Open"),
        ];

        if (updatedPositionIds.length > 0) {
          // Close positions not in the update
          closeConditions.push(
            not(
              inArray(
                perpetualPositions.providerPositionId,
                updatedPositionIds,
              ),
            ),
          );
        }

        await tx
          .update(perpetualPositions)
          .set({
            status: "Closed",
            closedAt: new Date(),
            lastUpdatedAt: new Date(),
          })
          .where(and(...closeConditions));

        // 3. Create account summary
        const summary = await this.createPerpsAccountSummaryInTransaction(
          tx,
          accountSummary,
        );

        this.#logger.info(
          `[PerpsRepository] Synced agent ${agentId}: ${syncedPositions.length} positions, equity=$${accountSummary.totalEquity}`,
        );

        return {
          positions: syncedPositions,
          summary,
        };
      } catch (error) {
        this.#logger.error(
          { error },
          `[PerpsRepository] Failed to sync agent ${agentId}`,
        );
        throw error;
      }
    });
  }

  /**
   * Batch sync multiple agents' perps data
   * Processes agents in controlled batches to avoid database contention
   * @param agentSyncData Array of agent sync data
   * @returns Results with successes and failures
   */
  async batchSyncAgentsPerpsData(
    agentSyncData: AgentPerpsSyncData[],
  ): Promise<BatchPerpsSyncResult> {
    const successful: Array<{
      agentId: string;
      positions: SelectPerpetualPosition[];
      summary: SelectPerpsAccountSummary;
    }> = [];
    const failed: Array<{ agentId: string; error: Error }> = [];

    // Process in smaller batches to avoid database contention
    const concurrencyLimit = 5; // Process 5 agents at a time

    for (let i = 0; i < agentSyncData.length; i += concurrencyLimit) {
      const batch = agentSyncData.slice(i, i + concurrencyLimit);

      const batchResults = await Promise.allSettled(
        batch.map((data) =>
          this.syncAgentPerpsData(
            data.agentId,
            data.competitionId,
            data.positions,
            data.accountSummary,
          ).then((result) => ({ agentId: data.agentId, ...result })),
        ),
      );

      batchResults.forEach((result, index) => {
        const agent = batch[index];
        if (!agent) {
          // This should never happen, but handle it defensively
          this.#logger.error(
            `[PerpsRepository] Unexpected missing agent at index ${index}`,
          );
          return;
        }

        const agentId = agent.agentId;
        if (result.status === "fulfilled") {
          successful.push(result.value);
        } else {
          failed.push({
            agentId,
            error:
              result.reason instanceof Error
                ? result.reason
                : new Error(String(result.reason)),
          });
        }
      });
    }

    this.#logger.info(
      `[PerpsRepository] Batch sync completed: ${successful.length} successful, ${failed.length} failed`,
    );

    return { successful, failed };
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  /**
   * Get active agents subquery for a competition
   * Reusable subquery
   * @param competitionId Competition ID to filter by
   * @returns Subquery for active agents
   * @private
   */
  private getActiveAgentsSubquery(competitionId: string) {
    return this.#dbRead
      .select({
        agentId: competitionAgents.agentId,
      })
      .from(competitionAgents)
      .where(
        and(
          eq(competitionAgents.competitionId, competitionId),
          eq(competitionAgents.status, "active"),
        ),
      )
      .as("active_agents");
  }

  // =============================================================================
  // AGGREGATION QUERIES
  // =============================================================================

  /**
   * Get risk-adjusted leaderboard with Calmar ratio fallback to equity
   * Combines risk metrics and account summaries in a single query
   * @param competitionId Competition ID
   * @param limit Optional limit for pagination
   * @param offset Optional offset for pagination
   * @returns Array of leaderboard entries sorted by Calmar (if available) then equity
   */
  async getRiskAdjustedLeaderboard(
    competitionId: string,
    limit = 50,
    offset = 0,
    evaluationMetric:
      | "calmar_ratio"
      | "sortino_ratio"
      | "simple_return" = "calmar_ratio",
  ): Promise<RiskAdjustedLeaderboardEntry[]> {
    try {
      // Get active agents subquery
      const activeAgents = this.getActiveAgentsSubquery(competitionId);

      // Latest summary subquery for lateral join
      const latestSummarySubquery = this.#dbRead
        .select({
          agentId: perpsAccountSummaries.agentId,
          totalEquity: perpsAccountSummaries.totalEquity,
          totalPnl: perpsAccountSummaries.totalPnl,
          timestamp: perpsAccountSummaries.timestamp,
        })
        .from(perpsAccountSummaries)
        .where(
          and(
            eq(perpsAccountSummaries.competitionId, competitionId),
            sql`${perpsAccountSummaries.agentId} = ${activeAgents.agentId}`,
          ),
        )
        .orderBy(desc(perpsAccountSummaries.timestamp))
        .limit(1)
        .as("latest_summary");

      // Risk metrics subquery for lateral join
      const riskMetricsSubquery = this.#dbRead
        .select({
          agentId: perpsRiskMetrics.agentId,
          calmarRatio: perpsRiskMetrics.calmarRatio,
          sortinoRatio: perpsRiskMetrics.sortinoRatio,
          simpleReturn: perpsRiskMetrics.simpleReturn,
          maxDrawdown: perpsRiskMetrics.maxDrawdown,
          downsideDeviation: perpsRiskMetrics.downsideDeviation,
        })
        .from(perpsRiskMetrics)
        .where(
          and(
            eq(perpsRiskMetrics.competitionId, competitionId),
            sql`${perpsRiskMetrics.agentId} = ${activeAgents.agentId}`,
          ),
        )
        .limit(1)
        .as("risk_metrics");

      // Single query with lateral joins for both summaries and risk metrics
      const results = await this.#dbRead
        .select({
          agentId: activeAgents.agentId,
          totalEquity: latestSummarySubquery.totalEquity,
          totalPnl: latestSummarySubquery.totalPnl,
          calmarRatio: riskMetricsSubquery.calmarRatio,
          sortinoRatio: riskMetricsSubquery.sortinoRatio,
          simpleReturn: riskMetricsSubquery.simpleReturn,
          maxDrawdown: riskMetricsSubquery.maxDrawdown,
          downsideDeviation: riskMetricsSubquery.downsideDeviation,
        })
        .from(activeAgents)
        .leftJoinLateral(latestSummarySubquery, sql`true`)
        .leftJoinLateral(riskMetricsSubquery, sql`true`)
        .orderBy(
          // Dynamic sorting based on evaluation metric
          // Use SQL template to add NULLS LAST - agents WITHOUT metrics rank after agents WITH metrics
          ...(evaluationMetric === "sortino_ratio"
            ? [
                sql`${riskMetricsSubquery.sortinoRatio} DESC NULLS LAST`,
                desc(latestSummarySubquery.totalEquity),
              ]
            : evaluationMetric === "simple_return"
              ? [
                  sql`${riskMetricsSubquery.simpleReturn} DESC NULLS LAST`,
                  desc(latestSummarySubquery.totalEquity),
                ]
              : [
                  // Default to calmar_ratio sorting
                  sql`${riskMetricsSubquery.calmarRatio} DESC NULLS LAST`,
                  desc(latestSummarySubquery.totalEquity),
                ]),
        )
        .limit(limit)
        .offset(offset);

      // Transform to the expected type
      const leaderboard: RiskAdjustedLeaderboardEntry[] = results
        .filter((row) => row.totalEquity !== null) // Filter out agents without summaries
        .map((row) => ({
          agentId: row.agentId,
          totalEquity: row.totalEquity || "0",
          totalPnl: row.totalPnl,
          calmarRatio: row.calmarRatio,
          sortinoRatio: row.sortinoRatio,
          simpleReturn: row.simpleReturn,
          maxDrawdown: row.maxDrawdown,
          downsideDeviation: row.downsideDeviation,
          hasRiskMetrics: row.calmarRatio !== null || row.sortinoRatio !== null,
        }));

      this.#logger.debug(
        `[PerpsRepository] Retrieved ${leaderboard.length} risk-adjusted leaderboard entries`,
      );

      return leaderboard;
    } catch (error) {
      this.#logger.error({ error }, "Error in getRiskAdjustedLeaderboard");
      throw error;
    }
  }

  /**
   * Get latest account summaries for all agents in a competition, sorted for leaderboard
   * @param competitionId Competition ID
   * @returns Array of latest account summaries sorted by totalEquity DESC
   */
  async getCompetitionLeaderboardSummaries(
    competitionId: string,
  ): Promise<SelectPerpsAccountSummary[]> {
    try {
      // Get active agents first, then use lateral join to get their latest summaries
      const activeAgents = this.getActiveAgentsSubquery(competitionId);

      // Create subquery for lateral join - gets the latest summary for each agent
      const latestSummarySubquery = this.#dbRead
        .select()
        .from(perpsAccountSummaries)
        .where(
          and(
            eq(perpsAccountSummaries.competitionId, competitionId),
            // This references the outer query's agent ID
            sql`${perpsAccountSummaries.agentId} = ${activeAgents.agentId}`,
          ),
        )
        .orderBy(desc(perpsAccountSummaries.timestamp))
        .limit(1)
        .as("latest_summary");

      // Use leftJoinLateral to get the latest summary per agent
      const results = await this.#dbRead
        .select()
        .from(activeAgents)
        .leftJoinLateral(latestSummarySubquery, sql`true`)
        .orderBy(desc(sql`${latestSummarySubquery}.total_equity`));

      // Filter out nulls and return just the summary objects
      const summaries = results
        .filter((row) => row.latest_summary !== null)
        .map((row) => row.latest_summary as SelectPerpsAccountSummary);

      this.#logger.debug(
        `[PerpsRepository] Retrieved ${summaries.length} account summaries for competition leaderboard`,
      );

      return summaries;
    } catch (error) {
      this.#logger.error(
        { error },
        "Error in getCompetitionLeaderboardSummaries",
      );
      throw error;
    }
  }

  /**
   * Get perps competition statistics using SQL aggregations
   * @param competitionId Competition ID
   * @returns Competition statistics
   */
  async getPerpsCompetitionStats(
    competitionId: string,
  ): Promise<PerpsCompetitionStats> {
    try {
      // Get distinct agents in the competition
      const distinctAgents = this.#dbRead
        .selectDistinct({
          agentId: perpsAccountSummaries.agentId,
        })
        .from(perpsAccountSummaries)
        .where(eq(perpsAccountSummaries.competitionId, competitionId))
        .as("distinct_agents");

      // Create subquery for lateral join - gets the latest summary for each agent
      const latestSummarySubquery = this.#dbRead
        .select({
          agentId: perpsAccountSummaries.agentId,
          totalEquity: perpsAccountSummaries.totalEquity,
          totalVolume: perpsAccountSummaries.totalVolume,
        })
        .from(perpsAccountSummaries)
        .where(
          and(
            eq(perpsAccountSummaries.competitionId, competitionId),
            sql`${perpsAccountSummaries.agentId} = ${distinctAgents.agentId}`,
          ),
        )
        .orderBy(desc(perpsAccountSummaries.timestamp))
        .limit(1)
        .as("latest_summary");

      // Use leftJoinLateral to get latest summaries and aggregate
      const [stats] = await this.#dbRead
        .select({
          totalAgents: drizzleCount(latestSummarySubquery.agentId),
          totalVolume: sum(latestSummarySubquery.totalVolume),
          averageEquity: avg(latestSummarySubquery.totalEquity),
        })
        .from(distinctAgents)
        .leftJoinLateral(latestSummarySubquery, sql`true`);

      // Get position count separately (can't join easily with the subquery)
      const [positionStats] = await this.#dbRead
        .select({
          totalPositions: drizzleCount(perpetualPositions.id),
        })
        .from(perpetualPositions)
        .where(eq(perpetualPositions.competitionId, competitionId));

      return {
        totalAgents: stats?.totalAgents ?? 0,
        totalPositions: positionStats?.totalPositions ?? 0,
        totalVolume: Number(stats?.totalVolume ?? 0),
        averageEquity: Number(stats?.averageEquity ?? 0),
      };
    } catch (error) {
      this.#logger.error({ error }, "Error in getPerpsCompetitionStats");
      throw error;
    }
  }

  /**
   * Count positions for an agent across multiple competitions in bulk
   * @param agentId Agent ID
   * @param competitionIds Array of competition IDs
   * @returns Map of competition ID to position count
   */
  async countBulkAgentPositionsInCompetitions(
    agentId: string,
    competitionIds: string[],
  ): Promise<Map<string, number>> {
    if (competitionIds.length === 0) {
      return new Map();
    }

    try {
      this.#logger.debug(
        `countBulkAgentPositionsInCompetitions called for agent ${agentId} in ${competitionIds.length} competitions`,
      );

      // Get position counts for all competitions in one query
      const results = await this.#dbRead
        .select({
          competitionId: perpetualPositions.competitionId,
          count: drizzleCount(),
        })
        .from(perpetualPositions)
        .where(
          and(
            eq(perpetualPositions.agentId, agentId),
            inArray(perpetualPositions.competitionId, competitionIds),
          ),
        )
        .groupBy(perpetualPositions.competitionId);

      // Create map with results
      const countMap = new Map<string, number>();

      // Initialize all competitions with 0 (important for competitions with no positions)
      for (const competitionId of competitionIds) {
        countMap.set(competitionId, 0);
      }

      // Update with actual counts
      for (const result of results) {
        countMap.set(result.competitionId, result.count);
      }

      this.#logger.debug(
        `Found positions in ${results.length}/${competitionIds.length} competitions`,
      );

      return countMap;
    } catch (error) {
      this.#logger.error(
        { error },
        "Error in countBulkAgentPositionsInCompetitions",
      );
      throw error;
    }
  }

  /**
   * Get all perps positions for a competition with pagination
   * Similar to getCompetitionTrades but for perps positions
   * @param competitionId Competition ID
   * @param limit Optional result limit
   * @param offset Optional result offset
   * @param statusFilter Optional status filter (defaults to "Open")
   * @returns Object with positions array and total count
   */
  async getCompetitionPerpsPositions(
    competitionId: string,
    limit?: number,
    offset?: number,
    statusFilter?: string,
  ): Promise<{
    positions: PerpetualPositionWithAgent[];
    total: number;
  }> {
    try {
      const conditions = [eq(perpetualPositions.competitionId, competitionId)];

      // Default to showing only open positions unless specified otherwise
      if (statusFilter !== "all") {
        conditions.push(eq(perpetualPositions.status, statusFilter || "Open"));
      }

      // Build the main query with agent join - following same pattern as getCompetitionTrades
      // Sort based on status: Open positions by createdAt, Closed positions by closedAt
      // Note: undefined defaults to "Open" (see filtering logic above)
      const orderByClause =
        statusFilter === "Closed"
          ? desc(perpetualPositions.closedAt)
          : statusFilter === "Open" || statusFilter === undefined
            ? desc(perpetualPositions.createdAt)
            : desc(perpetualPositions.lastUpdatedAt); // For "all" or other statuses

      const positionsQuery = this.#dbRead
        .select({
          ...getTableColumns(perpetualPositions),
          agent: {
            id: agents.id,
            name: agents.name,
            imageUrl: agents.imageUrl,
            description: agents.description,
          },
        })
        .from(perpetualPositions)
        .innerJoin(agents, eq(perpetualPositions.agentId, agents.id))
        .where(and(...conditions))
        .orderBy(orderByClause);

      // Apply pagination
      if (limit !== undefined) {
        positionsQuery.limit(limit);
      }

      if (offset !== undefined) {
        positionsQuery.offset(offset);
      }

      // Build count query
      const totalQuery = this.#dbRead
        .select({ count: drizzleCount() })
        .from(perpetualPositions)
        .where(and(...conditions));

      // Execute both queries in parallel
      const [results, total] = await Promise.all([positionsQuery, totalQuery]);

      return {
        positions: results,
        total: total[0]?.count ?? 0,
      };
    } catch (error) {
      this.#logger.error({ error }, "Error in getCompetitionPerpsPositions");
      throw error;
    }
  }

  // =============================================================================
  // TRANSFER HISTORY OPERATIONS
  // =============================================================================

  /**
   * Save transfer history for violation detection and audit
   * NOTE: Mid-competition transfers are PROHIBITED
   * @param transfer Transfer data
   * @param tx Optional transaction
   * @returns Created transfer record
   */
  async saveTransferHistory(
    transfer: InsertPerpsTransferHistory,
    tx?: Transaction,
  ): Promise<SelectPerpsTransferHistory> {
    try {
      const executor = tx || this.#db;
      const [result] = await executor
        .insert(perpsTransferHistory)
        .values(transfer)
        .returning();

      if (!result) {
        throw new Error("Failed to save transfer history");
      }

      this.#logger.debug(
        `[PerpsRepository] Saved transfer: agent=${transfer.agentId}, type=${transfer.type}, amount=${transfer.amount}`,
      );

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in saveTransferHistory");
      throw error;
    }
  }

  /**
   * Batch save transfers (used during sync operations)
   * @param transfers Array of transfer records
   * @returns Array of created transfer records
   */
  async batchSaveTransferHistory(
    transfers: InsertPerpsTransferHistory[],
  ): Promise<SelectPerpsTransferHistory[]> {
    if (transfers.length === 0) {
      return [];
    }

    try {
      // Process in batches to avoid PostgreSQL query limits
      const BATCH_SIZE = 500;
      const allResults: SelectPerpsTransferHistory[] = [];

      for (let i = 0; i < transfers.length; i += BATCH_SIZE) {
        const batch = transfers.slice(i, i + BATCH_SIZE);
        const results = await this.#db
          .insert(perpsTransferHistory)
          .values(batch)
          .onConflictDoNothing({ target: perpsTransferHistory.txHash })
          .returning();

        allResults.push(...results);
      }

      this.#logger.debug(
        `[PerpsRepository] Batch saved ${allResults.length} transfers in ${Math.ceil(transfers.length / BATCH_SIZE)} batches`,
      );

      return allResults;
    } catch (error) {
      this.#logger.error({ error }, "Error in batchSaveTransferHistory");
      throw error;
    }
  }

  /**
   * Get transfer history for an agent in a competition
   *
   * NOTE: This method intentionally has NO LIMIT on results. While this could
   * theoretically cause memory issues with thousands of transfers, in practice:
   * 1. Competitions are typically 1 week long
   * 2. Mid-competition transfers are violations - should be rare
   * 3. Even 100 transfers would only be ~10KB
   * 4. We need ALL transfers for violation detection and admin review
   *
   * If this becomes an issue in production, consider implementing pagination.
   *
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @param since Optional timestamp to get transfers after
   * @returns Array of transfer records
   */
  async getAgentTransferHistory(
    agentId: string,
    competitionId: string,
    since?: Date,
  ): Promise<SelectPerpsTransferHistory[]> {
    try {
      const conditions = [
        eq(perpsTransferHistory.agentId, agentId),
        eq(perpsTransferHistory.competitionId, competitionId),
      ];

      if (since) {
        conditions.push(
          sql`${perpsTransferHistory.transferTimestamp} > ${since}`,
        );
      }

      const transfers = await this.#dbRead
        .select()
        .from(perpsTransferHistory)
        .where(and(...conditions))
        .orderBy(perpsTransferHistory.transferTimestamp);

      this.#logger.debug(
        `[PerpsRepository] Retrieved ${transfers.length} transfers for agent ${agentId}`,
      );

      return transfers;
    } catch (error) {
      this.#logger.error({ error }, "Error in getAgentTransferHistory");
      throw error;
    }
  }

  /**
   * Get transfer violation counts for all agents in a competition with agent names
   * Uses SQL aggregation with JOIN
   * @param competitionId Competition ID
   * @param startDate Competition start date (only count transfers after this)
   * @returns Array of agents with transfer counts and names (only includes agents with violations)
   */
  async getCompetitionTransferViolationCounts(
    competitionId: string,
    startDate: Date,
  ): Promise<
    Array<{ agentId: string; agentName: string; transferCount: number }>
  > {
    try {
      // Use SQL GROUP BY and COUNT with agent JOIN for aggregation
      // Only returns agents who have transfers (violations)
      const results = await this.#dbRead
        .select({
          agentId: perpsTransferHistory.agentId,
          agentName: agents.name,
          transferCount: drizzleCount(perpsTransferHistory.id),
        })
        .from(perpsTransferHistory)
        .leftJoin(agents, eq(perpsTransferHistory.agentId, agents.id))
        .where(
          and(
            eq(perpsTransferHistory.competitionId, competitionId),
            gt(perpsTransferHistory.transferTimestamp, startDate), // Only transfers after competition start
          ),
        )
        .groupBy(perpsTransferHistory.agentId, agents.name)
        .orderBy(desc(drizzleCount(perpsTransferHistory.id))); // Order by most violations first

      // Map results to ensure non-null agent names
      const mappedResults = results.map((row) => ({
        agentId: row.agentId,
        agentName: row.agentName ?? "Unknown Agent",
        transferCount: row.transferCount,
      }));

      this.#logger.debug(
        `[PerpsRepository] Found ${mappedResults.length} agents with transfer violations in competition ${competitionId}`,
      );

      return mappedResults;
    } catch (error) {
      this.#logger.error(
        { error },
        "Error in getCompetitionTransferViolationCounts",
      );
      throw error;
    }
  }

  // =============================================================================
  // RISK METRICS OPERATIONS
  // =============================================================================

  /**
   * Upsert risk metrics for an agent (latest values only)
   * @param metrics Risk metrics to save/update
   * @param tx Optional transaction
   * @returns Saved risk metrics
   */
  async upsertRiskMetrics(
    metrics: InsertPerpsRiskMetrics,
    tx?: Transaction,
  ): Promise<SelectPerpsRiskMetrics> {
    try {
      const executor = tx || this.#db;
      const [result] = await executor
        .insert(perpsRiskMetrics)
        .values(metrics)
        .onConflictDoUpdate({
          target: [perpsRiskMetrics.agentId, perpsRiskMetrics.competitionId],
          set: {
            simpleReturn: metrics.simpleReturn,
            calmarRatio: metrics.calmarRatio,
            annualizedReturn: metrics.annualizedReturn,
            maxDrawdown: metrics.maxDrawdown,
            sortinoRatio: metrics.sortinoRatio,
            downsideDeviation: metrics.downsideDeviation,
            snapshotCount: metrics.snapshotCount,
            calculationTimestamp: sql`CURRENT_TIMESTAMP`,
          },
        })
        .returning();

      if (!result) {
        throw new Error("Failed to save risk metrics");
      }

      this.#logger.debug(
        `[PerpsRepository] Upserted risk metrics: agent=${metrics.agentId}, calmar=${metrics.calmarRatio}`,
      );

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in upsertRiskMetrics");
      throw error;
    }
  }

  /**
   * Batch create risk metrics snapshots for time series data
   * Following the same pattern as batchCreatePortfolioSnapshots
   * @param snapshots Array of risk metrics snapshot data
   * @returns Array of created snapshots
   */
  async batchCreateRiskMetricsSnapshots(
    snapshots: InsertRiskMetricsSnapshot[],
    tx?: Transaction,
  ): Promise<SelectRiskMetricsSnapshot[]> {
    if (snapshots.length === 0) {
      return [];
    }

    const executor = tx || this.#db;

    try {
      this.#logger.debug(
        `[PerpsRepository] Batch creating ${snapshots.length} risk metrics snapshots`,
      );

      const now = new Date();
      const results = await executor
        .insert(riskMetricsSnapshots)
        .values(
          snapshots.map((snapshot) => ({
            ...snapshot,
            timestamp: snapshot.timestamp || now,
          })),
        )
        .returning();

      this.#logger.debug(
        `[PerpsRepository] Successfully created ${results.length} risk metrics snapshots`,
      );

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in batchCreateRiskMetricsSnapshots");
      throw error;
    }
  }

  /**
   * Get risk metrics time series data for a competition
   * @param competitionId Competition ID
   * @param options Optional parameters for filtering and pagination
   * @returns Array of risk metrics snapshots
   */
  async getRiskMetricsTimeSeries(
    competitionId: string,
    options?: RiskMetricsTimeSeriesOptions,
  ): Promise<SelectRiskMetricsSnapshot[]> {
    try {
      const conditions = [
        eq(riskMetricsSnapshots.competitionId, competitionId),
      ];

      if (options?.agentId) {
        conditions.push(eq(riskMetricsSnapshots.agentId, options.agentId));
      }

      if (options?.startDate) {
        conditions.push(gte(riskMetricsSnapshots.timestamp, options.startDate));
      }

      if (options?.endDate) {
        conditions.push(lte(riskMetricsSnapshots.timestamp, options.endDate));
      }

      const query = this.#dbRead
        .select()
        .from(riskMetricsSnapshots)
        .where(and(...conditions))
        .orderBy(desc(riskMetricsSnapshots.timestamp));

      // Apply pagination if specified
      let results: SelectRiskMetricsSnapshot[];
      if (options?.limit !== undefined && options.limit > 0) {
        if (options?.offset !== undefined && options.offset > 0) {
          results = await query.limit(options.limit).offset(options.offset);
        } else {
          results = await query.limit(options.limit);
        }
      } else if (options?.offset !== undefined && options.offset > 0) {
        results = await query.offset(options.offset);
      } else {
        results = await query;
      }

      this.#logger.debug(
        `[PerpsRepository] Retrieved ${results.length} risk metrics snapshots for competition ${competitionId}`,
      );

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in getRiskMetricsTimeSeries");
      throw error;
    }
  }

  /**
   * Save risk metrics for an agent
   * @param metrics Risk metrics to save
   * @returns Saved risk metrics
   */
  async saveRiskMetrics(
    metrics: InsertPerpsRiskMetrics,
    tx?: Transaction,
  ): Promise<SelectPerpsRiskMetrics> {
    return this.upsertRiskMetrics(metrics, tx);
  }

  /**
   * Get risk metrics for an agent across multiple competitions in a single query
   * @param agentId Agent ID
   * @param competitionIds Array of competition IDs
   * @returns Map of competition ID to risk metrics
   */
  async getBulkAgentRiskMetrics(
    agentId: string,
    competitionIds: string[],
  ): Promise<Map<string, SelectPerpsRiskMetrics>> {
    try {
      if (competitionIds.length === 0) {
        return new Map();
      }

      const results = await this.#dbRead
        .select()
        .from(perpsRiskMetrics)
        .where(
          and(
            eq(perpsRiskMetrics.agentId, agentId),
            inArray(perpsRiskMetrics.competitionId, competitionIds),
          ),
        );

      // Convert to Map
      const metricsMap = new Map<string, SelectPerpsRiskMetrics>();
      for (const metric of results) {
        metricsMap.set(metric.competitionId, metric);
      }

      this.#logger.debug(
        `[PerpsRepository] Fetched ${results.length} risk metrics for agent ${agentId} across ${competitionIds.length} competitions`,
      );

      return metricsMap;
    } catch (error) {
      this.#logger.error({ error }, "Error in getBulkAgentRiskMetrics");
      throw error;
    }
  }
}
