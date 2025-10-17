import {
  and,
  avg,
  countDistinct,
  desc,
  count as drizzleCount,
  eq,
  inArray,
  max,
  min,
  sum,
} from "drizzle-orm";
import { Logger } from "pino";

import {
  agents,
  competitionAgents,
  competitions,
  competitionsLeaderboard,
  votes,
} from "../schema/core/defs.js";
import { agentScore } from "../schema/ranking/defs.js";
import {
  perpetualPositions,
  trades,
  tradingCompetitionsLeaderboard,
} from "../schema/trading/defs.js";
import { Database } from "../types.js";
import type { RawAgentMetricsQueryResult } from "./types/agent-metrics.js";
import { CompetitionType } from "./types/index.js";

/**
 * Leaderboard Repository
 * Handles database operations for leaderboards
 */

export class LeaderboardRepository {
  readonly #dbRead: Database;
  readonly #logger: Logger;

  constructor(dbRead: Database, logger: Logger) {
    this.#dbRead = dbRead;
    this.#logger = logger;
  }

  /**
   * Get global statistics for a specific competition type across all relevant competitions.
   * Relevant competitions are those with status 'ended'.
   * @param type The type of competition (e.g., 'trading')
   * @returns Object containing the total number of active agents, trades, volume,
   * competitions, and competition IDs for active or ended competitions.
   */
  async getGlobalStats(type: CompetitionType): Promise<{
    activeAgents: number;
    totalTrades: number;
    totalVolume: number;
    totalCompetitions: number;
    totalVotes: number;
    competitionIds: string[];
  }> {
    this.#logger.debug("getGlobalStats called for type:", type);

    // Filter competitions by `type` and `status` IN ['active', 'ended'].
    const relevantCompetitions = await this.#dbRead
      .select({ id: competitions.id })
      .from(competitions)
      .where(
        and(eq(competitions.type, type), eq(competitions.status, "ended")),
      );

    if (relevantCompetitions.length === 0) {
      return {
        activeAgents: 0,
        totalTrades: 0,
        totalVolume: 0,
        totalCompetitions: 0,
        totalVotes: 0,
        competitionIds: [],
      };
    }

    const relevantCompetitionIds = relevantCompetitions.map((c) => c.id);

    // Sum up total trades and total volume from these competitions.
    const tradeStatsResult = await this.#dbRead
      .select({
        totalTrades: drizzleCount(trades.id),
        totalVolume: sum(trades.tradeAmountUsd).mapWith(Number),
      })
      .from(trades)
      .where(inArray(trades.competitionId, relevantCompetitionIds));

    const voteStatsResult = await this.#dbRead
      .select({
        totalVotes: drizzleCount(votes.id),
      })
      .from(votes)
      .where(inArray(votes.competitionId, relevantCompetitionIds));

    // agents remain 'active' in completed competitions
    // count distinct active agents in these competitions.
    const totalActiveAgents = await this.#dbRead
      .select({
        totalActiveAgents: countDistinct(competitionAgents.agentId),
      })
      .from(competitionAgents)
      .where(
        and(
          inArray(competitionAgents.competitionId, relevantCompetitionIds),
          eq(competitionAgents.status, "active"),
        ),
      );

    return {
      activeAgents: totalActiveAgents[0]?.totalActiveAgents ?? 0,
      totalTrades: tradeStatsResult[0]?.totalTrades ?? 0,
      totalVolume: tradeStatsResult[0]?.totalVolume ?? 0,
      totalCompetitions: relevantCompetitions.length,
      totalVotes: voteStatsResult[0]?.totalVotes ?? 0,
      competitionIds: relevantCompetitionIds,
    };
  }

  /**
   * Get bulk agent metrics for multiple agents using optimized queries
   * This replaces N+1 query patterns in attachAgentMetrics
   * Returns raw query results for processing in the service layer
   *
   * @param agentIds Array of agent IDs to get metrics for
   * @returns Raw query results from database
   */
  async getBulkAgentMetrics(
    agentIds: string[],
  ): Promise<RawAgentMetricsQueryResult> {
    if (agentIds.length === 0) {
      return {
        agentRanks: [],
        competitionCounts: [],
        voteCounts: [],
        tradeCounts: [],
        positionCounts: [],
        bestPlacements: [],
        bestPnls: [],
        totalRois: [],
        allAgentScores: [],
      };
    }

    this.#logger.debug(
      `getBulkAgentMetrics called for ${agentIds.length} agents`,
    );

