import { Rating, rate, rating } from "openskill";
import { Logger } from "pino";

import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionType } from "@recallnet/db/repositories/types";
import type { Transaction as DatabaseTransaction } from "@recallnet/db/types";

/**
 * Agent Rank Service
 * Manages agent ranking calculations and updates
 */
export class AgentRankService {
  private agentScoreRepo: AgentScoreRepository;
  private competitionRepo: CompetitionRepository;
  private logger: Logger;

  constructor(
    agentScoreRepo: AgentScoreRepository,
    competitionRepo: CompetitionRepository,
    logger: Logger,
  ) {
    this.agentScoreRepo = agentScoreRepo;
    this.competitionRepo = competitionRepo;
    this.logger = logger;
  }

  /**
   * Update agent ranks when a competition ends
   * Updates both global rankings (arena_id IS NULL) and arena-specific rankings
   * @param competitionId The ID of the competition that ended
   * @param tx Optional database transaction
   * @returns Promise resolving to void
   */
  async updateAgentRanksForCompetition(
    competitionId: string,
    tx?: DatabaseTransaction,
  ): Promise<void> {
    this.logger.debug(
      `[AgentRankService] Updating agent ranks for ended competition: ${competitionId}`,
    );

    try {
      // Get competition type and arena_id using transaction if available
      const metadata = await this.competitionRepo.getCompetitionMetadata(
        competitionId,
        tx,
      );
      if (!metadata) {
        this.logger.error(
          {
            competitionId,
          },
          `[AgentRankService] Competition not found`,
        );
        return;
      }

      const { type, arenaId } = metadata;

      const leaderboard =
        await this.competitionRepo.findLeaderboardByCompetition(
          competitionId,
          tx,
        );
      if (!leaderboard || leaderboard.length === 0) {
        this.logger.warn(
          {
            competitionId,
          },
          `[AgentRankService] No leaderboard entries found for competition`,
        );
        return;
      }

      // Update global and arena rankings in parallel
      const updatePromises = [
        this.updateGlobalRankings(leaderboard, competitionId, type, tx),
      ];

      // Only update arena rankings if competition has an arena
      if (arenaId) {
        updatePromises.push(
          this.updateArenaRankings(
            leaderboard,
            competitionId,
            arenaId,
            type,
            tx,
          ),
        );
      }

      await Promise.all(updatePromises);

      this.logger.debug(
        {
          competitionId,
          type,
          arenaId: arenaId ?? "none",
          numAgents: leaderboard.length,
          updatedGlobal: true,
          updatedArena: !!arenaId,
        },
        `[AgentRankService] Successfully updated ranks for competition`,
      );
    } catch (error) {
      this.logger.error(
        {
          competitionId,
          error,
        },
        `[AgentRankService] Error updating agent ranks for competition`,
      );
      throw error;
    }
  }

  /**
   * Update global rankings for agents in a competition
   * @param leaderboard Competition leaderboard entries
   * @param competitionId Competition ID
   * @param type Competition type
   * @param tx Optional database transaction
   * @returns Promise resolving to void
   */
  private async updateGlobalRankings(
    leaderboard: Array<{ agentId: string; rank: number }>,
    competitionId: string,
    type: CompetitionType,
    tx?: DatabaseTransaction,
  ): Promise<void> {
    const currentRanks = await this.agentScoreRepo.getAllAgentRanks({ type });

    const ratings: Record<string, Rating> = {};

    // Initialize ratings for all agents in the leaderboard
    for (const entry of leaderboard) {
      const agentId = entry.agentId;
      const existingRank = currentRanks.find((rank) => rank.id === agentId);
      if (existingRank) {
        ratings[agentId] = rating({
          mu: existingRank.mu,
          sigma: existingRank.sigma,
        });
      } else {
        ratings[agentId] = rating(); // use default
      }
    }

    const agents = leaderboard.map((entry) => [ratings[entry.agentId]!]);

    // Update ratings using the PlackettLuce model
    const updatedRatings = rate(agents);

    const batchUpdateData = leaderboard.map((entry, index) => {
      const agentId = entry.agentId;
      const r = updatedRatings[index]![0]!;

      // Calculate ordinal score scaled to match ELO range
      const value = ordinal(r, { alpha: 24, target: 1500 });

      return {
        agentId,
        mu: r.mu,
        sigma: r.sigma,
        ordinal: value,
      };
    });

    await this.agentScoreRepo.batchUpdateAgentRanks(
      batchUpdateData,
      competitionId,
      type,
      tx,
    );

    this.logger.debug(
      {
        competitionId,
        numUpdated: batchUpdateData.length,
        type,
      },
      `[AgentRankService] Successfully updated global ranks`,
    );
  }

