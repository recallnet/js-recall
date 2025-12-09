import {
  and,
  desc,
  count as drizzleCount,
  eq,
  isNotNull,
  sql,
} from "drizzle-orm";
import { Logger } from "pino";

import { agents } from "../schema/core/defs.js";
import { trades } from "../schema/trading/defs.js";
import type { InsertTrade, SelectTrade } from "../schema/trading/types.js";
import { Database } from "../types.js";
import { BalanceRepository } from "./balance.js";
import { SpecificChainSchema } from "./types/index.js";

/**
 * Result of a single trade creation with balance updates
 */
export interface TradeCreationResult {
  trade: SelectTrade;
  updatedBalances: {
    fromTokenBalance: number;
    toTokenBalance?: number;
  };
}

/**
 * Result of batch trade creation
 */
export interface BatchTradeCreationResult {
  successful: Array<TradeCreationResult & { agentId: string }>;
  failed: Array<{ trade: InsertTrade; error: Error }>;
}

/**
 * Trade Repository
 * Handles database operations for trades
 */
export class TradeRepository {
  readonly #db: Database;
  readonly #logger: Logger;
  readonly #balanceRepository: BalanceRepository;

  constructor(
    database: Database,
    logger: Logger,
    balanceRepository: BalanceRepository,
  ) {
    this.#db = database;
    this.#logger = logger;
    this.#balanceRepository = balanceRepository;
  }

  /**
   * Create a trade and update balances atomically
   * @param trade Trade to create
   * @returns Object containing the created trade and updated balance amounts
   */
  async createTradeWithBalances(
    trade: InsertTrade,
  ): Promise<TradeCreationResult> {
    return await this.#db.transaction(async (tx) => {
      // For spot_live trades with txHash, check if already exists BEFORE touching balances
      // This optimization avoids wasted balance operations for duplicates during re-sync
      if (trade.tradeType === "spot_live" && trade.txHash) {
        const existing = await tx
          .select({ id: trades.id })
          .from(trades)
          .where(
            and(
              eq(trades.txHash, trade.txHash),
              eq(trades.competitionId, trade.competitionId),
              eq(trades.agentId, trade.agentId),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          this.#logger.debug(
            `[TradeRepository] Trade already exists (txHash=${trade.txHash}), skipping duplicate`,
          );
          throw new Error(
            `Duplicate trade: txHash=${trade.txHash} already exists for agent ${trade.agentId}`,
          );
        }
      }

      // Validate and parse the fromSpecificChain
      const fromSpecificChain = SpecificChainSchema.parse(
        trade.fromSpecificChain,
      );

      // Decrement the "from" token balance using the helper function
      const fromTokenBalance =
        await this.#balanceRepository.decrementBalanceInTransaction(
          tx,
          trade.agentId,
          trade.fromToken,
          trade.competitionId,
          trade.fromAmount,
          fromSpecificChain,
          trade.fromTokenSymbol,
        );

