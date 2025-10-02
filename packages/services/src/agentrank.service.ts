import { Rating, rate, rating } from "openskill";
import { Logger } from "pino";

import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
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
      // Get competition type using transaction if available
      const type = await this.competitionRepo.getCompetitionType(
        competitionId,
        tx,
      );
      if (!type) {
        this.logger.error(
          {
            competitionId,
          },
          `[AgentRankService] Competition not found`,
        );
        return;
      }

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

      const updatedRanks = await this.agentScoreRepo.batchUpdateAgentRanks(
        batchUpdateData,
        competitionId,
        type,
        tx,
      );

      this.logger.debug(
        {
          competitionId,
          numUpdated: updatedRanks.length,
          type,
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
