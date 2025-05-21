import {
  boolean,
  foreignKey,
  index,
  integer,
  numeric,
  pgSchema,
  serial,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
  customType,
} from "drizzle-orm/pg-core";

import { competitions, teams } from "../core/defs.js";

/**
 * Shared postgres type for an ethereum address.
 * Note: default length 50 to not introduce any migrations.
 */
function ethereumAddress(name?: string, length: number = 50) {
  if (name) {
    return varchar(name, { length: length });
  } else {
    return varchar({ length: length });
  }
}

/**
 * Shared postgres type for a token amount.
 * Note: Using too small of precision and scale. Should be changed, but left as it is to not introduce any migrations.
 *
 * @param name - Name of the database column
 */
function tokenAmount(name?: string) {
  if (name) {
    return numeric(name, { precision: 30, scale: 15, mode: "number" });
  } else {
    return numeric({ precision: 30, scale: 15, mode: "number" });
  }
}

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const tradingComps = pgSchema("trading_comps");

export const crossChainTradingType = tradingComps.enum(
  "cross_chain_trading_type",
  ["disallowAll", "disallowXParent", "allow"],
);

export const tradingCompetitions = tradingComps.table(
  "trading_competitions",
  {
    competitionId: uuid()
      .primaryKey()
      .references(() => competitions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    crossChainTradingType: crossChainTradingType("cross_chain_trading_type")
      .notNull()
      .default("disallowAll"),
  },
  (table) => [
    index("idx_competitions_cross_chain_trading").on(
      table.crossChainTradingType,
    ),
  ],
);

export const balances = tradingComps.table(
  "balances",
  {
    id: serial().primaryKey().notNull(),
    teamId: uuid("team_id").notNull(),
    tokenAddress: ethereumAddress("token_address").notNull(),
    amount: tokenAmount().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow(),
    specificChain: varchar("specific_chain", { length: 20 }).notNull(),
  },
  (table) => [
    index("idx_balances_specific_chain").on(table.specificChain),
    index("idx_balances_team_id").on(table.teamId),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: "balances_team_id_fkey",
    }).onDelete("cascade"),
    unique("balances_team_id_token_address_key").on(
      table.teamId,
      table.tokenAddress,
    ),
  ],
);

