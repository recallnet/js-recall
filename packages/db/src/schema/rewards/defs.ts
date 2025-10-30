import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { agents, competitions, users } from "../core/defs.js";
import { blockchainAddress, bytea, tokenAmount } from "../custom-types.js";

export const epochs = pgTable("epochs", {
  id: uuid().primaryKey().notNull().defaultRandom(),
  number: serial().notNull().unique(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

// Define rewards table for storing reward information
export const rewards = pgTable(
  "rewards",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "cascade",
    }),
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
    index("idx_rewards_user_id").on(table.userId),
    index("idx_rewards_agent_id").on(table.agentId),
    index("idx_rewards_address").on(table.address),
    uniqueIndex("uq_rewards_competition_id_user_id_agent_id").on(
      table.competitionId,
      table.userId,
      table.agentId,
    ),
  ],
);

// Define rewards_tree table for storing all nodes of a merkle tree
export const rewardsTree = pgTable(
  "rewards_tree",
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
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
    id: uuid().primaryKey().notNull().defaultRandom(),
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
