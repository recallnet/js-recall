import {
  AnyColumn,
  and,
  asc,
  desc,
  count as drizzleCount,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  lte,
  max,
  min,
  sql,
} from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import { v4 as uuidv4 } from "uuid";

import { db, dbRead } from "@/database/db.js";
import {
  competitionAgents,
  competitions,
  competitionsLeaderboard,
} from "@/database/schema/core/defs.js";
import {
  InsertCompetition,
  InsertCompetitionsLeaderboard,
  UpdateCompetition,
} from "@/database/schema/core/types.js";
import {
  portfolioSnapshots,
  portfolioTokenValues,
  tradingCompetitions,
  tradingCompetitionsLeaderboard,
} from "@/database/schema/trading/defs.js";
import { InsertTradingCompetition } from "@/database/schema/trading/types.js";
import {
  InsertPortfolioSnapshot,
  InsertPortfolioTokenValue,
} from "@/database/schema/trading/types.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";
import {
  COMPETITION_AGENT_STATUS,
  COMPETITION_STATUS,
  CompetitionAgentStatus,
  CompetitionStatus,
  PagingParams,
} from "@/types/index.js";

import { getSort } from "./helpers.js";
import { PartialExcept } from "./types.js";

/**
 * Competition Repository
 * Handles database operations for competitions
 */

/**
 * allowable order by database columns
 */
const competitionOrderByFields: Record<string, AnyColumn> = {
  id: competitions.id,
  name: competitions.name,
  description: competitions.description,
  externalUrl: competitions.externalUrl,
  imageUrl: competitions.imageUrl,
  startDate: competitions.startDate,
  endDate: competitions.endDate,
  createdAt: competitions.createdAt,
};

interface Snapshot24hResult {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  earliestSnapshots: Array<any>;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  snapshots24hAgo: Array<any>;
}

const snapshotCache = new Map<string, [number, Snapshot24hResult]>();
const MAX_CACHE_AGE = 1000 * 60 * 5; // 5 minutes

/**
 * Find all competitions
 */
async function findAllImpl() {
  return await dbRead
    .select({
      crossChainTradingType: tradingCompetitions.crossChainTradingType,
      ...getTableColumns(competitions),
    })
    .from(tradingCompetitions)
    .innerJoin(
      competitions,
      eq(tradingCompetitions.competitionId, competitions.id),
    );
}

/**
 * Find a competition by ID
 * @param id The ID to search for
 */
async function findByIdImpl(id: string) {
  const [result] = await dbRead
    .select({
      crossChainTradingType: tradingCompetitions.crossChainTradingType,
      ...getTableColumns(competitions),
    })
    .from(tradingCompetitions)
    .innerJoin(
      competitions,
      eq(tradingCompetitions.competitionId, competitions.id),
    )
    .where(eq(competitions.id, id))
    .limit(1);
  return result;
}

/**
 * Create a new competition
 * @param competition Competition to create
 */
async function createImpl(
  competition: InsertCompetition &
    Omit<InsertTradingCompetition, "competitionId">,
) {
  const result = await db.transaction(async (tx) => {
    const now = new Date();
    const [comp] = await tx
      .insert(competitions)
      .values({
        ...competition,
        createdAt: competition.createdAt || now,
        updatedAt: competition.updatedAt || now,
      })
      .returning();
    const [tradingComp] = await tx
      .insert(tradingCompetitions)
      .values({
        competitionId: comp!.id,
        crossChainTradingType: competition.crossChainTradingType,
      })
      .returning();
    return { ...comp!, ...tradingComp! };
  });
  return result;
}

/**
 * Update an existing competition and trading_competition in a transaction
 * @param competition Competition to update
 */
async function updateImpl(
  competition: PartialExcept<InsertCompetition, "id"> &
    Partial<Omit<InsertTradingCompetition, "competitionId">>,
) {
  try {
    const result = await db.transaction(async (tx) => {
      const [comp] = await tx
        .update(competitions)
        .set({
          ...competition,
          updatedAt: competition.updatedAt || new Date(),
        })
        .where(eq(competitions.id, competition.id))
        .returning();

      const [tradingComp] = await tx
        .update(tradingCompetitions)
        .set({
          ...competition,
        })
        .where(eq(tradingCompetitions.competitionId, competition.id))
        .returning();

      return { ...comp!, ...tradingComp! };
    });
    return result;
  } catch (error) {
    console.error("[CompetitionRepository] Error in update:", error);
    throw error;
  }
}

/**
 * Update a single competition by ID
 * @param competitionId Competition ID
 * @param updateData Update data for the competition
 */
async function updateOneImpl(
  competitionId: string,
  updateData: UpdateCompetition,
) {
  try {
    const [result] = await db
      .update(competitions)
      .set({
        ...updateData,
        updatedAt: updateData.updatedAt || new Date(),
      })
      .where(eq(competitions.id, competitionId))
      .returning();

    if (!result) {
      throw new Error(`Competition with ID ${competitionId} not found`);
    }

    return result;
  } catch (error) {
    console.error("[CompetitionRepository] Error in updateOne:", error);
    throw error;
  }
}

/**
 * Add a single agent to a competition
 * @param competitionId Competition ID
 * @param agentId Agent ID to add
 */
