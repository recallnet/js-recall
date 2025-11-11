import { randomUUID } from "crypto";

import { CompetitionRewardsRepository } from "@recallnet/db/repositories/competition-rewards";
import {
  InsertCompetitionReward,
  SelectCompetitionReward,
} from "@recallnet/db/schema/core/types";
import { Transaction } from "@recallnet/db/types";

/**
 * CompetitionRewardService
 * Service for managing rewards in the competition rewards schema
 */
export class CompetitionRewardService {
  private competitionRewardsRepo: CompetitionRewardsRepository;

  constructor(competitionRewardsRepo: CompetitionRewardsRepository) {
    this.competitionRewardsRepo = competitionRewardsRepo;
  }

  /**
   * Assign winners to rewards for a competition
   * @param competitionId The competition ID
   * @param leaderboard The leaderboard
   * @param excludedAgentIds Optional array of agent IDs ineligible for rewards
   * @param tx Optional database transaction
   * @returns void
   */
  async assignWinnersToRewards(
    competitionId: string,
    leaderboard: { agentId: string; value: number }[],
    excludedAgentIds?: string[],
    tx?: Transaction,
  ): Promise<void> {
    await this.competitionRewardsRepo.assignWinnersToRewards(
      competitionId,
      leaderboard,
      excludedAgentIds,
      tx,
    );
  }

  /**
   * Create rewards for a competition
   * @param competitionId The competition ID
   * @param rewards The rewards
   * @param tx Optional database transaction
   * @returns The created rewards
   */
  async createRewards(
    competitionId: string,
    rewards: Record<number, number>,
    tx?: Transaction,
  ): Promise<SelectCompetitionReward[]> {
    const rewardsData: InsertCompetitionReward[] = Object.entries(rewards).map(
      ([rank, reward]) => ({
        id: randomUUID(),
        competitionId,
        rank: Number(rank),
        reward,
      }),
    );
    return this.competitionRewardsRepo.createRewards(rewardsData, tx);
  }

  /**
   * Get all rewards for a competition
   * @param competitionId The competition ID
   * @returns Array of reward records
   */
  async getRewardsByCompetition(
    competitionId: string,
  ): Promise<SelectCompetitionReward[]> {
    return this.competitionRewardsRepo.findRewardsByCompetition(competitionId);
  }

  /**
   * Replace rewards for a competition
   * @param competitionId The competition ID
   * @param rewards The new rewards
   * @param tx Optional database transaction
   * @returns The updated rewards
   */
  async replaceRewards(
    competitionId: string,
    rewards: Record<number, number>,
    tx?: Transaction,
  ): Promise<SelectCompetitionReward[]> {
    await this.competitionRewardsRepo.deleteRewardsByCompetition(
      competitionId,
      tx,
    );
    return this.createRewards(competitionId, rewards, tx);
  }
}
