import { Logger } from "pino";

import { LeaderboardRepository } from "@recallnet/db/repositories/leaderboard";

import { buildPaginationResponse } from "./lib/pagination-utils.js";
import {
  AgentMetadata,
  BenchmarkLeaderboardData,
  CompetitionType,
  LeaderboardAgent,
  LeaderboardParams,
  UnifiedLeaderboardData,
  UnifiedSkillData,
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
   * Get leaderboard data with pagination
   * Returns global leaderboard by type or arena-specific leaderboard if arenaId provided
   * @param params Query parameters including type, arenaId, limit, offset
   * @returns Complete leaderboard response with ranked agents and metadata
   */
  async getGlobalLeaderboardForType(params: LeaderboardParams) {
    try {
      // If arenaId provided, return arena-specific leaderboard
      if (params.arenaId) {
        return await this.getArenaLeaderboard(params.arenaId, params);
      }

      // Otherwise return global leaderboard by type
      const { agents, totalCount } =
        await this.getGlobalAgentMetricsForType(params);

      return {
        agents,
        pagination: buildPaginationResponse(
          totalCount,
          params.limit,
          params.offset,
        ),
      };
    } catch (error) {
      this.logger.error(
        "[LeaderboardService] Failed to get leaderboard:",
        error,
      );

      // Return safe fallback instead of throwing
      return this.emptyLeaderboardResponse(params);
    }
  }

  /**
   * Get arena-specific leaderboard data with pagination
   * @param arenaId Arena ID to get leaderboard for
   * @param params Pagination parameters
   * @returns Complete leaderboard response with ranked agents and metadata
   */
  private async getArenaLeaderboard(
    arenaId: string,
    params: Pick<LeaderboardParams, "limit" | "offset">,
  ) {
    const { agents, totalCount } =
      await this.leaderboardRepo.getArenaLeaderboard({
        arenaId,
        limit: params.limit,
        offset: params.offset,
      });

    // Calculate ranks using arithmetic (offset + index + 1)
    const rankedAgents = agents.map((agent, index) => ({
      ...agent,
      rank: params.offset + index + 1,
      metadata: agent.metadata as AgentMetadata,
    }));

    return {
      agents: rankedAgents,
      pagination: buildPaginationResponse(
        totalCount,
        params.limit,
        params.offset,
      ),
    };
  }

  /**
   * Get global metrics for agents with pagination and ranking, ordered by score
   * @param params Pagination parameters
   * @returns Object with paginated agent metrics and total count
   */
  private async getGlobalAgentMetricsForType(
    params: LeaderboardParams,
  ): Promise<{
    agents: LeaderboardAgent[];
    totalCount: number;
  }> {
    const { agents, totalCount } =
      await this.leaderboardRepo.getGlobalAgentMetricsForType(params);

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

  /**
   * Get unified leaderboard combining benchmark models with trading/futures agents
   * @param benchmarkData The benchmark leaderboard data from JSON
   * @returns Complete unified leaderboard data with all skills, models, and agents
   */
  async getUnifiedLeaderboard(
    benchmarkData: BenchmarkLeaderboardData,
  ): Promise<UnifiedLeaderboardData> {
    try {
      this.logger.debug("[LeaderboardService] Building unified leaderboard");

      const allSkills = benchmarkData.skills;
      const skillDataMap: Record<string, UnifiedSkillData> = {};

      // Process each skill
      for (const [skillId, skill] of Object.entries(allSkills)) {
        if (skillId === "crypto_trading") {
          // Get trading agents from database
          const agentsResponse = await this.getGlobalLeaderboardForType({
            type: "trading",
            limit: 100,
            offset: 0,
          });

          // Get stats from ALL agents in the database
          const tradingStats =
            await this.leaderboardRepo.getStatsForCompetitionType("trading");

          skillDataMap[skillId] = {
            skill,
            participants: {
              models: [],
              agents: agentsResponse.agents || [],
            },
            stats: {
              totalParticipants: tradingStats.totalAgents,
              modelCount: 0,
              agentCount: tradingStats.totalAgents,
              avgScore: tradingStats.avgScore,
              topScore: tradingStats.topScore,
            },
            pagination: agentsResponse.pagination,
          };
        } else if (skillId === "perpetual_futures") {
          // Get perpetual futures agents from database
          const agentsResponse = await this.getGlobalLeaderboardForType({
            type: "perpetual_futures",
            limit: 100,
            offset: 0,
          });

          // Get stats from ALL agents in the database
          const futuresStats =
            await this.leaderboardRepo.getStatsForCompetitionType(
              "perpetual_futures",
            );

          skillDataMap[skillId] = {
            skill,
            participants: {
              models: [],
              agents: agentsResponse.agents || [],
            },
            stats: {
              totalParticipants: futuresStats.totalAgents,
              modelCount: 0,
              agentCount: futuresStats.totalAgents,
              avgScore: futuresStats.avgScore,
              topScore: futuresStats.topScore,
            },
            pagination: agentsResponse.pagination,
          };
        } else {
          // Benchmark skill - use models from JSON
          const modelsForSkill = benchmarkData.models
            .filter((model) => model.scores[skillId] !== undefined)
            .sort(
              (a, b) =>
                (a.scores[skillId]?.rank || 999) -
                (b.scores[skillId]?.rank || 999),
            );

          skillDataMap[skillId] = {
            skill,
            participants: {
              models: modelsForSkill,
              agents: [],
            },
            stats: {
              totalParticipants: modelsForSkill.length,
              modelCount: modelsForSkill.length,
              agentCount: 0,
              avgScore: benchmarkData.skillStats[skillId]?.avgScore,
              topScore: benchmarkData.skillStats[skillId]?.topScore,
            },
          };
        }
      }

      // Get total ranked agents across all competition types
      const totalRankedAgents =
        await this.leaderboardRepo.getTotalRankedAgents();

      return {
        skills: allSkills,
        skillData: skillDataMap,
        globalStats: {
          totalSkills: Object.keys(allSkills).length,
          totalModels: benchmarkData.models.length,
          totalAgents: totalRankedAgents,
        },
      };
    } catch (error) {
      this.logger.error(
        "[LeaderboardService] Failed to build unified leaderboard:",
        error,
      );
      throw error;
    }
  }
}
