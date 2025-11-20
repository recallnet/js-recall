import { eq } from "drizzle-orm";

import { paperTradingInitialBalances } from "../schema/trading/defs.js";
import {
  InsertPaperTradingInitialBalances,
  SelectPaperTradingInitialBalances,
} from "../schema/trading/types.js";
import { Database, Transaction } from "../types.js";

/**
 * Paper Trading Initial Balances Repository
 * Handles database operations for paper trading competition initial balances
 */
export class PaperTradingInitialBalancesRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  /**
   * Creates or updates initial balance for a competition
   * @param data - The initial balance data to upsert
   * @param tx - Optional database transaction
   * @returns The upserted initial balance record
   */
  async upsert(
    data: InsertPaperTradingInitialBalances,
    tx?: Transaction,
  ): Promise<SelectPaperTradingInitialBalances | undefined> {
    const executor = tx || this.#db;
    const [result] = await executor
      .insert(paperTradingInitialBalances)
      .values(data)
      .onConflictDoUpdate({
        target: [
          paperTradingInitialBalances.competitionId,
          paperTradingInitialBalances.specificChain,
          paperTradingInitialBalances.tokenSymbol,
        ],
        set: {
          tokenAddress: data.tokenAddress,
          amount: data.amount,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  /**
   * Finds all initial balances for a competition
   * @param competitionId - The competition ID
   * @param tx - Optional database transaction
   * @returns Array of initial balance records
   */
  async findByCompetitionId(
    competitionId: string,
    tx?: Transaction,
  ): Promise<SelectPaperTradingInitialBalances[]> {
    const executor = tx || this.#db;
    return await executor
      .select()
      .from(paperTradingInitialBalances)
      .where(eq(paperTradingInitialBalances.competitionId, competitionId));
  }
}