    try {
      // Query 1: Agent basic info + global scores
      const agentRanksQuery = this.#dbRead
        .select({
          agentId: agents.id,
          name: agents.name,
          description: agents.description,
          imageUrl: agents.imageUrl,
          metadata: agents.metadata,
          globalScore: agentScore.ordinal,
        })
        .from(agents)
        .leftJoin(agentScore, eq(agents.id, agentScore.agentId))
        .where(inArray(agents.id, agentIds));

      // Query 2: Competition counts (only completed competitions)
      const competitionCountsQuery = this.#dbRead
        .select({
          agentId: competitionAgents.agentId,
          completedCompetitions: countDistinct(competitions.id),
        })
        .from(competitionAgents)
        .innerJoin(
          competitions,
          eq(competitionAgents.competitionId, competitions.id),
        )
        .where(
          and(
            inArray(competitionAgents.agentId, agentIds),
            eq(competitions.status, "ended"),
          ),
        )
        .groupBy(competitionAgents.agentId);

      // Query 3: Vote counts
      const voteCountsQuery = this.#dbRead
        .select({
          agentId: votes.agentId,
          totalVotes: drizzleCount(),
        })
        .from(votes)
        .where(inArray(votes.agentId, agentIds))
        .groupBy(votes.agentId);

      // Query 4: Trade counts
      const tradeCountsQuery = this.#dbRead
        .select({
          agentId: trades.agentId,
          totalTrades: drizzleCount(),
        })
        .from(trades)
        .where(inArray(trades.agentId, agentIds))
        .groupBy(trades.agentId);

      // Query 4b: Position counts (for perpetual futures competitions)
      const positionCountsQuery = this.#dbRead
        .select({
          agentId: perpetualPositions.agentId,
          totalPositions: drizzleCount(),
        })
        .from(perpetualPositions)
        .where(inArray(perpetualPositions.agentId, agentIds))
        .groupBy(perpetualPositions.agentId);

      // Query 5: Best placements - get the best rank for each agent
      const bestPlacementsSubquery = this.#dbRead
        .select({
          agentId: competitionsLeaderboard.agentId,
          minRank: min(competitionsLeaderboard.rank).as("minRank"),
        })
        .from(competitionsLeaderboard)
        .where(inArray(competitionsLeaderboard.agentId, agentIds))
        .groupBy(competitionsLeaderboard.agentId)
        .as("bestRanks");

      const bestPlacementsQuery = this.#dbRead
        .select({
          competitionId: competitionsLeaderboard.competitionId,
          agentId: competitionsLeaderboard.agentId,
          rank: competitionsLeaderboard.rank,
          score: competitionsLeaderboard.score,
          totalAgents: competitionsLeaderboard.totalAgents,
        })
        .from(competitionsLeaderboard)
        .innerJoin(
          bestPlacementsSubquery,
          and(
            eq(competitionsLeaderboard.agentId, bestPlacementsSubquery.agentId),
            eq(competitionsLeaderboard.rank, bestPlacementsSubquery.minRank),
          ),
        )
        .where(inArray(competitionsLeaderboard.agentId, agentIds));

      // Query 6: Best Profit/Loss
      const bestPnlQuery = this.#dbRead
        .selectDistinctOn([competitionsLeaderboard.agentId], {
          competitionId: competitionsLeaderboard.competitionId,
          agentId: competitionsLeaderboard.agentId,
          pnl: tradingCompetitionsLeaderboard.pnl,
        })
        .from(competitionsLeaderboard)
        .innerJoin(
          tradingCompetitionsLeaderboard,
          eq(
            tradingCompetitionsLeaderboard.competitionsLeaderboardId,
            competitionsLeaderboard.id,
          ),
        )
        .where(inArray(competitionsLeaderboard.agentId, agentIds))
        .orderBy(
          competitionsLeaderboard.agentId,
          desc(tradingCompetitionsLeaderboard.pnl),
        );

      // Query 7: Total ROI - calculate ROI percentage across all finished competitions
      const totalRoiQuery = this.#dbRead
        .select({
          agentId: competitionsLeaderboard.agentId,
          totalPnl: sum(tradingCompetitionsLeaderboard.pnl).as("totalPnl"),
          totalStartingValue: sum(
            tradingCompetitionsLeaderboard.startingValue,
          ).as("totalStartingValue"),
        })
        .from(competitionsLeaderboard)
        .innerJoin(
          tradingCompetitionsLeaderboard,
          eq(
            tradingCompetitionsLeaderboard.competitionsLeaderboardId,
            competitionsLeaderboard.id,
          ),
        )
        .innerJoin(
          competitions,
          eq(competitionsLeaderboard.competitionId, competitions.id),
        )
        .where(
          and(
            inArray(competitionsLeaderboard.agentId, agentIds),
            eq(competitions.status, "ended"),
          ),
        )
        .groupBy(competitionsLeaderboard.agentId);

      // Query 8: Get all agent scores for rank calculation in service layer
      const allAgentScoresQuery = this.#dbRead
        .select({
          agentId: agentScore.agentId,
          ordinal: agentScore.ordinal,
        })
        .from(agentScore)
        .orderBy(agentScore.ordinal);

      // Execute all queries in parallel
      const [
        agentRanks,
        competitionCounts,
        voteCounts,
        tradeCounts,
        positionCounts,
        bestPlacements,
        bestPnls,
        totalRois,
        allAgentScores,
      ] = await Promise.all([
        agentRanksQuery,
        competitionCountsQuery,
        voteCountsQuery,
        tradeCountsQuery,
        positionCountsQuery,
        bestPlacementsQuery,
        bestPnlQuery,
        totalRoiQuery,
        allAgentScoresQuery,
      ]);

      // Return raw query results for processing in service layer
      this.#logger.debug(
        `Successfully retrieved bulk metrics data for ${agentIds.length} agents`,
      );

