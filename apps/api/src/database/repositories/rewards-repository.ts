import { and, eq } from "drizzle-orm";

import { RewardsRepository } from "@recallnet/db-schema/repositories/rewards";

import { db } from "@/database/db.js";
import { repositoryLogger } from "@/lib/logger.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

const repository = new RewardsRepository(db, repositoryLogger);

/**
 * Find a competition ID by root hash
 * @param rootHash The root hash to search for
 * @returns The competition ID if found, undefined otherwise
 */
async function findCompetitionByRootHashImpl(
  rootHash: Uint8Array,
): Promise<string | undefined> {
  try {
    const [result] = await db
      .select({ competitionId: rewardsRoots.competitionId })
      .from(rewardsRoots)
      .where(eq(rewardsRoots.rootHash, rootHash))
      .limit(1);

    return result?.competitionId;
  } catch (error) {
    repositoryLogger.error("Error in findCompetitionByRootHash:", error);
    throw error;
  }
}

/**
 * Mark a reward as claimed by updating the claimed column to true
 * @param competitionId The competition ID (UUID)
 * @param address The user's blockchain address
 * @param amount The reward amount that was claimed
 * @returns The updated reward record if found, undefined otherwise
 */
async function markRewardAsClaimedImpl(
  competitionId: string,
  address: string,
  amount: bigint,
): Promise<SelectReward | undefined> {
  try {
    const [updated] = await db
      .update(rewards)
      .set({
        claimed: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(rewards.competitionId, competitionId),
          eq(rewards.address, address),
          eq(rewards.amount, amount),
        ),
      )
      .returning();

    return updated;
  } catch (error) {
    repositoryLogger.error("Error in markRewardAsClaimed:", error);
    throw error;
  }
}

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

export const getRewardsByCompetition = createTimedRepositoryFunction(
  repository.getRewardsByCompetition.bind(repository),
  "RewardsRepository",
  "getRewardsByCompetition",
);

export const insertRewards = createTimedRepositoryFunction(
  repository.insertRewards.bind(repository),
  "RewardsRepository",
  "insertRewards",
);

export const insertRewardsTree = createTimedRepositoryFunction(
  repository.insertRewardsTree.bind(repository),
  "RewardsRepository",
  "insertRewardsTree",
);

export const insertRewardsRoot = createTimedRepositoryFunction(
  repository.insertRewardsRoot.bind(repository),
  "RewardsRepository",
  "insertRewardsRoot",
);

export const getRewardsTreeByCompetition = createTimedRepositoryFunction(
  repository.getRewardsTreeByCompetition.bind(repository),
  "RewardsRepository",
  "getRewardsTreeByCompetition",
);

export const findCompetitionByRootHash = createTimedRepositoryFunction(
  findCompetitionByRootHashImpl,
  "RewardsRepository",
  "findCompetitionByRootHash",
);

export const markRewardAsClaimed = createTimedRepositoryFunction(
  markRewardAsClaimedImpl,
  "RewardsRepository",
  "markRewardAsClaimed",
);
