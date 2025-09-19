import { eq } from "drizzle-orm";

import { tradingConstraints } from "../schema/trading/defs.js";
import {
  InsertTradingConstraints,
  SelectTradingConstraints,
} from "../schema/trading/types.js";
import { Database, Transaction } from "../types.js";

export class TradingConstraintsRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  /**
   * Creates trading constraints for a competition
   * @param data - The trading constraints data to insert
   * @param tx - Optional database transaction
   * @returns The created trading constraints record
   */
  async create(
    data: InsertTradingConstraints,
    tx?: Transaction,
  ): Promise<SelectTradingConstraints | undefined> {
    const executor = tx || this.#db;
    const [result] = await executor
      .insert(tradingConstraints)
      .values(data)
      .returning();
    return result;
  }

  /**
   * Finds trading constraints by competition ID
   * @param competitionId - The competition ID to find constraints for
   * @returns The trading constraints record or null if not found
   */
  async findByCompetitionId(
    competitionId: string,
  ): Promise<SelectTradingConstraints | null> {
    const [result] = await this.#db
      .select()
      .from(tradingConstraints)
      .where(eq(tradingConstraints.competitionId, competitionId))
      .limit(1);
    return result || null;
  }

  /**
   * Updates trading constraints for a competition
   * @param competitionId - The competition ID to update constraints for
   * @param data - The updated trading constraints data
   * @param tx - Optional database transaction
   * @returns The updated trading constraints record
   */
  async update(
    competitionId: string,
    data: Partial<InsertTradingConstraints>,
    tx?: Transaction,
  ): Promise<SelectTradingConstraints | undefined> {
    const executor = tx || this.#db;
    const [result] = await executor
      .update(tradingConstraints)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(tradingConstraints.competitionId, competitionId))
      .returning();
    return result;
  }

  /**
   * Deletes trading constraints for a competition
   * @param competitionId - The competition ID to delete constraints for
   * @returns True if constraints were deleted, false if not found
   */
  async delete(competitionId: string): Promise<boolean> {
    const result = await this.#db
      .delete(tradingConstraints)
      .where(eq(tradingConstraints.competitionId, competitionId));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Upserts trading constraints for a competition
   * @param data - The trading constraints data to upsert
   * @returns The upserted trading constraints record
   */
  async upsert(
    data: InsertTradingConstraints,
  ): Promise<SelectTradingConstraints | undefined> {
    const [result] = await this.#db
      .insert(tradingConstraints)
      .values(data)
      .onConflictDoUpdate({
        target: tradingConstraints.competitionId,
        set: {
          minimumPairAgeHours: data.minimumPairAgeHours,
          minimum24hVolumeUsd: data.minimum24hVolumeUsd,
          minimumLiquidityUsd: data.minimumLiquidityUsd,
          minimumFdvUsd: data.minimumFdvUsd,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }
}
