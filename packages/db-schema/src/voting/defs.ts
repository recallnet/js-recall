import { sql } from "drizzle-orm";
import {
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
} from "drizzle-orm/pg-core";

import { agents, competitions, users } from "../core/defs.js";
import { blockchainAddress, tokenAmount } from "../util.js";

const bytea = customType<{
  data: Uint8Array | Buffer; // what your app uses
  driverData: Buffer; // what node-postgres returns
  notNull: false;
  default: false;
}>({
  dataType: () => "bytea",
  toDriver: (v) => (v instanceof Buffer ? v : Buffer.from(v)),
  fromDriver: (v) => v, // Buffer
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
 * - One row per (wallet, competitionId) pair.
 *
 * Invariants / notes:
 * - Balance is always ≥ 0 (enforced by CHECK).
 * - `updatedAt` should be bumped on every change.
 * - Rows are mutable — this is the live ledger state.
 *
 * Coupling:
 * - Every update to `boost_balances` must have a matching immutable entry
 *   in `boost_changes` (same transaction) for auditability/idempotency.
 *
 * Typical queries:
 * - Get balance by wallet and competitionId.
 */
export const boostBalances = pgTable(
  "boost_balances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    wallet: bytea("wallet").notNull(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    balance: tokenAmount("balance")
      .notNull()
      .default(sql`0`),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    // enforce one balance per (wallet, competition)
    walletCompetitionUniq: uniqueIndex(
      "boost_balances_wallet_competition_uniq",
    ).on(t.wallet, t.competitionId),
    // address must be exactly 20 bytes
    walletLenChk: sql`CHECK (octet_length(${t.wallet}) = 20)`,
    // balance must never be negative
    balanceNonNegative: sql`CHECK (${t.balance} >= 0)`,
    balanceDescIdx: index("boost_balances_balance_desc_idx").on(
      t.competitionId,
      sql`${t.balance} DESC`,
    ),
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
 * - (balance_id, idem_key) is unique → an operation is applied at most once per balance (i.e., wallet x competitionId) entry.
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
    balanceId: uuid("balance_id")
      .notNull()
      .references(() => boostBalances.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    deltaAmount: tokenAmount("delta_amount").notNull(), // earn:+X, spend:-X
    meta: jsonb("meta")
      .notNull()
      .default(sql`'{}'::jsonb`),
    idemKey: bytea("idem_key").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    // enforce idempotency per wallet
    uniqBalanceIdx: uniqueIndex("boost_changes_balance_idem_uq").on(
      t.balanceId,
      t.idemKey,
    ),
    // Query pattern: history-by-wallet in time order
    balanceCreatedIdx: index("boost_changes_balance_created_idx").on(
      t.balanceId,
      sql`${t.createdAt} DESC`,
    ),
    createdIdx: index("boost_changes_created_at_idx").on(t.createdAt),
  }),
);

export const agentBoostTotals = pgTable(
  "agent_boost_totals",
  {
    id: uuid("id").primaryKey().notNull(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    total: tokenAmount("total")
      .notNull()
      .default(sql`0`),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("agent_boost_totals_agent_id_idx").on(t.agentId),
    index("agent_boost_totals_competition_id_idx").on(t.competitionId),
    uniqueIndex("agent_boost_totals_agent_id_competition_id_idx").on(
      t.agentId,
      t.competitionId,
    ),
  ],
);

export const agentBoosts = pgTable(
  "agent_boosts",
  {
    id: uuid("id").primaryKey().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    changeId: uuid("change_id")
      .notNull()
      .references(() => boostChanges.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("agent_boots_user_id_idx").on(t.userId),
    index("agent_boots_agent_id_idx").on(t.agentId),
    index("agent_boosts_competition_id_idx").on(t.competitionId),
    index("agent_boosts_change_idx").on(t.changeId),
  ],
);
