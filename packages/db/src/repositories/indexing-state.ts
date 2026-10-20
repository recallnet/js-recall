import { eq, sql } from "drizzle-orm";

import { indexingCheckpoints } from "../schema/indexing/defs.js";
import type { Database, Transaction } from "../types.js";

/** Successfully scanned position for a configured indexer. */
export type IndexingCheckpoint = typeof indexingCheckpoints.$inferSelect;

/** Batch result whose position is committed with the batch's domain writes. */
export interface IndexingBatch {
  nextBlock: number;
}

/**
 * Serializes batches and commits their checkpoints with their domain writes.
 * Transaction-scoped locks are compatible with transaction-pooled connections.
 */
export class IndexingStateRepository {
  constructor(private readonly db: Database) {}

  /** Read the next block to scan and the time of the last committed scan. */
  async getCheckpoint(
    key: string,
    tx?: Transaction,
  ): Promise<IndexingCheckpoint | undefined> {
    const [row] = await (tx ?? this.db)
      .select()
      .from(indexingCheckpoints)
      .where(eq(indexingCheckpoints.key, key))
      .limit(1);
    return row;
  }

  /**
   * Run a batch under an exclusive transaction lock, or return undefined if busy.
   * The callback must use the supplied transaction for every domain write.
   * Throws on failure and rolls back domain writes and scan progress together.
   */
  async runBatch<T extends IndexingBatch>(
    key: string,
    process: (tx: Transaction, nextBlock: number | undefined) => Promise<T>,
  ): Promise<T | undefined> {
    return this.db.transaction(
      async (tx) => {
        await tx.execute(sql`SET LOCAL statement_timeout = '5s'`);
        await tx.execute(
          sql`SET LOCAL idle_in_transaction_session_timeout = '15s'`,
        );
        const lock = await tx.execute<{ acquired: boolean }>(
          sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) AS acquired`,
        );
        if (!lock.rows[0]?.acquired) return undefined;

        const checkpoint = await this.getCheckpoint(key, tx);
        const result = await process(tx, checkpoint?.nextBlock);
        if (
          !Number.isSafeInteger(result.nextBlock) ||
          result.nextBlock < (checkpoint?.nextBlock ?? 0)
        ) {
          throw new Error("Invalid indexing checkpoint");
        }
        await tx
          .insert(indexingCheckpoints)
          .values({ key, nextBlock: result.nextBlock })
          .onConflictDoUpdate({
            target: indexingCheckpoints.key,
            set: {
              nextBlock: result.nextBlock,
              updatedAt: sql`clock_timestamp()`,
            },
          });
        return result;
      },
      { isolationLevel: "read committed" },
    );
  }
}
