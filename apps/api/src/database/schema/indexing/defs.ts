// Define events table - stores raw blockchain events with metadata only
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
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

import { EventType } from "@/indexing/blockchain-types.js";

export { indexingEvents, stakes, stakeChanges };
export type { IndexingEvent, StakeChangeRow, StakeChangeInsert, StakeRow };

const indexingEvents = pgTable(
  "indexing_events",
  {
    id: uuid().primaryKey().notNull(),
    // Raw event data (stored during indexing)
    rawEventData: jsonb("raw_event_data").notNull(), // Store the complete raw event payload
    type: varchar("type", { length: 50 }).notNull(), // Event type (stake, unstake, relock, withdraw)

    // Blockchain event metadata (stored during indexing)
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

const stakes = pgTable(
  "stakes",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().notNull(), // on-chain receipt / NFT id
    wallet: varchar("wallet", { length: 42 }).notNull(), // canonicalized EVM addr
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
  }),
);

const stakeChanges = pgTable(
  "stake_changes",
  {
    id: uuid("id").primaryKey().notNull(),
    // who/what
    stakeId: bigint("stake_id", { mode: "bigint" })
      .notNull()
      .references(() => stakes.id),
    wallet: varchar("wallet", { length: 64 }).notNull(),
    // delta — signed: +stake, 0 for relock, -move from staked to withdrawable, -withdraw, etc.
    deltaAmount: bigint("delta_amount", { mode: 'bigint' }).notNull(),
    kind: varchar("kind", { length: 24 }).notNull(), // See EventType for possible values
    // chain idempotency
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    logIndex: integer("log_index").notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    blockHash: varchar("block_hash", { length: 66 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqEvent: uniqueIndex("stake_changes_event_uq").on(
      t.txHash,
      t.logIndex,
    ),
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
