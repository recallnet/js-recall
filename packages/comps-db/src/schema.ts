import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

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
    }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_teams_active").using(
      "btree",
      table.active.asc().nullsLast().op("bool_ops"),
    ),
    index("idx_teams_api_key").using(
      "btree",
      table.apiKey.asc().nullsLast().op("text_ops"),
    ),
    index("idx_teams_is_admin").using(
      "btree",
      table.isAdmin.asc().nullsLast().op("bool_ops"),
    ),
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
    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_competitions_status").using(
      "btree",
      table.status.asc().nullsLast().op("text_ops"),
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
    }).default(sql`CURRENT_TIMESTAMP`),
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
    }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).default(sql`CURRENT_TIMESTAMP`),
    specificChain: varchar("specific_chain", { length: 20 }),
  },
  (table) => [
    index("idx_balances_specific_chain").using(
      "btree",
      table.specificChain.asc().nullsLast().op("text_ops"),
    ),
    index("idx_balances_team_id").using(
      "btree",
      table.teamId.asc().nullsLast().op("uuid_ops"),
    ),
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
    timestamp: timestamp({ withTimezone: true }).default(
      sql`CURRENT_TIMESTAMP`,
    ),
    fromChain: varchar("from_chain", { length: 10 }),
    toChain: varchar("to_chain", { length: 10 }),
    fromSpecificChain: varchar("from_specific_chain", { length: 20 }),
    toSpecificChain: varchar("to_specific_chain", { length: 20 }),
  },
  (table) => [
    index("idx_trades_competition_id").using(
      "btree",
      table.competitionId.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_trades_from_chain").using(
      "btree",
      table.fromChain.asc().nullsLast().op("text_ops"),
    ),
    index("idx_trades_from_specific_chain").using(
      "btree",
      table.fromSpecificChain.asc().nullsLast().op("text_ops"),
    ),
    index("idx_trades_team_id").using(
      "btree",
      table.teamId.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_trades_timestamp").using(
      "btree",
      table.timestamp.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("idx_trades_to_chain").using(
      "btree",
      table.toChain.asc().nullsLast().op("text_ops"),
    ),
    index("idx_trades_to_specific_chain").using(
      "btree",
      table.toSpecificChain.asc().nullsLast().op("text_ops"),
    ),
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
    timestamp: timestamp({ withTimezone: true }).default(
      sql`CURRENT_TIMESTAMP`,
    ),
    chain: varchar({ length: 10 }),
    specificChain: varchar("specific_chain", { length: 20 }),
  },
  (table) => [
    index("idx_prices_chain").using(
      "btree",
      table.chain.asc().nullsLast().op("text_ops"),
    ),
    index("idx_prices_specific_chain").using(
      "btree",
      table.specificChain.asc().nullsLast().op("text_ops"),
    ),
    index("idx_prices_timestamp").using(
      "btree",
      table.timestamp.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("idx_prices_token").using(
      "btree",
      table.token.asc().nullsLast().op("text_ops"),
    ),
    index("idx_prices_token_chain").using(
      "btree",
      table.token.asc().nullsLast().op("text_ops"),
      table.chain.asc().nullsLast().op("text_ops"),
    ),
    index("idx_prices_token_specific_chain").using(
      "btree",
      table.token.asc().nullsLast().op("text_ops"),
      table.specificChain.asc().nullsLast().op("text_ops"),
    ),
    index("idx_prices_token_timestamp").using(
      "btree",
      table.token.asc().nullsLast().op("timestamptz_ops"),
      table.timestamp.asc().nullsLast().op("timestamptz_ops"),
    ),
  ],
);

export const portfolioSnapshots = pgTable(
  "portfolio_snapshots",
  {
    id: serial().primaryKey().notNull(),
    teamId: uuid("team_id").notNull(),
    competitionId: uuid("competition_id").notNull(),
    timestamp: timestamp({ withTimezone: true }).default(
      sql`CURRENT_TIMESTAMP`,
    ),
    totalValue: numeric("total_value", {
      precision: 30,
      scale: 15,
      mode: "number",
    }).notNull(),
  },
  (table) => [
    index("idx_portfolio_snapshots_team_competition").using(
      "btree",
      table.teamId.asc().nullsLast().op("uuid_ops"),
      table.competitionId.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_portfolio_snapshots_timestamp").using(
      "btree",
      table.timestamp.asc().nullsLast().op("timestamptz_ops"),
    ),
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
    index("idx_portfolio_token_values_snapshot_id").using(
      "btree",
      table.portfolioSnapshotId.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_portfolio_token_values_specific_chain").using(
      "btree",
      table.specificChain.asc().nullsLast().op("text_ops"),
    ),
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