      this.#logger.debug(
        `[TradeRepository] From token balance updated: agent=${trade.agentId}, token=${trade.fromToken} (${trade.fromTokenSymbol}), newBalance=${fromTokenBalance}`,
      );

      let toTokenBalance: number | undefined;

      // Only increment the "to" token balance for non-burn addresses (toAmount > 0)
      if (trade.toAmount > 0) {
        // Validate and parse the toSpecificChain
        const toSpecificChain = SpecificChainSchema.parse(
          trade.toSpecificChain,
        );

        toTokenBalance =
          await this.#balanceRepository.incrementBalanceInTransaction(
            tx,
            trade.agentId,
            trade.toToken,
            trade.competitionId,
            trade.toAmount,
            toSpecificChain,
            trade.toTokenSymbol,
          );

        this.#logger.debug(
          `[TradeRepository] To token balance updated: agent=${trade.agentId}, token=${trade.toToken} (${trade.toTokenSymbol}), newBalance=${toTokenBalance}`,
        );
      } else {
        this.#logger.debug(
          `[TradeRepository] Skipping to token balance update (burn trade): agent=${trade.agentId}, token=${trade.toToken} (${trade.toTokenSymbol})`,
        );
      }

      // Create the trade record
      // Note: We already checked for duplicates above for spot_live trades
      // The unique constraint serves as a safety net if the check is bypassed
      const [insertedTrade] = await tx
        .insert(trades)
        .values({
          ...trade,
          timestamp: trade.timestamp || new Date(),
        })
        .returning();

      if (!insertedTrade) {
        throw new Error("Failed to create trade - no result returned");
      }

      this.#logger.debug(
        `[TradeRepository] Trade created successfully: agent=${trade.agentId}, tradeId=${insertedTrade.id}, fromBalance=${fromTokenBalance}, toBalance=${toTokenBalance ?? "N/A (burn)"}`,
      );

      return {
        trade: insertedTrade,
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
  async getAgentTrades(agentId: string, limit?: number, offset?: number) {
    try {
      const query = this.#db
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
      this.#logger.error({ error }, "Error in getAgentTrades");
      throw error;
    }
  }

  /**
   * Get the count of trades for a competition (count, total volume, unique tokens)
   * @param competitionId Competition ID
   * @returns Count of trades
   */
  async getCompetitionTradeMetrics(competitionId: string) {
    try {
      const query = await this.#db.execute(sql`
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
      this.#logger.error({ error }, "Error in getCompetitionTradeMetrics");
      throw error;
    }
  }

  /**
   * Get trades for a competition
   * @param competitionId Competition ID
   * @param limit Optional result limit
   * @param offset Optional result offset
   */
  async getCompetitionTrades(
    competitionId: string,
    limit?: number,
    offset?: number,
  ) {
    try {
      const tradesQuery = this.#db
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
          txHash: trades.txHash,
          tradeType: trades.tradeType,
          agent: {
            id: agents.id,
            name: agents.name,
            imageUrl: agents.imageUrl,
            description: agents.description,
          },
        })
        .from(trades)
        .innerJoin(agents, eq(trades.agentId, agents.id))
        .where(eq(trades.competitionId, competitionId))
        .orderBy(desc(trades.timestamp));

      if (limit !== undefined) {
        tradesQuery.limit(limit);
      }

      if (offset !== undefined) {
        tradesQuery.offset(offset);
      }

      const totalQuery = this.#db
        .select({ count: drizzleCount() })
        .from(trades)
        .where(eq(trades.competitionId, competitionId));

      const [results, total] = await Promise.all([tradesQuery, totalQuery]);

      return {
        trades: results,
        total: total[0]?.count ?? 0,
      };
    } catch (error) {
      this.#logger.error({ error }, "Error in getCompetitionTrades");
      throw error;
    }
  }

  /**
   * Count trades for an agent across multiple competitions in bulk
   * @param agentId Agent ID
   * @param competitionIds Array of competition IDs
   * @returns Map of competition ID to trade count
   */
  async countBulkAgentTradesInCompetitions(
    agentId: string,
    competitionIds: string[],
  ): Promise<Map<string, number>> {
    if (competitionIds.length === 0) {
      return new Map();
    }

    try {
      this.#logger.debug(
        `countBulkAgentTradesInCompetitions called for agent ${agentId} in ${competitionIds.length} competitions`,
      );

      // Get trade counts for all competitions in one query
      const results = await this.#db
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

      this.#logger.debug(
        `Found trades in ${results.length}/${competitionIds.length} competitions`,
      );

      return countMap;
    } catch (error) {
      this.#logger.error(
        { error },
        "Error in countBulkAgentTradesInCompetitions",
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
  async getAgentTradesInCompetition(
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

      const tradesQuery = this.#db
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

      const totalQuery = this.#db
        .select({ count: drizzleCount() })
        .from(trades)
        .where(whereClause);

      const [results, total] = await Promise.all([tradesQuery, totalQuery]);

      return {
        trades: results,
        total: total[0]?.count ?? 0,
      };
    } catch (error) {
      this.#logger.error({ error }, "Error in getAgentTradesInCompetition");
      throw error;
    }
  }

  /**
   * Count all trades
   */
  async count() {
    try {
      const [result] = await this.#db
        .select({ count: drizzleCount() })
        .from(trades);

      return result?.count ?? 0;
    } catch (error) {
      this.#logger.error({ error }, "Error in count");
      throw error;
    }
  }

  /**
   * Get the latest on-chain trade block number for an agent in a competition on a specific chain
   * Used to determine incremental sync starting point for spot live competitions
   *
   * IMPORTANT: The returned block number should be used WITH OVERLAP (not +1) to prevent gaps.
   * Example: If latestBlock=1000, next sync should start from block 1000 (not 1001).
   *
   * Why overlap is necessary:
   * - Block 1000 might have 3 trades: A (success), B (failed), C (success)
   * - MAX(block_number) returns 1000 (from A or C)
   * - If next sync starts from 1001, trade B is permanently lost
   * - Starting from 1000 allows B to be retried
   * - Unique constraint (txHash, competitionId, agentId) prevents duplicates from A and C
   *
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @param specificChain Specific chain to query
   * @returns Latest block number or null if no trades exist
   */
  async getLatestSpotLiveTradeBlock(
    agentId: string,
    competitionId: string,
    specificChain: string,
  ): Promise<number | null> {
    try {
      const [result] = await this.#db
        .select({ blockNumber: trades.blockNumber })
        .from(trades)
        .where(
          and(
            eq(trades.agentId, agentId),
            eq(trades.competitionId, competitionId),
            eq(trades.tradeType, "spot_live"),
            eq(trades.fromSpecificChain, specificChain),
            isNotNull(trades.blockNumber),
          ),
        )
        .orderBy(desc(trades.blockNumber))
        .limit(1);

      return result?.blockNumber ?? null;
    } catch (error) {
      this.#logger.error({ error }, "Error in getLatestSpotLiveTradeBlock");
      throw error;
    }
  }

  /**
   * Batch create trades with balance updates
   * Processes trades in controlled batches to avoid database contention
   * @param tradesToCreate Array of trades to create
   * @returns Results with successes and failures
   */
  async batchCreateTradesWithBalances(
    tradesToCreate: InsertTrade[],
  ): Promise<BatchTradeCreationResult> {
    const successful: Array<TradeCreationResult & { agentId: string }> = [];
    const failed: Array<{ trade: InsertTrade; error: Error }> = [];

    if (tradesToCreate.length === 0) {
      return { successful, failed };
    }

    const concurrencyLimit = 5;

    for (let i = 0; i < tradesToCreate.length; i += concurrencyLimit) {
      const batch = tradesToCreate.slice(i, i + concurrencyLimit);

      const batchResults = await Promise.allSettled(
        batch.map((trade) =>
          this.createTradeWithBalances(trade).then((result) => ({
            agentId: trade.agentId,
            ...result,
          })),
        ),
      );

      batchResults.forEach((result, index) => {
        const trade = batch[index];
        if (!trade) {
          this.#logger.error(
            `[TradeRepository] Unexpected missing trade at index ${index}`,
          );
          return;
        }

        if (result.status === "fulfilled") {
          successful.push(result.value);
        } else {
          failed.push({
            trade,
            error:
              result.reason instanceof Error
                ? result.reason
                : new Error(String(result.reason)),
          });
        }
      });
    }

    this.#logger.info(
      `[TradeRepository] Batch trade creation completed: ${successful.length} successful, ${failed.length} failed`,
    );

    return { successful, failed };
  }

  /**
   * Count spot live trades for an agent in a competition
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @returns Number of spot_live trades
   */
  async countSpotLiveTradesForAgent(
    agentId: string,
    competitionId: string,
  ): Promise<number> {
    try {
      const result = await this.#db
        .select({ count: drizzleCount() })
        .from(trades)
        .where(
          and(
            eq(trades.agentId, agentId),
            eq(trades.competitionId, competitionId),
            eq(trades.tradeType, "spot_live"),
          ),
        );

      return result[0]?.count ?? 0;
    } catch (error) {
      this.#logger.error(
        { error, agentId, competitionId },
        "[TradeRepository] Error counting spot live trades",
      );
      throw error;
    }
  }
}
