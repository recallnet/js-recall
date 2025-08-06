import {
  and,
  countDistinct,
  desc,
  count as drizzleCount,
  eq,
  inArray,
  min,
  sum,
} from "drizzle-orm";

import { dbRead } from "@/database/db.js";
import {
  agents,
  competitionAgents,
  competitions,
  competitionsLeaderboard,
  votes,
} from "@/database/schema/core/defs.js";
import { agentScore } from "@/database/schema/ranking/defs.js";
import {
  trades,
  tradingCompetitionsLeaderboard,
} from "@/database/schema/trading/defs.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";
import {
  COMPETITION_AGENT_STATUS,
  COMPETITION_STATUS,
  CompetitionType,
} from "@/types/index.js";

/**
 * Leaderboard Repository
 * Handles database operations for leaderboards
 */

/**
 * Get the total ROI as percentage (decimal format) for a single agent across all finished competitions
 * @param agentId The agent ID to get ROI for
 * @returns The total ROI as percentage in decimal format (e.g., 0.37 for 37%) or null if no completed competitions
 */
export async function getAgentTotalRoi(
  agentId: string,
): Promise<number | null> {
  try {
    const result = await dbRead
      .select({
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
          eq(competitionsLeaderboard.agentId, agentId),
          eq(competitions.status, "ended"),
        ),
      )
      .groupBy(competitionsLeaderboard.agentId);

    if (!result[0]) {
      return null;
    }

    const totalPnl = Number(result[0].totalPnl);
    const totalStartingValue = Number(result[0].totalStartingValue);

    if (
      typeof totalPnl !== "number" ||
      typeof totalStartingValue !== "number" ||
      isNaN(totalPnl) ||
      isNaN(totalStartingValue) ||
      totalStartingValue <= 0
    ) {
      return null;
    }

    // Calculate ROI as percentage in decimal format (e.g., 0.37 for 37%)
    return totalPnl / totalStartingValue;
  } catch (error) {
    console.error("[LeaderboardRepository] Error in getAgentBestRoi:", error);
    return null;
  }
}

/**
 * Get global statistics for a specific competition type across all relevant competitions.
 * Relevant competitions are those with status 'ended'.
 * @param type The type of competition (e.g., 'trading')
 * @returns Object containing the total number of active agents, trades, volume,
 * competitions, and competition IDs for active or ended competitions.
 */
