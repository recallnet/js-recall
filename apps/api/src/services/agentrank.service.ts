import { Rating, rate, rating } from "openskill";

import type { Transaction as DatabaseTransaction } from "@recallnet/db/types";

import * as agentScoreRepo from "@/database/repositories/agentscore-repository.js";
import * as competitionRepo from "@/database/repositories/competition-repository.js";
import { serviceLogger } from "@/lib/logger.js";

/**
 * Agent Rank Service
 * Manages agent ranking calculations and updates
 */
export class AgentRankService {
  /**
   * Update agent ranks when a competition ends
   * @param competitionId The ID of the competition that ended
   * @param tx Optional database transaction
   * @returns Promise resolving to void
   */
  async updateAgentRanksForCompetition(
    competitionId: string,
    tx?: DatabaseTransaction,
  ): Promise<void> {
    serviceLogger.debug(
      `[AgentRankService] Updating agent ranks for ended competition: ${competitionId}`,
    );

    try {
      const leaderboard = await competitionRepo.findLeaderboardByCompetition(
        competitionId,
        tx,
      );
      if (!leaderboard || leaderboard.length === 0) {
        console.warn(
          `[AgentRankService] No leaderboard entries found for competition ${competitionId}`,
        );
        return;
      }

      const currentRanks = await agentScoreRepo.getAllAgentRanks();

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

      const teams = leaderboard.map((entry) => [ratings[entry.agentId]!]);

      // Update ratings using the PlackettLuce model
      const updatedRatings = rate(teams);

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

      const updatedRanks = await agentScoreRepo.batchUpdateAgentRanks(
        batchUpdateData,
        competitionId,
        tx,
      );

      serviceLogger.debug(
        `[AgentRankService] Successfully updated ranks for ${updatedRanks.length} agents from competition ${competitionId}`,
      );
    } catch (error) {
      serviceLogger.error(
        `[AgentRankService] Error updating agent ranks for competition ${competitionId}:`,
        error,
      );
      throw error;
    }
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
