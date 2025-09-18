import {
  and,
  avg,
  desc,
  count as drizzleCount,
  eq,
  inArray,
  not,
  sql,
  sum,
} from "drizzle-orm";

import { agents, competitionAgents } from "@recallnet/db-schema/core/defs";
import {
  perpetualPositions,
  perpsAccountSummaries,
  perpsCompetitionConfig,
  perpsSelfFundingAlerts,
} from "@recallnet/db-schema/trading/defs";
import {
  InsertPerpetualPosition,
  InsertPerpsAccountSummary,
  InsertPerpsCompetitionConfig,
  InsertPerpsSelfFundingAlert,
  SelectPerpetualPosition,
  SelectPerpsAccountSummary,
  SelectPerpsCompetitionConfig,
  SelectPerpsSelfFundingAlert,
} from "@recallnet/db-schema/trading/types";

import { db, dbRead } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";
import {
  AgentPerpsSyncData,
  AgentPerpsSyncResult,
  BatchPerpsSyncResult,
  PerpsCompetitionStats,
  PerpsSelfFundingAlertReview,
} from "@/types/index.js";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Perps Repository
 * Handles database operations for perpetual futures competitions
 */

// =============================================================================
// PERPS COMPETITION CONFIG
// =============================================================================

/**
 * Create perps competition configuration
 * @param config Configuration to create
 * @returns Created configuration
 */
async function createPerpsCompetitionConfigImpl(
  config: InsertPerpsCompetitionConfig,
): Promise<SelectPerpsCompetitionConfig> {
  try {
    const [result] = await db
      .insert(perpsCompetitionConfig)
      .values(config)
      .returning();

    if (!result) {
      throw new Error("Failed to create perps competition config");
    }

    repositoryLogger.debug(
      `[PerpsRepository] Created perps config for competition ${config.competitionId}`,
    );

    return result;
  } catch (error) {
    repositoryLogger.error("Error in createPerpsCompetitionConfig:", error);
    throw error;
  }
}

/**
 * Get perps competition configuration
 * @param competitionId Competition ID
 * @returns Configuration or null if not found
 */
