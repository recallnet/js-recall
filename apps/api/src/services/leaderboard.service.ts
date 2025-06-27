import {
  getGlobalStats,
  getOptimizedGlobalAgentMetrics,
} from "@/database/repositories/leaderboard-repository.js";
import {
  AgentMetadata,
  CompetitionType,
  LeaderboardAgent,
  LeaderboardParams,
} from "@/types/index.js";

import { AgentManager } from "./agent-manager.service.js";

/**
 * Leaderboard Service
 * Handles global leaderboard data with sorting and pagination across all competitions
 */
export class LeaderboardService {
  constructor(private agentManager: AgentManager) {}

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

      // Calculate global metrics for all agents across competitions using optimized query
      const globalMetrics = await this.getOptimizedGlobalMetrics();

      // Sort agents based on requested sort field
      const sortedAgents = this.sortAgents(globalMetrics, params.sort);

      // Apply pagination
      const total = sortedAgents.length;
      const paginatedAgents = sortedAgents.slice(
        params.offset,
        params.offset + params.limit,
      );

      return {
        stats: {
          activeAgents: stats.activeAgents,
          totalCompetitions: stats.totalCompetitions,
          totalTrades: stats.totalTrades,
          totalVolume: stats.totalVolume,
          totalVotes: stats.totalVotes,
        },
        agents: paginatedAgents,
        pagination: {
          total,
          limit: params.limit,
          offset: params.offset,
          hasMore: params.offset + params.limit < total,
        },
      };
    } catch (error) {
      console.error(
        "[LeaderboardService] Failed to get global leaderboard:",
        error,
      );

      // Return safe fallback instead of throwing
      return this.emptyLeaderboardResponse(params);
    }
  }

  /**
   * Get optimized global metrics for all agents using a single query
   * This replaces the N+1 query problem from the old calculateGlobalMetrics method
   * @returns Array of agent metrics with all required data
   */
  private async getOptimizedGlobalMetrics(): Promise<LeaderboardAgent[]> {
    const agentMetrics = await getOptimizedGlobalAgentMetrics();

    return agentMetrics.map((agent) => ({
      rank: 0, // Will be set during sorting
      id: agent.id,
      name: agent.name,
      description: agent.description,
      imageUrl: agent.imageUrl,
      metadata: agent.metadata as AgentMetadata,
      score: agent.score,
      numCompetitions: agent.numCompetitions,
      voteCount: agent.voteCount,
    }));
  }

  /**
   * Sort agents based on the requested sort field
   * @param agents Array of agents to sort
   * @param sortField Sort field with optional '-' prefix for descending
   * @returns Sorted array with updated ranks
   */
  private sortAgents(
    agents: LeaderboardAgent[],
    sortField?: string,
  ): LeaderboardAgent[] {
    // Validate and sanitize sort field
    const VALID_SORT_FIELDS = [
      "rank",
      "score",
      "name",
      "competitions",
      "votes",
    ] as const;

    const sort = sortField || "rank";
    const isDescending = sort.startsWith("-");
    const field = isDescending ? sort.slice(1) : sort;

    // Critical: Validate against whitelist
    if (
      !VALID_SORT_FIELDS.includes(field as (typeof VALID_SORT_FIELDS)[number])
    ) {
      console.warn(
        `[LeaderboardService] Invalid sort field '${field}', falling back to rank`,
      );
      return this.sortAgents(agents, "rank"); // Safe fallback
    }

    // For rank-based sorting, always assign ranks first based on score
    let agentsWithRanks = [...agents];
    if (field === "rank") {
      // Sort by score descending to assign proper ranks
      agentsWithRanks = [...agents]
        .sort((a, b) => b.score - a.score)
        .map((agent, index) => ({
          ...agent,
          rank: index + 1,
        }));

      // If user wants descending rank order, reverse the array
      if (isDescending) {
        return agentsWithRanks.reverse();
      }
      return agentsWithRanks;
    }

    // For non-rank sorting, sort the agents normally
    const sortedAgents = [...agentsWithRanks].sort((a, b) => {
      let comparison = 0;

      switch (field) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "score":
          comparison = a.score - b.score;
          break;
        case "competitions":
          comparison = a.numCompetitions - b.numCompetitions;
          break;
        case "votes":
          comparison = a.voteCount - b.voteCount;
          break;
        default:
          comparison = 0;
      }

      return isDescending ? -comparison : comparison;
    });

    // For non-rank sorting, assign ranks based on score after sorting
    // First, get rank mapping based on scores
    const scoreRankMap = new Map();
    [...agents]
      .sort((a, b) => b.score - a.score)
      .forEach((agent, index) => {
        scoreRankMap.set(agent.id, index + 1);
      });

    // Apply the rank mapping to sorted agents
    return sortedAgents.map((agent) => ({
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
    console.log("[LeaderboardService] getGlobalStats for type:", type);
    return await getGlobalStats(type);
  }
}
