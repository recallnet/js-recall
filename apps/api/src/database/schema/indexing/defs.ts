import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import type { EventType } from "@/indexing/blockchain-types.js";

export { indexingEvents, stakes, stakeChanges };
export type { IndexingEvent, StakeChangeRow, StakeChangeInsert, StakeRow };

const walletDef = varchar("wallet", { length: 42 });

/**
 * Source-of-truth feed of *raw on-chain events* we indexed (stake/unstake/relock/withdraw).
 *
 * Invariants / notes:
 * - One row per tx log: (transaction_hash, log_index) is unique.
 * - All timestamps are UTC (timestamp without time zone).
 * - block_number is stored as bigint and should be handled as JS bigint.
 * - raw_event_data preserves the original payload for offline reprocessing & audits.
 *
 * This table is *not* the accounting ledger. It’s the append-only intake that downstream
 * processors consume to produce stake mutations and Boost awards.
 */
const indexingEvents = pgTable(
  "indexing_events",
  {
    id: uuid().primaryKey().notNull(),
    // Full original decoded event for auditing / replays.
    rawEventData: jsonb("raw_event_data").notNull(),
    // High-level event kind used by downstream logic: stake/unstake/relock/withdraw.
    type: varchar("type", { length: 50 }).notNull(),
    // Chain metadata for ordering, reorg checks and idempotency.
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    blockHash: varchar("block_hash", { length: 66 }).notNull(),
    blockTimestamp: timestamp("block_timestamp").notNull(),
    transactionHash: varchar("transaction_hash", { length: 66 }).notNull(),
    logIndex: integer("log_index").notNull(),
    // Indexer metadata
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Prevent duplicates from the same tx log
    txLogUnique: uniqueIndex("events_txhash_logindex_uq").on(
      t.transactionHash,
      t.logIndex,
    ),
    // Common query patterns
    blockNumberIdx: index("events_block_number_idx").on(t.blockNumber),
    blockTimeIdx: index("events_block_timestamp_idx").on(t.blockTimestamp),
    typeIdx: index("events_type_idx").on(t.type),
    // Helpful for exact block lookups / reorg checks
    blockHashIdx: index("events_block_hash_idx").on(t.blockHash),
    // Housekeeping / retention jobs
    createdAtIdx: index("events_created_at_idx").on(t.createdAt),
  }),
);

/**
 * Off-chain mirror of on-chain stake positions.
 * One row per stake created on chain (keyed by the on-chain stake/receipt id, e.g. NFT token id).
 * The row is updated as lifecycle transitions occur (stake → unstake → withdraw / relock).
 *
 * Contrast to `stake_changes`:
 * - `stakes` is the *current mutable state* of each on-chain stake.
 * - `stake_changes` is the *immutable ledger* of applied events.
 * - Every mutation of `stakes` MUST be in the same DB transaction as inserting the corresponding `stake_changes` row.
 *
 * Invariants / notes:
 * - `id` exactly matches the on-chain stake/receipt id (bigint).
 * - `wallet` is a canonicalized (lowercased) EVM address.
 * - `amount` is the *current active amount* for this stake (after partial unstakes/relocks).
 * - Lifecycle columns (`stakedAt`, `canUnstakeAfter`, `unstakedAt`, `canWithdrawAfter`, `withdrawnAt`, `relockedAt`)
 *   are progressively filled; `NULL` means “not reached yet”.
 * - All timestamps are UTC (`timestamp` without time zone).
 *
 * Concurrency / idempotency:
 * - Apply chain events exactly once using `(tx_hash, log_index)` uniqueness in `stake_changes`.
 * - Use optimistic checks / row locks when updating `stakes` to avoid lost updates.
 *
 * Reorg handling:
 * - Keep `block_number` + `block_hash` in `stake_changes` (and in the raw `indexing_events`)
 *   to detect and repair on replays if a reorg invalidates prior assumptions.
 * Lifecycle / status (derived from columns):
 * - Locked:              unstakedAt IS NULL AND now() <  canUnstakeAfter
 * - Unlocked:            unstakedAt IS NULL AND now() >= canUnstakeAfter
 * - Unstaked:            unstakedAt IS NOT NULL AND withdrawnAt IS NULL
 * - Withdrawal Pending:  withdrawnAt IS NULL AND canWithdrawAfter IS NOT NULL AND now() >= canWithdrawAfter
 * - Withdrawn:           withdrawnAt IS NOT NULL            // terminal
 * - Relocked:            relockedAt  IS NOT NULL            // terminal
 * Notes:
 * - “Withdrawn” and “Relocked” both end the stake lifecycle; they should be mutually
 *   exclusive.
 * - Status is time-relative (uses NOW at query time); if you need a historical view,
 *   compute against a chosen reference timestamp instead of NOW().
 */
