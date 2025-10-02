import {
  and,
  countDistinct,
  desc,
  count as drizzleCount,
  eq,
  inArray,
  min,
  sql,
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
  perpsAccountSummaries,
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
   * Get aggregated statistics across ALL competition types (global platform stats).
   * Use this for the global leaderboard and platform-wide metrics.
   * For type-specific stats, use getGlobalStats(type) instead.
   * Aggregates stats from both paper trading and perpetual futures competitions.
   * Only includes competitions with status 'ended'.
   * @returns Object containing combined stats: totalTrades (paper), totalPositions (perps), combined volume, etc.
   */
  async getGlobalStatsAllTypes(): Promise<{
    activeAgents: number;
    totalTrades: number;
    totalPositions: number;
    totalVolume: number;
    totalCompetitions: number;
    totalVotes: number;
    competitionIds: string[];
  }> {
    this.#logger.debug("getGlobalStatsAllTypes called");

    // Get all ended competitions, separated by type
    const allEndedCompetitions = await this.#dbRead
      .select({ id: competitions.id, type: competitions.type })
      .from(competitions)
      .where(eq(competitions.status, "ended"));

    if (allEndedCompetitions.length === 0) {
      return {
        activeAgents: 0,
        totalTrades: 0,
        totalPositions: 0,
        totalVolume: 0,
        totalCompetitions: 0,
        totalVotes: 0,
        competitionIds: [],
      };
    }

    // Separate competition IDs by type
    const paperTradingIds = allEndedCompetitions
      .filter((c) => c.type === "trading")
      .map((c) => c.id);
    const perpsIds = allEndedCompetitions
      .filter((c) => c.type === "perpetual_futures")
      .map((c) => c.id);
    const allCompetitionIds = allEndedCompetitions.map((c) => c.id);

    // Run all queries in parallel
    const [
      tradeStats,
      positionStats,
      perpsVolumeStats,
      voteStats,
      activeAgentStats,
    ] = await Promise.all([
      // 1. Get trade stats for paper trading competitions only
      paperTradingIds.length > 0
        ? this.#dbRead
            .select({
              totalTrades: drizzleCount(trades.id),
              totalVolume: sum(trades.tradeAmountUsd).mapWith(Number),
            })
            .from(trades)
            .where(inArray(trades.competitionId, paperTradingIds))
        : Promise.resolve([{ totalTrades: 0, totalVolume: 0 }]),

      // 2. Get position stats for perps competitions only
      perpsIds.length > 0
        ? this.#dbRead
            .select({
              totalPositions: drizzleCount(perpetualPositions.id),
            })
            .from(perpetualPositions)
            .where(inArray(perpetualPositions.competitionId, perpsIds))
        : Promise.resolve([{ totalPositions: 0 }]),

      // 3. Get aggregated volume stats for perps competitions
      // Using lateral join for scalability - avoids materializing intermediate results
      perpsIds.length > 0
        ? (async () => {
            // Get distinct agents from all perps competitions
            const distinctAgents = this.#dbRead
              .selectDistinct({
                agentId: perpsAccountSummaries.agentId,
              })
              .from(perpsAccountSummaries)
              .where(inArray(perpsAccountSummaries.competitionId, perpsIds))
              .as("distinct_agents");

            // Create subquery for lateral join - gets latest summary per agent
            const latestSummarySubquery = this.#dbRead
              .select({
                totalVolume: perpsAccountSummaries.totalVolume,
              })
              .from(perpsAccountSummaries)
              .where(
                and(
                  inArray(perpsAccountSummaries.competitionId, perpsIds),
                  sql`${perpsAccountSummaries.agentId} = ${distinctAgents.agentId}`,
                ),
              )
              .orderBy(desc(perpsAccountSummaries.timestamp))
              .limit(1)
              .as("latest_summary");

            // Use leftJoinLateral to get latest summaries and aggregate
            const result = await this.#dbRead
              .select({
                totalVolume: sum(latestSummarySubquery.totalVolume).mapWith(
                  Number,
                ),
              })
              .from(distinctAgents)
              .leftJoinLateral(latestSummarySubquery, sql`true`);

            return result;
          })()
        : Promise.resolve([{ totalVolume: 0 }]),

      // 4. Get vote stats for all competitions
      this.#dbRead
        .select({
          totalVotes: drizzleCount(votes.id),
        })
        .from(votes)
        .where(inArray(votes.competitionId, allCompetitionIds)),

      // 5. Get active agent count across all competitions
      this.#dbRead
        .select({
          totalActiveAgents: countDistinct(competitionAgents.agentId),
        })
        .from(competitionAgents)
        .where(
          and(
            inArray(competitionAgents.competitionId, allCompetitionIds),
            eq(competitionAgents.status, "active"),
          ),
        ),
    ]);

    // Get the aggregated perps volume (already summed in the database)
    const perpsVolume = perpsVolumeStats[0]?.totalVolume ?? 0;

    // Combine volumes from both competition types
    const totalVolume = (tradeStats[0]?.totalVolume ?? 0) + perpsVolume;

    this.#logger.debug(
      `Global stats: ${allEndedCompetitions.length} competitions, ` +
        `${paperTradingIds.length} paper trading, ${perpsIds.length} perps`,
    );

    return {
      activeAgents: activeAgentStats[0]?.totalActiveAgents ?? 0,
      totalTrades: tradeStats[0]?.totalTrades ?? 0,
      totalPositions: positionStats[0]?.totalPositions ?? 0,
      totalVolume,
      totalCompetitions: allEndedCompetitions.length,
      totalVotes: voteStats[0]?.totalVotes ?? 0,
      competitionIds: allCompetitionIds,
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
   * Get global agent metrics with pagination
   * Uses separate aggregation queries to avoid Cartesian product issues
   * @param params Pagination parameters (limit and offset)
   * @returns Object containing paginated agent metrics and total count
   */
  async getGlobalAgentMetrics(params: {
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
      `getGlobalAgentMetrics called with params`,
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
        "Error in getGlobalAgentMetrics",
      );
      throw error;
    }
  }
}
