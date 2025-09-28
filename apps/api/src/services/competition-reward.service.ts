import { v4 as uuidv4 } from "uuid";

import {
  InsertCompetitionReward,
  SelectCompetitionReward,
} from "@recallnet/db/schema/core/types";

import { db } from "@/database/db.js";
import * as competitionRewardsRepository from "@/database/repositories/competition-rewards-repository.js";

// Type for database transaction
type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * CompetitionRewardService
 * Service for managing rewards in the competition rewards schema
 */
export class CompetitionRewardService {
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
    await competitionRewardsRepository.assignWinnersToRewards(
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
    tx?: DatabaseTransaction,
  ): Promise<SelectCompetitionReward[]> {
    const rewardsData: InsertCompetitionReward[] = Object.entries(rewards).map(
      ([rank, reward]) => ({
        id: uuidv4(),
        competitionId,
        rank: Number(rank),
        reward,
      }),
    );
    return competitionRewardsRepository.createRewards(rewardsData, tx);
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
    return competitionRewardsRepository.findRewardByCompetitionAndRank(
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
    return competitionRewardsRepository.findRewardsByCompetition(competitionId);
  }

  /**
   * Get all rewards for an agent (across all competitions)
   * @param agentId The agent ID
   * @returns Array of reward records
   */
  async getRewardsByAgent(agentId: string): Promise<SelectCompetitionReward[]> {
    return competitionRewardsRepository.findRewardsByAgent(agentId);
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
    return competitionRewardsRepository.updateReward(id, update);
  }

  /**
   * Delete a reward by id
   * @param id The reward ID
   * @returns True if deleted, false otherwise
   */
  async deleteReward(id: string): Promise<boolean> {
    return competitionRewardsRepository.deleteReward(id);
  }

  /**
   * Delete all rewards for a competition
   * @param competitionId The competition ID
   * @returns True if deleted, false otherwise
   */
  async deleteRewardsByCompetition(competitionId: string): Promise<boolean> {
    return competitionRewardsRepository.deleteRewardsByCompetition(
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
    tx?: DatabaseTransaction,
  ): Promise<SelectCompetitionReward[]> {
    await competitionRewardsRepository.deleteRewardsByCompetition(
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
      await competitionRewardsRepository.findRewardsByCompetitions(
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
