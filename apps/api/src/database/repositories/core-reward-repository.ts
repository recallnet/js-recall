import { and, eq, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/database/db.js";
import { rewards } from "@/database/schema/core/defs.js";
import { InsertReward, SelectReward } from "@/database/schema/core/types.js";

/**
 * Core Rewards Repository
 * Handles database operations for competition rewards (core schema)
 */

/**
 * Create multiple rewards
 * @param rewardsData Array of reward data to create
 * @returns Array of created reward records
 * @throws Error if reward creation fails or if duplicates exist
 */
export async function createRewards(
  rewardsData: InsertReward[],
): Promise<SelectReward[]> {
  try {
    const data: InsertReward[] = rewardsData.map((reward) => ({
      id: reward.id || uuidv4(),
      competitionId: reward.competitionId,
      rank: reward.rank,
      reward: reward.reward,
      agentId: reward.agentId,
    }));
    const result = await db.insert(rewards).values(data).returning();
    if (!result || result.length === 0) {
      throw new Error("Failed to create rewards - no results returned");
    }
    return result;
  } catch (error) {
    console.error("[CoreRewardRepository] Error in createRewards:", error);
    throw error;
  }
}

/**
 * Find a reward by competition and rank
 * @param competitionId The competition ID
 * @param rank The rank
 * @returns The reward record if found, undefined otherwise
 */
export async function findRewardByCompetitionAndRank(
  competitionId: string,
  rank: number,
): Promise<SelectReward | undefined> {
  try {
    const [result] = await db
      .select()
      .from(rewards)
      .where(
        and(eq(rewards.competitionId, competitionId), eq(rewards.rank, rank)),
      )
      .limit(1);
    return result;
  } catch (error) {
    console.error(
      "[CoreRewardRepository] Error in findRewardByCompetitionAndRank:",
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
export async function findRewardsByCompetition(
  competitionId: string,
): Promise<SelectReward[]> {
  try {
    return await db
      .select()
      .from(rewards)
      .where(eq(rewards.competitionId, competitionId));
  } catch (error) {
    console.error(
      "[CoreRewardRepository] Error in findRewardsByCompetition:",
      error,
    );
    throw error;
  }
}

/**
 * Find all rewards for multiple competitions
 * @param competitionIds Array of competition IDs
 * @returns Array of reward records grouped by competition ID
 */
export async function findRewardsByCompetitions(
  competitionIds: string[],
): Promise<SelectReward[]> {
  try {
    if (competitionIds.length === 0) {
      return [];
    }

    return await db
      .select()
      .from(rewards)
      .where(inArray(rewards.competitionId, competitionIds))
      .orderBy(rewards.rank);
  } catch (error) {
    console.error(
      "[CoreRewardRepository] Error in findRewardsByCompetitions:",
      error,
    );
    throw error;
  }
}

/**
 * Find all rewards for an agent (across all competitions)
 * @param agentId The agent ID
 * @returns Array of reward records
 */
export async function findRewardsByAgent(
  agentId: string,
): Promise<SelectReward[]> {
  try {
    return await db.select().from(rewards).where(eq(rewards.agentId, agentId));
  } catch (error) {
    console.error("[CoreRewardRepository] Error in findRewardsByAgent:", error);
    throw error;
  }
}

/**
 * Update a reward by id
 * @param id The reward ID
 * @param update Partial update object
 * @returns The updated reward record if found, undefined otherwise
 */
export async function updateReward(
  id: string,
  update: Partial<InsertReward>,
): Promise<SelectReward | undefined> {
  try {
    const [result] = await db
      .update(rewards)
      .set(update)
      .where(eq(rewards.id, id))
      .returning();
    return result;
  } catch (error) {
    console.error("[CoreRewardRepository] Error in updateReward:", error);
    throw error;
  }
}

/**
 * Delete a reward by id
 * @param id The reward ID
 * @returns True if deleted, false otherwise
 */
export async function deleteReward(id: string): Promise<boolean> {
  try {
    const result = await db.delete(rewards).where(eq(rewards.id, id));
    return (result?.rowCount ?? 0) > 0;
  } catch (error) {
    console.error("[CoreRewardRepository] Error in deleteReward:", error);
    throw error;
  }
}

/**
 * Delete all rewards for a competition
 * @param competitionId The competition ID
 * @returns True if deleted, false otherwise
 */
export async function deleteRewardsByCompetition(
  competitionId: string,
): Promise<boolean> {
  try {
    const result = await db
      .delete(rewards)
      .where(eq(rewards.competitionId, competitionId));
    return (result?.rowCount ?? 0) > 0;
  } catch (error) {
    console.error(
      "[CoreRewardRepository] Error in deleteRewardsByCompetition:",
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
export async function assignWinnersToRewards(
  competitionId: string,
  leaderboard: { agentId: string; value: number }[],
): Promise<void> {
  // Fetch all rewards for the competition
  const rewardRecords = await findRewardsByCompetition(competitionId);

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

  await db.transaction(async (tx) => {
    const promises = updates.map((update) => {
      if (!update) return null;
      return tx
        .update(rewards)
        .set({ agentId: update.agentId })
        .where(eq(rewards.id, update.id));
    });

    await Promise.all(promises);
  });
}
