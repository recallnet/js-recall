import { and, desc, count as drizzleCount, eq, sql } from "drizzle-orm";

import { agents } from "@recallnet/db-schema/core/defs";
import { trades } from "@recallnet/db-schema/trading/defs";
import { InsertTrade } from "@recallnet/db-schema/trading/types";

import { db } from "@/database/db.js";
import {
  decrementBalanceInTransaction,
  incrementBalanceInTransaction,
} from "@/database/repositories/balance-repository.js";
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
 * Get the count of trades for a competition (count, total volume, unique tokens)
 * @param competitionId Competition ID
 * @returns Count of trades
 */
async function getCompetitionTradeMetricsImpl(competitionId: string) {
  try {
    const query = await db.execute(sql`
      WITH base AS (
      SELECT
        ${trades.id}             AS id,
        ${trades.tradeAmountUsd} AS trade_amount_usd,
        ${trades.fromToken}      AS from_token,
        ${trades.toToken}        AS to_token
      FROM ${trades}
      WHERE ${trades.competitionId} = ${competitionId}
    )
    SELECT
      COUNT(*) FILTER (WHERE u.ord = 1)                                       AS total_trades,
      COALESCE(SUM(b.trade_amount_usd) FILTER (WHERE u.ord = 1), 0)::numeric  AS total_volume,
      COUNT(DISTINCT u.token)                                                 AS unique_tokens
    FROM base b
    CROSS JOIN LATERAL
      unnest(ARRAY[b.from_token, b.to_token]) WITH ORDINALITY AS u(token, ord);
    `);
    const result = query.rows[0] ?? {
      total_trades: 0,
      total_volume: 0,
      unique_tokens: 0,
    };

    return {
      totalTrades: Number(result.total_trades),
      totalVolume: Number(result.total_volume),
      uniqueTokens: Number(result.unique_tokens),
    };
  } catch (error) {
    repositoryLogger.error("Error in getCompetitionTradeMetrics:", error);
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
    const tradesQuery = db
      .select({
        id: trades.id,
        competitionId: trades.competitionId,
        agentId: trades.agentId,
        fromToken: trades.fromToken,
        toToken: trades.toToken,
        fromAmount: trades.fromAmount,
        toAmount: trades.toAmount,
        fromTokenSymbol: trades.fromTokenSymbol,
        toTokenSymbol: trades.toTokenSymbol,
        fromSpecificChain: trades.fromSpecificChain,
        toSpecificChain: trades.toSpecificChain,
        tradeAmountUsd: trades.tradeAmountUsd,
        timestamp: trades.timestamp,
        reason: trades.reason,
        agent: {
          id: agents.id,
          name: agents.name,
          imageUrl: agents.imageUrl,
          description: agents.description,
        },
      })
      .from(trades)
      .leftJoin(agents, eq(trades.agentId, agents.id))
      .where(eq(trades.competitionId, competitionId))
      .orderBy(desc(trades.timestamp));

    if (limit !== undefined) {
      tradesQuery.limit(limit);
    }

    if (offset !== undefined) {
      tradesQuery.offset(offset);
    }

    const totalQuery = db
      .select({ count: drizzleCount() })
      .from(trades)
      .where(eq(trades.competitionId, competitionId));

    const [results, total] = await Promise.all([tradesQuery, totalQuery]);

    return {
      trades: results,
      total: total[0]?.count ?? 0,
    };
  } catch (error) {
    repositoryLogger.error("Error in getCompetitionTrades:", error);
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
    const whereClause = and(
      eq(trades.competitionId, competitionId),
      eq(trades.agentId, agentId),
    );

    const tradesQuery = db
      .select()
      .from(trades)
      .where(whereClause)
      .orderBy(desc(trades.timestamp));

    if (limit !== undefined) {
      tradesQuery.limit(limit);
    }

    if (offset !== undefined) {
      tradesQuery.offset(offset);
    }

    const totalQuery = db
      .select({ count: drizzleCount() })
      .from(trades)
      .where(whereClause);

    const [results, total] = await Promise.all([tradesQuery, totalQuery]);

    return {
      trades: results,
      total: total[0]?.count ?? 0,
    };
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

/**
 * Check if a transaction has already been indexed
 * Used by the on-chain indexer to avoid duplicate processing
 */
async function isTransactionIndexedImpl(txHash: string): Promise<boolean> {
  try {
    const [result] = await db
      .select({ id: trades.id })
      .from(trades)
      .where(eq(trades.onChainTxHash, txHash))
      .limit(1);

    return !!result;
  } catch (error) {
    repositoryLogger.error("Error in isTransactionIndexed:", error);
    throw error;
  }
}

/**
 * Create an on-chain trade record without updating balances
 * Used by the indexer since balance tracking happens separately via wallet scanning
 */
async function createOnChainTradeImpl(
  trade: InsertTrade,
): Promise<typeof trades.$inferSelect> {
  try {
    // Ensure this is marked as an on-chain trade
    const onChainTrade = {
      ...trade,
      tradeType: "on_chain" as const,
    };

    const [result] = await db.insert(trades).values(onChainTrade).returning();

    if (!result) {
      throw new Error("Failed to create on-chain trade");
    }

    repositoryLogger.info(
      `[TradeRepository] Created on-chain trade: agent=${trade.agentId}, tx=${trade.onChainTxHash}`,
    );

    return result;
  } catch (error) {
    repositoryLogger.error("Error in createOnChainTrade:", error);
    throw error;
  }
}

/**
 * Batch create on-chain trades for efficiency
 * Used by the indexer when processing multiple transactions
 */
async function batchCreateOnChainTradesImpl(
  tradesToInsert: InsertTrade[],
): Promise<(typeof trades.$inferSelect)[]> {
  if (tradesToInsert.length === 0) {
    return [];
  }

  try {
    // Ensure all trades are marked as on-chain
    const onChainTrades = tradesToInsert.map((trade) => ({
      ...trade,
      tradeType: "on_chain" as const,
    }));

    const results = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(trades)
        .values(onChainTrades)
        .returning();

      repositoryLogger.info(
        `[TradeRepository] Batch created ${inserted.length} on-chain trades`,
      );

      return inserted;
    });

    return results;
  } catch (error) {
    repositoryLogger.error("Error in batchCreateOnChainTrades:", error);
    throw error;
  }
}