  /**
   * Update arena-specific rankings for agents in a competition
   * Uses historical data from previous competitions in the same arena
   * @param leaderboard Competition leaderboard entries
   * @param competitionId Competition ID
   * @param arenaId Arena ID
   * @param type Competition type
   * @param tx Optional database transaction
   * @returns Promise resolving to void
   */
  private async updateArenaRankings(
    leaderboard: Array<{ agentId: string; rank: number }>,
    competitionId: string,
    arenaId: string,
    type: CompetitionType,
    tx?: DatabaseTransaction,
  ): Promise<void> {
    // Get latest arena history for all agents in this competition
    const agentIds = leaderboard.map((entry) => entry.agentId);
    const latestArenaHistory =
      await this.agentScoreRepo.getLatestArenaHistoryForAgents(
        arenaId,
        agentIds,
      );

    // Create lookup map for latest ratings
    const latestRatingsMap = new Map(
      latestArenaHistory.map((h) => [h.agentId, { mu: h.mu, sigma: h.sigma }]),
    );

    const ratings: Record<string, Rating> = {};

    // Initialize ratings for all agents in the leaderboard
    for (const entry of leaderboard) {
      const agentId = entry.agentId;
      const latestRating = latestRatingsMap.get(agentId);

      if (latestRating) {
        // Use the most recent historical rating for this arena
        ratings[agentId] = rating({
          mu: latestRating.mu,
          sigma: latestRating.sigma,
        });
      } else {
        // First competition in this arena for this agent
        ratings[agentId] = rating(); // use default
      }
    }

    const agents = leaderboard.map((entry) => [ratings[entry.agentId]!]);

    // Update ratings using the PlackettLuce model
    const updatedRatings = rate(agents);

    const batchUpdateData = leaderboard.map((entry, index) => {
      const agentId = entry.agentId;
      const r = updatedRatings[index]![0]!;

      // Calculate ordinal score scaled to match ELO range
      const value = ordinal(r, { alpha: 24, target: 1500 });

      return {
        agentId,
        mu: r.mu,
        sigma: r.sigma,
        ordinal: value,
      };
    });

    await this.agentScoreRepo.batchUpdateArenaRanks(
      batchUpdateData,
      competitionId,
      arenaId,
      type,
      tx,
    );

    this.logger.debug(
      {
        competitionId,
        arenaId,
        numUpdated: batchUpdateData.length,
        type,
      },
      `[AgentRankService] Successfully updated arena-specific ranks`,
    );
  }
}

/**
 * Compute a conservative "ordinal" skill estimate:
 *   α · [ (μ − z·σ) + target / α ]
 *
 * - `z`      controls how many standard deviations below μ you want
 *            (3 ⇒ ≈ 99.7 % confidence).
 * - `alpha`  scales the entire metric.
 * - `target` shifts the baseline toward a desired floor/goal.
 */
function ordinal(
  { mu, sigma }: Rating,
  options: {
    z?: number;
    alpha?: number;
    target?: number;
  } = {},
): number {
  const { z = 3.0, alpha = 1, target = 0 } = options;

  return alpha * (mu - z * sigma + target / alpha);
}
