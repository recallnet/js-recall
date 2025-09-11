import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  serial,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  admins,
  agents,
  competitions,
  competitionsLeaderboard,
} from "../core/defs.js";

/**
 * Trading schema for all trading-related components.
 */
export const tradingComps = pgSchema("trading_comps");

/**
 * Enum for cross-chain trading type.
 */
export const crossChainTradingType = tradingComps.enum(
  "cross_chain_trading_type",
  ["disallowAll", "disallowXParent", "allow"],
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
    index("idx_trades_timestamp").on(table.timestamp),
    index("idx_trades_to_chain").on(table.toChain),
    index("idx_trades_to_specific_chain").on(table.toSpecificChain),
    // Compound indexes for optimized query patterns
    index("idx_trades_agent_timestamp").on(table.agentId, table.timestamp),
    index("idx_trades_competition_timestamp").on(
      table.competitionId,
      table.timestamp,
    ),
    index("idx_trades_competition_agent_timestamp").on(
      table.competitionId,
      table.agentId,
      sql`${table.timestamp} DESC`,
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

/**
 * Data source types for perps competitions
 */
export const perpsDataSourceEnum = tradingComps.enum("perps_data_source", [
  "external_api", // Symphony, Hyperliquid, etc.
  "onchain_indexing", // Envio indexing DEX perps
  "hybrid", // Combination of both
]);

/**
 * Configuration for perpetual futures competitions
 */
export const perpsCompetitionConfig = tradingComps.table(
  "perps_competition_config",
  {
    competitionId: uuid("competition_id")
      .primaryKey()
      .references(() => competitions.id),

    // Data source configuration
    dataSource: perpsDataSourceEnum("data_source").notNull(),
    dataSourceConfig: jsonb("data_source_config").notNull(),
    // For external_api: { provider: "symphony", apiUrl: "...", ... }
    // For onchain_indexing: { protocol: "gmx", chains: ["arbitrum"], ... }

    // Competition parameters (generic)
    initialCapital: numeric("initial_capital").notNull().default("500.00"),

    // Monitoring thresholds
    selfFundingThresholdUsd: numeric("self_funding_threshold_usd").default(
      "10.00",
    ),
    inactivityHours: integer("inactivity_hours").default(24),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
);

/**
 * Table for perpetual positions
 */
export const perpetualPositions = tradingComps.table(
  "perpetual_positions",
  {
    id: uuid().primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id),
    competitionId: uuid("competition_id").notNull(),

    // Position identifiers (provider-agnostic)
    providerPositionId: varchar("provider_position_id", { length: 100 }),
    providerTradeId: varchar("provider_trade_id", { length: 100 }),

    // Position details
    asset: varchar("asset", { length: 20 }).notNull(),
    isLong: boolean("is_long").notNull(),
    leverage: numeric("leverage"),
    positionSize: numeric("position_size").notNull(),
    collateralAmount: numeric("collateral_amount").notNull(),

    // Prices
    entryPrice: numeric("entry_price").notNull(),
    currentPrice: numeric("current_price"),
    liquidationPrice: numeric("liquidation_price"),

    // PnL
    pnlUsdValue: numeric("pnl_usd_value"),
    pnlPercentage: numeric("pnl_percentage"),

    // Status
    status: varchar("status", { length: 20 }).notNull().default("Open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_perp_positions_agent_comp").on(
      table.agentId,
      table.competitionId,
    ),
    index("idx_perp_positions_comp").on(table.competitionId),
    index("idx_perp_positions_status").on(table.status),
    index("idx_perp_positions_created").on(table.createdAt.desc()),
    unique("perp_positions_provider_id").on(table.providerPositionId),
  ],
);

/**
 * Account summaries for perps trading
 */
export const perpsAccountSummaries = tradingComps.table(
  "perps_account_summaries",
  {
    id: uuid().primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id),
    competitionId: uuid("competition_id").notNull(),

    // Core equity metrics
    initialCapital: numeric("initial_capital"),
    totalEquity: numeric("total_equity").notNull(),
    availableBalance: numeric("available_balance"),
    marginUsed: numeric("margin_used"),

    // PnL metrics
    totalPnl: numeric("total_pnl"),
    totalRealizedPnl: numeric("total_realized_pnl"),
    totalUnrealizedPnl: numeric("total_unrealized_pnl"),

    // Trading activity metrics
    totalVolume: numeric("total_volume"),
    totalFeesPaid: numeric("total_fees_paid"),

    // Trading statistics
    totalTrades: integer("total_trades"),
    averageTradeSize: numeric("average_trade_size"),

    // Position counts
    openPositionsCount: integer("open_positions_count"),
    closedPositionsCount: integer("closed_positions_count"),
    liquidatedPositionsCount: integer("liquidated_positions_count"),

    // Performance metrics
    roi: numeric("roi"),
    roiPercent: numeric("roi_percent"),

    // Account status
    accountStatus: varchar("account_status", { length: 20 }),

    // Store raw provider response for audit
    rawData: jsonb("raw_data"),

    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_perps_summaries_agent_comp").on(
      table.agentId,
      table.competitionId,
    ),
    index("idx_perps_summaries_timestamp").on(table.timestamp),
  ],
);

/**
 * Self-funding detection alerts for perps competitions
 */
export const perpsSelfFundingAlerts = tradingComps.table(
  "perps_self_funding_alerts",
  {
    id: uuid().primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id),
    competitionId: uuid("competition_id").notNull(),

    // Detection details
    expectedEquity: numeric("expected_equity").notNull(),
    actualEquity: numeric("actual_equity").notNull(),
    unexplainedAmount: numeric("unexplained_amount").notNull(),

    // Provider data snapshot at detection time
    accountSnapshot: jsonb("account_snapshot").notNull(),
    detectionMethod: varchar("detection_method", { length: 50 }), // 'transfer_history' or 'balance_reconciliation'

    // Review status
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow(),
    reviewed: boolean("reviewed").default(false),
    reviewNote: text("review_note"),
    actionTaken: varchar("action_taken", { length: 50 }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => admins.id),
  },
  (table) => [
    index("idx_perps_alerts_agent_comp").on(table.agentId, table.competitionId),
    index("idx_perps_alerts_comp_reviewed").on(
      table.competitionId,
      table.reviewed,
    ),
    index("idx_perps_alerts_detected").on(table.detectedAt.desc()),
  ],
);
