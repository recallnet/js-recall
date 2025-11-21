import { desc, sql } from "drizzle-orm";
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

import type { SpecificChain } from "../../repositories/types/index.js";
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
 * Enum for trade types.
 */
export const tradeType = tradingComps.enum("trade_type", [
  "simulated",
  "spot_live",
]);

/**
 * Enum for evaluation metrics used in perps competitions.
 */
export const evaluationMetricEnum = tradingComps.enum("evaluation_metric", [
  "calmar_ratio",
  "sortino_ratio",
  "simple_return",
]);

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
 * Table to hold stats on perpetual futures competitions
 */
export const perpsCompetitionsLeaderboard = tradingComps.table(
  "perps_competitions_leaderboard",
  {
    competitionsLeaderboardId: uuid("competitions_leaderboard_id")
      .primaryKey()
      .references(() => competitionsLeaderboard.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    calmarRatio: numeric("calmar_ratio", { mode: "number" }), // Returns as JS number
    sortinoRatio: numeric("sortino_ratio", { mode: "number" }), // Returns as JS number
    simpleReturn: numeric("simple_return", { mode: "number" }), // Returns as JS number
    maxDrawdown: numeric("max_drawdown", { mode: "number" }), // Returns as JS number
    downsideDeviation: numeric("downside_deviation", { mode: "number" }), // Returns as JS number
    totalEquity: numeric("total_equity", { mode: "number" }).notNull(), // Returns as JS number
    totalPnl: numeric("total_pnl", { mode: "number" }), // Returns as JS number
    hasRiskMetrics: boolean("has_risk_metrics").default(false),
  },
  (table) => [
    index("idx_perps_competitions_leaderboard_calmar").on(table.calmarRatio),
  ],
);

/**
 * Table for balances of agents in a competition.
 */
export const balances = tradingComps.table(
  "balances",
  {
    id: serial().primaryKey().notNull(),
    agentId: uuid("agent_id").notNull(),
    competitionId: uuid("competition_id").notNull(),
    tokenAddress: varchar("token_address", { length: 50 }).notNull(),
    amount: numeric({ mode: "number" }).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow(),
    specificChain: varchar("specific_chain", { length: 20 })
      .$type<SpecificChain>()
      .notNull(),
    symbol: varchar("symbol", { length: 20 }).notNull(),
  },
  (table) => [
    index("idx_balances_specific_chain").on(table.specificChain),
    index("idx_balances_agent_id").on(table.agentId),
    index("idx_balances_competition_id").on(table.competitionId),
    index("idx_balances_agent_competition").on(
      table.agentId,
      table.competitionId,
    ),
    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agents.id],
      name: "balances_agent_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "balances_competition_id_fkey",
    }).onDelete("cascade"),
    unique("balances_agent_id_token_address_competition_id_key").on(
      table.agentId,
      table.tokenAddress,
      table.competitionId,
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

    // Trade type discriminator
    tradeType: tradeType("trade_type").default("simulated"),

    // On-chain specific fields (for spot_live trades)
    txHash: varchar("tx_hash", { length: 100 }),
    blockNumber: integer("block_number"),
    protocol: varchar("protocol", { length: 50 }),
    gasUsed: numeric("gas_used"),
    gasPrice: numeric("gas_price"),
    gasCostUsd: numeric("gas_cost_usd"),
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
    // Spot live specific indexes
    index("idx_trades_trade_type").on(table.tradeType),
    index("idx_trades_tx_hash").on(table.txHash),
    index("idx_trades_block_number").on(table.blockNumber),
    index("idx_trades_type_competition_timestamp").on(
      table.tradeType,
      table.competitionId,
      sql`${table.timestamp} DESC`,
    ),
    // Unique constraint for spot_live trades to prevent duplicates
    // Only applies when txHash is not null (spot_live trades only)
    // Allows the same txHash across different competitions or agents
    unique("trades_tx_hash_competition_agent_unique").on(
      table.txHash,
      table.competitionId,
      table.agentId,
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
      desc(table.timestamp),
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

    // Evaluation metric for ranking
    evaluationMetric: evaluationMetricEnum("evaluation_metric")
      .default("calmar_ratio")
      .notNull(),

    // Competition parameters (generic)
    initialCapital: numeric("initial_capital").notNull().default("500.00"),

    // Monitoring thresholds
    selfFundingThresholdUsd: numeric("self_funding_threshold_usd").default(
      "10.00",
    ),
    minFundingThreshold: numeric("min_funding_threshold"),
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
    // Composite index for efficient DISTINCT ON queries to get latest summary per agent
    index("idx_perps_summaries_agent_comp_timestamp").on(
      table.agentId,
      table.competitionId,
      table.timestamp.desc(),
    ),
  ],
);