/**
 * Get trades by type (simulated or on_chain)
 * Useful for separating live trades from simulated ones
 */
async function getTradesByTypeImpl(
  competitionId: string,
  tradeType: "simulated" | "on_chain",
  params?: {
    limit?: number;
    offset?: number;
  },
): Promise<{
  trades: (typeof trades.$inferSelect)[];
  total: number;
}> {
  try {
    const { limit = 100, offset = 0 } = params || {};

    const whereCondition = and(
      eq(trades.competitionId, competitionId),
      eq(trades.tradeType, tradeType),
    );

    const tradesQuery = db
      .select()
      .from(trades)
      .where(whereCondition)
      .orderBy(desc(trades.timestamp))
      .limit(limit)
      .offset(offset);

    const totalQuery = db
      .select({ count: drizzleCount() })
      .from(trades)
      .where(whereCondition);

    const [tradeResults, totalResult] = await Promise.all([
      tradesQuery,
      totalQuery,
    ]);

    return {
      trades: tradeResults,
      total: totalResult[0]?.count || 0,
    };
  } catch (error) {
    repositoryLogger.error("Error in getTradesByType:", error);
    throw error;
  }
}

/**
 * Get on-chain trades for gas cost analysis
 * Used by chain exit detector for reconciliation
 */
async function getOnChainTradesInWindowImpl(
  agentId: string,
  competitionId: string,
  startTime: Date,
  endTime: Date,
): Promise<(typeof trades.$inferSelect)[]> {
  try {
    return await db
      .select()
      .from(trades)
      .where(
        and(
          eq(trades.agentId, agentId),
          eq(trades.competitionId, competitionId),
          eq(trades.tradeType, "on_chain"),
          sql`${trades.timestamp} >= ${startTime}`,
          sql`${trades.timestamp} <= ${endTime}`,
        ),
      )
      .orderBy(trades.timestamp);
  } catch (error) {
    repositoryLogger.error("Error in getOnChainTradesInWindow:", error);
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

export const getCompetitionTradeMetrics = createTimedRepositoryFunction(
  getCompetitionTradeMetricsImpl,
  "TradeRepository",
  "getCompetitionTradeMetrics",
);

export const isTransactionIndexed = createTimedRepositoryFunction(
  isTransactionIndexedImpl,
  "TradeRepository",
  "isTransactionIndexed",
);

export const createOnChainTrade = createTimedRepositoryFunction(
  createOnChainTradeImpl,
  "TradeRepository",
  "createOnChainTrade",
);

export const batchCreateOnChainTrades = createTimedRepositoryFunction(
  batchCreateOnChainTradesImpl,
  "TradeRepository",
  "batchCreateOnChainTrades",
);

export const getTradesByType = createTimedRepositoryFunction(
  getTradesByTypeImpl,
  "TradeRepository",
  "getTradesByType",
);

export const getOnChainTradesInWindow = createTimedRepositoryFunction(
  getOnChainTradesInWindowImpl,
  "TradeRepository",
  "getOnChainTradesInWindow",
);
