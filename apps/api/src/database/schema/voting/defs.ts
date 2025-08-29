import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { competitions } from "@/database/schema/core/defs.js";
import { blockchainAddress, tokenAmount } from "@/database/schema/util.js";

const bytea = customType<{ data: Uint8Array; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const epochs = pgTable("epochs", {
  id: uuid().primaryKey().notNull(),
  number: serial().notNull().unique(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

// Define rewards table for storing reward information
export const rewards = pgTable(
  "rewards",
  {
    id: uuid().primaryKey().notNull(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    address: blockchainAddress("address").notNull(),
    amount: tokenAmount("amount").notNull(),
    leafHash: bytea("leaf_hash").notNull(),
    claimed: boolean().default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_rewards_competition_id").on(table.competitionId),
    index("idx_rewards_address").on(table.address),
  ],
);

// Define rewards_tree table for storing all nodes of a merkle tree
export const rewardsTree = pgTable(
  "rewards_tree",
  {
    id: uuid().primaryKey().notNull(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    level: integer().notNull(),
    idx: integer().notNull(),
    hash: bytea().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_rewards_tree_competition_id_level_idx").on(
      table.competitionId,
      table.level,
      table.idx,
    ),
    index("idx_rewards_tree_level_hash").on(table.level, table.hash),
    index("idx_rewards_tree_level_idx").on(table.level, table.idx),
  ],
);

// Define rewards_roots table for storing root hashes
export const rewardsRoots = pgTable(
  "rewards_roots",
  {
    id: uuid().primaryKey().notNull(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    rootHash: bytea("root_hash").notNull(),
    tx: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("uq_rewards_roots_competition_id").on(table.competitionId),
  ],
);

/**
 * Canonical view of each wallet’s Boost balance.
 *
 * Purpose:
 * - Tracks the *current available balance* of Boost.
 * - One row per wallet; the primary key is the canonicalized EVM address string.
 *
 * Invariants / notes:
 * - Balance is always ≥ 0 (enforced by CHECK).
 * - `wallet` must be lowercased before insert/update.
 * - `updatedAt` should be bumped on every change.
 * - Rows are mutable — this is the live ledger state.
 *
 * Coupling:
 * - Every update to `boost_balances` must have a matching immutable entry
 *   in `boost_changes` (same transaction) for auditability/idempotency.
 *
 * Typical queries:
 * - Get balance by wallet (PK lookup).
 * - List wallets with recent activity (order by updated_at).
 */
export const boostBalances = pgTable(
  "boost_balances",
  {
    wallet: varchar("wallet", { length: 42 }).primaryKey().notNull(),
    balance: bigint("balance", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    // balance must never be negative
    balanceNonNegative: sql`CHECK (${t.balance} >= 0)`,
    // handy for housekeeping & lookups
    walletIdx: index("boost_balances_wallet_idx").on(t.wallet),
    updatedIdx: index("boost_balances_updated_at_idx").on(t.updatedAt),
    createdIdx: index("boost_balances_created_at_idx").on(t.createdAt),
  }),
);

/**
 * boost_changes
 *
 * Immutable journal of all Boost mutations.
 *
 * Purpose:
 * - Append-only log of “earn” (+X) and “spend” (−X) operations.
 * - Provides audit trail, idempotency, and replay capability.
 *
 * Invariants / notes:
 * - (wallet, idem_key) is unique → an operation is applied at most once per wallet.
 * - `delta_amount` is signed: positive for earn, negative for spend.
 * - `meta` holds structured context (competition id, reason, etc).
 * - Rows are never updated or deleted.
 *
 * Coupling:
 * - Insert into `boost_changes` and update `boost_balances` in the same transaction.
 * - If the insert is skipped due to the unique constraint, skip the balance mutation
 *   (idempotent replay).
 *
 * Typical queries:
 * - Fetch wallet history ordered by created_at.
 * - Check if a given idem_key has already been applied.
 */
export const boostChanges = pgTable(
  "boost_changes",
  {
    id: uuid("id").primaryKey().notNull(),
    wallet: varchar("wallet", { length: 42 }).notNull(),
    deltaAmount: bigint("delta_amount", { mode: "bigint" }).notNull(), // earn:+X, spend:-X
    meta: jsonb("meta")
      .notNull()
      .default(sql`'{}'::jsonb`),
    idemKey: varchar("idem_key", { length: 256 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    // enforce idempotency per wallet
    uniqWalletIdem: uniqueIndex("boost_changes_wallet_idem_uq").on(
      t.wallet,
      t.idemKey,
    ),
    walletIdx: index("boost_changes_wallet_idx").on(t.wallet),
    createdIdx: index("boost_changes_created_at_idx").on(t.createdAt),
  }),
);