/**
 * Transfer history for violation detection and admin audit
 * NOTE: Mid-competition transfers are PROHIBITED - any transfer during
 * an active competition is a violation that should trigger alerts
 */
export const perpsTransferHistory = tradingComps.table(
  "perps_transfer_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id),
    competitionId: uuid("competition_id").notNull(),

    // Transfer details
    type: varchar("type", { length: 20 }).notNull(), // 'deposit' | 'withdraw'
    amount: numeric("amount").notNull(),
    asset: varchar("asset", { length: 10 }).notNull(),
    fromAddress: varchar("from_address", { length: 100 }).notNull(),
    toAddress: varchar("to_address", { length: 100 }).notNull(),
    txHash: varchar("tx_hash", { length: 100 }).notNull(),
    chainId: integer("chain_id").notNull(),

    // Timestamp when transfer occurred
    transferTimestamp: timestamp("transfer_timestamp", {
      withTimezone: true,
    }).notNull(),

    // Metadata
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_perps_transfers_agent_comp").on(
      table.agentId,
      table.competitionId,
    ),
    index("idx_perps_transfers_timestamp").on(table.transferTimestamp),
    // Compound index for efficient getAgentTransferHistory queries with since filter
    // Covers: WHERE agent_id = ? AND competition_id = ? AND transfer_timestamp > ?
    index("idx_perps_transfers_agent_comp_timestamp").on(
      table.agentId,
      table.competitionId,
      table.transferTimestamp,
    ),
    // Unique constraint since txHash is always required per API spec
    unique("idx_perps_transfers_tx_hash").on(table.txHash),
  ],
);

/**
 * Risk metrics table for Calmar ratio calculations
 * Uses simple returns since mid-competition transfers are prohibited
 */
export const perpsRiskMetrics = tradingComps.table(
  "perps_risk_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id),
    competitionId: uuid("competition_id").notNull(),

    // Core metrics for Calmar calculation
    simpleReturn: numeric("simple_return").notNull(), // (endValue/startValue) - 1
    calmarRatio: numeric("calmar_ratio").notNull(),
    annualizedReturn: numeric("annualized_return").notNull(),
    maxDrawdown: numeric("max_drawdown").notNull(),

    // Sortino ratio metrics
    sortinoRatio: numeric("sortino_ratio"),
    downsideDeviation: numeric("downside_deviation"),

    // Note: transferCount and periodCount removed - transfers are violations

    // Metadata
    calculationTimestamp: timestamp("calculation_timestamp", {
      withTimezone: true,
    }).defaultNow(),
    snapshotCount: integer("snapshot_count").notNull(),
  },
  (table) => [
    // Unique constraint for upsert operations
    unique("idx_perps_metrics_unique").on(table.agentId, table.competitionId),
    index("idx_perps_metrics_agent_comp").on(
      table.agentId,
      table.competitionId,
    ),
    index("idx_perps_metrics_calmar").on(
      table.competitionId,
      table.calmarRatio.desc(),
    ),
    index("idx_perps_metrics_sortino").on(
      table.competitionId,
      table.sortinoRatio.desc(),
    ),
  ],
);

// NOTE: The system uses simple returns since mid-competition transfers are prohibited

/**
 * Time-series table for risk metrics snapshots
 * Stores historical risk metrics for each agent at regular intervals
 * Unlike perps_risk_metrics, this table has NO unique constraint on (agent_id, competition_id)
 * allowing multiple snapshots over time
 */
