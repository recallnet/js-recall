import { and, desc, count as drizzleCount, eq, sql } from "drizzle-orm";

import { db } from "@/database/db.js";
import {
  decrementBalanceInTransaction,
  incrementBalanceInTransaction,
} from "@/database/repositories/balance-repository.js";
import { trades } from "@/database/schema/trading/defs.js";
import { InsertTrade } from "@/database/schema/trading/types.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";
import { SpecificChainSchema } from "@/types/index.js";

/**
 * Trade Repository
 * Handles database operations for trades
 */

/**
 * Create a trade and update balances atomically
 * @param trade Trade to create
 * @returns Object containing the created trade and updated balance amounts
 */
async function createTradeWithBalancesImpl(trade: InsertTrade): Promise<{
  trade: typeof trades.$inferSelect;
  updatedBalances: {
    fromTokenBalance: number;
    toTokenBalance?: number;
  };
}> {
  return await db.transaction(async (tx) => {
    // Validate and parse the fromSpecificChain
    const fromSpecificChain = SpecificChainSchema.parse(
      trade.fromSpecificChain,
    );

    // Decrement the "from" token balance using the helper function
    const fromTokenBalance = await decrementBalanceInTransaction(
      tx,
      trade.agentId,
      trade.fromToken,
      trade.fromAmount,
      fromSpecificChain,
      trade.fromTokenSymbol,
    );

    repositoryLogger.debug(
      `[TradeRepository] From token balance updated: agent=${trade.agentId}, token=${trade.fromToken} (${trade.fromTokenSymbol}), newBalance=${fromTokenBalance}`,
    );

    let toTokenBalance: number | undefined;

    // Only increment the "to" token balance for non-burn addresses (toAmount > 0)
    if (trade.toAmount > 0) {
      // Validate and parse the toSpecificChain
      const toSpecificChain = SpecificChainSchema.parse(trade.toSpecificChain);

      toTokenBalance = await incrementBalanceInTransaction(
        tx,
        trade.agentId,
        trade.toToken,
        trade.toAmount,
        toSpecificChain,
        trade.toTokenSymbol,
      );

      repositoryLogger.debug(
        `[TradeRepository] To token balance updated: agent=${trade.agentId}, token=${trade.toToken} (${trade.toTokenSymbol}), newBalance=${toTokenBalance}`,
      );
    } else {
      repositoryLogger.debug(
        `[TradeRepository] Skipping to token balance update (burn trade): agent=${trade.agentId}, token=${trade.toToken} (${trade.toTokenSymbol})`,
      );
    }

    // Create the trade record
    const [result] = await tx
      .insert(trades)
      .values({
        ...trade,
        timestamp: trade.timestamp || new Date(),
      })
      .returning();

    if (!result) {
      throw new Error("Failed to create trade - no result returned");
    }

    repositoryLogger.debug(
      `[TradeRepository] Trade created successfully: agent=${trade.agentId}, tradeId=${result.id}, fromBalance=${fromTokenBalance}, toBalance=${toTokenBalance ?? "N/A (burn)"}`,
    );

    return {
      trade: result,
      updatedBalances: {
        fromTokenBalance,
        toTokenBalance,
      },
    };
  });
}

/**
 * Get trades for an agent
 * @param agentId Agent ID
 * @param limit Optional result limit
 * @param offset Optional result offset
 */
async function getAgentTradesImpl(
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
    repositoryLogger.error("Error in getAgentTrades:", error);
    throw error;
  }
}

/**
 * Get trades for a competition
 * @param competitionId Competition ID
 * @param limit Optional result limit
 * @param offset Optional result offset
 */
async function getCompetitionTradesImpl(
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
    repositoryLogger.error("Error in getCompetitionTrades:", error);
    throw error;
  }
}

/**
 * Count trades for an agent
 * @param agentId Agent ID
 */
async function countAgentTradesImpl(agentId: string) {
  try {
    const [result] = await db
      .select({ count: drizzleCount() })
      .from(trades)
      .where(eq(trades.agentId, agentId));

    return result?.count ?? 0;
  } catch (error) {
    repositoryLogger.error("Error in countAgentTrades:", error);
    throw error;
  }
}

