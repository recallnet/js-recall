import { and, desc, count as drizzleCount, eq } from "drizzle-orm";

import { db } from "@/database/db.js";
import { trades } from "@/database/schema/trading/defs.js";
import { InsertTrade } from "@/database/schema/trading/types.js";

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
    const [result] = await db
      .insert(trades)
      .values({
        ...trade,
        timestamp: trade.timestamp || new Date(),
      })
      .returning();

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
 * Get trades for an agent
 * @param agentId Agent ID
 * @param limit Optional result limit
 * @param offset Optional result offset
 */
export async function getAgentTrades(
  agentId: string,
  limit?: number,
  offset?: number,
) {
  try {
    const query = db
      .select()
      .from(trades)
      .where(eq(trades.agentId, agentId))
      .orderBy(desc(trades.timestamp));

    if (limit !== undefined) {
      query.limit(limit);
    }

    if (offset !== undefined) {
      query.offset(offset);
    }

    return await query;
  } catch (error) {
    console.error("[TradeRepository] Error in getAgentTrades:", error);
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
 * Count trades for an agent
 * @param agentId Agent ID
 */
export async function countAgentTrades(agentId: string) {
  try {
    const [result] = await db
      .select({ count: drizzleCount() })
      .from(trades)
      .where(eq(trades.agentId, agentId));

    return result?.count ?? 0;
  } catch (error) {
    console.error("[TradeRepository] Error in countAgentTrades:", error);
    throw error;
  }
}

/**
 * Count trades for an agent in a specific competition
 * @param agentId Agent ID
 * @param competitionId Competition ID
 * @returns Number of trades for the agent in the competition
 */
export async function countAgentTradesInCompetition(
  agentId: string,
  competitionId: string,
): Promise<number> {
  try {
    const [result] = await db
      .select({ count: drizzleCount() })
      .from(trades)
      .where(
        and(
          eq(trades.agentId, agentId),
          eq(trades.competitionId, competitionId),
        ),
      );

    return result?.count ?? 0;
  } catch (error) {
    console.error(
      "[TradeRepository] Error in countAgentTradesInCompetition:",
      error,
    );
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

/**
 * Get all trades
 * @param competitionId Optional competition ID to filter by
 */
export async function getAllTrades(competitionId?: string) {
  try {
    const query = db.select().from(trades).orderBy(desc(trades.timestamp));

    if (competitionId) {
      query.where(eq(trades.competitionId, competitionId));
    }

    return await query;
  } catch (error) {
    console.error("[TradeRepository] Error in getAllTrades:", error);
    throw error;
  }
}