const stakes = pgTable(
  "stakes",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().notNull(), // on-chain receipt / NFT id
    wallet: walletDef.notNull(), // canonicalized EVM addr
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    // lifecycle
    stakedAt: timestamp("staked_at").notNull(),
    canUnstakeAfter: timestamp("can_unstake_after").notNull(),
    unstakedAt: timestamp("unstaked_at"),
    canWithdrawAfter: timestamp("can_withdraw_after"),
    withdrawnAt: timestamp("withdrawn_at"),
    relockedAt: timestamp("relocked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    walletIdx: index("stakes_wallet_idx").on(t.wallet),
    statusIdx: index("stakes_status_idx").on(t.unstakedAt, t.withdrawnAt),
    createdIdx: index("stakes_created_at_idx").on(t.createdAt),
    // CHECK (amount >= 0)
    amountNonNegative: sql`CHECK (${t.amount} >= 0)`,
  }),
);

/**
 * Immutable journal of *applied* stake lifecycle events. Each row corresponds to a chain log we decided
 * to apply to a stake, with the signed delta recorded and chain coordinates for idempotency.
 *
 * Usage:
 * - Insert into this table *first* (or with a unique guard), then mutate `stakes`
 *   in the same transaction. If the insert is a no-op due to the unique constraint,
 *   skip the state mutation (idempotent replay).
 * Consumers:
 * - Indexer reads new rows and *derives* mutations for `stakes` + `stake_changes`.
 *   Never drive product state directly from this table in user-facing code.
 *
 * Invariants / notes:
 * - (tx_hash, log_index) is unique → an event is applied at most once.
 * - `delta_amount` captures the _signed_ change to the stake’s active amount:
 * - Keep `block_number` and `block_hash` for reorg analysis and audits.
 */
const stakeChanges = pgTable(
  "stake_changes",
  {
    id: uuid("id").primaryKey().notNull(),
    // who/what
    stakeId: bigint("stake_id", { mode: "bigint" })
      .notNull()
      .references(() => stakes.id),
    wallet: walletDef.notNull(),
    // delta — signed: +stake, 0 for relock, -move from staked to withdrawable, -withdraw, etc.
    deltaAmount: bigint("delta_amount", { mode: "bigint" }).notNull(),
    kind: varchar("kind", { length: 24 }).notNull(), // See EventType for possible values
    // chain idempotency
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    logIndex: integer("log_index").notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    blockHash: varchar("block_hash", { length: 66 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqEvent: uniqueIndex("stake_changes_event_uq").on(t.txHash, t.logIndex),
    stakeIdx: index("stake_changes_stake_idx").on(t.stakeId),
    walletIdx: index("stake_changes_wallet_idx").on(t.wallet),
    blockIdx: index("stake_changes_block_idx").on(t.blockNumber),
    txHashIdx: index("stake_changes_tx_hash_idx").on(t.txHash),
  }),
);

// Export types for use in TypeScript
type StakeRow = InferSelectModel<typeof stakes>;
type IndexingEvent = InferSelectModel<typeof indexingEvents>;
type StakeChangeRow = Omit<InferSelectModel<typeof stakeChanges>, "kind"> & {
  kind: EventType;
};
type StakeChangeInsert = Omit<InferInsertModel<typeof stakeChanges>, "kind"> & {
  kind: EventType;
};
