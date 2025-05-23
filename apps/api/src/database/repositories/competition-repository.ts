import {
  AnyColumn,
  and,
  desc,
  eq,
  getTableColumns,
  max,
  sql,
} from "drizzle-orm";

import { db } from "@/database/db.js";
import {
  competitionAgents,
  competitions,
} from "@/database/schema/core/defs.js";
import { InsertCompetition } from "@/database/schema/core/types.js";
import {
  portfolioSnapshots,
  portfolioTokenValues,
  tradingCompetitions,
} from "@/database/schema/trading/defs.js";
import { InsertTradingCompetition } from "@/database/schema/trading/types.js";
import {
  InsertPortfolioSnapshot,
  InsertPortfolioTokenValue,
} from "@/database/schema/trading/types.js";
import { CompetitionStatus, PagingParams } from "@/types/index.js";

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
  externalLink: competitions.externalLink,
  imageUrl: competitions.imageUrl,
  startDate: competitions.startDate,
  endDate: competitions.endDate,
  createdAt: competitions.createdAt,
};

/**
 * Find all competitions
 */
export async function findAll() {
  return db
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
 * Update an existing competition
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
        createdAt: new Date(),
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
 * Add agents to a competition
 * @param competitionId Competition ID
 * @param agentIds Array of agent IDs
 */
export async function addAgents(competitionId: string, agentIds: string[]) {
  const createdAt = new Date();
  const values = agentIds.map((agentId) => ({
    competitionId,
    agentId,
    createdAt,
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
 */
export async function getAgents(competitionId: string) {
  try {
    const result = await db
      .select({ agentId: competitionAgents.agentId })
      .from(competitionAgents)
      .where(eq(competitionAgents.competitionId, competitionId));

    return result.map((row) => row.agentId);
  } catch (error) {
    console.error("[CompetitionRepository] Error in getAgents:", error);
    throw error;
  }
}

/**
 * Alias for getAgents for better semantic naming
 * @param competitionId Competition ID
 */
export async function getCompetitionAgents(competitionId: string) {
  return getAgents(competitionId);
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
      .where(eq(competitions.status, CompetitionStatus.ACTIVE))
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
  } catch (error) {
    console.error(
      "[CompetitionRepository] Error in getAgentPortfolioSnapshots:",
      error,
    );
    throw error;
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
 * Find competitions by status
 * @param status Competition status
 */
export async function findByStatus(
  status: CompetitionStatus,
  params: PagingParams,
) {
  try {
    let query = db
      .select({
        crossChainTradingType: tradingCompetitions.crossChainTradingType,
        ...getTableColumns(competitions),
      })
      .from(tradingCompetitions)
      .innerJoin(
        competitions,
        eq(tradingCompetitions.competitionId, competitions.id),
      )
      .where(eq(competitions.status, status))
      .$dynamic();

    if (params.sort) {
      query = getSort(query, params.sort, competitionOrderByFields);
    }

    query = query.limit(params.limit).offset(params.offset);

    return await query;
  } catch (error) {
    console.error("[CompetitionRepository] Error in findByStatus:", error);
    throw error;
  }
}
