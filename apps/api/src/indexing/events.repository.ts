import { and, desc, eq } from "drizzle-orm";

import { BlockHashCoder, TxHashCoder } from "@recallnet/db/coders";
import { indexingEvents } from "@recallnet/db/schema/indexing/defs";

import config from "@/config/index.js";
import { db } from "@/database/db.js";
import { EventData } from "@/indexing/blockchain-types.js";

/**
 * EventsRepository
 *
 * Persistence layer for the **raw intake** table `indexing_events`.
 * This repository is the idempotency gate for the indexing pipeline:
 *   - `isEventPresent()` lets callers short-circuit duplicate logs
 *     using the natural chain key (block_number, tx_hash, log_index).
 *   - `save()` inserts the normalized raw event payload (append-only),
 *     relying on a UNIQUE (tx_hash, log_index) in the schema to enforce
 *     at-most-once writes even under races.
 *   - `lastBlockNumber()` returns the resume point for the indexer,
 *     falling back to configured `startBlock` if the table is empty.
 *
 * Relationships:
 * - Called by `EventProcessor.processEvent()` *after* stake mutations succeed.
 * - Read by `IndexingService.loop()` to set `fromBlock = last + 1`.
 *
 * Conventions:
 * - Hashes and addresses must be lower-cased before insert (done here).
 * - Timestamps are UTC (`timestamp` without time zone).
 */
export class EventsRepository {
  readonly #db: typeof db;

  constructor(database: typeof db = db) {
    this.#db = database;
  }

  /**
   * Check if a chain log has already been recorded in `indexing_events`.
   *
   * Idempotency key:
   * - (block_number, transaction_hash, log_index)
   *
   * Returns:
   * - true  → already present (caller should skip processing)
   * - false → new event (caller may proceed)
   *
   * Notes:
   * - `transactionHash` is normalized to lowercase to match storage convention.
   * - Fast due to index on (tx_hash, log_index) and/or block_number.
   */
  async isEventPresent(
    blockNumber: bigint,
    transactionHash: string,
    logIndex: number,
  ): Promise<boolean> {
    const txHash = TxHashCoder.encode(transactionHash);
    const rows = await this.#db
      .select({ id: indexingEvents.blockNumber })
      .from(indexingEvents)
      .where(
        and(
          eq(indexingEvents.blockNumber, blockNumber),
          eq(indexingEvents.transactionHash, txHash),
          eq(indexingEvents.logIndex, logIndex),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  /**
   * Append a normalized raw event into `indexing_events`.
   *
   * Behavior:
   * - Inserts the event with all chain coordinates + untouched `raw` payload.
   * - Uses `onConflictDoNothing()` so duplicate inserts are safely ignored
   *   (race-proof w.r.t. concurrent indexer workers).
   *
   * Returns:
   * - true  → row inserted (first time we see this log)
   * - false → insert was skipped by the unique constraint (already present)
   *
   * Caller contract:
   * - Should only be called **after** domain mutations (stakes/stake_changes)
   *   have succeeded; this preserves “apply state, then record intake” semantics.
   * - All hashes are lower-cased here; upstream code can pass mixed case.
   */
  async append(event: EventData): Promise<boolean> {
    const txHash = TxHashCoder.encode(event.transactionHash);
    const blockHash = BlockHashCoder.encode(event.blockHash);
    const rows = await this.#db
      .insert(indexingEvents)
      .values({
        id: crypto.randomUUID(),
        rawEventData: event.raw,
        type: event.type,
        blockNumber: event.blockNumber,
        blockHash: blockHash,
        blockTimestamp: event.blockTimestamp,
        transactionHash: txHash,
        logIndex: event.logIndex,
        createdAt: event.createdAt,
      })
      .onConflictDoNothing()
      .returning({ id: indexingEvents.id });
    return rows.length > 0;
  }

  /**
   * Get the highest block number recorded in `indexing_events`.
   *
   * Usage:
   * - `IndexingService.loop()` uses this to resume with `fromBlock = last`.
   *
   * Fallback:
   * - If no rows exist, falls back to `config.stakingIndex.eventStartBlock`.
   *
   * Returns:
   * - bigint block number (never undefined).
   *
   * Performance:
   * - Uses ORDER BY block_number DESC LIMIT 1; ensure an index on block_number
   *   exists (present in schema) for O(log N) retrieval.
   */
  async lastBlockNumber(): Promise<bigint> {
    const [row] = await this.#db
      .select({ blockNumber: indexingEvents.blockNumber })
      .from(indexingEvents)
      .orderBy(desc(indexingEvents.blockNumber))
      .limit(1);

    const lastBlockNumber =
      row?.blockNumber ?? config.stakingIndex.eventStartBlock;
    return BigInt(lastBlockNumber);
  }
}
