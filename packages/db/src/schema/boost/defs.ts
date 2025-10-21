import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  numeric,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { agents, competitions, users } from "../core/defs.js";
import { bytea, tokenAmount } from "../custom-types.js";
import { stakes } from "../indexing/defs.js";

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
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    balance: tokenAmount("balance")
      .notNull()
      .default(sql`0`),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // enforce one balance per (user, competition)
    uniqueIndex("boost_balances_user_competition_uniq").on(
      t.userId,
      t.competitionId,
    ),
    // balance must never be negative
    sql`CHECK (${t.balance} >= 0)`,
    index("boost_balances_balance_desc_idx").on(
      t.competitionId,
      sql`${t.balance} DESC`,
    ),
    index("boost_balances_updated_at_idx").on(t.updatedAt),
    index("boost_balances_created_at_idx").on(t.createdAt),
  ],
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
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    balanceId: uuid("balance_id")
      .notNull()
      .references(() => boostBalances.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    wallet: bytea("wallet").notNull(),
    deltaAmount: tokenAmount("delta_amount").notNull(), // earn:+X, spend:-X
    meta: jsonb("meta")
      .notNull()
      .default(sql`'{}'::jsonb`),
    idemKey: bytea("idem_key").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // enforce idempotency per wallet
    uniqueIndex("boost_changes_balance_idem_uq").on(t.balanceId, t.idemKey),
    // Query pattern: history-by-user in time order
    index("boost_changes_balance_created_idx").on(
      t.balanceId,
      sql`${t.createdAt} DESC`,
    ),
    index("boost_changes_wallet_idx").on(t.wallet),
    index("boost_changes_created_at_idx").on(t.createdAt),
    // address must be exactly 20 bytes
    sql`CHECK (octet_length(${t.wallet}) = 20)`,
  ],
);

export const stakeBoostAwards = pgTable(
  "stake_boost_awards",
  {
    id: serial().primaryKey().notNull(),
    stakeId: bigint("stake_id", { mode: "bigint" })
      .notNull()
      .references(() => stakes.id, { onDelete: "cascade" }),
    baseAmount: tokenAmount("base_amount").notNull(),
    multiplier: numeric("multiplier", {
      precision: 6,
      scale: 4,
      mode: "number",
    }).notNull(),
    boostChangeId: uuid("boost_change_id")
      .notNull()
      .references(() => boostChanges.id, { onDelete: "cascade" }),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("stake_boost_awards_stake_id_competition_id_idx").on(
      t.stakeId,
      t.competitionId,
    ),
  ],
);

export const agentBoostTotals = pgTable(
  "agent_boost_totals",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
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
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    agentBoostTotalId: uuid("agent_boost_total_id")
      .notNull()
      .references(() => agentBoostTotals.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    changeId: uuid("change_id")
      .notNull()
      .references(() => boostChanges.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("agent_boosts_agent_boost_total_id_idx").on(t.agentBoostTotalId),
    index("agent_boosts_change_idx").on(t.changeId),
    index("agent_boosts_created_at_idx").on(t.createdAt),
    uniqueIndex("agent_boosts_agent_boost_total_id_change_id_idx").on(
      t.agentBoostTotalId,
      t.changeId,
    ),
  ],
);
