import {
  boolean,
  customType,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { agents, users } from "@/database/schema/core/defs.js";
import { blockchainAddress, tokenAmount } from "@/database/schema/util.js";

const bytea = customType<{ data: Uint8Array; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const epochs = pgTable("epochs", {
  id: serial().primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const stakes = pgTable("stakes", {
  id: uuid().primaryKey().notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: tokenAmount("amount").notNull(),
  address: blockchainAddress("address").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  withdrawalAt: timestamp("withdrawal_at", { withTimezone: true }),
  withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  epochCreated: uuid("epoch_created").references(() => epochs.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const voteAssignments = pgTable(
  "vote_assignments",
  {
    stakeId: uuid("stake_id")
      .notNull()
      .references(() => stakes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    epoch: uuid("epoch")
      .notNull()
      .references(() => epochs.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    amount: tokenAmount("amount").notNull(),
  },
  (table) => [
    index("idx_vote_assignments_user_id").on(table.userId),
    index("idx_vote_assignments_epoch").on(table.epoch),
    index("idx_vote_assignments_stake_id").on(table.stakeId),
  ],
);

export const votesAvailable = pgTable(
  "votes_available",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    epoch: uuid("epoch")
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
      columns: [table.userId, table.epoch],
      name: "votes_available_pkey",
    }),
    index("idx_votes_available_user_id").on(table.userId),
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
    epoch: uuid("epoch")
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
    index("idx_votes_performed_user_id").on(table.userId),
    index("idx_votes_performed_agent_id").on(table.agentId),
    index("idx_votes_performed_epoch").on(table.epoch),
  ],
);

// Define rewards table for storing reward information
export const rewards = pgTable(
  "rewards",
  {
    id: serial("id").primaryKey().notNull(),
    epoch: uuid("epoch")
      .notNull()
      .references(() => epochs.id, { onDelete: "cascade" }),
    address: blockchainAddress("address").notNull(),
    amount: tokenAmount("amount").notNull(),
    leafHash: bytea("leaf_hash").notNull(),
    claimed: boolean("claimed").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: false })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: false })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_rewards_epoch_id").on(table.epoch)],
);

// Define rewards_tree table for storing all nodes of a merkle tree
export const rewardsTree = pgTable(
  "rewards_tree",
  {
    id: serial("id").primaryKey().notNull(),
    epoch: uuid("epoch")
      .notNull()
      .references(() => epochs.id, { onDelete: "cascade" }),
    level: integer("level").notNull(),
    idx: integer("idx").notNull(),
    hash: bytea("hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: false })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_rewards_tree_level_hash").on(table.level, table.hash),
    index("idx_rewards_tree_level_idx").on(table.level, table.idx),
  ],
);

// Define rewards_roots table for storing root hashes
export const rewardsRoots = pgTable(
  "rewards_roots",
  {
    id: serial("id").primaryKey().notNull(),
    epoch: uuid("epoch")
      .notNull()
      .references(() => epochs.id, { onDelete: "cascade" }),
    rootHash: bytea("root_hash").notNull(),
    tx: text("tx").notNull(),
    createdAt: timestamp("created_at", { withTimezone: false })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_rewards_roots_epoch_id").on(table.epoch)],
);
