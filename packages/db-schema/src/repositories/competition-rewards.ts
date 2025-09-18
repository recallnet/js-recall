import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { Logger } from "pino";

import { competitionRewards } from "../core/defs.js";
import {
  InsertCompetitionReward,
  SelectCompetitionReward,
} from "../core/types.js";
import { Database, Transaction } from "../types.js";

/**
 * Core Rewards Repository
 * Handles database operations for competition rewards (core schema)
 */
export class CompetitionRewardsRepository {
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(db: Database, logger: Logger) {
    this.#db = db;
    this.#logger = logger;
  }

  /**
   * Create multiple rewards
   * @param rewardsData Array of reward data to create
   * @param tx Optional database transaction
   * @returns Array of created reward records
   * @throws Error if reward creation fails or if duplicates exist
   */
  async createRewards(
    rewardsData: InsertCompetitionReward[],
    tx?: Transaction,
  ): Promise<SelectCompetitionReward[]> {
    try {
      const data: InsertCompetitionReward[] = rewardsData.map((reward) => ({
        id: reward.id || randomUUID(),
        competitionId: reward.competitionId,
        rank: reward.rank,
        reward: reward.reward,
        agentId: reward.agentId,
      }));
      const executor = tx || this.#db;
      const result = await executor
        .insert(competitionRewards)
        .values(data)
        .returning();
      if (!result || result.length === 0) {
        throw new Error("Failed to create rewards - no results returned");
      }
      return result;
    } catch (error) {
      this.#logger.error(`Error in createRewards: ${error}`);
      throw error;
    }
  }

  /**
   * Find a reward by competition and rank
   * @param competitionId The competition ID
   * @param rank The rank
   * @returns The reward record if found, undefined otherwise
   */
  async findRewardByCompetitionAndRank(
    competitionId: string,
    rank: number,
  ): Promise<SelectCompetitionReward | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(competitionRewards)
        .where(
          and(
            eq(competitionRewards.competitionId, competitionId),
            eq(competitionRewards.rank, rank),
          ),
        )
        .limit(1);
      return result;
    } catch (error) {
      this.#logger.error(
        `Error in findRewardByCompetitionAndRank: ${error}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Find all rewards for a competition
   * @param competitionId The competition ID
   * @returns Array of reward records
   */
  async findRewardsByCompetition(
    competitionId: string,
  ): Promise<SelectCompetitionReward[]> {
    try {
      return await this.#db
        .select()
        .from(competitionRewards)
        .where(eq(competitionRewards.competitionId, competitionId));
    } catch (error) {
      this.#logger.error(`Error in findRewardsByCompetition: ${error}`, error);
      throw error;
    }
  }

  /**
   * Find all rewards for multiple competitions
   * @param competitionIds Array of competition IDs
   * @returns Array of reward records grouped by competition ID
   */
  async findRewardsByCompetitions(
    competitionIds: string[],
  ): Promise<SelectCompetitionReward[]> {
    try {
      if (competitionIds.length === 0) {
        return [];
      }

      return await this.#db
        .select()
        .from(competitionRewards)
        .where(inArray(competitionRewards.competitionId, competitionIds))
        .orderBy(competitionRewards.rank);
    } catch (error) {
      this.#logger.error(`Error in findRewardsByCompetitions: ${error}`, error);
      throw error;
    }
  }

  /**
   * Find all rewards for an agent (across all competitions)
   * @param agentId The agent ID
   * @returns Array of reward records
   */
  async findRewardsByAgent(
    agentId: string,
  ): Promise<SelectCompetitionReward[]> {
    try {
      return await this.#db
        .select()
        .from(competitionRewards)
        .where(eq(competitionRewards.agentId, agentId));
    } catch (error) {
      this.#logger.error(`Error in findRewardsByAgent: ${error}`, error);
      throw error;
    }
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
    try {
      const [result] = await this.#db
        .update(competitionRewards)
        .set(update)
        .where(eq(competitionRewards.id, id))
        .returning();
      return result;
    } catch (error) {
      this.#logger.error(`Error in updateReward: ${error}`, error);
      throw error;
    }
  }

  /**
   * Delete a reward by id
   * @param id The reward ID
   * @returns True if deleted, false otherwise
   */
  async deleteReward(id: string): Promise<boolean> {
    try {
      const result = await this.#db
        .delete(competitionRewards)
        .where(eq(competitionRewards.id, id));
      return (result?.rowCount ?? 0) > 0;
    } catch (error) {
      this.#logger.error(`Error in deleteReward: ${error}`, error);
      throw error;
    }
  }

  /**
   * Delete all rewards for a competition
   * @param competitionId The competition ID
   * @param tx Optional database transaction
   * @returns True if deleted, false otherwise
   */
  async deleteRewardsByCompetition(
    competitionId: string,
    tx?: Transaction,
  ): Promise<boolean> {
    try {
      const executor = tx || this.#db;
      const result = await executor
        .delete(competitionRewards)
        .where(eq(competitionRewards.competitionId, competitionId));
      return (result?.rowCount ?? 0) > 0;
    } catch (error) {
      this.#logger.error(
        `Error in deleteRewardsByCompetition: ${error}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Assign winners to rewards for a competition by updating agentIds based on leaderboard
   * @param competitionId The competition ID
   * @param leaderboard Array of { agentId, value } objects, index+1 = rank
   * @returns void
   */
  async assignWinnersToRewards(
    competitionId: string,
    leaderboard: { agentId: string; value: number }[],
  ): Promise<void> {
    try {
      // Fetch all rewards for the competition
      const rewardRecords = await this.findRewardsByCompetition(competitionId);

      const updates = rewardRecords
        .map((reward) => {
          const leaderboardEntry = leaderboard[reward.rank - 1];
          if (!leaderboardEntry) return null;
          return {
            id: reward.id,
            agentId: leaderboardEntry.agentId,
          };
        })
        .filter(Boolean);

      await this.#db.transaction(async (tx) => {
        for (const update of updates) {
          if (!update) continue;
          await tx
            .update(competitionRewards)
            .set({ agentId: update.agentId })
            .where(eq(competitionRewards.id, update.id));
        }
      });
    } catch (error) {
      this.#logger.error(`Error in assignWinnersToRewards: ${error}`);
      throw error;
    }
  }
}
