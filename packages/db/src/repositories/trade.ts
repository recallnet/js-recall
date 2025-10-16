import { and, desc, count as drizzleCount, eq, sql } from "drizzle-orm";
import { Logger } from "pino";

import { agents } from "../schema/core/defs.js";
import { trades } from "../schema/trading/defs.js";
import { InsertTrade } from "../schema/trading/types.js";
import { Database } from "../types.js";
import { isDeadlockError, withRetry } from "../utils/with-retry.js";
import { BalanceRepository } from "./balance.js";
import { SpecificChainSchema } from "./types/index.js";

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
   * Uses consistent lock ordering and automatic retry on transient failures.
   *
   * @param trade Trade to create
   * @returns Object containing the created trade and updated balance amounts
   */
  async createTradeWithBalances(trade: InsertTrade): Promise<{
    trade: typeof trades.$inferSelect;
    updatedBalances: {
      fromTokenBalance: number;
      toTokenBalance?: number;
    };
  }> {
    return await withRetry(
      async () => {
        return await this.#db.transaction(async (tx) => {
          // Sort tokens alphabetically to ensure consistent lock ordering
          const tokens = [
            {
              address: trade.fromToken,
              chain: SpecificChainSchema.parse(trade.fromSpecificChain),
              symbol: trade.fromTokenSymbol,
              isFrom: true,
            },
            {
              address: trade.toToken,
              chain: SpecificChainSchema.parse(trade.toSpecificChain),
              symbol: trade.toTokenSymbol,
              isFrom: false,
            },
          ].sort((a, b) => a.address.localeCompare(b.address));

          const [firstToken, secondToken] = tokens;
          if (!firstToken || !secondToken) {
            throw new Error("Invalid token configuration");
          }

          this.#logger.debug(
            `[TradeRepository] Updating balances for tokens: ${firstToken.symbol}, ${secondToken.symbol}`,
          );

          // Update tokens in sorted order for consistent locking
          // Use separate variables instead of Map to avoid overwrite bug with same-token trades
          let fromTokenBalance: number | undefined;
          let toTokenBalance: number | undefined;

          for (const token of [firstToken, secondToken]) {
            if (token.isFrom) {
              // Decrement fromToken balance
              fromTokenBalance =
                await this.#balanceRepository.decrementBalanceInTransaction(
                  tx,
                  trade.agentId,
                  token.address,
                  trade.fromAmount,
                  token.chain,
                  token.symbol,
                );

              this.#logger.debug(
                `[TradeRepository] From token balance updated: agent=${trade.agentId}, token=${token.address} (${token.symbol}), newBalance=${fromTokenBalance}`,
              );
            } else if (trade.toAmount > 0) {
              // Increment toToken balance (skip for burn trades)
              toTokenBalance =
                await this.#balanceRepository.incrementBalanceInTransaction(
                  tx,
                  trade.agentId,
                  token.address,
                  trade.toAmount,
                  token.chain,
                  token.symbol,
                );

              this.#logger.debug(
                `[TradeRepository] To token balance updated: agent=${trade.agentId}, token=${trade.toToken} (${trade.toTokenSymbol}), newBalance=${toTokenBalance}`,
              );
            } else {
              // Skip burn trades
              this.#logger.debug(
                `[TradeRepository] Skipping to token balance update (burn trade): agent=${trade.agentId}, token=${token.address} (${token.symbol})`,
              );
            }
          }

          // Validate required fromToken balance
          if (fromTokenBalance === undefined) {
            throw new Error(
              `From token balance missing for token ${trade.fromToken}`,
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

          this.#logger.debug(
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
      },
      {
        maxRetries: 3,
        baseDelay: 50,
        isRetryable: isDeadlockError,
        logger: this.#logger,
        context: "createTradeWithBalances",
      },
    );
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
      this.#logger.error("Error in getAgentTrades:", error);
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
      this.#logger.error("Error in getCompetitionTradeMetrics:", error);
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
      this.#logger.error("Error in getCompetitionTrades:", error);
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
      this.#logger.error("Error in countBulkAgentTradesInCompetitions:", error);
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
      this.#logger.error("Error in getAgentTradesInCompetition:", error);
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
      this.#logger.error("Error in count:", error);
      throw error;
    }
  }
}