      return {
        agentRanks,
        competitionCounts,
        voteCounts,
        tradeCounts,
        positionCounts,
        bestPlacements,
        bestPnls,
        totalRois,
        allAgentScores,
      };
    } catch (error) {
      this.#logger.error("Error in getBulkAgentMetrics:", error);
      throw error;
    }
  }

  /**
   * Get statistics for a specific competition type across all agents
   * @param type The competition type to get statistics for
   * @returns Average score, top score, and total agent count for the given type
   */
  async getStatsForCompetitionType(type: CompetitionType): Promise<{
    avgScore: number;
    topScore: number;
    totalAgents: number;
  }> {
    this.#logger.debug(`getStatsForCompetitionType called for type: ${type}`);

    try {
      const result = await this.#dbRead
        .select({
          avgScore: avg(agentScore.ordinal).mapWith(Number),
          topScore: max(agentScore.ordinal).mapWith(Number),
          totalAgents: drizzleCount(),
        })
        .from(agentScore)
        .where(eq(agentScore.type, type));

      const stats = result[0];
      if (!stats) {
        return {
          avgScore: 0,
          topScore: 0,
          totalAgents: 0,
        };
      }

      return {
        avgScore: stats.avgScore ?? 0,
        topScore: stats.topScore ?? 0,
        totalAgents: stats.totalAgents,
      };
    } catch (error) {
      this.#logger.error(
        { error, type },
        "Error in getStatsForCompetitionType",
      );
      throw error;
    }
  }

  /**
   * Get total count of active agents across all competition types and statuses
   * Counts distinct agents with 'active' status in all competitions
   * @returns Total number of unique active agents across the platform
   */
  async getTotalActiveAgents(): Promise<number> {
    this.#logger.debug("getTotalActiveAgents called");

    try {
      const result = await this.#dbRead
        .select({
          totalActiveAgents: countDistinct(competitionAgents.agentId),
        })
        .from(competitionAgents)
        .where(eq(competitionAgents.status, "active"));

      return result[0]?.totalActiveAgents ?? 0;
    } catch (error) {
      this.#logger.error({ error }, "Error in getTotalActiveAgents");
      throw error;
    }
  }

  /**
   * Get count of distinct agent IDs across all competition types
   * @returns Total number of unique active agents across the platform
   */
  async getTotalRankedAgents(): Promise<number> {
    this.#logger.debug("getTotalRankedAgents called");

    try {
      const result = await this.#dbRead
        .select({
          totalRankedAgents: countDistinct(agentScore.agentId),
        })
        .from(agentScore);
      return result[0]?.totalRankedAgents ?? 0;
    } catch (error) {
      this.#logger.error({ error }, "Error in getTotalRankedAgents");
      throw error;
    }
  }

  /**
   * Get global agent metrics with pagination
   * Uses separate aggregation queries to avoid Cartesian product issues
   * @param params Pagination parameters (limit and offset)
   * @returns Object containing paginated agent metrics and total count
   */
  async getGlobalAgentMetricsForType(params: {
    type: CompetitionType;
    limit: number;
    offset: number;
  }): Promise<{
    agents: Array<{
      id: string;
      name: string;
      handle: string;
      description: string | null;
      imageUrl: string | null;
      metadata: unknown;
      score: number;
      type: CompetitionType;
      numCompetitions: number;
      voteCount: number;
    }>;
    totalCount: number;
  }> {
    this.#logger.debug(
      {
        type: params.type,
        limit: params.limit,
        offset: params.offset,
      },
      `getGlobalAgentMetricsForType called with params`,
    );

    try {
      // Get paginated agents with their basic info and scores, sorted by score descending
      // Note: our service layer will use `LeaderboardParams` and zod to default to `trading`,
      // so this conditional `params.type` check isn't strictly needed
      const whereConditions = [];
      if (params.type) {
        whereConditions.push(eq(agentScore.type, params.type));
      }
      const query = this.#dbRead
        .select({
          id: agents.id,
          name: agents.name,
          handle: agents.handle,
          description: agents.description,
          imageUrl: agents.imageUrl,
          metadata: agents.metadata,
          score: agentScore.ordinal,
          type: agentScore.type,
        })
        .from(agentScore)
        .innerJoin(agents, eq(agentScore.agentId, agents.id))
        .where(and(...whereConditions))
        .orderBy(desc(agentScore.ordinal))
        .limit(params.limit)
        .offset(params.offset);

      const agentsWithScores = await query;
      if (agentsWithScores.length === 0) {
        return {
          agents: [],
          totalCount: 0,
        };
      }

      const agentIds = agentsWithScores.map((agent) => agent.id);

      // Get competition counts for paginated agents in one query
      const competitionCounts = await this.#dbRead
        .select({
          agentId: competitionAgents.agentId,
          numCompetitions: countDistinct(competitionAgents.competitionId),
        })
        .from(competitionAgents)
        .where(inArray(competitionAgents.agentId, agentIds))
        .groupBy(competitionAgents.agentId);

      // Get vote counts for paginated agents in one query
      const voteCounts = await this.#dbRead
        .select({
          agentId: votes.agentId,
          voteCount: drizzleCount(votes.id),
        })
        .from(votes)
        .where(inArray(votes.agentId, agentIds))
        .groupBy(votes.agentId);

      // Create lookup maps for efficient merging
      const competitionCountMap = new Map(
        competitionCounts.map((c) => [c.agentId, c.numCompetitions]),
      );
      const voteCountMap = new Map(
        voteCounts.map((v) => [v.agentId, v.voteCount]),
      );

      // Combine all data
      const enrichedAgents = agentsWithScores.map((agent) => ({
        ...agent,
        numCompetitions: competitionCountMap.get(agent.id) ?? 0,
        voteCount: voteCountMap.get(agent.id) ?? 0,
      }));

      // Now get the total count of all agents, needed for pagination
      const totalCountResult = await this.#dbRead
        .select({
          count: drizzleCount(),
        })
        .from(agentScore)
        .where(and(...whereConditions));
      const totalCount = totalCountResult[0]?.count ?? 0;

      this.#logger.debug(
        {
          totalCount,
          numEnrichedAgents: enrichedAgents.length,
        },
        `Retrieved agent metrics with pagination`,
      );

      return {
        agents: enrichedAgents,
        totalCount,
      };
    } catch (error) {
      this.#logger.error(
        {
          error,
        },
        "Error in getGlobalAgentMetricsForType",
      );
      throw error;
    }
  }
}