async function getGlobalStatsImpl(type: CompetitionType): Promise<{
  activeAgents: number;
  totalTrades: number;
  totalVolume: number;
  totalCompetitions: number;
  totalVotes: number;
  competitionIds: string[];
}> {
  repositoryLogger.debug("getGlobalStats called for type:", type);

  // Filter competitions by `type` and `status` IN ['active', 'ended'].
  const relevantCompetitions = await dbRead
    .select({ id: competitions.id })
    .from(competitions)
    .where(
      and(
        eq(competitions.type, type),
        eq(competitions.status, COMPETITION_STATUS.ENDED),
      ),
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
  const tradeStatsResult = await dbRead
    .select({
      totalTrades: drizzleCount(trades.id),
      totalVolume: sum(trades.tradeAmountUsd).mapWith(Number),
    })
    .from(trades)
    .where(inArray(trades.competitionId, relevantCompetitionIds));

  const voteStatsResult = await dbRead
    .select({
      totalVotes: drizzleCount(votes.id),
    })
    .from(votes)
    .where(inArray(votes.competitionId, relevantCompetitionIds));

  // agents remain 'active' in completed competitions
  // count distinct active agents in these competitions.
  const totalActiveAgents = await dbRead
    .select({
      totalActiveAgents: countDistinct(competitionAgents.agentId),
    })
    .from(competitionAgents)
    .where(
      and(
        inArray(competitionAgents.competitionId, relevantCompetitionIds),
        eq(competitionAgents.status, COMPETITION_AGENT_STATUS.ACTIVE),
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
 * Uses exactly 4 queries regardless of the number of agents
 *
 * @param agentIds Array of agent IDs to get metrics for
 * @returns Array of agent metrics with all required data
 */
async function getBulkAgentMetricsImpl(agentIds: string[]): Promise<
  Array<{
    agentId: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    metadata: unknown;
    globalRank: number | null;
    globalScore: number | null;
    completedCompetitions: number;
    totalVotes: number;
    totalTrades: number;
    bestPlacement: {
      competitionId: string;
      rank: number;
      score: number;
      totalAgents: number;
    } | null;
    bestPnl: number | null;
    totalRoi: number | null;
  }>
> {
  if (agentIds.length === 0) {
    return [];
  }

  repositoryLogger.debug(
    `getBulkAgentMetrics called for ${agentIds.length} agents`,
  );

  try {
    // Query 1: Agent basic info + global scores
    const agentRanksQuery = dbRead
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
    const competitionCountsQuery = dbRead
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
    const voteCountsQuery = dbRead
      .select({
        agentId: votes.agentId,
        totalVotes: drizzleCount(),
      })
      .from(votes)
      .where(inArray(votes.agentId, agentIds))
      .groupBy(votes.agentId);

    // Query 4: Trade counts
    const tradeCountsQuery = dbRead
      .select({
        agentId: trades.agentId,
        totalTrades: drizzleCount(),
      })
      .from(trades)
      .where(inArray(trades.agentId, agentIds))
      .groupBy(trades.agentId);

    // Query 5: Best placements - get the best rank for each agent
    const bestPlacementsSubquery = dbRead
      .select({
        agentId: competitionsLeaderboard.agentId,
        minRank: min(competitionsLeaderboard.rank).as("minRank"),
      })
      .from(competitionsLeaderboard)
      .where(inArray(competitionsLeaderboard.agentId, agentIds))
      .groupBy(competitionsLeaderboard.agentId)
      .as("bestRanks");

    const bestPlacementsQuery = dbRead
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
    const bestPnlQuery = dbRead
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
    const totalRoiQuery = dbRead
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

    // Execute all queries in parallel
    const [
      agentRanksResult,
      competitionCountsResult,
      voteCountsResult,
      tradeCountsResult,
      bestPlacementResult,
      bestPnlResult,
      totalRoiResult,
    ] = await Promise.all([
      agentRanksQuery,
      competitionCountsQuery,
      voteCountsQuery,
      tradeCountsQuery,
      bestPlacementsQuery,
      bestPnlQuery,
      totalRoiQuery,
    ]);

    // Query 6: Get actual ranks - need to get all ranks first then calculate
    const allRanksQuery = dbRead
      .select({
        agentId: agentScore.agentId,
        ordinal: agentScore.ordinal,
      })
      .from(agentScore)
      .orderBy(agentScore.ordinal);

    const allRanksResult = await allRanksQuery;

    // Calculate ranks
    const ranksMap = new Map<string, number>();
    allRanksResult
      .sort((a, b) => (b.ordinal || 0) - (a.ordinal || 0)) // Sort by ordinal DESC
      .forEach((rank, index) => {
        if (agentIds.includes(rank.agentId)) {
          ranksMap.set(rank.agentId, index + 1);
        }
      });

    // Create lookup maps for efficient joining
    const agentRanksMap = new Map(
      agentRanksResult.map((row) => [row.agentId, row]),
    );
    const competitionCountsMap = new Map(
      competitionCountsResult.map((row) => [
        row.agentId,
        row.completedCompetitions,
      ]),
    );
    const voteCountsMap = new Map(
      voteCountsResult.map((row) => [row.agentId, row.totalVotes]),
    );
    const tradeCountsMap = new Map(
      tradeCountsResult.map((row) => [row.agentId, row.totalTrades]),
    );
    const bestPlacementMap = new Map(
      bestPlacementResult.map((row) => [
        row.agentId,
        {
          competitionId: row.competitionId,
          rank: row.rank,
          score: row.score,
          totalAgents: row.totalAgents,
        },
      ]),
    );

    const bestPnlMap = new Map(
      bestPnlResult.map((row) => [
        row.agentId,
        {
          competitionId: row.competitionId,
          pnl: row.pnl,
        },
      ]),
    );

    const totalRoiMap = new Map(
      totalRoiResult.map((row) => {
        const totalPnl = row.totalPnl ? Number(row.totalPnl) : null;
        const totalStartingValue = row.totalStartingValue
          ? Number(row.totalStartingValue)
          : null;

        if (
          typeof totalPnl !== "number" ||
          typeof totalStartingValue !== "number" ||
          isNaN(totalPnl) ||
          isNaN(totalStartingValue) ||
          totalStartingValue <= 0
        ) {
          return [row.agentId, null];
        }

        // Calculate ROI as percentage in decimal format (e.g., 0.37 for 37%)
        const roiPercent = totalPnl / totalStartingValue;
        return [row.agentId, roiPercent];
      }),
    );

    // Combine all data
    const result = agentIds.map((agentId) => {
      const agentData = agentRanksMap.get(agentId);
      const completedCompetitions = competitionCountsMap.get(agentId) ?? 0;
      const totalVotes = voteCountsMap.get(agentId) ?? 0;
      const totalTrades = tradeCountsMap.get(agentId) ?? 0;
      const bestPlacement = bestPlacementMap.get(agentId) ?? null;
      const bestPnl = bestPnlMap.get(agentId)?.pnl ?? null;
      const globalRank = ranksMap.get(agentId) ?? null;
      const totalRoi = totalRoiMap.get(agentId) ?? null;

      return {
        agentId,
        name: agentData?.name ?? "Unknown",
        description: agentData?.description ?? null,
        imageUrl: agentData?.imageUrl ?? null,
        metadata: agentData?.metadata ?? null,
        globalScore: agentData?.globalScore ?? null,
        globalRank,
        completedCompetitions,
        totalVotes,
        totalTrades,
        bestPlacement,
        bestPnl,
        totalRoi,
      };
    });

    repositoryLogger.debug(
      `Successfully retrieved bulk metrics for ${result.length} agents`,
    );
    return result;
  } catch (error) {
    repositoryLogger.error("Error in getBulkAgentMetrics:", error);
    throw error;
  }
}

/**
 * Get optimized global agent metrics using separate queries to avoid N+1 problem
 * This replaces the N+1 query problem in calculateGlobalMetrics
 * Uses separate aggregation queries to avoid Cartesian product issues
 * @returns Array of agent metrics with all required data
 */
async function getOptimizedGlobalAgentMetricsImpl(): Promise<
  Array<{
    id: string;
    name: string;
    handle: string;
    description: string | null;
    imageUrl: string | null;
    metadata: unknown;
    score: number;
    numCompetitions: number;
    voteCount: number;
  }>
> {
  repositoryLogger.debug("getOptimizedGlobalAgentMetrics called");

  try {
    // Get all agents with their basic info and scores
    const agentsWithScores = await dbRead
      .select({
        id: agents.id,
        name: agents.name,
        handle: agents.handle,
        description: agents.description,
        imageUrl: agents.imageUrl,
        metadata: agents.metadata,
        score: agentScore.ordinal,
      })
      .from(agentScore)
      .innerJoin(agents, eq(agentScore.agentId, agents.id));

    if (agentsWithScores.length === 0) {
      return [];
    }

    const agentIds = agentsWithScores.map((agent) => agent.id);

    // Get competition counts for all agents in one query
    const competitionCounts = await dbRead
      .select({
        agentId: competitionAgents.agentId,
        numCompetitions: countDistinct(competitionAgents.competitionId),
      })
      .from(competitionAgents)
      .where(inArray(competitionAgents.agentId, agentIds))
      .groupBy(competitionAgents.agentId);

    // Get vote counts for all agents in one query
    const voteCounts = await dbRead
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
    const result = agentsWithScores.map((agent) => ({
      ...agent,
      numCompetitions: competitionCountMap.get(agent.id) ?? 0,
      voteCount: voteCountMap.get(agent.id) ?? 0,
    }));

    repositoryLogger.debug(
      `Retrieved ${result.length} agent metrics with optimized query`,
    );

    return result;
  } catch (error) {
    repositoryLogger.error("Error in getOptimizedGlobalAgentMetrics:", error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// ----------------------------------------------------------------------------

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const getGlobalStats = createTimedRepositoryFunction(
  getGlobalStatsImpl,
  "LeaderboardRepository",
  "getGlobalStats",
);

export const getBulkAgentMetrics = createTimedRepositoryFunction(
  getBulkAgentMetricsImpl,
  "LeaderboardRepository",
  "getBulkAgentMetrics",
);

export const getOptimizedGlobalAgentMetrics = createTimedRepositoryFunction(
  getOptimizedGlobalAgentMetricsImpl,
  "LeaderboardRepository",
  "getOptimizedGlobalAgentMetrics",
);
