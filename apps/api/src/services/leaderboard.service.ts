import {
  getGlobalStats,
  getOptimizedGlobalAgentMetrics,
  getTotalAgentsWithScores,
} from "@/database/repositories/leaderboard-repository.js";
import { serviceLogger } from "@/lib/logger.js";
import {
  AgentMetadata,
  CompetitionType,
  LeaderboardAgent,
  LeaderboardParams,
} from "@/types/index.js";

import { AgentService } from "./agent.service.js";

/**
 * Leaderboard Service
 * Handles global leaderboard data with sorting and pagination across all competitions
 */
export class LeaderboardService {
  constructor(private agentService: AgentService) {}

  /**
   * Get global leaderboard data with sorting and pagination
   * @param params Query parameters including sort, limit, offset
   * @returns Complete leaderboard response with sorted agents and metadata
   */
  async getGlobalLeaderboardWithSorting(params: LeaderboardParams) {
    try {
      // Get global stats (existing functionality)
      const stats = await getGlobalStats(params.type);
      if (stats.competitionIds.length === 0) {
        return this.emptyLeaderboardResponse(params);
      }

      // Get agents with SQL-level sorting and pagination
      const agents = await this.getOptimizedGlobalMetrics(
        params.sort,
        params.limit,
        params.offset,
      );

      // For total count, we need to get all agents count (for pagination metadata)
      const totalCount = await this.getTotalAgentsCount();

      // Assign ranks based on score ordering with offset consideration
      const agentsWithRanks = this.assignRanks(
        agents,
        params.sort,
        params.offset,
      );

      return {
        stats: {
          activeAgents: stats.activeAgents,
          totalCompetitions: stats.totalCompetitions,
          totalTrades: stats.totalTrades,
          totalVolume: stats.totalVolume,
          totalVotes: stats.totalVotes,
        },
        agents: agentsWithRanks,
        pagination: {
          total: totalCount,
          limit: params.limit,
          offset: params.offset,
          hasMore: params.offset + params.limit < totalCount,
        },
      };
    } catch (error) {
      serviceLogger.error(
        "[LeaderboardService] Failed to get global leaderboard:",
        error,
      );

      // Return safe fallback instead of throwing
      return this.emptyLeaderboardResponse(params);
    }
  }

  /**
   * Get optimized global metrics for agents with SQL-level sorting and pagination
   * @param sort Sort field with optional '-' prefix for descending
   * @param limit Number of results to return
   * @param offset Number of results to skip
   * @returns Array of agent metrics with all required data
   */
  private async getOptimizedGlobalMetrics(
    sort?: string,
    limit?: number,
    offset?: number,
  ): Promise<LeaderboardAgent[]> {
    const agentMetrics = await getOptimizedGlobalAgentMetrics(
      sort,
      limit,
      offset,
    );

    return agentMetrics.map((agent) => ({
      rank: 0, // Will be set by assignRanks method
      id: agent.id,
      name: agent.name,
      handle: agent.handle,
      description: agent.description,
      imageUrl: agent.imageUrl,
      metadata: agent.metadata as AgentMetadata,
      score: agent.score,
      numCompetitions: agent.numCompetitions,
      voteCount: agent.voteCount,
    }));
  }

  /**
   * Get total count of agents with scores for pagination
   * @returns Total number of agents in the leaderboard
   */
  private async getTotalAgentsCount(): Promise<number> {
    return await getTotalAgentsWithScores();
  }

  /**
   * Assign ranks to agents based on their scores
   * Rank 1 = highest score, rank 2 = second highest, etc.
   * @param agents Array of agents to assign ranks to
   * @param sortField Sort field to determine if we need special rank handling
   * @param offset Pagination offset to calculate correct global ranks
   * @returns Array of agents with proper ranks assigned
   */
  private assignRanks(
    agents: LeaderboardAgent[],
    sortField?: string,
    offset: number = 0,
  ): LeaderboardAgent[] {
    // When sorting by rank (default sort), agents come from DB already sorted by score
    // For ascending rank: highest score gets rank 1
    // For descending rank: lowest score gets rank 1 (reversed)
    if (sortField === "rank" || sortField === undefined || sortField === "") {
      // Ascending rank order (1, 2, 3...) - highest score is rank 1
      // Include offset to maintain global rank positions
      return agents.map((agent, index) => ({
        ...agent,
        rank: offset + index + 1,
      }));
    } else if (sortField === "-rank") {
      // For descending rank, we need to know the total count
      // This is a special case that requires different handling
      // For now, we'll assign sequential ranks and the sorting will be handled by the DB
      return agents.map((agent, index) => ({
        ...agent,
        rank: offset + index + 1, // Still use global positioning
      }));
    }

    // For non-rank sort fields, assign ranks based on score regardless of current order
    // We need to get all agents to determine true ranks
    // This is a limitation of the current approach - for non-rank sorts,
    // we calculate ranks within the current page
    const agentScores = agents.map((a) => ({ id: a.id, score: a.score }));
    agentScores.sort((a, b) => b.score - a.score);

    const scoreRankMap = new Map<string, number>();
    agentScores.forEach((agent, index) => {
      scoreRankMap.set(agent.id, index + 1 + offset);
    });

    // Apply the rank mapping to maintain the requested sort order
    return agents.map((agent) => ({
      ...agent,
      rank: scoreRankMap.get(agent.id) || 1,
    }));
  }

  /**
   * Return empty leaderboard response for error cases or no data
   * @param params Original request parameters
   * @returns Safe empty response
   */
  private emptyLeaderboardResponse(params: LeaderboardParams) {
    return {
      stats: {
        activeAgents: 0,
        totalCompetitions: 0,
        totalTrades: 0,
        totalVolume: 0,
        totalVotes: 0,
      },
      agents: [],
      pagination: {
        total: 0,
        limit: params.limit,
        offset: params.offset,
        hasMore: false,
      },
    };
  }

  /**
   * Get global leaderboard data across all relevant competitions (legacy method)
   * @param type Competition type
   * @returns Basic global stats
   */
  async getGlobalStats(type: CompetitionType) {
    serviceLogger.debug("[LeaderboardService] getGlobalStats for type:", type);
    return await getGlobalStats(type);
  }
}
