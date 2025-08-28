import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { agents, competitions, users } from "@/database/schema/core/defs.js";
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

export const stakes = pgTable(
  "stakes",
  {
    id: uuid().primaryKey().notNull(),
    tokenId: bigint("token_id", { mode: "bigint" }).notNull(),
    amount: numeric("amount", { precision: 78, scale: 0 }).notNull(),
    address: blockchainAddress("address").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    epochCreated: uuid("epoch_created")
      .notNull()
      .references(() => epochs.id),
    stakedAt: timestamp("staked_at").notNull(),
    canUnstakeAfter: timestamp("can_unstake_after").notNull(),
    unstakedAt: timestamp("unstaked_at"),
    canWithdrawAfter: timestamp("can_withdraw_after"),
    withdrawnAt: timestamp("withdrawn_at"),
    relockedAt: timestamp("relocked_at"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_stakes_address").on(table.address)],
);

export const voteAssignments = pgTable(
  "vote_assignments",
  {
    stakeId: uuid("stake_id")
      .notNull()
      .references(() => stakes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    epoch: uuid()
      .notNull()
      .references(() => epochs.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    amount: tokenAmount("amount").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.stakeId, table.userId, table.epoch],
      name: "vote_assignments_pkey",
    }),
    index("idx_vote_assignments_user_epoch").on(table.userId, table.epoch),
    index("idx_vote_assignments_epoch").on(table.epoch),
  ],
);

export const votesAvailable = pgTable(
  "votes_available",
  {
    address: varchar("address", { length: 50 }).notNull(),
    epoch: uuid()
      .notNull()
      .references(() => epochs.id, { onDelete: "cascade" }),
    amount: tokenAmount("amount").notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }),
    transactionHash: varchar("transaction_hash", { length: 66 }),
    logIndex: integer("log_index"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.address, table.epoch],
      name: "votes_available_pkey",
    }),
  ],
);

export const votesPerformed = pgTable(
  "votes_performed",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    epoch: uuid()
      .notNull()
      .references(() => epochs.id, { onDelete: "cascade" }),
    amount: tokenAmount("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.agentId, table.epoch],
      name: "votes_performed_pkey",
    }),
    index("idx_votes_performed_agent_epoch").on(table.agentId, table.epoch),
    index("idx_votes_performed_epoch").on(table.epoch),
  ],
);

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