export const riskMetricsSnapshots = tradingComps.table(
  "risk_metrics_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id),
    competitionId: uuid("competition_id").notNull(),

    // Timestamp for this snapshot
    timestamp: timestamp("timestamp", { withTimezone: true })
      .defaultNow()
      .notNull(),

    // Risk metrics at this point in time
    calmarRatio: numeric("calmar_ratio"),
    sortinoRatio: numeric("sortino_ratio"),
    simpleReturn: numeric("simple_return"),
    annualizedReturn: numeric("annualized_return"),
    maxDrawdown: numeric("max_drawdown"),
    downsideDeviation: numeric("downside_deviation"), // For Sortino calculation
  },
  (table) => [
    // Index for querying by agent and competition
    index("idx_risk_snapshots_agent_comp").on(
      table.agentId,
      table.competitionId,
    ),
    // Index for time-based queries
    index("idx_risk_snapshots_timestamp").on(table.timestamp.desc()),
    // Composite index for competition time series queries
    index("idx_risk_snapshots_comp_time").on(
      table.competitionId,
      table.timestamp.desc(),
    ),
    // Index for agent time series within a competition
    index("idx_risk_snapshots_agent_comp_time").on(
      table.agentId,
      table.competitionId,
      table.timestamp.desc(),
    ),
  ],
);

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

/**
 * Data source types for spot live competitions
 */
export const spotLiveDataSourceEnum = tradingComps.enum(
  "spot_live_data_source",
  [
    "rpc_direct", // Direct RPC provider (e.g., Alchemy)
    "envio_indexing", // Envio indexing service
    "hybrid", // Combination of both
  ],
);

/**
 * Configuration for spot live trading competitions
 */
