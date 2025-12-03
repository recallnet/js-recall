import { eq } from "drizzle-orm";

import { paperTradingConfig } from "../schema/trading/defs.js";
import {
  InsertPaperTradingConfig,
  SelectPaperTradingConfig,
} from "../schema/trading/types.js";
import { Database, Transaction } from "../types.js";

/**
 * Paper Trading Config Repository
 * Handles database operations for paper trading competition configurations
 */
export class PaperTradingConfigRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  /**
   * Creates or updates paper trading config for a competition
   * @param data - The paper trading config data to upsert
   * @param tx - Optional database transaction
   * @returns The upserted paper trading config record
   */
  async upsert(
    data: InsertPaperTradingConfig,
    tx?: Transaction,
  ): Promise<SelectPaperTradingConfig | undefined> {
    const executor = tx || this.#db;
    const [result] = await executor
      .insert(paperTradingConfig)
      .values(data)
      .onConflictDoUpdate({
        target: paperTradingConfig.competitionId,
        set: {
          maxTradePercentage: data.maxTradePercentage,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  /**
   * Finds paper trading config by competition ID
   * @param competitionId - The competition ID to find config for
   * @returns The paper trading config record or null if not found
   */
  async findByCompetitionId(
    competitionId: string,
  ): Promise<SelectPaperTradingConfig | null> {
    const [result] = await this.#db
      .select()
      .from(paperTradingConfig)
      .where(eq(paperTradingConfig.competitionId, competitionId))
      .limit(1);
    return result || null;
  }
}
