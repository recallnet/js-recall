import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const crossChainTradingType = pgEnum("cross_chain_trading_type", [
  "disallowAll",
  "disallowXParent",
  "allow",
]);

export const teams = pgTable(
  "teams",
  {
    id: uuid().primaryKey().notNull(),
    name: varchar({ length: 100 }).notNull(),
    email: varchar({ length: 100 }).notNull(),
    contactPerson: varchar("contact_person", { length: 100 }).notNull(),
    apiKey: varchar("api_key", { length: 400 }).notNull(),
    walletAddress: varchar("wallet_address", { length: 42 }),
    bucketAddresses: text("bucket_addresses").array(),
    metadata: jsonb(),
    isAdmin: boolean("is_admin").default(false),
    active: boolean().default(false),
    deactivationReason: text("deactivation_reason"),
    deactivationDate: timestamp("deactivation_date", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => [
    index("idx_teams_active").on(table.active),
    index("idx_teams_api_key").on(table.apiKey),
    index("idx_teams_is_admin").on(table.isAdmin),
    index("idx_teams_metadata_ref_name").using(
      "btree",
      sql`(((metadata -> 'ref'::text) ->> 'name'::text))`,
    ),
    unique("teams_email_key").on(table.email),
    unique("teams_api_key_key").on(table.apiKey),
    unique("teams_wallet_address_key").on(table.walletAddress),
  ],
);

export const competitions = pgTable(
  "competitions",
  {
    id: uuid().primaryKey().notNull(),
    name: varchar({ length: 100 }).notNull(),
    description: text(),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    status: varchar({ length: 20 }).notNull(),
    crossChainTradingType: crossChainTradingType("cross_chain_trading_type")
      .notNull()
      .default("disallowAll"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => [
    index("idx_competitions_status").on(table.status),
    index("idx_competitions_cross_chain_trading").on(
      table.crossChainTradingType,
    ),
  ],
);

export const competitionTeams = pgTable(
  "competition_teams",
  {
    competitionId: uuid("competition_id").notNull(),
    teamId: uuid("team_id").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.competitionId],
      foreignColumns: [competitions.id],
      name: "competition_teams_competition_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [teams.id],
      name: "competition_teams_team_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.competitionId, table.teamId],
      name: "competition_teams_pkey",
    }),
  ],
);

export const balances = pgTable(
  "balances",
  {
    id: serial().primaryKey().notNull(),
    teamId: uuid("team_id").notNull(),
    tokenAddress: varchar("token_address", { length: 50 }).notNull(),
    amount: numeric({ precision: 30, scale: 15, mode: "number" }).notNull(),
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

export const trades = pgTable(
  "trades",
  {
    id: uuid().primaryKey().notNull(),
    teamId: uuid("team_id").notNull(),
    competitionId: uuid("competition_id").notNull(),
    fromToken: varchar("from_token", { length: 50 }).notNull(),
    toToken: varchar("to_token", { length: 50 }).notNull(),
    fromAmount: numeric("from_amount", {
      precision: 30,
      scale: 15,
      mode: "number",
    }).notNull(),
    toAmount: numeric("to_amount", {
      precision: 30,
      scale: 15,
      mode: "number",
    }).notNull(),
    price: numeric({ precision: 30, scale: 15, mode: "number" }).notNull(),
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

export const prices = pgTable(
  "prices",
  {
    id: serial().primaryKey().notNull(),
    token: varchar({ length: 50 }).notNull(),
    price: numeric({ precision: 30, scale: 15, mode: "number" }).notNull(),
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

export const portfolioSnapshots = pgTable(
  "portfolio_snapshots",
  {
    id: serial().primaryKey().notNull(),
    teamId: uuid("team_id").notNull(),
    competitionId: uuid("competition_id").notNull(),
    timestamp: timestamp({ withTimezone: true }).defaultNow(),
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

export const portfolioTokenValues = pgTable(
  "portfolio_token_values",
  {
    id: serial().primaryKey().notNull(),
    portfolioSnapshotId: integer("portfolio_snapshot_id").notNull(),
    tokenAddress: varchar("token_address", { length: 50 }).notNull(),
    amount: numeric({ precision: 30, scale: 15, mode: "number" }).notNull(),
    valueUsd: numeric("value_usd", {
      precision: 30,
      scale: 15,
      mode: "number",
    }).notNull(),
    price: numeric({ precision: 30, scale: 15, mode: "number" }).notNull(),
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

export type SelectTeam = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;

export type SelectCompetition = typeof competitions.$inferSelect;
export type InsertCompetition = typeof competitions.$inferInsert;

export type SelectCompetitionTeam = typeof competitionTeams.$inferSelect;
export type InsertCompetitionTeam = typeof competitionTeams.$inferInsert;

export type SelectBalance = typeof balances.$inferSelect;
export type InsertBalance = typeof balances.$inferInsert;

export type SelectTrade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;

export type SelectPrice = typeof prices.$inferSelect;
export type InsertPrice = typeof prices.$inferInsert;

export type SelectPortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type InsertPortfolioSnapshot = typeof portfolioSnapshots.$inferInsert;

export type SelectPortfolioTokenValue =
  typeof portfolioTokenValues.$inferSelect;
export type InsertPortfolioTokenValue =
  typeof portfolioTokenValues.$inferInsert;
