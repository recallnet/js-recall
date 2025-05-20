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
} from "drizzle-orm/pg-core";

import { competitions, teams } from "../core/defs.js";

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
    tokenAddress: varchar("token_address", { length: 50 }).notNull(),
    amount: numeric({ mode: "number" }).notNull(),
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
    fromToken: varchar("from_token", { length: 50 }).notNull(),
    toToken: varchar("to_token", { length: 50 }).notNull(),
    fromAmount: numeric("from_amount", {
      mode: "number",
    }).notNull(),
    toAmount: numeric("to_amount", {
      mode: "number",
    }).notNull(),
    price: numeric({ mode: "number" }).notNull(),
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
    token: varchar({ length: 50 }).notNull(),
    price: numeric({ mode: "number" }).notNull(),
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
    // TODO: are units of this number usdc? if so, the precision and scale are good here. if not, need to remove.
    totalValue: numeric("total_value", {
      precision: 30,
      scale: 15,
      mode: "number",
    }).notNull(),
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
    tokenAddress: varchar("token_address", { length: 50 }).notNull(),
    amount: numeric({ mode: "number" }).notNull(),
    valueUsd: numeric("value_usd", {
      precision: 30,
      scale: 15,
      mode: "number",
    }).notNull(),
    price: numeric({ mode: "number" }).notNull(),
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
