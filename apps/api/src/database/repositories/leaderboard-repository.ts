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

import { db } from "@/database/db.js";
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
 * Get global statistics for a specific competition type across all relevant competitions.
 * Relevant competitions are those with status 'ended'.
 * @param type The type of competition (e.g., 'trading')
 * @returns Object containing the total number of active agents, trades, volume,
 * competitions, and competition IDs for active or ended competitions.
 */
export async function getGlobalStats(type: CompetitionType): Promise<{
  activeAgents: number;
  totalTrades: number;
  totalVolume: number;
  totalCompetitions: number;
  totalVotes: number;
  competitionIds: string[];
}> {
  console.log("[CompetitionRepository] getGlobalStats called for type:", type);

  // Filter competitions by `type` and `status` IN ['active', 'ended'].
  const relevantCompetitions = await db
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
  const tradeStatsResult = await db
    .select({
      totalTrades: drizzleCount(trades.id),
      totalVolume: sum(trades.tradeAmountUsd).mapWith(Number),
    })
    .from(trades)
    .where(inArray(trades.competitionId, relevantCompetitionIds));

  const voteStatsResult = await db
    .select({
      totalVotes: drizzleCount(votes.id),
    })
    .from(votes)
    .where(inArray(votes.competitionId, relevantCompetitionIds));

  // agents remain 'active' in completed competitions
  // count distinct active agents in these competitions.
  const totalActiveAgents = await db
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
export async function getBulkAgentMetrics(agentIds: string[]): Promise<
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
  }>
> {
  if (agentIds.length === 0) {
    return [];
  }

  console.log(
    `[LeaderboardRepository] getBulkAgentMetrics called for ${agentIds.length} agents`,
  );

  try {
    // Query 1: Agent basic info + global scores
    const agentRanksQuery = db
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
    const competitionCountsQuery = db
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
    const voteCountsQuery = db
      .select({
        agentId: votes.agentId,
        totalVotes: drizzleCount(),
      })
      .from(votes)
      .where(inArray(votes.agentId, agentIds))
      .groupBy(votes.agentId);

    // Query 4: Trade counts
    const tradeCountsQuery = db
      .select({
        agentId: trades.agentId,
        totalTrades: drizzleCount(),
      })
      .from(trades)
      .where(inArray(trades.agentId, agentIds))
      .groupBy(trades.agentId);

    // Query 5: Best placements - get the best rank for each agent
    const bestPlacementsSubquery = db
      .select({
        agentId: competitionsLeaderboard.agentId,
        minRank: min(competitionsLeaderboard.rank).as("minRank"),
      })
      .from(competitionsLeaderboard)
      .where(inArray(competitionsLeaderboard.agentId, agentIds))
      .groupBy(competitionsLeaderboard.agentId)
      .as("bestRanks");

    const bestPlacementsQuery = db
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
    const bestPnlQuery = db
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

    // Execute all queries in parallel
    const [
      agentRanksResult,
      competitionCountsResult,
      voteCountsResult,
      tradeCountsResult,
      bestPlacementResult,
      bestPnlResult,
    ] = await Promise.all([
      agentRanksQuery,
      competitionCountsQuery,
      voteCountsQuery,
      tradeCountsQuery,
      bestPlacementsQuery,
      bestPnlQuery,
    ]);

    // Query 6: Get actual ranks - need to get all ranks first then calculate
    const allRanksQuery = db
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

    // Combine all data
    const result = agentIds.map((agentId) => {
      const agentData = agentRanksMap.get(agentId);
      const completedCompetitions = competitionCountsMap.get(agentId) ?? 0;
      const totalVotes = voteCountsMap.get(agentId) ?? 0;
      const totalTrades = tradeCountsMap.get(agentId) ?? 0;
      const bestPlacement = bestPlacementMap.get(agentId) ?? null;
      const bestPnl = bestPnlMap.get(agentId)?.pnl ?? null;
      const globalRank = ranksMap.get(agentId) ?? null;

      return {
        agentId,
        name: agentData?.name ?? "Unknown",
        description: agentData?.description ?? null,
        imageUrl: agentData?.imageUrl ?? null,
        metadata: agentData?.metadata ?? null,
        globalRank,
        globalScore: agentData?.globalScore ?? null,
        completedCompetitions,
        totalVotes,
        totalTrades,
        bestPlacement,
        bestPnl,
      };
    });

    console.log(
      `[LeaderboardRepository] Successfully retrieved bulk metrics for ${result.length} agents`,
    );
    return result;
  } catch (error) {
    console.error(
      "[LeaderboardRepository] Error in getBulkAgentMetrics:",
      error,
    );
    throw error;
  }
}

/**
 * Get optimized global agent metrics using separate queries to avoid N+1 problem
 * This replaces the N+1 query problem in calculateGlobalMetrics
 * Uses separate aggregation queries to avoid Cartesian product issues
 * @returns Array of agent metrics with all required data
 */
export async function getOptimizedGlobalAgentMetrics(): Promise<
  Array<{
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    metadata: unknown;
    score: number;
    numCompetitions: number;
    voteCount: number;
  }>
> {
  console.log("[LeaderboardRepository] getOptimizedGlobalAgentMetrics called");

  try {
    // Get all agents with their basic info and scores
    const agentsWithScores = await db
      .select({
        id: agents.id,
        name: agents.name,
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
    const competitionCounts = await db
      .select({
        agentId: competitionAgents.agentId,
        numCompetitions: countDistinct(competitionAgents.competitionId),
      })
      .from(competitionAgents)
      .where(inArray(competitionAgents.agentId, agentIds))
      .groupBy(competitionAgents.agentId);

    // Get vote counts for all agents in one query
    const voteCounts = await db
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

    console.log(
      `[LeaderboardRepository] Retrieved ${result.length} agent metrics with optimized query`,
    );

    return result;
  } catch (error) {
    console.error(
      "[LeaderboardRepository] Error in getOptimizedGlobalAgentMetrics:",
      error,
    );
    throw error;
  }
}