async function addAgentToCompetitionImpl(
  competitionId: string,
  agentId: string,
) {
  try {
    await db
      .insert(competitionAgents)
      .values({
        competitionId,
        agentId,
        status: COMPETITION_AGENT_STATUS.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error(
      `[CompetitionRepository] Error adding agent ${agentId} to competition ${competitionId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Remove an agent from a competition
 * @param competitionId Competition ID
 * @param agentId Agent ID to remove
 * @returns Boolean indicating if a row was deleted
 */
async function removeAgentFromCompetitionImpl(
  competitionId: string,
  agentId: string,
  reason?: string,
): Promise<boolean> {
  try {
    const result = await db
      .update(competitionAgents)
      .set({
        status: COMPETITION_AGENT_STATUS.DISQUALIFIED,
        deactivationReason: reason || "Disqualified from competition",
        deactivatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(competitionAgents.competitionId, competitionId),
          eq(competitionAgents.agentId, agentId),
          eq(competitionAgents.status, COMPETITION_AGENT_STATUS.ACTIVE),
        ),
      )
      .returning();

    const wasUpdated = result.length > 0;

    if (wasUpdated) {
      console.log(
        `[CompetitionRepository] Removed agent ${agentId} from competition ${competitionId}`,
      );
    } else {
      console.log(
        `[CompetitionRepository] No active agent ${agentId} found in competition ${competitionId} to remove`,
      );
    }

    return wasUpdated;
  } catch (error) {
    console.error(
      `[CompetitionRepository] Error removing agent ${agentId} from competition ${competitionId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Add agents to a competition
 * @param competitionId Competition ID
 * @param agentIds Array of agent IDs
 */
async function addAgentsImpl(competitionId: string, agentIds: string[]) {
  const now = new Date();
  const values = agentIds.map((agentId) => ({
    competitionId,
    agentId,
    status: COMPETITION_AGENT_STATUS.ACTIVE,
    createdAt: now,
    updatedAt: now,
  }));
  try {
    await db.insert(competitionAgents).values(values).onConflictDoNothing();
  } catch (error) {
    console.error("[CompetitionRepository] Error in addAgents:", error);
    throw error;
  }
}

/**
 * Get agents in a competition
 * @param competitionId Competition ID
 * @param status Optional status filter - defaults to active only
 */
async function getAgentsImpl(
  competitionId: string,
  status: CompetitionAgentStatus = COMPETITION_AGENT_STATUS.ACTIVE,
) {
  try {
    const result = await dbRead
      .select({ agentId: competitionAgents.agentId })
      .from(competitionAgents)
      .where(
        and(
          eq(competitionAgents.competitionId, competitionId),
          eq(competitionAgents.status, status),
        ),
      );

    return result.map((row) => row.agentId);
  } catch (error) {
    console.error("[CompetitionRepository] Error in getAgents:", error);
    throw error;
  }
}

/**
 * Alias for getAgents for better semantic naming
 * @param competitionId Competition ID
 * @param status Optional status filter - defaults to active only
 */
async function getCompetitionAgentsImpl(
  competitionId: string,
  status?: CompetitionAgentStatus,
) {
  return getAgentsImpl(competitionId, status);
}

/**
 * Check if an agent is actively participating in a competition
 * @param competitionId Competition ID
 * @param agentId Agent ID
 * @returns boolean indicating if agent is active in the competition
 */
async function isAgentActiveInCompetitionImpl(
  competitionId: string,
  agentId: string,
): Promise<boolean> {
  try {
    const result = await dbRead
      .select({ agentId: competitionAgents.agentId })
      .from(competitionAgents)
      .where(
        and(
          eq(competitionAgents.competitionId, competitionId),
          eq(competitionAgents.agentId, agentId),
          eq(competitionAgents.status, COMPETITION_AGENT_STATUS.ACTIVE),
        ),
      )
      .limit(1);

    return result.length > 0;
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in isAgentActiveInCompetition:",
      error,
    );
    throw error;
  }
}

/**
 * Get the status of an agent in a competition
 * @param competitionId Competition ID
 * @param agentId Agent ID
 * @returns The agent's status in the competition, or null if not found
 */
async function getAgentCompetitionStatusImpl(
  competitionId: string,
  agentId: string,
): Promise<CompetitionAgentStatus | null> {
  try {
    const result = await dbRead
      .select({ status: competitionAgents.status })
      .from(competitionAgents)
      .where(
        and(
          eq(competitionAgents.competitionId, competitionId),
          eq(competitionAgents.agentId, agentId),
        ),
      )
      .limit(1);

    return result.length > 0 ? result[0]!.status : null;
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in getAgentCompetitionStatus:",
      error,
    );
    throw error;
  }
}

/**
 * Get an agent's competition record with full details
 * @param competitionId Competition ID
 * @param agentId Agent ID
 * @returns The agent's competition record or null if not found
 */
async function getAgentCompetitionRecordImpl(
  competitionId: string,
  agentId: string,
): Promise<{
  status: CompetitionAgentStatus;
  deactivationReason: string | null;
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
} | null> {
  try {
    const result = await dbRead
      .select({
        status: competitionAgents.status,
        deactivationReason: competitionAgents.deactivationReason,
        deactivatedAt: competitionAgents.deactivatedAt,
        createdAt: competitionAgents.createdAt,
        updatedAt: competitionAgents.updatedAt,
      })
      .from(competitionAgents)
      .where(
        and(
          eq(competitionAgents.competitionId, competitionId),
          eq(competitionAgents.agentId, agentId),
        ),
      )
      .limit(1);

    return result.length > 0 ? result[0]! : null;
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in getAgentCompetitionRecord:",
      error,
    );
    throw error;
  }
}

/**
 * Get competition records for multiple agents efficiently
 * This replaces N calls to getAgentCompetitionRecord with a single bulk operation
 * @param competitionId Competition ID
 * @param agentIds Array of agent IDs to get records for
 * @returns Array of agent competition records
 */
export async function getBulkAgentCompetitionRecords(
  competitionId: string,
  agentIds: string[],
): Promise<
  Array<{
    agentId: string;
    status: CompetitionAgentStatus;
    deactivationReason: string | null;
    deactivatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>
> {
  if (agentIds.length === 0) {
    return [];
  }

  try {
    console.log(
      `[CompetitionRepository] getBulkAgentCompetitionRecords called for ${agentIds.length} agents in competition ${competitionId}`,
    );

    const result = await dbRead
      .select({
        agentId: competitionAgents.agentId,
        status: competitionAgents.status,
        deactivationReason: competitionAgents.deactivationReason,
        deactivatedAt: competitionAgents.deactivatedAt,
        createdAt: competitionAgents.createdAt,
        updatedAt: competitionAgents.updatedAt,
      })
      .from(competitionAgents)
      .where(
        and(
          eq(competitionAgents.competitionId, competitionId),
          inArray(competitionAgents.agentId, agentIds),
        ),
      );

    console.log(
      `[CompetitionRepository] Retrieved ${result.length} competition records for ${agentIds.length} agents`,
    );

    return result;
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in getBulkAgentCompetitionRecords:",
      error,
    );
    throw error;
  }
}

/**
 * Update an agent's status in a competition
 * @param competitionId Competition ID
 * @param agentId Agent ID
 * @param status New status
 * @param reason Optional reason for the status change
 * @returns boolean indicating if the update was successful
 */
async function updateAgentCompetitionStatusImpl(
  competitionId: string,
  agentId: string,
  status: CompetitionAgentStatus,
  reason?: string,
): Promise<boolean> {
  try {
    const baseUpdateData = {
      status,
      updatedAt: new Date(),
    };

    // Add deactivation fields when moving to inactive status, clear them when reactivating
    const updateData =
      status !== COMPETITION_AGENT_STATUS.ACTIVE
        ? {
            ...baseUpdateData,
            deactivationReason: reason || `Status changed to ${status}`,
            deactivatedAt: new Date(),
          }
        : {
            ...baseUpdateData,
            deactivationReason: null,
            deactivatedAt: null,
          };

    const result = await db
      .update(competitionAgents)
      .set(updateData)
      .where(
        and(
          eq(competitionAgents.competitionId, competitionId),
          eq(competitionAgents.agentId, agentId),
        ),
      )
      .returning();

    const wasUpdated = result.length > 0;

    if (wasUpdated) {
      console.log(
        `[CompetitionRepository] Updated agent ${agentId} status to ${status} in competition ${competitionId}`,
      );
    }

    return wasUpdated;
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in updateAgentCompetitionStatusImpl:",
      error,
    );
    throw error;
  }
}

/**
 * Mark an agent as having left a competition voluntarily
 * @param competitionId Competition ID
 * @param agentId Agent ID
 * @param reason Optional reason for leaving
 * @returns boolean indicating if the update was successful
 */
async function markAgentAsWithdrawnImpl(
  competitionId: string,
  agentId: string,
  reason?: string,
): Promise<boolean> {
  return updateAgentCompetitionStatusImpl(
    competitionId,
    agentId,
    COMPETITION_AGENT_STATUS.WITHDRAWN,
    reason || "Agent withdrew from competition voluntarily",
  );
}

/**
 * Find active competition
 */
async function findActiveImpl() {
  try {
    const [result] = await dbRead
      .select({
        crossChainTradingType: tradingCompetitions.crossChainTradingType,
        ...getTableColumns(competitions),
      })
      .from(tradingCompetitions)
      .innerJoin(
        competitions,
        eq(tradingCompetitions.competitionId, competitions.id),
      )
      .where(eq(competitions.status, COMPETITION_STATUS.ACTIVE))
      .limit(1);
    return result;
  } catch (error) {
    console.error("[CompetitionRepository] Error in findActive:", error);
    throw error;
  }
}

/**
 * Create a portfolio snapshot
 * @param snapshot Portfolio snapshot data
 */
async function createPortfolioSnapshotImpl(snapshot: InsertPortfolioSnapshot) {
  try {
    const [result] = await db
      .insert(portfolioSnapshots)
      .values({
        ...snapshot,
        timestamp: snapshot.timestamp || new Date(),
      })
      .returning();

    if (!result) {
      throw new Error(
        "Failed to create portfolio snapshot - no result returned",
      );
    }

    return result;
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in createPortfolioSnapshot:",
      error,
    );
    throw error;
  }
}

/**
 * Insert multiple portfolio token values in a batch operation
 * @param tokenValues Array of portfolio token values to insert
 * @returns Array of inserted portfolio token values
 */
async function batchCreatePortfolioTokenValuesImpl(
  tokenValues: Omit<InsertPortfolioTokenValue, "id">[],
) {
  if (!tokenValues.length) {
    return [];
  }

  try {
    console.log(
      `[CompetitionRepository] Batch inserting ${tokenValues.length} portfolio token values`,
    );

    const results = await db
      .insert(portfolioTokenValues)
      .values(tokenValues)
      .returning();

    console.log(
      `[CompetitionRepository] Successfully inserted ${results.length} portfolio token values`,
    );

    return results;
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error batch inserting portfolio token values:",
      error,
    );
    throw error;
  }
}

