import { getGlobalStats } from "@/database/repositories/leaderboard-repository.js";
import {
  AgentMetadata,
  CompetitionAgentsParamsSchema,
  CompetitionType,
  LeaderboardAgent,
  LeaderboardParams,
} from "@/types/index.js";

import { AgentManager } from "./agent-manager.service.js";
import { CompetitionManager } from "./competition-manager.service.js";
import { VoteManager } from "./vote-manager.service.js";

/**
 * Leaderboard Service
 * Handles global leaderboard data with sorting and pagination across all competitions
 */
export class LeaderboardService {
  constructor(
    private agentManager: AgentManager,
    private competitionManager: CompetitionManager,
    private voteManager: VoteManager,
  ) {}

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

      // Calculate global metrics for all agents across competitions
      const globalMetrics = await this.calculateGlobalMetrics(
        stats.competitionIds,
      );

      // Sort agents based on requested sort field
      const sortedAgents = this.sortAgents(
        Array.from(globalMetrics.values()),
        params.sort,
      );

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
   * Calculate global metrics for all agents across multiple competitions
   * @param competitionIds List of competition IDs to process
   * @returns Map of agent ID to accumulated metrics
   */
  private async calculateGlobalMetrics(
    competitionIds: string[],
  ): Promise<Map<string, LeaderboardAgent>> {
    const agentMetricsMap = new Map<string, LeaderboardAgent>();

    // Process each competition
    await Promise.all(
      competitionIds.map(async (competitionId) => {
        try {
          // CRITICAL: Use pagination loop instead of hardcoded limits
          const allAgents =
            await this.getAllAgentsForCompetition(competitionId);

          // Get leaderboard data for scoring
          const leaderboard =
            await this.competitionManager.getLeaderboard(competitionId);
          const leaderboardMap = new Map(
            leaderboard.map((entry, index) => [
              entry.agentId,
              { score: entry.value, position: index + 1 },
            ]),
          );

          // Get vote counts for this competition
          const voteCounts =
            await this.voteManager.getVoteCountsByCompetition(competitionId);

          // Process each agent's metrics
          await Promise.all(
            allAgents.map(async (agent) => {
              try {
                const leaderboardData = leaderboardMap.get(agent.id);
                const score = leaderboardData?.score ?? 0;

                const metrics =
                  await this.competitionManager.calculateAgentMetrics(
                    competitionId,
                    agent.id,
                    score,
                  );

                // Get or initialize agent's accumulated metrics
                const existingMetrics = agentMetricsMap.get(agent.id) || {
                  id: agent.id,
                  name: agent.name,
                  description: agent.description || undefined,
                  imageUrl: agent.imageUrl || undefined,
                  metadata: agent.metadata as AgentMetadata,
                  rank: 0, // Will be calculated after sorting
                  score: 0,
                  numCompetitions: 0,
                  voteCount: 0,
                };

                // Get vote count for current agent in current competition
                const currentCompetitionVoteCount =
                  voteCounts.get(agent.id) ?? 0;

                // Accumulate metrics across competitions
                agentMetricsMap.set(agent.id, {
                  ...existingMetrics,
                  score: existingMetrics.score + metrics.pnlPercent,
                  numCompetitions: existingMetrics.numCompetitions + 1,
                  voteCount:
                    existingMetrics.voteCount + currentCompetitionVoteCount,
                });
              } catch (error) {
                console.warn(
                  `[LeaderboardService] Failed to process agent ${agent.id} in competition ${competitionId}:`,
                  error,
                );
                // Continue processing other agents
              }
            }),
          );
        } catch (error) {
          console.warn(
            `[LeaderboardService] Failed to process competition ${competitionId}:`,
            error,
          );
          // Continue processing other competitions
        }
      }),
    );

    return agentMetricsMap;
  }

  /**
   * Get all agents for a competition with automatic pagination
   * @param competitionId Competition ID
   * @returns Array of all agents in the competition
   */
  private async getAllAgentsForCompetition(competitionId: string) {
    const allAgents = [];
    let offset = 0;
    const limit = 100; // Smaller batch size for memory efficiency

    while (true) {
      try {
        const compsQueryParams = CompetitionAgentsParamsSchema.parse({
          limit,
          offset,
        });

        const { agents, total } =
          await this.agentManager.getAgentsForCompetition(
            competitionId,
            compsQueryParams,
          );

        if (agents.length === 0) break;

        allAgents.push(...agents);
        offset += limit;

        // Safety check to prevent infinite loops
        if (allAgents.length > 10000) {
          console.warn(
            `[LeaderboardService] Too many agents in competition ${competitionId}, limiting to first 10000`,
          );
          break;
        }

        // If we've fetched all agents, break
        if (allAgents.length >= total) break;
      } catch (error) {
        console.error(
          `[LeaderboardService] Failed to fetch agents for competition ${competitionId} at offset ${offset}:`,
          error,
        );
        break;
      }
    }

    return allAgents;
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
