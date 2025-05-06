import { desc, count as drizzleCount, eq, sql } from "drizzle-orm";

import { InsertTrade, trades } from "@recallnet/comps-db/schema";

import { db } from "@/database/db.js";

/**
 * Trade Repository
 * Handles database operations for trades
 */

/**
 * Create a new trade
 * @param trade Trade to create
 */
export async function create(trade: InsertTrade) {
  try {
    const [result] = await db.insert(trades).values(trade).returning();

    if (!result) {
      throw new Error("Failed to create trade - no result returned");
    }

    return result;
  } catch (error) {
    console.error("[TradeRepository] Error in create:", error);
    throw error;
  }
}

/**
 * Get trades for a team
 * @param teamId Team ID
 * @param limit Optional result limit
 * @param offset Optional result offset
 */
export async function getTeamTrades(
  teamId: string,
  limit?: number,
  offset?: number,
) {
  try {
    const query = db
      .select()
      .from(trades)
      .where(eq(trades.teamId, teamId))
      .orderBy(desc(trades.timestamp));

    if (limit !== undefined) {
      query.limit(limit);
    }

    if (offset !== undefined) {
      query.offset(offset);
    }

    return await query;
  } catch (error) {
    console.error("[TradeRepository] Error in getTeamTrades:", error);
    throw error;
  }
}

/**
 * Get trades for a competition
 * @param competitionId Competition ID
 * @param limit Optional result limit
 * @param offset Optional result offset
 */
export async function getCompetitionTrades(
  competitionId: string,
  limit?: number,
  offset?: number,
) {
  try {
    const query = db
      .select()
      .from(trades)
      .where(eq(trades.competitionId, competitionId))
      .orderBy(desc(trades.timestamp));

    if (limit !== undefined) {
      query.limit(limit);
    }

    if (offset !== undefined) {
      query.offset(offset);
    }

    return await query;
  } catch (error) {
    console.error("[TradeRepository] Error in getCompetitionTrades:", error);
    throw error;
  }
}

/**
 * Count trades for a team
 * @param teamId Team ID
 */
export async function countTeamTrades(teamId: string) {
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(trades)
      .where(eq(trades.teamId, teamId));

    return result?.count ?? 0;
  } catch (error) {
    console.error("[TradeRepository] Error in countTeamTrades:", error);
    throw error;
  }
}

/**
 * Count all trades
 */
export async function count() {
  try {
    const [result] = await db.select({ count: drizzleCount() }).from(trades);

    return result?.count ?? 0;
  } catch (error) {
    console.error("[TradeRepository] Error in count:", error);
    throw error;
  }
}