/**
 * Get latest portfolio snapshots for all active agents in a competition
 * @param competitionId Competition ID
 */
async function getLatestPortfolioSnapshotsImpl(competitionId: string) {
  try {
    // TODO: this query seems to be averaging almost 2 full seconds.
    //  We added indexes on Jul 10, need to find out if indexing fixes the issue.
    const subquery = dbRead
      .select({
        agentId: portfolioSnapshots.agentId,
        maxTimestamp: max(portfolioSnapshots.timestamp).as("max_timestamp"),
      })
      .from(portfolioSnapshots)
      .innerJoin(
        competitionAgents,
        and(
          eq(portfolioSnapshots.agentId, competitionAgents.agentId),
          eq(portfolioSnapshots.competitionId, competitionAgents.competitionId),
        ),
      )
      .where(
        and(
          eq(portfolioSnapshots.competitionId, competitionId),
          eq(competitionAgents.status, COMPETITION_AGENT_STATUS.ACTIVE),
        ),
      )
      .groupBy(portfolioSnapshots.agentId)
      .as("latest_snapshots");

    const result = await dbRead
      .select()
      .from(portfolioSnapshots)
      .innerJoin(
        subquery,
        and(
          eq(portfolioSnapshots.agentId, subquery.agentId),
          eq(portfolioSnapshots.timestamp, subquery.maxTimestamp),
        ),
      )
      .where(eq(portfolioSnapshots.competitionId, competitionId));

    return result.map((row) => row.portfolio_snapshots);
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in getLatestPortfolioSnapshotsImpl:",
      error,
    );
    throw error;
  }
}

