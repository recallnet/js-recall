import { eq } from "drizzle-orm";
import { Logger } from "pino";

import { Database } from "../types.js";
import { rewards, rewardsRoots, rewardsTree } from "../voting/defs.js";
import {
  InsertReward,
  InsertRewardsRoot,
  SelectReward,
  SelectRewardsRoot,
  SelectRewardsTree,
} from "../voting/types.js";

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
   * @returns Array of rewards for the competition
   */
  async getRewardsByCompetition(
    competitionId: string,
  ): Promise<SelectReward[]> {
    try {
      return await this.#db
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
   * @returns Array of inserted rewards
   */
  async insertRewards(
    rewardsToInsert: InsertReward[],
  ): Promise<SelectReward[]> {
    try {
      return await this.#db.insert(rewards).values(rewardsToInsert).returning();
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
}
