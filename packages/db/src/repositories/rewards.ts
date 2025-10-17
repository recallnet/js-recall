import { and, eq, sum } from "drizzle-orm";
import { Logger } from "pino";

import { rewards, rewardsRoots, rewardsTree } from "../schema/voting/defs.js";
import {
  InsertReward,
  InsertRewardsRoot,
  SelectReward,
  SelectRewardsRoot,
  SelectRewardsTree,
} from "../schema/voting/types.js";
import { Database, Transaction } from "../types.js";

export class RewardsRepository {
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.#db = database;
    this.#logger = logger;
  }

  /**
   * Get all rewards for a specific competition
   * @param competitionId The competition ID (UUID) to get rewards for
   * @param tx Optional database transaction to use for the operation
   * @returns Array of rewards for the competition
   */
  async getRewardsByCompetition(
    competitionId: string,
    tx?: Transaction,
  ): Promise<SelectReward[]> {
    try {
      const executor = tx || this.#db;
      return await executor
        .select()
        .from(rewards)
        .where(eq(rewards.competitionId, competitionId));
    } catch (error) {
      this.#logger.error("Error in getRewardsByCompetition:", error);
      throw error;
    }
  }

  /**
   * Insert multiple rewards
   * @param rewardsToInsert Array of rewards to insert
   * @param tx Optional database transaction to use for the operation
   * @returns Array of inserted rewards
   */
  async insertRewards(
    rewardsToInsert: InsertReward[],
    tx?: Transaction,
  ): Promise<SelectReward[]> {
    try {
      const executor = tx || this.#db;
      return await executor.insert(rewards).values(rewardsToInsert).returning();
    } catch (error) {
      this.#logger.error("Error in insertRewards:", error);
      throw error;
    }
  }

  /**
   * Insert entries into the rewards tree
   * @param entries Array of tree entries to insert
   * @returns Array of inserted entries
   */
  async insertRewardsTree(
    entries: {
      id?: string;
      competitionId: string;
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

      return await this.#db
        .insert(rewardsTree)
        .values(entriesWithIds)
        .returning();
    } catch (error) {
      this.#logger.error("Error in insertRewardsTree:", error);
      throw error;
    }
  }

  /**
   * Insert a root hash entry into the rewards_roots table
   * @param rootEntry The root entry to insert containing epoch, rootHash, and tx
   * @returns The inserted root entry
   */
  async insertRewardsRoot(
    rootEntry: InsertRewardsRoot,
  ): Promise<SelectRewardsRoot> {
    try {
      const [inserted] = await this.#db
        .insert(rewardsRoots)
        .values(rootEntry)
        .returning();

      if (!inserted) {
        throw new Error("Failed to insert rewards root entry");
      }

      return inserted;
    } catch (error) {
      this.#logger.error("Error in insertRewardsRoot:", error);
      throw error;
    }
  }

  /**
   * Get all nodes of a rewards tree for a specific competition
   * @param competitionId The competition ID (UUID) to get tree nodes for
   * @returns Array of tree nodes with level, idx, and hash
   */
  async getRewardsTreeByCompetition(
    competitionId: string,
  ): Promise<SelectRewardsTree[]> {
    try {
      return await this.#db
        .select()
        .from(rewardsTree)
        .where(eq(rewardsTree.competitionId, competitionId));
    } catch (error) {
      this.#logger.error("Error in getRewardsTreeByCompetition:", error);
      throw error;
    }
  }

  /**
   * Find a competition ID by root hash
   * @param rootHash The root hash to search for
   * @returns The competition ID if found, undefined otherwise
   */
  async findCompetitionByRootHash(
    rootHash: Uint8Array,
  ): Promise<string | undefined> {
    try {
      const [result] = await this.#db
        .select({ competitionId: rewardsRoots.competitionId })
        .from(rewardsRoots)
        .where(eq(rewardsRoots.rootHash, rootHash))
        .limit(1);

      return result?.competitionId;
    } catch (error) {
      this.#logger.error("Error in findCompetitionByRootHash:", error);
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
  async markRewardAsClaimed(
    competitionId: string,
    address: string,
    amount: bigint,
  ): Promise<SelectReward | undefined> {
    try {
      const [updated] = await this.#db
        .update(rewards)
        .set({
          claimed: true,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(rewards.competitionId, competitionId),
            eq(rewards.address, address.toLowerCase()),
            eq(rewards.amount, amount),
          ),
        )
        .returning();

      return updated;
    } catch (error) {
      this.#logger.error("Error in markRewardAsClaimed:", error);
      throw error;
    }
  }

  /**
   * Get the total claimable rewards for a specific address
   * @param address The wallet address to get total claimable rewards for
   * @returns The total amount of unclaimed rewards as a bigint
   */
  async getTotalClaimableRewardsByAddress(address: string): Promise<bigint> {
    try {
      const result = await this.#db
        .select({ total: sum(rewards.amount) })
        .from(rewards)
        .where(
          and(
            eq(rewards.address, address.toLowerCase()),
            eq(rewards.claimed, false),
          ),
        );

      const total = result[0]?.total;
      return total ? BigInt(total) : 0n;
    } catch (error) {
      this.#logger.error("Error in getTotalClaimableRewardsByAddress:", error);
      throw error;
    }
  }

  /**
   * Get rewards with their corresponding merkle roots for a specific address
   * @param address The wallet address to get rewards for
   * @returns Array of rewards with merkle root information
   */
  async getRewardsWithRootsByAddress(address: string): Promise<
    Array<{
      reward: SelectReward;
      rootHash: Uint8Array;
    }>
  > {
    try {
      const result = await this.#db
        .select({
          reward: rewards,
          rootHash: rewardsRoots.rootHash,
        })
        .from(rewards)
        .innerJoin(
          rewardsRoots,
          eq(rewards.competitionId, rewardsRoots.competitionId),
        )
        .where(
          and(
            eq(rewards.address, address.toLowerCase()),
            eq(rewards.claimed, false),
          ),
        );

      return result;
    } catch (error) {
      this.#logger.error("Error in getRewardsWithRootsByAddress:", error);
      throw error;
    }
  }
}
