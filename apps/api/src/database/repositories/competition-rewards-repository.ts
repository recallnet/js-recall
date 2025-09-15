import { and, eq, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { competitionRewards } from "@recallnet/db-schema/core/defs";
import {
  InsertCompetitionReward,
  SelectCompetitionReward,
} from "@recallnet/db-schema/core/types";

import { db } from "@/database/db.js";
import { competitionRewardsLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

// Type for database transaction
type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Core Rewards Repository
 * Handles database operations for competition rewards (core schema)
 */

/**
 * Create multiple rewards
 * @param rewardsData Array of reward data to create
 * @param tx Optional database transaction
 * @returns Array of created reward records
 * @throws Error if reward creation fails or if duplicates exist
 */
export async function createRewardsImpl(
  rewardsData: InsertCompetitionReward[],
  tx?: DatabaseTransaction,
): Promise<SelectCompetitionReward[]> {
  try {
    const data: InsertCompetitionReward[] = rewardsData.map((reward) => ({
      id: reward.id || uuidv4(),
      competitionId: reward.competitionId,
      rank: reward.rank,
      reward: reward.reward,
      agentId: reward.agentId,
    }));
    const dbClient = tx || db;
    const result = await dbClient
      .insert(competitionRewards)
      .values(data)
      .returning();
    if (!result || result.length === 0) {
      throw new Error("Failed to create rewards - no results returned");
    }
    return result;
  } catch (error) {
    competitionRewardsLogger.error(`Error in createRewards: ${error}`);
    throw error;
  }
}

/**
 * Find a reward by competition and rank
 * @param competitionId The competition ID
 * @param rank The rank
 * @returns The reward record if found, undefined otherwise
 */
export async function findRewardByCompetitionAndRankImpl(
  competitionId: string,
  rank: number,
): Promise<SelectCompetitionReward | undefined> {
  try {
    const [result] = await db
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
    competitionRewardsLogger.error(
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
export async function findRewardsByCompetitionImpl(
  competitionId: string,
): Promise<SelectCompetitionReward[]> {
  try {
    return await db
      .select()
      .from(competitionRewards)
      .where(eq(competitionRewards.competitionId, competitionId));
  } catch (error) {
    competitionRewardsLogger.error(
      `Error in findRewardsByCompetition: ${error}`,
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
export async function findRewardsByCompetitionsImpl(
  competitionIds: string[],
): Promise<SelectCompetitionReward[]> {
  try {
    if (competitionIds.length === 0) {
      return [];
    }

    return await db
      .select()
      .from(competitionRewards)
      .where(inArray(competitionRewards.competitionId, competitionIds))
      .orderBy(competitionRewards.rank);
  } catch (error) {
    competitionRewardsLogger.error(
      `Error in findRewardsByCompetitions: ${error}`,
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
export async function findRewardsByAgentImpl(
  agentId: string,
): Promise<SelectCompetitionReward[]> {
  try {
    return await db
      .select()
      .from(competitionRewards)
      .where(eq(competitionRewards.agentId, agentId));
  } catch (error) {
    competitionRewardsLogger.error(
      `Error in findRewardsByAgent: ${error}`,
      error,
    );
    throw error;
  }
}

/**
 * Update a reward by id
 * @param id The reward ID
 * @param update Partial update object
 * @returns The updated reward record if found, undefined otherwise
 */
export async function updateRewardImpl(
  id: string,
  update: Partial<InsertCompetitionReward>,
): Promise<SelectCompetitionReward | undefined> {
  try {
    const [result] = await db
      .update(competitionRewards)
      .set(update)
      .where(eq(competitionRewards.id, id))
      .returning();
    return result;
  } catch (error) {
    competitionRewardsLogger.error(`Error in updateReward: ${error}`, error);
    throw error;
  }
}

/**
 * Delete a reward by id
 * @param id The reward ID
 * @returns True if deleted, false otherwise
 */
export async function deleteRewardImpl(id: string): Promise<boolean> {
  try {
    const result = await db
      .delete(competitionRewards)
      .where(eq(competitionRewards.id, id));
    return (result?.rowCount ?? 0) > 0;
  } catch (error) {
    competitionRewardsLogger.error(`Error in deleteReward: ${error}`, error);
    throw error;
  }
}

/**
 * Delete all rewards for a competition
 * @param competitionId The competition ID
 * @param tx Optional database transaction
 * @returns True if deleted, false otherwise
 */
export async function deleteRewardsByCompetitionImpl(
  competitionId: string,
  tx?: DatabaseTransaction,
): Promise<boolean> {
  try {
    const dbClient = tx || db;
    const result = await dbClient
      .delete(competitionRewards)
      .where(eq(competitionRewards.competitionId, competitionId));
    return (result?.rowCount ?? 0) > 0;
  } catch (error) {
    competitionRewardsLogger.error(
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
export async function assignWinnersToRewardsImpl(
  competitionId: string,
  leaderboard: { agentId: string; value: number }[],
): Promise<void> {
  try {
    // Fetch all rewards for the competition
    const rewardRecords = await findRewardsByCompetitionImpl(competitionId);

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
      for (const update of updates) {
        if (!update) continue;
        await tx
          .update(competitionRewards)
          .set({ agentId: update.agentId })
          .where(eq(competitionRewards.id, update.id));
      }
    });
  } catch (error) {
    competitionRewardsLogger.error(`Error in assignWinnersToRewards: ${error}`);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// ----------------------------------------------------------------------------

/**
 * All repository functions wrapped with timing and metrics
 * These are the functions that should be imported by services
 */

export const createRewards = createTimedRepositoryFunction(
  createRewardsImpl,
  "CompetitionRewardsRepository",
  "createRewards",
);

export const findRewardByCompetitionAndRank = createTimedRepositoryFunction(
  findRewardByCompetitionAndRankImpl,
  "CompetitionRewardsRepository",
  "findRewardByCompetitionAndRank",
);

export const findRewardsByCompetition = createTimedRepositoryFunction(
  findRewardsByCompetitionImpl,
  "CompetitionRewardsRepository",
  "findRewardsByCompetition",
);

export const findRewardsByCompetitions = createTimedRepositoryFunction(
  findRewardsByCompetitionsImpl,
  "CompetitionRewardsRepository",
  "findRewardsByCompetitions",
);

export const findRewardsByAgent = createTimedRepositoryFunction(
  findRewardsByAgentImpl,
  "CompetitionRewardsRepository",
  "findRewardsByAgent",
);

export const updateReward = createTimedRepositoryFunction(
  updateRewardImpl,
  "CompetitionRewardsRepository",
  "updateReward",
);

export const deleteReward = createTimedRepositoryFunction(
  deleteRewardImpl,
  "CompetitionRewardsRepository",
  "deleteReward",
);

export const deleteRewardsByCompetition = createTimedRepositoryFunction(
  deleteRewardsByCompetitionImpl,
  "CompetitionRewardsRepository",
  "deleteRewardsByCompetition",
);

export const assignWinnersToRewards = createTimedRepositoryFunction(
  assignWinnersToRewardsImpl,
  "CompetitionRewardsRepository",
  "assignWinnersToRewards",
);