async function getPerpsCompetitionConfigImpl(
  competitionId: string,
): Promise<SelectPerpsCompetitionConfig | null> {
  try {
    const [result] = await dbRead
      .select()
      .from(perpsCompetitionConfig)
      .where(eq(perpsCompetitionConfig.competitionId, competitionId))
      .limit(1);

    return result || null;
  } catch (error) {
    repositoryLogger.error("Error in getPerpsCompetitionConfig:", error);
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
async function batchUpsertPerpsPositionsInTransactionImpl(
  tx: DatabaseTransaction | typeof db,
  positions: InsertPerpetualPosition[],
): Promise<SelectPerpetualPosition[]> {
  if (positions.length === 0) {
    return [];
  }

  try {
    const database = tx || db;
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
        target: perpetualPositions.providerPositionId,
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

    repositoryLogger.debug(
      `[PerpsRepository] Batch upserted ${results.length} positions`,
    );

    return results;
  } catch (error) {
    repositoryLogger.error("Error in batchUpsertPerpsPositions:", error);
    throw error;
  }
}

/**
 * Upsert perpetual position (single position convenience wrapper)
 * @param position Position data to upsert
 * @returns Upserted position
 */
async function upsertPerpsPositionImpl(
  position: InsertPerpetualPosition,
): Promise<SelectPerpetualPosition> {
  const results = await batchUpsertPerpsPositionsInTransactionImpl(db, [
    position,
  ]);
  if (!results[0]) {
    throw new Error("Failed to upsert perpetual position");
  }
  return results[0];
}

/**
 * Get perps positions for an agent in a competition
 * @param agentId Agent ID
 * @param competitionId Competition ID
 * @param status Optional status filter
 * @returns Array of positions
 */
async function getPerpsPositionsImpl(
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

    const results = await dbRead
      .select()
      .from(perpetualPositions)
      .where(and(...conditions))
      .orderBy(desc(perpetualPositions.createdAt));

    return results;
  } catch (error) {
    repositoryLogger.error("Error in getPerpsPositions:", error);
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
async function createPerpsAccountSummaryInTransactionImpl(
  tx: DatabaseTransaction | typeof db,
  summary: InsertPerpsAccountSummary,
): Promise<SelectPerpsAccountSummary> {
  try {
    const database = tx || db;
    const [result] = await database
      .insert(perpsAccountSummaries)
      .values(summary)
      .returning();

    if (!result) {
      throw new Error("Failed to create perps account summary");
    }

    repositoryLogger.debug(
      `[PerpsRepository] Created account summary for agent ${summary.agentId}`,
    );

    return result;
  } catch (error) {
    repositoryLogger.error("Error in createPerpsAccountSummary:", error);
    throw error;
  }
}

/**
 * Create perps account summary (convenience wrapper)
 * @param summary Summary data to create
 * @returns Created summary
 */
async function createPerpsAccountSummaryImpl(
  summary: InsertPerpsAccountSummary,
): Promise<SelectPerpsAccountSummary> {
  return createPerpsAccountSummaryInTransactionImpl(db, summary);
}

/**
 * Batch create multiple account summaries efficiently
 * @param summaries Array of summary data to create
 * @returns Array of created summaries
 */
async function batchCreatePerpsAccountSummariesImpl(
  summaries: InsertPerpsAccountSummary[],
): Promise<SelectPerpsAccountSummary[]> {
  if (summaries.length === 0) {
    return [];
  }

  try {
    const results = await db
      .insert(perpsAccountSummaries)
      .values(summaries)
      .returning();

    repositoryLogger.debug(
      `[PerpsRepository] Batch created ${results.length} account summaries`,
    );

    return results;
  } catch (error) {
    repositoryLogger.error("Error in batchCreatePerpsAccountSummaries:", error);
    throw error;
  }
}

/**
 * Get latest perps account summary for an agent
 * @param agentId Agent ID
 * @param competitionId Competition ID
 * @returns Latest summary or null
 */
async function getLatestPerpsAccountSummaryImpl(
  agentId: string,
  competitionId: string,
): Promise<SelectPerpsAccountSummary | null> {
  try {
    const [result] = await dbRead
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
    repositoryLogger.error("Error in getLatestPerpsAccountSummary:", error);
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
async function createPerpsSelfFundingAlertImpl(
  alert: InsertPerpsSelfFundingAlert,
): Promise<SelectPerpsSelfFundingAlert> {
  try {
    const [result] = await db
      .insert(perpsSelfFundingAlerts)
      .values(alert)
      .returning();

    if (!result) {
      throw new Error("Failed to create perps self-funding alert");
    }

    repositoryLogger.warn(
      `[PerpsRepository] Created self-funding alert for agent ${alert.agentId}: $${alert.unexplainedAmount}`,
    );

    return result;
  } catch (error) {
    repositoryLogger.error("Error in createPerpsSelfFundingAlert:", error);
    throw error;
  }
}

/**
 * Batch create multiple self-funding alerts in a single transaction
 * @param alerts Array of alert data to create
 * @returns Array of created alerts
 */
async function batchCreatePerpsSelfFundingAlertsImpl(
  alerts: InsertPerpsSelfFundingAlert[],
): Promise<SelectPerpsSelfFundingAlert[]> {
  if (alerts.length === 0) {
    return [];
  }

  try {
    const results = await db
      .insert(perpsSelfFundingAlerts)
      .values(alerts)
      .returning();

    for (const alert of results) {
      repositoryLogger.warn(
        `[PerpsRepository] Created self-funding alert for agent ${alert.agentId}: $${alert.unexplainedAmount}`,
      );
    }

    repositoryLogger.info(
      `[PerpsRepository] Batch created ${results.length} self-funding alerts`,
    );

    return results;
  } catch (error) {
    repositoryLogger.error(
      "Error in batchCreatePerpsSelfFundingAlerts:",
      error,
    );
    throw error;
  }
}

/**
 * Get unreviewed self-funding alerts for a competition
 * @param competitionId Competition ID
 * @returns Array of unreviewed alerts
 */
async function getUnreviewedPerpsAlertsImpl(
  competitionId: string,
): Promise<SelectPerpsSelfFundingAlert[]> {
  try {
    const alerts = await dbRead
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
    repositoryLogger.error("Error in getUnreviewedPerpsAlerts:", error);
    throw error;
  }
}

/**
 * Review a self-funding alert
 * @param alertId Alert ID
 * @param reviewData Review information
 * @returns Updated alert or null
 */
async function reviewPerpsSelfFundingAlertImpl(
  alertId: string,
  reviewData: PerpsSelfFundingAlertReview,
): Promise<SelectPerpsSelfFundingAlert | null> {
  try {
    const [result] = await db
      .update(perpsSelfFundingAlerts)
      .set(reviewData)
      .where(eq(perpsSelfFundingAlerts.id, alertId))
      .returning();

    if (!result) {
      return null;
    }

    repositoryLogger.info(
      `[PerpsRepository] Reviewed self-funding alert ${alertId}: action=${reviewData.actionTaken}`,
    );

    return result;
  } catch (error) {
    repositoryLogger.error("Error in reviewPerpsSelfFundingAlert:", error);
    throw error;
  }
}

/**
 * Get self-funding alerts for an agent
 * @param agentId Agent ID
 * @param competitionId Competition ID
 * @returns Array of alerts
 */
async function getAgentSelfFundingAlertsImpl(
  agentId: string,
  competitionId: string,
): Promise<SelectPerpsSelfFundingAlert[]> {
  try {
    const alerts = await dbRead
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
    repositoryLogger.error("Error in getAgentSelfFundingAlerts:", error);
    throw error;
  }
}

/**
 * Batch get self-funding alerts for multiple agents
 * @param agentIds Array of agent IDs
 * @param competitionId Competition ID
 * @returns Map of agent ID to their alerts
 */
async function batchGetAgentsSelfFundingAlertsImpl(
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
    const batchSize = 500; // PostgreSQL can handle large IN clauses efficiently
    const allAlerts: SelectPerpsSelfFundingAlert[] = [];

    for (let i = 0; i < agentIds.length; i += batchSize) {
      const batchAgentIds = agentIds.slice(i, i + batchSize);

      const batchAlerts = await dbRead
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

    repositoryLogger.debug(
      `[PerpsRepository] Batch fetched alerts for ${agentIds.length} agents in ${Math.ceil(agentIds.length / batchSize)} batches: found ${allAlerts.length} total alerts`,
    );

    return alertsMap;
  } catch (error) {
    repositoryLogger.error("Error in batchGetAgentsSelfFundingAlerts:", error);
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
async function syncAgentPerpsDataImpl(
  agentId: string,
  competitionId: string,
  positions: InsertPerpetualPosition[],
  accountSummary: InsertPerpsAccountSummary,
): Promise<AgentPerpsSyncResult> {
  return await db.transaction(async (tx) => {
    try {
      // 1. Batch upsert all current positions
      const syncedPositions = await batchUpsertPerpsPositionsInTransactionImpl(
        tx,
        positions,
      );

      // 2. Close positions that weren't in the update (no longer open)
      const updatedPositionIds = positions
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
            inArray(perpetualPositions.providerPositionId, updatedPositionIds),
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
      const summary = await createPerpsAccountSummaryInTransactionImpl(
        tx,
        accountSummary,
      );

      repositoryLogger.info(
        `[PerpsRepository] Synced agent ${agentId}: ${syncedPositions.length} positions, equity=$${accountSummary.totalEquity}`,
      );

      return {
        positions: syncedPositions,
        summary,
      };
    } catch (error) {
      repositoryLogger.error(
        `[PerpsRepository] Failed to sync agent ${agentId}:`,
        error,
      );
      throw error;
    }
  });
}

/**
 * Batch sync multiple agents' perps data efficiently
 * Processes agents in controlled batches to avoid database contention
 * @param agentSyncData Array of agent sync data
 * @returns Results with successes and failures
 */
async function batchSyncAgentsPerpsDataImpl(
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
        syncAgentPerpsDataImpl(
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
        repositoryLogger.error(
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

  repositoryLogger.info(
    `[PerpsRepository] Batch sync completed: ${successful.length} successful, ${failed.length} failed`,
  );

  return { successful, failed };
}

// =============================================================================
// AGGREGATION QUERIES
// =============================================================================

/**
 * Get latest account summaries for all agents in a competition, sorted for leaderboard
 * @param competitionId Competition ID
 * @returns Array of latest account summaries sorted by totalEquity DESC
 */
async function getCompetitionLeaderboardSummariesImpl(
  competitionId: string,
): Promise<SelectPerpsAccountSummary[]> {
  try {
    // Single efficient query using DISTINCT ON to get latest per agent
    // Then sort by totalEquity for leaderboard
    const summaries = await dbRead
      .selectDistinctOn([perpsAccountSummaries.agentId])
      .from(perpsAccountSummaries)
      .innerJoin(
        competitionAgents,
        and(
          eq(perpsAccountSummaries.agentId, competitionAgents.agentId),
          eq(
            perpsAccountSummaries.competitionId,
            competitionAgents.competitionId,
          ),
          eq(competitionAgents.status, "active"), // Only active agents
        ),
      )
      .where(eq(perpsAccountSummaries.competitionId, competitionId))
      .orderBy(
        perpsAccountSummaries.agentId,
        desc(perpsAccountSummaries.timestamp),
      );

    // Sort by totalEquity DESC for leaderboard (in memory since DISTINCT ON requires specific order)
    // This is still efficient as we've already filtered to just the latest summaries
    const sortedSummaries = summaries
      .map((row) => row.perps_account_summaries) // Extract just the summary part
      .sort((a, b) => {
        const aEquity = Number(a.totalEquity) || 0;
        const bEquity = Number(b.totalEquity) || 0;
        return bEquity - aEquity;
      });

    repositoryLogger.debug(
      `[PerpsRepository] Retrieved ${sortedSummaries.length} account summaries for competition leaderboard`,
    );

    return sortedSummaries;
  } catch (error) {
    repositoryLogger.error(
      "Error in getCompetitionLeaderboardSummaries:",
      error,
    );
    throw error;
  }
}

/**
 * Get perps competition statistics using efficient SQL aggregations
 * @param competitionId Competition ID
 * @returns Competition statistics
 */
async function getPerpsCompetitionStatsImpl(
  competitionId: string,
): Promise<PerpsCompetitionStats> {
  try {
    // Use a subquery to get the latest summary per agent, then aggregate
    const statsQuery = dbRead
      .selectDistinctOn([perpsAccountSummaries.agentId], {
        agentId: perpsAccountSummaries.agentId,
        totalEquity: perpsAccountSummaries.totalEquity,
        totalVolume: perpsAccountSummaries.totalVolume,
      })
      .from(perpsAccountSummaries)
      .where(eq(perpsAccountSummaries.competitionId, competitionId))
      .orderBy(
        perpsAccountSummaries.agentId,
        desc(perpsAccountSummaries.timestamp),
      )
      .as("latest");

    // Aggregate the latest summaries
    const [stats] = await dbRead
      .select({
        totalAgents: drizzleCount(statsQuery.agentId),
        totalVolume: sum(statsQuery.totalVolume),
        averageEquity: avg(statsQuery.totalEquity),
      })
      .from(statsQuery);

    // Get position count separately (can't join easily with the subquery)
    const [positionStats] = await dbRead
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
    repositoryLogger.error("Error in getPerpsCompetitionStats:", error);
    throw error;
  }
}

/**
 * Count positions for an agent across multiple competitions in bulk
 * @param agentId Agent ID
 * @param competitionIds Array of competition IDs
 * @returns Map of competition ID to position count
 */
async function countBulkAgentPositionsInCompetitionsImpl(
  agentId: string,
  competitionIds: string[],
): Promise<Map<string, number>> {
  if (competitionIds.length === 0) {
    return new Map();
  }

  try {
    repositoryLogger.debug(
      `countBulkAgentPositionsInCompetitions called for agent ${agentId} in ${competitionIds.length} competitions`,
    );

    // Get position counts for all competitions in one query
    const results = await dbRead
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

    repositoryLogger.debug(
      `Found positions in ${results.length}/${competitionIds.length} competitions`,
    );

    return countMap;
  } catch (error) {
    repositoryLogger.error(
      "Error in countBulkAgentPositionsInCompetitions:",
      error,
    );
    throw error;
  }
}

/**
 * Get all perps positions for a competition with pagination
 * Similar to getCompetitionTradesImpl but for perps positions
 * @param competitionId Competition ID
 * @param limit Optional result limit
 * @param offset Optional result offset
 * @param statusFilter Optional status filter (defaults to "Open")
 * @returns Object with positions array and total count
 */
async function getCompetitionPerpsPositionsImpl(
  competitionId: string,
  limit?: number,
  offset?: number,
  statusFilter?: string,
) {
  try {
    const conditions = [eq(perpetualPositions.competitionId, competitionId)];

    // Default to showing only open positions unless specified otherwise
    if (statusFilter !== "all") {
      conditions.push(eq(perpetualPositions.status, statusFilter || "Open"));
    }

    // Build the main query with agent join - following same pattern as getCompetitionTradesImpl
    const positionsQuery = dbRead
      .select({
        // All position fields from perpetualPositions table
        id: perpetualPositions.id,
        competitionId: perpetualPositions.competitionId,
        agentId: perpetualPositions.agentId,
        providerPositionId: perpetualPositions.providerPositionId,
        providerTradeId: perpetualPositions.providerTradeId,
        asset: perpetualPositions.asset,
        isLong: perpetualPositions.isLong,
        leverage: perpetualPositions.leverage,
        positionSize: perpetualPositions.positionSize,
        collateralAmount: perpetualPositions.collateralAmount,
        entryPrice: perpetualPositions.entryPrice,
        currentPrice: perpetualPositions.currentPrice,
        liquidationPrice: perpetualPositions.liquidationPrice,
        pnlUsdValue: perpetualPositions.pnlUsdValue,
        pnlPercentage: perpetualPositions.pnlPercentage,
        status: perpetualPositions.status,
        createdAt: perpetualPositions.createdAt,
        lastUpdatedAt: perpetualPositions.lastUpdatedAt,
        closedAt: perpetualPositions.closedAt,
        capturedAt: perpetualPositions.capturedAt,
        // Agent info embedded like in trades
        agent: {
          id: agents.id,
          name: agents.name,
          imageUrl: agents.imageUrl,
          description: agents.description,
        },
      })
      .from(perpetualPositions)
      .leftJoin(agents, eq(perpetualPositions.agentId, agents.id))
      .where(and(...conditions))
      .orderBy(desc(perpetualPositions.lastUpdatedAt));

    // Apply pagination
    if (limit !== undefined) {
      positionsQuery.limit(limit);
    }

    if (offset !== undefined) {
      positionsQuery.offset(offset);
    }

    // Build count query
    const totalQuery = dbRead
      .select({ count: drizzleCount() })
      .from(perpetualPositions)
      .where(and(...conditions));

    // Execute both queries in parallel for efficiency
    const [results, total] = await Promise.all([positionsQuery, totalQuery]);

    return {
      positions: results,
      total: total[0]?.count ?? 0,
    };
  } catch (error) {
    repositoryLogger.error("Error in getCompetitionPerpsPositions:", error);
    throw error;
  }
}

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

export const createPerpsCompetitionConfig = createTimedRepositoryFunction(
  createPerpsCompetitionConfigImpl,
  "PerpsRepository",
  "createPerpsCompetitionConfig",
);

export const getPerpsCompetitionConfig = createTimedRepositoryFunction(
  getPerpsCompetitionConfigImpl,
  "PerpsRepository",
  "getPerpsCompetitionConfig",
);

export const upsertPerpsPosition = createTimedRepositoryFunction(
  upsertPerpsPositionImpl,
  "PerpsRepository",
  "upsertPerpsPosition",
);

export const batchUpsertPerpsPositions = createTimedRepositoryFunction(
  (positions: InsertPerpetualPosition[]) =>
    batchUpsertPerpsPositionsInTransactionImpl(db, positions),
  "PerpsRepository",
  "batchUpsertPerpsPositions",
);

export const getPerpsPositions = createTimedRepositoryFunction(
  getPerpsPositionsImpl,
  "PerpsRepository",
  "getPerpsPositions",
);

export const createPerpsAccountSummary = createTimedRepositoryFunction(
  createPerpsAccountSummaryImpl,
  "PerpsRepository",
  "createPerpsAccountSummary",
);

export const batchCreatePerpsAccountSummaries = createTimedRepositoryFunction(
  batchCreatePerpsAccountSummariesImpl,
  "PerpsRepository",
  "batchCreatePerpsAccountSummaries",
);

export const getLatestPerpsAccountSummary = createTimedRepositoryFunction(
  getLatestPerpsAccountSummaryImpl,
  "PerpsRepository",
  "getLatestPerpsAccountSummary",
);

export const createPerpsSelfFundingAlert = createTimedRepositoryFunction(
  createPerpsSelfFundingAlertImpl,
  "PerpsRepository",
  "createPerpsSelfFundingAlert",
);

export const batchCreatePerpsSelfFundingAlerts = createTimedRepositoryFunction(
  batchCreatePerpsSelfFundingAlertsImpl,
  "PerpsRepository",
  "batchCreatePerpsSelfFundingAlerts",
);

export const getUnreviewedPerpsAlerts = createTimedRepositoryFunction(
  getUnreviewedPerpsAlertsImpl,
  "PerpsRepository",
  "getUnreviewedPerpsAlerts",
);

export const reviewPerpsSelfFundingAlert = createTimedRepositoryFunction(
  reviewPerpsSelfFundingAlertImpl,
  "PerpsRepository",
  "reviewPerpsSelfFundingAlert",
);

export const getAgentSelfFundingAlerts = createTimedRepositoryFunction(
  getAgentSelfFundingAlertsImpl,
  "PerpsRepository",
  "getAgentSelfFundingAlerts",
);

export const batchGetAgentsSelfFundingAlerts = createTimedRepositoryFunction(
  batchGetAgentsSelfFundingAlertsImpl,
  "PerpsRepository",
  "batchGetAgentsSelfFundingAlerts",
);

export const getPerpsCompetitionStats = createTimedRepositoryFunction(
  getPerpsCompetitionStatsImpl,
  "PerpsRepository",
  "getPerpsCompetitionStats",
);

export const getCompetitionLeaderboardSummaries = createTimedRepositoryFunction(
  getCompetitionLeaderboardSummariesImpl,
  "PerpsRepository",
  "getCompetitionLeaderboardSummaries",
);

export const syncAgentPerpsData = createTimedRepositoryFunction(
  syncAgentPerpsDataImpl,
  "PerpsRepository",
  "syncAgentPerpsData",
);

export const batchSyncAgentsPerpsData = createTimedRepositoryFunction(
  batchSyncAgentsPerpsDataImpl,
  "PerpsRepository",
  "batchSyncAgentsPerpsData",
);

export const countBulkAgentPositionsInCompetitions =
  createTimedRepositoryFunction(
    countBulkAgentPositionsInCompetitionsImpl,
    "PerpsRepository",
    "countBulkAgentPositionsInCompetitions",
  );

export const getCompetitionPerpsPositions = createTimedRepositoryFunction(
  getCompetitionPerpsPositionsImpl,
  "PerpsRepository",
  "getCompetitionPerpsPositions",
);
