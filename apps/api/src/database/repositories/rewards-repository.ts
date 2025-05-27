import { eq, sql } from "drizzle-orm";

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
    hash: Uint8Array 
  }[],
): Promise<SelectRewardsTree[]> {
  try {
    // Add UUID for each entry if not provided
    const entriesWithIds = entries.map(entry => ({
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
 * Get Merkle proof for a specific leaf node in the rewards tree
 * @param epoch The epoch ID (UUID)
 * @param leafHash The hash of the leaf node to generate proof for
 * @returns Array of proof hashes as Uint8Array
 */
export async function getMerkleProof(
  epoch: string,
  leafHash: Uint8Array,
): Promise<Uint8Array[]> {
  try {
    const result = await db.execute(sql`
      WITH RECURSIVE proof_path AS (
        -- Start with the leaf node by finding it by hash
        SELECT 
          level,
          idx,
          0 as depth
        FROM rewards_tree
        WHERE level = 0 
          AND hash = ${leafHash}
          AND epoch = ${epoch}
        
        UNION ALL
        
        -- Recursively find parent nodes up to the root
        SELECT
          rt.level,
          rt.idx,
          pp.depth + 1
        FROM proof_path pp
        JOIN rewards_tree rt
          ON rt.level = pp.level + 1
         AND rt.idx = (pp.idx / 2)
         AND rt.epoch = ${epoch}
      )
      -- Get sibling nodes for the proof
      SELECT
        array_agg(sib.hash) as proof
      FROM (
        SELECT DISTINCT ON (s.level)
          s.hash,
          p.depth
        FROM proof_path p
        JOIN rewards_tree s
          ON s.level = p.level
         AND s.idx = CASE WHEN p.idx % 2 = 0
                          THEN p.idx + 1
                          ELSE p.idx - 1
                     END
         AND s.epoch = ${epoch}
        WHERE s.hash IS NOT NULL
        ORDER BY s.level, p.depth
      ) sib;
    `);

    const proofArray = result.rows[0]?.proof as Uint8Array[] | null;
    return proofArray || [];
  } catch (error) {
    console.error("[RewardsRepository] Error in getMerkleProof:", error);
    throw error;
  }
}