export const trades = tradingComps.table(
  "trades",
  {
    id: uuid().primaryKey().notNull(),
    teamId: uuid("team_id").notNull(),
    competitionId: uuid("competition_id").notNull(),
    fromToken: ethereumAddress("from_token").notNull(),
    toToken: ethereumAddress("to_token").notNull(),
    fromAmount: tokenAmount("from_amount").notNull(),
    toAmount: tokenAmount("to_amount").notNull(),
    price: tokenAmount().notNull(),
    success: boolean().notNull(),
    error: text(),
    reason: text().notNull(),
    timestamp: timestamp({ withTimezone: true }).defaultNow(),
    fromChain: varchar("from_chain", { length: 10 }),
    toChain: varchar("to_chain", { length: 10 }),
    fromSpecificChain: varchar("from_specific_chain", { length: 20 }),
    toSpecificChain: varchar("to_specific_chain", { length: 20 }),
  },
  (table) => [
    index("idx_trades_competition_id").on(table.competitionId),
    index("idx_trades_from_chain").on(table.fromChain),
    index("idx_trades_from_specific_chain").on(table.fromSpecificChain),
    index("idx_trades_team_id").on(table.teamId),
    index("idx_trades_timestamp").on(table.timestamp),
    index("idx_trades_to_chain").on(table.toChain),
    index("idx_trades_to_specific_chain").on(table.toSpecificChain),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: "trades_team_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "trades_competition_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const prices = tradingComps.table(
  "prices",
  {
    id: serial().primaryKey().notNull(),
    token: ethereumAddress().notNull(),
    price: tokenAmount().notNull(),
    timestamp: timestamp({ withTimezone: true }).defaultNow(),
    chain: varchar({ length: 10 }),
    specificChain: varchar("specific_chain", { length: 20 }),
  },
  (table) => [
    index("idx_prices_chain").on(table.chain),
    index("idx_prices_specific_chain").on(table.specificChain),
    index("idx_prices_timestamp").on(table.timestamp),
    index("idx_prices_token").on(table.token),
    index("idx_prices_token_chain").on(table.token, table.chain),
    index("idx_prices_token_specific_chain").on(
      table.token,
      table.specificChain,
    ),
    index("idx_prices_token_timestamp").on(table.token, table.timestamp),
  ],
);

export const portfolioSnapshots = tradingComps.table(
  "portfolio_snapshots",
  {
    id: serial().primaryKey().notNull(),
    teamId: uuid("team_id").notNull(),
    competitionId: uuid("competition_id").notNull(),
    timestamp: timestamp({ withTimezone: true }).defaultNow(),
    totalValue: tokenAmount("total_value").notNull(),
  },
  (table) => [
    index("idx_portfolio_snapshots_team_competition").on(
      table.teamId,
      table.competitionId,
    ),
    index("idx_portfolio_snapshots_timestamp").on(table.timestamp),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: "portfolio_snapshots_team_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "portfolio_snapshots_competition_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const portfolioTokenValues = tradingComps.table(
  "portfolio_token_values",
  {
    id: serial().primaryKey().notNull(),
    portfolioSnapshotId: integer("portfolio_snapshot_id").notNull(),
    tokenAddress: ethereumAddress("token_address").notNull(),
    amount: tokenAmount().notNull(),
    valueUsd: tokenAmount("value_usd").notNull(),
    price: tokenAmount().notNull(),
    specificChain: varchar("specific_chain", { length: 20 }),
  },
  (table) => [
    index("idx_portfolio_token_values_snapshot_id").on(
      table.portfolioSnapshotId,
    ),
    index("idx_portfolio_token_values_specific_chain").on(table.specificChain),
    foreignKey({
      columns: [table.portfolioSnapshotId],
      foreignColumns: [portfolioSnapshots.id],
      name: "portfolio_token_values_portfolio_snapshot_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const votesAvailable = tradingComps.table(
  "votes_available",
  {
    address: ethereumAddress("address").notNull().primaryKey(),
    epoch: numeric(),
    amount: tokenAmount().notNull(),
    createdAt: timestamp({ withTimezone: false }).defaultNow(),
    updatedAt: timestamp({ withTimezone: false }).defaultNow(),
  },
  (table) => [
    index("idx_votes_available_address").on(table.address),
    index("idx_votes_available_address_epoch").on(table.address, table.epoch),
    index("idx_votes_available_epoch").on(table.epoch),
  ],
);

export const votesPerformed = tradingComps.table(
  "votes_performed",
  {
    address: ethereumAddress("address").notNull().primaryKey(),
    amount: tokenAmount().notNull(),
    epoch: numeric(),
    destination: ethereumAddress("destination").notNull(),
    createdAt: timestamp({ withTimezone: false }).defaultNow(),
    updatedAt: timestamp({ withTimezone: false }).defaultNow(),
  },
  (table) => [
    index("idx_votes_performed_address").on(table.address),
    index("idx_votes_performed_address_epoch").on(table.address, table.amount),
    index("idx_votes_performed_destination").on(table.destination),
    index("idx_votes_performed_destination_epoch").on(
      table.destination,
      table.epoch,
    ),
    index("idx_votes_performed_epoch").on(table.epoch),
  ],
);

export const epochs = tradingComps.table(
  "epochs",
  {
    id: serial().primaryKey(),
    createdAt: timestamp({ withTimezone: false }).defaultNow(),
  },
  (table) => [index("idx_epochs_id").on(table.id)],
);

// Define rewards table for storing reward information
export const rewards = tradingComps.table(
  'rewards',
  {
    id: serial('id').primaryKey().notNull(),
    epoch_id: integer('epoch_id').notNull(),
    address: text('address').notNull(),
    amount: numeric('amount').notNull(),
    leaf_hash: bytea('leaf_hash').notNull(),
    claimed: boolean('claimed').default(false).notNull(),
    created_at: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: false }).defaultNow().notNull(),
  },
  (table) => [index('idx_rewards_epoch_id').on(table.epoch_id)],
);

// Define rewards_tree table for storing all nodes of a merkle tree
export const rewardsTree = tradingComps.table(
  'rewards_tree',
  {
    id: serial('id').primaryKey().notNull(),
    epoch_id: integer('epoch_id').notNull(),
    level: integer('level').notNull(),
    idx: integer('idx').notNull(),
    hash: bytea('hash').notNull(),
    created_at: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_rewards_tree_level_hash').on(table.level, table.hash),
    index('idx_rewards_tree_level_idx').on(table.level, table.idx),
  ]
);

// Define rewards_roots table for storing root hashes
export const rewardsRoots = tradingComps.table(
  'rewards_roots',
  {
    id: serial('id').primaryKey().notNull(),
    epoch_id: integer('epoch_id').notNull(),
    root_hash: bytea('root_hash').notNull(),
    tx: text('tx').notNull(),
    created_at: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
  },
  (table) => [index('idx_rewards_roots_epoch_id').on(table.epoch_id)]
);
