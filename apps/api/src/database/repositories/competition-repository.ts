import {
  AnyColumn,
  and,
  asc,
  desc,
  count as drizzleCount,
  eq,
  getTableColumns,
  inArray,
  max,
  sql,
} from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/database/db.js";
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

/**
 * Find all competitions
 */
export async function findAll() {
  return await db
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
export async function findById(id: string) {
  const [result] = await db
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
export async function create(
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
export async function update(
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
export async function updateOne(
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
export async function addAgentToCompetition(
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
export async function removeAgentFromCompetition(
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
export async function addAgents(competitionId: string, agentIds: string[]) {
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
export async function getAgents(
  competitionId: string,
  status: CompetitionAgentStatus = COMPETITION_AGENT_STATUS.ACTIVE,
) {
  try {
    const result = await db
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
export async function getCompetitionAgents(
  competitionId: string,
  status?: CompetitionAgentStatus,
) {
  return getAgents(competitionId, status);
}

/**
 * Check if an agent is actively participating in a competition
 * @param competitionId Competition ID
 * @param agentId Agent ID
 * @returns boolean indicating if agent is active in the competition
 */
export async function isAgentActiveInCompetition(
  competitionId: string,
  agentId: string,
): Promise<boolean> {
  try {
    const result = await db
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
export async function getAgentCompetitionStatus(
  competitionId: string,
  agentId: string,
): Promise<CompetitionAgentStatus | null> {
  try {
    const result = await db
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
export async function getAgentCompetitionRecord(
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
    const result = await db
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
 * Update an agent's status in a competition
 * @param competitionId Competition ID
 * @param agentId Agent ID
 * @param status New status
 * @param reason Optional reason for the status change
 * @returns boolean indicating if the update was successful
 */
export async function updateAgentCompetitionStatus(
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
      "[CompetitionRepository] Error in updateAgentCompetitionStatus:",
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
export async function markAgentAsWithdrawn(
  competitionId: string,
  agentId: string,
  reason?: string,
): Promise<boolean> {
  return updateAgentCompetitionStatus(
    competitionId,
    agentId,
    COMPETITION_AGENT_STATUS.WITHDRAWN,
    reason || "Agent withdrew from competition voluntarily",
  );
}

/**
 * Find active competition
 */
export async function findActive() {
  try {
    const [result] = await db
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
export async function createPortfolioSnapshot(
  snapshot: InsertPortfolioSnapshot,
) {
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
 * Create a portfolio token value
 * @param tokenValue Portfolio token value data including amount, price, symbol, and specific chain
 */
export async function createPortfolioTokenValue(
  tokenValue: InsertPortfolioTokenValue,
) {
  try {
    const [result] = await db
      .insert(portfolioTokenValues)
      .values(tokenValue)
      .returning();

    if (!result) {
      throw new Error(
        "Failed to create portfolio token value - no result returned",
      );
    }

    return result;
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in createPortfolioTokenValue:",
      error,
    );
    throw error;
  }
}

/**
 * Get latest portfolio snapshots for all agents in a competition
 * @param competitionId Competition ID
 */
export async function getLatestPortfolioSnapshots(competitionId: string) {
  try {
    const subquery = db
      .select({
        agentId: portfolioSnapshots.agentId,
        maxTimestamp: max(portfolioSnapshots.timestamp).as("max_timestamp"),
      })
      .from(portfolioSnapshots)
      .where(eq(portfolioSnapshots.competitionId, competitionId))
      .groupBy(portfolioSnapshots.agentId)
      .as("latest_snapshots");

    const result = await db
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
      "[CompetitionRepository] Error in getLatestPortfolioSnapshots:",
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
export async function getBulkAgentPortfolioSnapshots(
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

    const result = await db
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
 * Get portfolio snapshots for an agent in a competition
 * @param competitionId Competition ID
 * @param agentId Agent ID
 */
export async function getAgentPortfolioSnapshots(
  competitionId: string,
  agentId: string,
) {
  try {
    return await db
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
export async function getBoundedSnapshots(
  competitionId: string,
  agentId: string,
) {
  try {
    // Create subqueries for newest and oldest snapshots
    const newestQuery = db
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

    const oldestQuery = db
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
export async function getAgentCompetitionRanking(
  agentId: string,
  competitionId: string,
): Promise<{ rank: number; totalAgents: number } | undefined> {
  try {
    // Get all latest portfolio snapshots for the competition
    const snapshots = await getLatestPortfolioSnapshots(competitionId);

    if (snapshots.length === 0) {
      return undefined; // No snapshots = no ranking data
    }

    // Sort by totalValue descending to determine rankings
    const sortedSnapshots = snapshots.sort(
      (a, b) => Number(b.totalValue) - Number(a.totalValue),
    );

    // Find the agent's position (1-based ranking)
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
export async function getPortfolioTokenValues(snapshotId: number) {
  try {
    return await db
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
export async function getAllPortfolioSnapshots(competitionId?: string) {
  try {
    const query = db
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
export async function getPortfolioTokenValuesByIds(snapshotIds: number[]) {
  try {
    if (snapshotIds.length === 0) {
      return [];
    }

    return await db
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
export async function count() {
  try {
    const [result] = await db
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
export async function countAgentCompetitions(agentId: string): Promise<number> {
  try {
    const [result] = await db
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
export async function findByStatus({
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
        return db
          .select({ count: drizzleCount() })
          .from(tradingCompetitions)
          .innerJoin(
            competitions,
            eq(tradingCompetitions.competitionId, competitions.id),
          )
          .where(eq(competitions.status, status));
      } else {
        return db
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
    let dataQuery = db
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
export async function findBestPlacementForAgent(agentId: string) {
  try {
    const [rankResult] = await db
      .select()
      .from(competitionsLeaderboard)
      .where(eq(competitionsLeaderboard.agentId, agentId))
      .orderBy(asc(competitionsLeaderboard.rank))
      .limit(1);
    if (!rankResult) {
      return rankResult;
    }
    const [pnlResult] = await db
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
    const agents = await db
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
export async function batchInsertLeaderboard(
  entries: (Omit<InsertCompetitionsLeaderboard, "id"> & { pnl?: number })[],
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

    let results: (InsertCompetitionsLeaderboard & { pnl?: number })[] = await db
      .insert(competitionsLeaderboard)
      .values(valuesToInsert)
      .returning();

    const pnlsToInsert = valuesToInsert.filter((e) => e.pnl);
    if (pnlsToInsert.length) {
      const pnlResults = await db
        .insert(tradingCompetitionsLeaderboard)
        .values(
          pnlsToInsert.map((entry) => {
            return {
              pnl: entry.pnl,
              competitionsLeaderboardId: entry.id,
            };
          }),
        )
        .returning();

      results = results.map((r) => {
        const pnl = pnlResults.find(
          (p) => p.competitionsLeaderboardId === r.id,
        );
        return { ...r, pnl: pnl?.pnl };
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
export async function findLeaderboardByCompetition(competitionId: string) {
  try {
    return await db
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
export async function findLeaderboardByTradingComp(competitionId: string) {
  try {
    return await db
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
export async function getAllCompetitionsLeaderboard(competitionId?: string) {
  try {
    const query = db
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
export async function getAllCompetitionAgents(
  competitionId: string,
): Promise<string[]> {
  try {
    const result = await db
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
export async function getBulkAgentCompetitionRankings(
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
    const snapshots = await getLatestPortfolioSnapshots(competitionId);

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