/**
 * Get portfolio snapshots for multiple agents in a competition efficiently
 * This replaces N+1 query patterns when getting snapshots for multiple agents
 * @param competitionId Competition ID
 * @param agentIds Array of agent IDs to get snapshots for
 * @returns Array of portfolio snapshots for all specified agents
 */
async function getBulkAgentPortfolioSnapshotsImpl(
  competitionId: string,
  agentIds: string[],
) {
  if (agentIds.length === 0) {
    return [];
  }

  try {
    console.log(
      `[CompetitionRepository] getBulkAgentPortfolioSnapshots called for ${agentIds.length} agents in competition ${competitionId}`,
    );

    const result = await dbRead
      .select()
      .from(portfolioSnapshots)
      .where(
        and(
          eq(portfolioSnapshots.competitionId, competitionId),
          inArray(portfolioSnapshots.agentId, agentIds),
        ),
      )
      .orderBy(desc(portfolioSnapshots.timestamp));

    console.log(
      `[CompetitionRepository] Retrieved ${result.length} portfolio snapshots for ${agentIds.length} agents`,
    );

    return result;
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in getBulkAgentPortfolioSnapshots:",
      error,
    );
    throw error;
  }
}

/**
 * Get earliest and 24h-ago snapshots for each agent
 * @param competitionId Competition ID
 * @param agentIds Array of agent IDs to get snapshots for
 * @returns Object containing earliest and 24h-ago snapshots by agent
 */
