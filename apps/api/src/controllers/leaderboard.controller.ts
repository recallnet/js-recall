import { NextFunction, Request, Response } from "express";

import { SelectAgent } from "@/database/schema/core/types.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import {
  AgentMetadata,
  AgentRank,
  CompetitionAgentsParamsSchema,
  LeaderboardParamsSchema,
} from "@/types/index.js";

export function makeLeaderboardController(services: ServiceRegistry) {
  /**
   * Leaderboard Controller
   * Handles global leaderboard operations.
   */
  return {
    /**
     * Get global leaderboard across all relevant competitions.
     * This endpoint is publicly accessible for read-only purposes.
     * @param req Request object (authentication is optional for this endpoint)
     * @param res Express response object
     * @param next Express next function
     */
    async getGlobalLeaderboard(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        // Validate query parameters
        const { success, data, error } = LeaderboardParamsSchema.safeParse(
          req.query,
        );
        if (!success) {
          throw new ApiError(400, `Invalid request format: ${error.message}`);
        }
        const queryParams = data;

        // Get global stats (i.e., generic competition accumulations)
        const stats = await services.leaderboardService.getGlobalStats(
          queryParams.type,
        );

        if (stats.competitionIds.length === 0) {
          throw new ApiError(404, "No competitions found");
        }

        // Collect agents and their metrics across all competitions
        const agentMetricsMap = new Map<string, AgentRank>();

        // Process each competition (need to get all agents in order to properly calculate metrics)
        await Promise.all(
          stats.competitionIds.map(async (competitionId) => {
            // Get all agents for this competition
            let allAgents: SelectAgent[] = [];
            let offset = 0;
            let hasMore = true;

            while (hasMore) {
              const compsQueryParams = CompetitionAgentsParamsSchema.parse({
                limit: 100,
                offset,
              });
              const { agents, total } =
                await services.agentManager.getAgentsForCompetition(
                  competitionId,
                  compsQueryParams,
                );
              allAgents = [...allAgents, ...agents];
              offset += 100;
              hasMore = allAgents.length < total;
            }

            // Get leaderboard data for scoring
            const leaderboard =
              await services.competitionManager.getLeaderboard(competitionId);
            const leaderboardMap = new Map(
              leaderboard.map((entry, index) => [
                entry.agentId,
                { score: entry.value, position: index + 1 },
              ]),
            );

            // Process each agent's metrics
            await Promise.all(
              allAgents.map(async (agent) => {
                const leaderboardData = leaderboardMap.get(agent.id);
                const score = leaderboardData?.score ?? 0;

                const metrics =
                  await services.competitionManager.calculateAgentMetrics(
                    competitionId,
                    agent.id,
                    score,
                  );

                // Get or initialize agent's accumulated metrics
                const existingMetrics = agentMetricsMap.get(agent.id) || {
                  id: agent.id,
                  name: agent.name,
                  imageUrl: agent.imageUrl || undefined,
                  metadata: agent.metadata as AgentMetadata,
                  rank: 0, // Will be calculated after sorting
                  score: 0, // TODO: Use pnl percent as naive score until we have elo
                  numCompetitions: 0,
                };

                // Accumulate metrics across competitions
                agentMetricsMap.set(agent.id, {
                  ...existingMetrics,
                  score: existingMetrics.score + metrics.pnlPercent,
                  numCompetitions: existingMetrics.numCompetitions + 1,
                });
              }),
            );
          }),
        );

        // Convert map to array and sort by score
        const globalRankings = Array.from(agentMetricsMap.values())
          .sort((a, b) => b.score - a.score)
          .map((agent, index) => ({
            ...agent,
            rank: index + 1,
          }));

        // Apply pagination
        const total = globalRankings.length;
        const paginatedRankings = globalRankings.slice(
          queryParams.offset,
          queryParams.offset + queryParams.limit,
        );

        // Return the competition agents with pagination metadata
        res.status(200).json({
          success: true,
          stats: {
            activeAgents: stats.activeAgents,
            totalCompetitions: stats.totalCompetitions,
            totalTrades: stats.totalTrades,
            totalVolume: stats.totalVolume,
          },
          agents: paginatedRankings,
          pagination: {
            total,
            limit: queryParams.limit,
            offset: queryParams.offset,
            hasMore: queryParams.offset + queryParams.limit < total,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

export type LeaderboardController = ReturnType<
  typeof makeLeaderboardController
>;
