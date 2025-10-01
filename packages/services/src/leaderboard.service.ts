import { Logger } from "pino";

import { LeaderboardRepository } from "@recallnet/db/repositories/leaderboard";

import {
  AgentMetadata,
  CompetitionType,
  LeaderboardAgent,
  LeaderboardParams,
} from "./types/index.js";

/**
 * Leaderboard Service
 * Handles global leaderboard data with pagination across all competitions
 */
export class LeaderboardService {
  private leaderboardRepo: LeaderboardRepository;
  private logger: Logger;

  constructor(leaderboardRepo: LeaderboardRepository, logger: Logger) {
    this.leaderboardRepo = leaderboardRepo;
    this.logger = logger;
  }

  /**
   * Get global leaderboard data with pagination
   * @param params Query parameters including limit, offset
   * @returns Complete leaderboard response with ranked agents and metadata
   */
  async getGlobalLeaderboard(params: LeaderboardParams) {
    try {
      // Get global stats across all competition types
      const stats = await this.leaderboardRepo.getGlobalStatsAllTypes();
      if (stats.competitionIds.length === 0) {
        return this.emptyLeaderboardResponse(params);
      }

      // Get paginated global metrics from database
      const { agents, totalCount } = await this.getGlobalAgentMetrics(params);

      return {
        stats: {
          activeAgents: stats.activeAgents,
          totalCompetitions: stats.totalCompetitions,
          totalTrades: stats.totalTrades,
          totalPositions: stats.totalPositions,
          totalVolume: stats.totalVolume,
          totalVotes: stats.totalVotes,
        },
        agents,
        pagination: {
          total: totalCount,
          limit: params.limit,
          offset: params.offset,
          hasMore: params.offset + params.limit < totalCount,
        },
      };
    } catch (error) {
      this.logger.error(
        "[LeaderboardService] Failed to get global leaderboard:",
        error,
      );

      // Return safe fallback instead of throwing
      return this.emptyLeaderboardResponse(params);
    }
  }

  /**
   * Get global metrics for agents with pagination and ranking, ordered by score
   * @param params Pagination parameters
   * @returns Object with paginated agent metrics and total count
   */
  private async getGlobalAgentMetrics(params: {
    limit: number;
    offset: number;
  }): Promise<{
    agents: LeaderboardAgent[];
    totalCount: number;
  }> {
    const { agents, totalCount } = await this.leaderboardRepo.getGlobalAgentMetrics(params);

    // Calculate ranks using arithmetic (offset + index + 1)
    // Database already sorted by score descending, so ranks are sequential
    const rankedAgents = agents.map((agent, index) => ({
      ...agent,
      rank: params.offset + index + 1,
      metadata: agent.metadata as AgentMetadata,
    }));

    return {
      agents: rankedAgents,
      totalCount,
    };
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
    this.logger.debug("[LeaderboardService] getGlobalStats for type:", type);
    return await this.leaderboardRepo.getGlobalStats(type);
  }
}