async function get24hSnapshotsImpl(
  competitionId: string,
  agentIds: string[],
): Promise<Snapshot24hResult> {
  if (agentIds.length === 0) {
    return { earliestSnapshots: [], snapshots24hAgo: [] };
  }

  console.log(
    `[CompetitionRepository] get24hSnapshotsImpl called for ${agentIds.length} agents in competition ${competitionId}`,
  );

  const cacheKey = competitionId + "-" + agentIds.join("-");
  const cachedResult = snapshotCache.get(cacheKey);
  if (cachedResult) {
    const now = Date.now();
    const [timestamp, result] = cachedResult;
    if (now - timestamp < MAX_CACHE_AGE) {
      console.log(
        `[CompetitionRepository] get24hSnapshotsImpl returning cached results`,
      );
      return result;
    }
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get earliest snapshots for each agent (for PnL calculation)
    const earliestSnapshots = await db.execute(sql`
      SELECT ps.id, ps.agent_id, ps.competition_id, ps.timestamp, ps.total_value
      FROM (SELECT UNNEST(${agentIds}::uuid[]) as agent_id) agents
      CROSS JOIN LATERAL (
        SELECT id, agent_id, competition_id, timestamp, total_value
        FROM ${sql.identifier("trading_comps", "portfolio_snapshots")} ps
        WHERE ps.agent_id = agents.agent_id
          AND ps.competition_id = ${competitionId}
        ORDER BY ps.timestamp ASC
        LIMIT 1
      ) ps
    `);

    // Get snapshots closest to 24h ago using window functions
    const snapshots24hAgo = await dbRead
      .select()
      .from(
        dbRead
          .select({
            ...getTableColumns(portfolioSnapshots),
            timeDiff:
              sql<number>`ABS(EXTRACT(EPOCH FROM ${portfolioSnapshots.timestamp} - ${twentyFourHoursAgo}))`.as(
                "time_diff",
              ),
            rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${portfolioSnapshots.agentId} ORDER BY ABS(EXTRACT(EPOCH FROM ${portfolioSnapshots.timestamp} - ${twentyFourHoursAgo})))`.as(
              "rn",
            ),
          })
          .from(portfolioSnapshots)
          .where(
            and(
              eq(portfolioSnapshots.competitionId, competitionId),
              inArray(portfolioSnapshots.agentId, agentIds),
            ),
          )
          .as("ranked_snapshots"),
      )
      .where(eq(sql`rn`, 1));

    console.log(
      `[CompetitionRepository] Retrieved ${earliestSnapshots.rows.length} earliest snapshots and ${snapshots24hAgo.length} 24h-ago snapshots for ${agentIds.length} agents`,
    );

    const result = {
      earliestSnapshots: earliestSnapshots.rows,
      snapshots24hAgo: snapshots24hAgo.map((row) => ({
        id: row.id,
        agentId: row.agentId,
        competitionId: row.competitionId,
        timestamp: row.timestamp,
        totalValue: row.totalValue,
      })),
    };

    // Cache the result
    const now = Date.now();
    snapshotCache.set(cacheKey, [now, result]);
    return result;
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in getBulkAgentMetricsSnapshots:",
      error,
    );
    throw error;
  }
}

/**
 * Get portfolio snapshots for an agent in a competition
 * @param competitionId Competition ID
 * @param agentId Agent ID
 */
async function getAgentPortfolioSnapshotsImpl(
  competitionId: string,
  agentId: string,
) {
  try {
    return await dbRead
      .select()
      .from(portfolioSnapshots)
      .where(
        and(
          eq(portfolioSnapshots.competitionId, competitionId),
          eq(portfolioSnapshots.agentId, agentId),
        ),
      )
      .orderBy(desc(portfolioSnapshots.timestamp));
    // TODO: there's no limit here, this is a weakness in perf
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in getAgentPortfolioSnapshots:",
      error,
    );
    throw error;
  }
}

/**
 * Get the newest and oldest portfolio snapshots for an agent in a competition
 * @param competitionId Competition ID
 * @param agentId Agent ID
 * @returns Object with newest and oldest snapshots, or null if no snapshots found
 */
async function getBoundedSnapshotsImpl(competitionId: string, agentId: string) {
  try {
    // Create subqueries for newest and oldest snapshots
    const newestQuery = dbRead
      .select()
      .from(portfolioSnapshots)
      .where(
        and(
          eq(portfolioSnapshots.competitionId, competitionId),
          eq(portfolioSnapshots.agentId, agentId),
        ),
      )
      .orderBy(desc(portfolioSnapshots.timestamp))
      .limit(1);

    const oldestQuery = dbRead
      .select()
      .from(portfolioSnapshots)
      .where(
        and(
          eq(portfolioSnapshots.competitionId, competitionId),
          eq(portfolioSnapshots.agentId, agentId),
        ),
      )
      .orderBy(asc(portfolioSnapshots.timestamp))
      .limit(1);

    // Union the queries and execute
    const results = await unionAll(newestQuery, oldestQuery);

    if (results.length === 0) {
      return null;
    }

    // Sort results by timestamp desc to identify newest vs oldest
    const sortedResults = results.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return {
      newest: sortedResults[0],
      oldest: sortedResults[sortedResults.length - 1],
    };
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in getAgentPortfolioSnapshotBounds:",
      error,
    );
    throw error;
  }
}

/**
 * Get agent's ranking in a specific competition
 * @param agentId Agent ID
 * @param competitionId Competition ID
 * @returns Object with rank and totalAgents, or undefined if no ranking data available
 */
async function getAgentCompetitionRankingImpl(
  agentId: string,
  competitionId: string,
): Promise<{ rank: number; totalAgents: number } | undefined> {
  try {
    // Get all latest portfolio snapshots for the competition
    const snapshots = await getLatestPortfolioSnapshotsImpl(competitionId);

    if (snapshots.length === 0) {
      return undefined; // No snapshots = no ranking data
    }

    // Sort by totalValue descending to determine rankings
    const sortedSnapshots = snapshots.sort(
      (a, b) => Number(b.totalValue) - Number(a.totalValue),
    );

    // Find the agent's rank (1-based ranking)
    const agentIndex = sortedSnapshots.findIndex(
      (snapshot) => snapshot.agentId === agentId,
    );

    // If agent not found in snapshots, return undefined
    if (agentIndex === -1) {
      return undefined; // Agent not found in snapshots = no ranking
    }

    return {
      rank: agentIndex + 1, // Convert to 1-based ranking
      totalAgents: sortedSnapshots.length,
    };
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in getAgentCompetitionRanking:",
      error,
    );
    // Return undefined on error - no reliable ranking data
    return undefined;
  }
}

/**
 * Get portfolio token values for a snapshot
 * @param snapshotId Snapshot ID
 */
async function getPortfolioTokenValuesImpl(snapshotId: number) {
  try {
    return await dbRead
      .select()
      .from(portfolioTokenValues)
      .where(eq(portfolioTokenValues.portfolioSnapshotId, snapshotId));
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in getPortfolioTokenValues:",
      error,
    );
    throw error;
  }
}

/**
 * Get all portfolio snapshots
 * @param competitionId Optional competition ID to filter by
 */
async function getAllPortfolioSnapshotsImpl(competitionId?: string) {
  try {
    const query = dbRead
      .select()
      .from(portfolioSnapshots)
      .orderBy(desc(portfolioSnapshots.timestamp));

    if (competitionId) {
      query.where(eq(portfolioSnapshots.competitionId, competitionId));
    }

    return await query;
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in getAllPortfolioSnapshots:",
      error,
    );
    throw error;
  }
}

/**
 * Get portfolio token values for multiple snapshots
 * @param snapshotIds Array of snapshot IDs
 */
async function getPortfolioTokenValuesByIdsImpl(snapshotIds: number[]) {
  try {
    if (snapshotIds.length === 0) {
      return [];
    }

    return await dbRead
      .select()
      .from(portfolioTokenValues)
      .where(inArray(portfolioTokenValues.portfolioSnapshotId, snapshotIds));
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in getPortfolioTokenValuesByIds:",
      error,
    );
    throw error;
  }
}

/**
 * Count total number of competitions
 */
async function countImpl() {
  try {
    const [result] = await dbRead
      .select({ count: sql<number>`count(*)` })
      .from(competitions);

    return result?.count ?? 0;
  } catch (error) {
    console.error("[CompetitionRepository] Error in count:", error);
    throw error;
  }
}

/**
 * Count the number of finished competitions an agent has participated in
 * @param agentId The ID of the agent
 * @returns The number of finished competitions the agent has participated in
 */
async function countAgentCompetitionsImpl(agentId: string): Promise<number> {
  try {
    const [result] = await dbRead
      .select({ count: drizzleCount() })
      .from(competitionAgents)
      .innerJoin(
        competitions,
        eq(competitionAgents.competitionId, competitions.id),
      )
      .where(
        and(
          eq(competitionAgents.agentId, agentId),
          eq(competitions.status, COMPETITION_STATUS.ENDED),
        ),
      );

    return result?.count ?? 0;
  } catch (error) {
    console.error(
      `[CompetitionRepository] Error counting competitions for agent ${agentId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Find competitions by status, or default to all competitions if no status is provided
 * @param status Competition status
 * @param params Pagination parameters
 * @returns Object containing competitions array and total count
 */
async function findByStatusImpl({
  status,
  params,
}: {
  status: CompetitionStatus | undefined;
  params: PagingParams;
}) {
  try {
    // Count query
    const countResult = await (() => {
      if (status) {
        return dbRead
          .select({ count: drizzleCount() })
          .from(tradingCompetitions)
          .innerJoin(
            competitions,
            eq(tradingCompetitions.competitionId, competitions.id),
          )
          .where(eq(competitions.status, status));
      } else {
        return dbRead
          .select({ count: drizzleCount() })
          .from(tradingCompetitions)
          .innerJoin(
            competitions,
            eq(tradingCompetitions.competitionId, competitions.id),
          );
      }
    })();

    const total = countResult[0]?.count ?? 0;

    // Data query with dynamic building
    let dataQuery = dbRead
      .select({
        crossChainTradingType: tradingCompetitions.crossChainTradingType,
        ...getTableColumns(competitions),
      })
      .from(tradingCompetitions)
      .innerJoin(
        competitions,
        eq(tradingCompetitions.competitionId, competitions.id),
      )
      .$dynamic();

    if (status) {
      dataQuery = dataQuery.where(eq(competitions.status, status));
    }

    if (params.sort) {
      dataQuery = getSort(dataQuery, params.sort, competitionOrderByFields);
    }

    const competitionResults = await dataQuery
      .limit(params.limit)
      .offset(params.offset);

    return { competitions: competitionResults, total };
  } catch (error) {
    console.error("[CompetitionRepository] Error in findByStatus:", error);
    throw error;
  }
}

/**
 * Find the best placement of an agent across all competitions
 * @param agentId The agent ID
 * @returns The agent best placement
 */
async function findBestPlacementForAgentImpl(agentId: string) {
  try {
    const [rankResult] = await dbRead
      .select()
      .from(competitionsLeaderboard)
      .where(eq(competitionsLeaderboard.agentId, agentId))
      .orderBy(asc(competitionsLeaderboard.rank))
      .limit(1);
    if (!rankResult) {
      return rankResult;
    }
    const [pnlResult] = await dbRead
      .select({
        ...getTableColumns(competitionsLeaderboard),
        ...getTableColumns(tradingCompetitionsLeaderboard),
      })
      .from(competitionsLeaderboard)
      .innerJoin(
        tradingCompetitionsLeaderboard,
        eq(
          competitionsLeaderboard.id,
          tradingCompetitionsLeaderboard.competitionsLeaderboardId,
        ),
      )
      .where(eq(competitionsLeaderboard.agentId, agentId))
      .orderBy(desc(tradingCompetitionsLeaderboard.pnl))
      .limit(1);
    const agents = await dbRead
      .select({
        count: drizzleCount(),
      })
      .from(competitionAgents)
      .where(eq(competitionAgents.competitionId, rankResult.competitionId));
    return {
      competitionId: rankResult.competitionId,
      rank: rankResult.rank,
      score: rankResult.score,
      pnl: pnlResult?.pnl,
      totalAgents: agents[0]?.count ?? 0,
    };
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in findAgentBestCompetitionRank:",
      error,
    );
    throw error;
  }
}

/**
 * Insert multiple leaderboard entries in a batch operation
 * @param entries Array of leaderboard entries to insert
 * @returns Array of inserted leaderboard entries
 */
export async function batchInsertLeaderboardImpl(
  entries: (Omit<InsertCompetitionsLeaderboard, "id"> & {
    pnl?: number;
    startingValue?: number;
  })[],
) {
  if (!entries.length) {
    return [];
  }

  try {
    console.log(
      `[CompetitionRepository] Batch inserting ${entries.length} leaderboard entries`,
    );

    const valuesToInsert = entries.map((entry) => ({
      ...entry,
      id: uuidv4(),
    }));

    let results: (InsertCompetitionsLeaderboard & {
      pnl?: number;
      startingValue?: number;
    })[] = await db
      .insert(competitionsLeaderboard)
      .values(valuesToInsert)
      .returning();

    const pnlsToInsert = valuesToInsert.filter((e) => e.pnl !== undefined);
    if (pnlsToInsert.length) {
      const pnlResults = await db
        .insert(tradingCompetitionsLeaderboard)
        .values(
          pnlsToInsert.map((entry) => {
            return {
              pnl: entry.pnl,
              startingValue: entry.startingValue || 0,
              competitionsLeaderboardId: entry.id,
            };
          }),
        )
        .returning();

      results = results.map((r) => {
        const pnl = pnlResults.find(
          (p) => p.competitionsLeaderboardId === r.id,
        );
        return { ...r, pnl: pnl?.pnl, startingValue: pnl?.startingValue };
      });
    }

    return results;
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error batch inserting leaderboard entries:",
      error,
    );
    throw error;
  }
}

/**
 * Find leaderboard entries for a specific competition
 * @param competitionId The competition ID
 * @returns Array of leaderboard entries sorted by rank
 */
async function findLeaderboardByCompetitionImpl(competitionId: string) {
  try {
    return await dbRead
      .select()
      .from(competitionsLeaderboard)
      .where(eq(competitionsLeaderboard.competitionId, competitionId))
      .orderBy(competitionsLeaderboard.rank);
  } catch (error) {
    console.error(
      `[CompetitionRepository] Error finding leaderboard for competition ${competitionId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Find leaderboard entries for a specific trading competition
 * @param competitionId The competition ID
 * @returns Array of leaderboard entries sorted by rank
 */
async function findLeaderboardByTradingCompImpl(competitionId: string) {
  try {
    return await dbRead
      .select({
        ...getTableColumns(competitionsLeaderboard),
        ...getTableColumns(tradingCompetitionsLeaderboard),
      })
      .from(competitionsLeaderboard)
      .innerJoin(
        tradingCompetitionsLeaderboard,
        eq(
          competitionsLeaderboard.id,
          tradingCompetitionsLeaderboard.competitionsLeaderboardId,
        ),
      )
      .where(eq(competitionsLeaderboard.competitionId, competitionId))
      .orderBy(competitionsLeaderboard.rank);
  } catch (error) {
    console.error(
      `[CompetitionRepository] Error finding leaderboard for competition ${competitionId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Get all competitions leaderboard entries
 * @param competitionId Optional competition ID to filter by
 */
async function getAllCompetitionsLeaderboardImpl(competitionId?: string) {
  try {
    const query = dbRead
      .select()
      .from(competitionsLeaderboard)
      .orderBy(desc(competitionsLeaderboard.createdAt));

    if (competitionId) {
      query.where(eq(competitionsLeaderboard.competitionId, competitionId));
    }

    return await query;
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in getAllCompetitionsLeaderboard:",
      error,
    );
    throw error;
  }
}

/**
 * Get all agents that have ever participated in a competition, regardless of status
 * This is useful for retrieving portfolio snapshots for all agents including inactive ones
 * @param competitionId Competition ID
 * @returns Array of agent IDs
 */
async function getAllCompetitionAgentsImpl(
  competitionId: string,
): Promise<string[]> {
  try {
    const result = await dbRead
      .select({ agentId: competitionAgents.agentId })
      .from(competitionAgents)
      .where(eq(competitionAgents.competitionId, competitionId));

    return result.map((row) => row.agentId);
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in getAllCompetitionAgents:",
      error,
    );
    throw error;
  }
}

/**
 * Get agent rankings for multiple agents in a competition efficiently
 * This replaces N calls to getAgentCompetitionRanking with a single bulk operation
 * @param competitionId Competition ID
 * @param agentIds Array of agent IDs to get rankings for
 * @returns Map of agent ID to ranking data
 */
async function getBulkAgentCompetitionRankingsImpl(
  competitionId: string,
  agentIds: string[],
): Promise<Map<string, { rank: number; totalAgents: number }>> {
  if (agentIds.length === 0) {
    return new Map();
  }

  try {
    console.log(
      `[CompetitionRepository] getBulkAgentCompetitionRankings called for ${agentIds.length} agents in competition ${competitionId}`,
    );

    // Get ALL latest portfolio snapshots for the competition ONCE
    const snapshots = await getLatestPortfolioSnapshotsImpl(competitionId);

    if (snapshots.length === 0) {
      return new Map(); // No snapshots = no ranking data
    }

    // Sort by totalValue descending to determine rankings ONCE
    const sortedSnapshots = snapshots.sort(
      (a, b) => Number(b.totalValue) - Number(a.totalValue),
    );

    const totalAgents = sortedSnapshots.length;
    const rankingsMap = new Map<
      string,
      { rank: number; totalAgents: number }
    >();

    // Calculate ranks for all requested agents in one pass
    for (const agentId of agentIds) {
      const agentIndex = sortedSnapshots.findIndex(
        (snapshot) => snapshot.agentId === agentId,
      );

      if (agentIndex !== -1) {
        rankingsMap.set(agentId, {
          rank: agentIndex + 1, // Convert to 1-based ranking
          totalAgents,
        });
      }
      // If agent not found in snapshots, don't add to map (undefined ranking)
    }

    console.log(
      `[CompetitionRepository] Calculated rankings for ${rankingsMap.size}/${agentIds.length} agents`,
    );

    return rankingsMap;
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in getBulkAgentCompetitionRankings:",
      error,
    );
    // Return empty map on error - no reliable ranking data
    return new Map();
  }
}

/**
 * Find active competitions that have reached their end date
 * @returns Array of active competitions that should be ended
 */
async function findActiveCompetitionsPastEndDateImpl() {
  try {
    const now = new Date();

    const result = await dbRead
      .select({
        crossChainTradingType: tradingCompetitions.crossChainTradingType,
        ...getTableColumns(competitions),
      })
      .from(tradingCompetitions)
      .innerJoin(
        competitions,
        eq(tradingCompetitions.competitionId, competitions.id),
      )
      .where(
        and(
          eq(competitions.status, COMPETITION_STATUS.ACTIVE),
          isNotNull(competitions.endDate),
          lte(competitions.endDate, now),
        ),
      );
    return result;
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in findActiveCompetitionsPastEndDateImpl:",
      error,
    );
    throw error;
  }
}

// ----------------------------------------------------------------------------
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// ----------------------------------------------------------------------------

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const findAll = createTimedRepositoryFunction(
  findAllImpl,
  "CompetitionRepository",
  "findAll",
);

export const findById = createTimedRepositoryFunction(
  findByIdImpl,
  "CompetitionRepository",
  "findById",
);

export const create = createTimedRepositoryFunction(
  createImpl,
  "CompetitionRepository",
  "create",
);

export const update = createTimedRepositoryFunction(
  updateImpl,
  "CompetitionRepository",
  "update",
);

export const updateOne = createTimedRepositoryFunction(
  updateOneImpl,
  "CompetitionRepository",
  "updateOne",
);

export const addAgentToCompetition = createTimedRepositoryFunction(
  addAgentToCompetitionImpl,
  "CompetitionRepository",
  "addAgentToCompetition",
);

export const removeAgentFromCompetition = createTimedRepositoryFunction(
  removeAgentFromCompetitionImpl,
  "CompetitionRepository",
  "removeAgentFromCompetition",
);

export const addAgents = createTimedRepositoryFunction(
  addAgentsImpl,
  "CompetitionRepository",
  "addAgents",
);

export const getAgents = createTimedRepositoryFunction(
  getAgentsImpl,
  "CompetitionRepository",
  "getAgents",
);

export const getCompetitionAgents = createTimedRepositoryFunction(
  getCompetitionAgentsImpl,
  "CompetitionRepository",
  "getCompetitionAgents",
);

export const isAgentActiveInCompetition = createTimedRepositoryFunction(
  isAgentActiveInCompetitionImpl,
  "CompetitionRepository",
  "isAgentActiveInCompetition",
);

export const getAgentCompetitionStatus = createTimedRepositoryFunction(
  getAgentCompetitionStatusImpl,
  "CompetitionRepository",
  "getAgentCompetitionStatus",
);

export const getAgentCompetitionRecord = createTimedRepositoryFunction(
  getAgentCompetitionRecordImpl,
  "CompetitionRepository",
  "getAgentCompetitionRecord",
);

export const updateAgentCompetitionStatus = createTimedRepositoryFunction(
  updateAgentCompetitionStatusImpl,
  "CompetitionRepository",
  "updateAgentCompetitionStatus",
);

export const markAgentAsWithdrawn = createTimedRepositoryFunction(
  markAgentAsWithdrawnImpl,
  "CompetitionRepository",
  "markAgentAsWithdrawn",
);

export const findActive = createTimedRepositoryFunction(
  findActiveImpl,
  "CompetitionRepository",
  "findActive",
);

export const createPortfolioSnapshot = createTimedRepositoryFunction(
  createPortfolioSnapshotImpl,
  "CompetitionRepository",
  "createPortfolioSnapshot",
);

export const batchCreatePortfolioTokenValues = createTimedRepositoryFunction(
  batchCreatePortfolioTokenValuesImpl,
  "CompetitionRepository",
  "batchCreatePortfolioTokenValues",
);

export const getLatestPortfolioSnapshots = createTimedRepositoryFunction(
  getLatestPortfolioSnapshotsImpl,
  "CompetitionRepository",
  "getLatestPortfolioSnapshots",
);

export const getBulkAgentPortfolioSnapshots = createTimedRepositoryFunction(
  getBulkAgentPortfolioSnapshotsImpl,
  "CompetitionRepository",
  "getBulkAgentPortfolioSnapshots",
);

export const getAgentPortfolioSnapshots = createTimedRepositoryFunction(
  getAgentPortfolioSnapshotsImpl,
  "CompetitionRepository",
  "getAgentPortfolioSnapshots",
);

export const getBoundedSnapshots = createTimedRepositoryFunction(
  getBoundedSnapshotsImpl,
  "CompetitionRepository",
  "getBoundedSnapshots",
);

export const getAgentCompetitionRanking = createTimedRepositoryFunction(
  getAgentCompetitionRankingImpl,
  "CompetitionRepository",
  "getAgentCompetitionRanking",
);

export const getPortfolioTokenValues = createTimedRepositoryFunction(
  getPortfolioTokenValuesImpl,
  "CompetitionRepository",
  "getPortfolioTokenValues",
);

export const getAllPortfolioSnapshots = createTimedRepositoryFunction(
  getAllPortfolioSnapshotsImpl,
  "CompetitionRepository",
  "getAllPortfolioSnapshots",
);

export const getPortfolioTokenValuesByIds = createTimedRepositoryFunction(
  getPortfolioTokenValuesByIdsImpl,
  "CompetitionRepository",
  "getPortfolioTokenValuesByIds",
);

export const count = createTimedRepositoryFunction(
  countImpl,
  "CompetitionRepository",
  "count",
);

export const countAgentCompetitions = createTimedRepositoryFunction(
  countAgentCompetitionsImpl,
  "CompetitionRepository",
  "countAgentCompetitions",
);

export const findByStatus = createTimedRepositoryFunction(
  findByStatusImpl,
  "CompetitionRepository",
  "findByStatus",
);

export const findBestPlacementForAgent = createTimedRepositoryFunction(
  findBestPlacementForAgentImpl,
  "CompetitionRepository",
  "findBestPlacementForAgent",
);

export const batchInsertLeaderboard = createTimedRepositoryFunction(
  batchInsertLeaderboardImpl,
  "CompetitionRepository",
  "batchInsertLeaderboard",
);

export const findLeaderboardByCompetition = createTimedRepositoryFunction(
  findLeaderboardByCompetitionImpl,
  "CompetitionRepository",
  "findLeaderboardByCompetition",
);

export const findLeaderboardByTradingComp = createTimedRepositoryFunction(
  findLeaderboardByTradingCompImpl,
  "CompetitionRepository",
  "findLeaderboardByTradingComp",
);

export const getAllCompetitionsLeaderboard = createTimedRepositoryFunction(
  getAllCompetitionsLeaderboardImpl,
  "CompetitionRepository",
  "getAllCompetitionsLeaderboard",
);

export const getAllCompetitionAgents = createTimedRepositoryFunction(
  getAllCompetitionAgentsImpl,
  "CompetitionRepository",
  "getAllCompetitionAgents",
);

export const getBulkAgentCompetitionRankings = createTimedRepositoryFunction(
  getBulkAgentCompetitionRankingsImpl,
  "CompetitionRepository",
  "getBulkAgentCompetitionRankings",
);

export const findActiveCompetitionsPastEndDate = createTimedRepositoryFunction(
  findActiveCompetitionsPastEndDateImpl,
  "CompetitionRepository",
  "findActiveCompetitionsPastEndDate",
);

export const get24hSnapshots = createTimedRepositoryFunction(
  get24hSnapshotsImpl,
  "CompetitionRepository",
  "get24hSnapshots",
);