/**
 * Count trades for an agent across multiple competitions in bulk
 * @param agentId Agent ID
 * @param competitionIds Array of competition IDs
 * @returns Map of competition ID to trade count
 */
async function countBulkAgentTradesInCompetitionsImpl(
  agentId: string,
  competitionIds: string[],
): Promise<Map<string, number>> {
  if (competitionIds.length === 0) {
    return new Map();
  }

  try {
    repositoryLogger.debug(
      `countBulkAgentTradesInCompetitions called for agent ${agentId} in ${competitionIds.length} competitions`,
    );

    // Get trade counts for all competitions in one query
    const results = await db
      .select({
        competitionId: trades.competitionId,
        count: drizzleCount(),
      })
      .from(trades)
      .where(
        and(
          eq(trades.agentId, agentId),
          sql`${trades.competitionId} IN (${sql.join(
            competitionIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
      )
      .groupBy(trades.competitionId);

    // Create map with results
    const countMap = new Map<string, number>();

    // Initialize all competitions with 0
    for (const competitionId of competitionIds) {
      countMap.set(competitionId, 0);
    }

    // Update with actual counts
    for (const result of results) {
      countMap.set(result.competitionId, result.count);
    }

    repositoryLogger.debug(
      `Found trades in ${results.length}/${competitionIds.length} competitions`,
    );

    return countMap;
  } catch (error) {
    repositoryLogger.error(
      "Error in countBulkAgentTradesInCompetitions:",
      error,
    );
    throw error;
  }
}

/**
 * Get trades for an agent in a competition
 * @param competitionId Competition ID
 * @param agentId Agent ID
 * @param limit Optional result limit
 * @param offset Optional result offset
 */
async function getAgentTradesInCompetitionImpl(
  competitionId: string,
  agentId: string,
  limit?: number,
  offset?: number,
) {
  try {
    const query = db
      .select()
      .from(trades)
      .where(
        and(
          eq(trades.competitionId, competitionId),
          eq(trades.agentId, agentId),
        ),
      )
      .orderBy(desc(trades.timestamp));

    if (limit !== undefined) {
      query.limit(limit);
    }

    if (offset !== undefined) {
      query.offset(offset);
    }

    return await query;
  } catch (error) {
    repositoryLogger.error("Error in getAgentTradesInCompetition:", error);
    throw error;
  }
}

/**
 * Count all trades
 */
async function countImpl() {
  try {
    const [result] = await db.select({ count: drizzleCount() }).from(trades);

    return result?.count ?? 0;
  } catch (error) {
    repositoryLogger.error("Error in count:", error);
    throw error;
  }
}

/**
 * Get all trades
 * @param competitionId Optional competition ID to filter by
 */
async function getAllTradesImpl(competitionId?: string) {
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

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

export const createTradeWithBalances = createTimedRepositoryFunction(
  createTradeWithBalancesImpl,
  "TradeRepository",
  "createTradeWithBalances",
);

export const getAgentTrades = createTimedRepositoryFunction(
  getAgentTradesImpl,
  "TradeRepository",
  "getAgentTrades",
);

export const getAgentTradesInCompetition = createTimedRepositoryFunction(
  getAgentTradesInCompetitionImpl,
  "TradeRepository",
  "getAgentTradesInCompetition",
);

export const getCompetitionTrades = createTimedRepositoryFunction(
  getCompetitionTradesImpl,
  "TradeRepository",
  "getCompetitionTrades",
);

export const countAgentTrades = createTimedRepositoryFunction(
  countAgentTradesImpl,
  "TradeRepository",
  "countAgentTrades",
);

export const countBulkAgentTradesInCompetitions = createTimedRepositoryFunction(
  countBulkAgentTradesInCompetitionsImpl,
  "TradeRepository",
  "countBulkAgentTradesInCompetitions",
);

export const count = createTimedRepositoryFunction(
  countImpl,
  "TradeRepository",
  "count",
);

export const getAllTrades = createTimedRepositoryFunction(
  getAllTradesImpl,
  "TradeRepository",
  "getAllTrades",
);
