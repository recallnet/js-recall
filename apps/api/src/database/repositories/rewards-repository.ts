import { eq } from "drizzle-orm";

import { db } from "@/database/db.js";
import {
  rewards,
  rewardsRoots,
  rewardsTree,
} from "@/database/schema/voting/defs.js";
import {
  InsertReward,
  InsertRewardsRoot,
  SelectReward,
  SelectRewardsRoot,
  SelectRewardsTree,
} from "@/database/schema/voting/types.js";

/**
 * Get all rewards for a specific epoch
 * @param epochId The epoch ID (UUID) to get rewards for
 * @returns Array of rewards for the epoch
 */
export async function getRewardsByEpoch(
  epochId: string,
): Promise<SelectReward[]> {
  try {
    return await db.select().from(rewards).where(eq(rewards.epoch, epochId));
  } catch (error) {
    console.error("[RewardsRepository] Error in getRewardsByEpoch:", error);
    throw error;
  }
}

/**
 * Insert multiple rewards
 * @param rewardsToInsert Array of rewards to insert
 * @returns Array of inserted rewards
 */
export async function insertRewards(
  rewardsToInsert: InsertReward[],
): Promise<SelectReward[]> {
  try {
    return await db.insert(rewards).values(rewardsToInsert).returning();
  } catch (error) {
    console.error("[RewardsRepository] Error in insertRewards:", error);
    throw error;
  }
}

/**
 * Insert entries into the rewards tree
 * @param entries Array of tree entries to insert
 * @returns Array of inserted entries
 */
export async function insertRewardsTree(
  entries: {
    id?: string;
    epoch: string;
    level: number;
    idx: number;
    hash: Uint8Array;
  }[],
): Promise<SelectRewardsTree[]> {
  try {
    // Add UUID for each entry if not provided
    const entriesWithIds = entries.map((entry) => ({
      ...entry,
      id: entry.id || crypto.randomUUID(),
    }));

    return await db.insert(rewardsTree).values(entriesWithIds).returning();
  } catch (error) {
    console.error("[RewardsRepository] Error in insertRewardsTree:", error);
    throw error;
  }
}

/**
 * Insert a root hash entry into the rewards_roots table
 * @param rootEntry The root entry to insert containing epoch, rootHash, and tx
 * @returns The inserted root entry
 */
export async function insertRewardsRoot(
  rootEntry: InsertRewardsRoot,
): Promise<SelectRewardsRoot> {
  try {
    const [inserted] = await db
      .insert(rewardsRoots)
      .values(rootEntry)
      .returning();

    if (!inserted) {
      throw new Error("Failed to insert rewards root entry");
    }

    return inserted;
  } catch (error) {
    console.error("[RewardsRepository] Error in insertRewardsRoot:", error);
    throw error;
  }
}

/**
 * Get all nodes of a rewards tree for a specific epoch
 * @param epochId The epoch ID (UUID) to get tree nodes for
 * @returns Array of tree nodes with level, idx, and hash
 */
export async function getRewardsTreeByEpoch(
  epochId: string,
): Promise<SelectRewardsTree[]> {
  try {
    return await db
      .select()
      .from(rewardsTree)
      .where(eq(rewardsTree.epoch, epochId));
  } catch (error) {
    console.error("[RewardsRepository] Error in getRewardsTreeByEpoch:", error);
    throw error;
  }
}