export const spotLiveCompetitionConfig = tradingComps.table(
  "spot_live_competition_config",
  {
    competitionId: uuid("competition_id")
      .primaryKey()
      .references(() => competitions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    // Data source configuration
    dataSource: spotLiveDataSourceEnum("data_source").notNull(),
    dataSourceConfig: jsonb("data_source_config").notNull(),
    // For rpc_direct: { provider: "alchemy", apiKeys: {...}, ... }
    // For envio_indexing: { indexerUrl: "...", ... }

    // Monitoring thresholds
    selfFundingThresholdUsd: numeric("self_funding_threshold_usd").default(
      "10.00",
    ),
    minFundingThreshold: numeric("min_funding_threshold"),
    inactivityHours: integer("inactivity_hours").default(24),

    // Sync configuration
    syncIntervalMinutes: integer("sync_interval_minutes").default(2),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_spot_live_config_competition_id").on(table.competitionId),
  ],
);

/**
 * Whitelisted DEX protocols per competition
 */
export const spotLiveAllowedProtocols = tradingComps.table(
  "spot_live_allowed_protocols",
  {
    id: uuid().primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    specificChain: varchar("specific_chain", { length: 20 })
      .$type<SpecificChain>()
      .notNull(),
    protocol: varchar("protocol", { length: 50 }).notNull(),
    routerAddress: varchar("router_address", { length: 66 }).notNull(),
    swapEventSignature: varchar("swap_event_signature", {
      length: 66,
    }).notNull(),
    factoryAddress: varchar("factory_address", { length: 66 }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_spot_live_protocols_competition_id").on(table.competitionId),
    index("idx_spot_live_protocols_chain").on(
      table.competitionId,
      table.specificChain,
    ),
    unique("spot_live_protocols_unique").on(
      table.competitionId,
      table.specificChain,
      table.routerAddress,
    ),
  ],
);

/**
 * Chains enabled for spot live competitions
 */
export const spotLiveCompetitionChains = tradingComps.table(
  "spot_live_competition_chains",
  {
    id: uuid().primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    specificChain: varchar("specific_chain", { length: 20 })
      .$type<SpecificChain>()
      .notNull(),
    enabled: boolean("enabled").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_spot_live_chains_competition_id").on(table.competitionId),
    unique("spot_live_chains_unique").on(
      table.competitionId,
      table.specificChain,
    ),
  ],
);

/**
 * Token whitelist for spot live competitions
 */
export const spotLiveAllowedTokens = tradingComps.table(
  "spot_live_allowed_tokens",
  {
    id: uuid().primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    specificChain: varchar("specific_chain", { length: 20 })
      .$type<SpecificChain>()
      .notNull(),
    tokenAddress: varchar("token_address", { length: 66 }).notNull(),
    tokenSymbol: varchar("token_symbol", { length: 20 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_spot_live_tokens_competition_id").on(table.competitionId),
    index("idx_spot_live_tokens_chain").on(
      table.competitionId,
      table.specificChain,
    ),
    unique("spot_live_tokens_unique").on(
      table.competitionId,
      table.specificChain,
      table.tokenAddress,
    ),
  ],
);

/**
 * Transfer history for spot live competitions
 */
export const spotLiveTransferHistory = tradingComps.table(
  "spot_live_transfer_history",
  {
    id: uuid().primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    // Transfer details
    type: varchar("type", { length: 20 }).notNull(), // 'deposit' | 'withdraw' | 'transfer'
    specificChain: varchar("specific_chain", { length: 20 })
      .$type<SpecificChain>()
      .notNull(),
    tokenAddress: varchar("token_address", { length: 66 }).notNull(),
    tokenSymbol: varchar("token_symbol", { length: 20 }).notNull(),
    amount: numeric("amount").notNull(),
    amountUsd: numeric("amount_usd"),

    // Addresses
    fromAddress: varchar("from_address", { length: 66 }).notNull(),
    toAddress: varchar("to_address", { length: 66 }).notNull(),

    // On-chain details
    txHash: varchar("tx_hash", { length: 100 }).notNull(),
    blockNumber: integer("block_number").notNull(),
    transferTimestamp: timestamp("transfer_timestamp", {
      withTimezone: true,
    }).notNull(),

    // Metadata
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_spot_live_transfers_agent_comp").on(
      table.agentId,
      table.competitionId,
    ),
    index("idx_spot_live_transfers_timestamp").on(table.transferTimestamp),
    index("idx_spot_live_transfers_agent_comp_timestamp").on(
      table.agentId,
      table.competitionId,
      table.transferTimestamp,
    ),
    index("idx_spot_live_transfers_type").on(table.type),
    unique("spot_live_transfers_tx_hash_unique").on(table.txHash),
  ],
);

/**
 * Agent sync state for incremental block scanning
 * Tracks the highest block scanned per agent per chain to enable gap-free incremental syncing
 */
export const spotLiveAgentSyncState = tradingComps.table(
  "spot_live_agent_sync_state",
  {
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    specificChain: varchar("specific_chain", { length: 20 })
      .$type<SpecificChain>()
      .notNull(),
    lastScannedBlock: integer("last_scanned_block").notNull(),
    lastScannedAt: timestamp("last_scanned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_sync_state_agent_comp_chain").on(
      table.agentId,
      table.competitionId,
      table.specificChain,
    ),
    unique("sync_state_unique").on(
      table.agentId,
      table.competitionId,
      table.specificChain,
    ),
  ],
);

/**
 * Self-funding violation alerts for spot live competitions
 */
export const spotLiveSelfFundingAlerts = tradingComps.table(
  "spot_live_self_funding_alerts",
  {
    id: uuid().primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    // Detection details
    detectionMethod: varchar("detection_method", { length: 50 }).notNull(), // 'transfer_history' | 'balance_reconciliation'
    violationType: varchar("violation_type", { length: 50 }).notNull(), // 'deposit' | 'withdrawal_exceeds_limit'
    detectedValue: numeric("detected_value").notNull(),
    thresholdValue: numeric("threshold_value").notNull(),
    specificChain: varchar("specific_chain", {
      length: 20,
    }).$type<SpecificChain>(),
    txHash: varchar("tx_hash", { length: 100 }),

    // Snapshot data
    transferSnapshot: jsonb("transfer_snapshot"),

    // Review status
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow(),
    reviewed: boolean("reviewed").default(false),
    reviewNote: text("review_note"),
    actionTaken: varchar("action_taken", { length: 50 }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => admins.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  },
  (table) => [
    index("idx_spot_live_alerts_agent_comp").on(
      table.agentId,
      table.competitionId,
    ),
    index("idx_spot_live_alerts_comp_reviewed").on(
      table.competitionId,
      table.reviewed,
    ),
    index("idx_spot_live_alerts_detected").on(table.detectedAt.desc()),
    index("idx_spot_live_alerts_violation_type").on(table.violationType),
  ],
);
