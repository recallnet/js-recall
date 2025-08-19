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

import { CROSS_CHAIN_TRADING_TYPE_VALUES } from "@/types/index.js";

import { agents, competitions, competitionsLeaderboard } from "../core/defs.js";

/**
 * Trading schema for all trading-related components.
 */
export const tradingComps = pgSchema("trading_comps");

/**
 * Enum for cross-chain trading type.
 */
export const crossChainTradingType = tradingComps.enum(
  "cross_chain_trading_type",
  CROSS_CHAIN_TRADING_TYPE_VALUES,
);

/**
 * Table for trading competitions.
 */
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

/**
 * Table to hold stats on trading specific competitions
 */
export const tradingCompetitionsLeaderboard = tradingComps.table(
  "trading_competitions_leaderboard",
  {
    competitionsLeaderboardId: uuid("competitions_leaderboard_id")
      .primaryKey()
      .references(() => competitionsLeaderboard.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    pnl: numeric("pnl", {
      precision: 30,
      scale: 15,
      mode: "number",
    })
      .notNull()
      .default(0),
    startingValue: numeric("starting_value", {
      precision: 30,
      scale: 15,
      mode: "number",
    })
      .notNull()
      .default(0),
  },
  (table) => [index("idx_trading_competitions_leaderboard_pnl").on(table.pnl)],
);

/**
 * Table for balances of agents in a competition.
 */
export const balances = tradingComps.table(
  "balances",
  {
    id: serial().primaryKey().notNull(),
    agentId: uuid("agent_id").notNull(),
    tokenAddress: varchar("token_address", { length: 50 }).notNull(),
    amount: numeric({ mode: "number" }).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow(),
    specificChain: varchar("specific_chain", { length: 20 }).notNull(),
    symbol: varchar("symbol", { length: 20 }).notNull(),
  },
  (table) => [
    index("idx_balances_specific_chain").on(table.specificChain),
    index("idx_balances_agent_id").on(table.agentId),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "balances_agent_id_fkey",
    }).onDelete("cascade"),
    unique("balances_agent_id_token_address_key").on(
      table.agentId,
      table.tokenAddress,
    ),
  ],
);

/**
 * Table for trades of agents in a competition.
 */
export const trades = tradingComps.table(
  "trades",
  {
    id: uuid().primaryKey().notNull(),
    agentId: uuid("agent_id").notNull(),
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
    tradeAmountUsd: numeric("trade_amount_usd", {
      mode: "number",
    }).notNull(),
    toTokenSymbol: varchar("to_token_symbol", { length: 20 }).notNull(),
    fromTokenSymbol: varchar("from_token_symbol", { length: 20 }).notNull(),
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
    index("idx_trades_agent_id").on(table.agentId),
    index("idx_trades_timestamp").on(table.timestamp),
    index("idx_trades_to_chain").on(table.toChain),
    index("idx_trades_to_specific_chain").on(table.toSpecificChain),
    // Compound indexes for optimized query patterns
    index("idx_trades_agent_timestamp").on(table.agentId, table.timestamp),
    index("idx_trades_competition_timestamp").on(
      table.competitionId,
      table.timestamp,
    ),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "trades_agent_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "trades_competition_id_fkey",
    }).onDelete("cascade"),
  ],
);

/**
 * Table for prices of tokens in a competition.
 */
export const prices = tradingComps.table(
  "prices",
  {
    id: serial().primaryKey().notNull(),
    token: varchar({ length: 50 }).notNull(),
    price: numeric({ mode: "number" }).notNull(),
    timestamp: timestamp({ withTimezone: true }).defaultNow(),
    chain: varchar({ length: 10 }),
    specificChain: varchar("specific_chain", { length: 20 }),
    symbol: varchar("symbol", { length: 20 }).notNull(),
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

/**
 * Table for portfolio snapshots of agents in a competition.
 */
export const portfolioSnapshots = tradingComps.table(
  "portfolio_snapshots",
  {
    id: serial().primaryKey().notNull(),
    agentId: uuid("agent_id").notNull(),
    competitionId: uuid("competition_id").notNull(),
    timestamp: timestamp({ withTimezone: true }).defaultNow().notNull(),
    // TODO: are units of this number usdc? if so, the precision and scale are good here. if not, need to remove.
    totalValue: numeric("total_value", {
      precision: 30,
      scale: 15,
      mode: "number",
    }).notNull(),
  },
  (table) => [
    index("idx_portfolio_snapshots_agent_competition").on(
      table.agentId,
      table.competitionId,
    ),
    index("idx_portfolio_snapshots_timestamp").on(table.timestamp),
    index("idx_portfolio_snapshots_competition_agent_timestamp").on(
      table.competitionId,
      table.agentId,
      table.timestamp,
    ),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "portfolio_snapshots_agent_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "portfolio_snapshots_competition_id_fkey",
    }).onDelete("cascade"),
  ],
);

/**
 * Table for trading constraints per competition.
 */
export const tradingConstraints = tradingComps.table(
  "trading_constraints",
  {
    competitionId: uuid("competition_id")
      .primaryKey()
      .references(() => competitions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    minimumPairAgeHours: integer("minimum_pair_age_hours").notNull(),
    minimum24hVolumeUsd: numeric("minimum_24h_volume_usd", {
      precision: 20,
      scale: 2,
      mode: "number",
    }).notNull(),
    minimumLiquidityUsd: numeric("minimum_liquidity_usd", {
      precision: 20,
      scale: 2,
      mode: "number",
    }).notNull(),
    minimumFdvUsd: numeric("minimum_fdv_usd", {
      precision: 20,
      scale: 2,
      mode: "number",
    }).notNull(),
    minTradesPerDay: integer("min_trades_per_day"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => [
    index("idx_trading_constraints_competition_id").on(table.competitionId),
  ],
);
