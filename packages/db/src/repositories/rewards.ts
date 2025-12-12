import { and, eq, isNotNull, sum } from "drizzle-orm";
import { Logger } from "pino";

import { agents, competitions } from "../schema/core/defs.js";
import { rewards, rewardsRoots, rewardsTree } from "../schema/rewards/defs.js";
import {
  InsertReward,
  InsertRewardsRoot,
  SelectReward,
  SelectRewardsRoot,
  SelectRewardsTree,
} from "../schema/rewards/types.js";
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
      this.#logger.error({ error }, "Error in getRewardsByCompetition");
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
      // Ensure walletAddress is set from address if not provided
      const rewardsWithWalletAddress = rewardsToInsert.map((reward) => ({
        ...reward,
        walletAddress:
          reward.walletAddress ?? String(reward.address).toLowerCase(),
      }));
      return await executor
        .insert(rewards)
        .values(rewardsWithWalletAddress)
        .returning();
    } catch (error) {
      this.#logger.error({ error }, "Error in insertRewards");
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
      this.#logger.error({ error }, "Error in insertRewardsTree");
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
      this.#logger.error({ error }, "Error in insertRewardsRoot");
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
      this.#logger.error({ error }, "Error in getRewardsTreeByCompetition");
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
      this.#logger.error({ error }, "Error in findCompetitionByRootHash");
      throw error;
    }
  }

  /**
   * Get the rewards root for a specific competition
   * @param competitionId The competition ID (UUID) to get the root for
   * @returns The rewards root entry if found, undefined otherwise
   */
  async getRewardsRootByCompetition(
    competitionId: string,
  ): Promise<SelectRewardsRoot | undefined> {
    try {
      const [result] = await this.#db
        .select()
        .from(rewardsRoots)
        .where(eq(rewardsRoots.competitionId, competitionId))
        .limit(1);

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in getRewardsRootByCompetition");
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
      const normalizedAddress = address.toLowerCase();
      const [updated] = await this.#db
        .update(rewards)
        .set({
          claimed: true,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(rewards.competitionId, competitionId),
            eq(rewards.walletAddress, normalizedAddress),
            eq(rewards.amount, amount),
          ),
        )
        .returning();

      return updated;
    } catch (error) {
      this.#logger.error({ error }, "Error in markRewardAsClaimed");
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
      const normalizedAddress = address.toLowerCase();
      const result = await this.#db
        .select({ total: sum(rewards.amount) })
        .from(rewards)
        .where(
          and(
            eq(rewards.walletAddress, normalizedAddress),
            eq(rewards.claimed, false),
          ),
        );

      const total = result[0]?.total;
      return total ? BigInt(total) : 0n;
    } catch (error) {
      this.#logger.error(
        { error },
        "Error in getTotalClaimableRewardsByAddress",
      );
      throw error;
    }
  }

  /**
   * Get rewards with their corresponding merkle roots for a specific address
   * @param address The wallet address to get rewards for
   * @returns Array of rewards with merkle root information, including agent and competition data
   */
  async getRewardsWithRootsByAddress(address: string): Promise<
    Array<{
      reward: SelectReward;
      rootHash: Uint8Array;
      agent: {
        id: string;
        name: string;
        imageUrl: string | null;
      } | null;
      competition: {
        id: string;
        name: string;
      };
    }>
  > {
    try {
      const normalizedAddress = address.toLowerCase();
      const result = await this.#db
        .select({
          reward: rewards,
          rootHash: rewardsRoots.rootHash,
          agent: {
            id: agents.id,
            name: agents.name,
            imageUrl: agents.imageUrl,
          },
          competition: {
            id: competitions.id,
            name: competitions.name,
          },
        })
        .from(rewards)
        .innerJoin(
          rewardsRoots,
          eq(rewards.competitionId, rewardsRoots.competitionId),
        )
        .innerJoin(competitions, eq(rewards.competitionId, competitions.id))
        .leftJoin(agents, eq(rewards.agentId, agents.id))
        .where(
          and(
            eq(rewards.walletAddress, normalizedAddress),
            eq(rewards.claimed, false),
            isNotNull(rewardsRoots.tx),
          ),
        );

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in getRewardsWithRootsByAddress");
      throw error;
    }
  }

  /**
   * Update the transaction hash for a rewards root entry by root hash
   * @param rootHash The root hash to identify the entry
   * @param tx The transaction hash to update
   * @param dbTx Optional database transaction to use for the operation
   * @returns The updated root entry if found, undefined otherwise
   */
  async updateRewardsRootTx(
    rootHash: Uint8Array,
    tx: string,
    dbTx?: Transaction,
  ): Promise<SelectRewardsRoot | undefined> {
    try {
      const executor = dbTx || this.#db;
      const [updated] = await executor
        .update(rewardsRoots)
        .set({
          tx: tx,
        })
        .where(eq(rewardsRoots.rootHash, rootHash))
        .returning();

      return updated;
    } catch (error) {
      this.#logger.error({ error }, "Error in updateRewardsRootTx");
      throw error;
    }
  }
}
