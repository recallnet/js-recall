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
   * @param tx Optional database transaction
   * @returns void
   */
  async assignWinnersToRewards(
    competitionId: string,
    leaderboard: { agentId: string; value: number }[],
    tx?: DatabaseTransaction,
  ): Promise<void> {
    await this.competitionRewardsRepo.assignWinnersToRewards(
      competitionId,
      leaderboard,
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
   * Get a reward by competition and rank
   * @param competitionId The competition ID
   * @param rank The rank
   * @returns The reward record if found, undefined otherwise
   */
  async getRewardByCompetitionAndRank(
    competitionId: string,
    rank: number,
  ): Promise<SelectCompetitionReward | undefined> {
    return this.competitionRewardsRepo.findRewardByCompetitionAndRank(
      competitionId,
      rank,
    );
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
   * Get all rewards for an agent (across all competitions)
   * @param agentId The agent ID
   * @returns Array of reward records
   */
  async getRewardsByAgent(agentId: string): Promise<SelectCompetitionReward[]> {
    return this.competitionRewardsRepo.findRewardsByAgent(agentId);
  }

  /**
   * Update a reward by id
   * @param id The reward ID
   * @param update Partial update object
   * @returns The updated reward record if found, undefined otherwise
   */
  async updateReward(
    id: string,
    update: Partial<InsertCompetitionReward>,
  ): Promise<SelectCompetitionReward | undefined> {
    return this.competitionRewardsRepo.updateReward(id, update);
  }

  /**
   * Delete a reward by id
   * @param id The reward ID
   * @returns True if deleted, false otherwise
   */
  async deleteReward(id: string): Promise<boolean> {
    return this.competitionRewardsRepo.deleteReward(id);
  }

  /**
   * Delete all rewards for a competition
   * @param competitionId The competition ID
   * @returns True if deleted, false otherwise
   */
  async deleteRewardsByCompetition(competitionId: string): Promise<boolean> {
    return this.competitionRewardsRepo.deleteRewardsByCompetition(
      competitionId,
    );
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

  /**
   * Populate competitions with their rewards
   * @param competitions Array of competition objects with id field
   * @returns Array of competitions with rewards populated
   */
  async populateRewards<T extends { id: string }>(
    competitions: T[],
  ): Promise<(T & { rewards?: Record<number, number> })[]> {
    if (competitions.length === 0) {
      return competitions;
    }

    // Extract competition IDs
    const competitionIds = competitions.map((comp) => comp.id);

    // Get all rewards for these competitions
    const allRewards =
      await this.competitionRewardsRepo.findRewardsByCompetitions(
        competitionIds,
      );

    // Group rewards by competition ID
    const rewardsByCompetition = new Map<string, Record<number, number>>();

    for (const reward of allRewards) {
      if (!rewardsByCompetition.has(reward.competitionId)) {
        rewardsByCompetition.set(reward.competitionId, {});
      }
      const competitionRewards = rewardsByCompetition.get(
        reward.competitionId,
      )!;
      competitionRewards[reward.rank] = reward.reward;
    }

    // Populate competitions with their rewards
    return competitions.map((competition) => ({
      ...competition,
      rewards: rewardsByCompetition.get(competition.id),
    }));
  }
}
