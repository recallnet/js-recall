import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Teams table
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 100 }).notNull().unique(),
  contactPerson: varchar("contact_person", { length: 100 }).notNull(),
  apiKey: varchar("api_key", { length: 400 }).notNull().unique(),
  walletAddress: varchar("wallet_address", { length: 42 }).unique(),
  bucketAddresses: text("bucket_addresses").array(),
  metadata: jsonb("metadata"),
  isAdmin: boolean("is_admin").default(false),
  active: boolean("active").default(false),
  deactivationReason: text("deactivation_reason"),
  deactivationDate: timestamp("deactivation_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Teams relations
export const teamsRelations = relations(teams, ({ many }) => ({
  competitionTeams: many(competitionTeams),
  balances: many(balances),
  trades: many(trades),
  portfolioSnapshots: many(portfolioSnapshots),
}));

// Competitions table
export const competitions = pgTable("competitions", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  status: varchar("status", { length: 20 }).notNull(), // PENDING, ACTIVE, COMPLETED
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Competitions relations
export const competitionsRelations = relations(competitions, ({ many }) => ({
  competitionTeams: many(competitionTeams),
  trades: many(trades),
  portfolioSnapshots: many(portfolioSnapshots),
}));

// Competition Teams junction table
export const competitionTeams = pgTable(
  "competition_teams",
  {
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.competitionId, table.teamId] })],
);

// Competition Teams relations
export const competitionTeamsRelations = relations(
  competitionTeams,
  ({ one }) => ({
    team: one(teams, {
      fields: [competitionTeams.teamId],
      references: [teams.id],
    }),
    competition: one(competitions, {
      fields: [competitionTeams.competitionId],
      references: [competitions.id],
    }),
  }),
);

// Balances table
export const balances = pgTable("balances", {
  id: serial("id").primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  tokenAddress: varchar("token_address", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 30, scale: 15 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  specificChain: varchar("specific_chain", { length: 20 }),
});

// Balances relations
export const balancesRelations = relations(balances, ({ one }) => ({
  team: one(teams, {
    fields: [balances.teamId],
    references: [teams.id],
  }),
}));

// Trades table
export const trades = pgTable("trades", {
  id: uuid("id").primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  competitionId: uuid("competition_id")
    .notNull()
    .references(() => competitions.id, { onDelete: "cascade" }),
  fromToken: varchar("from_token", { length: 50 }).notNull(),
  toToken: varchar("to_token", { length: 50 }).notNull(),
  fromAmount: decimal("from_amount", { precision: 30, scale: 15 }).notNull(),
  toAmount: decimal("to_amount", { precision: 30, scale: 15 }).notNull(),
  price: decimal("price", { precision: 30, scale: 15 }).notNull(),
  success: boolean("success").notNull(),
  error: text("error"),
  reason: text("reason").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  fromChain: varchar("from_chain", { length: 10 }),
  toChain: varchar("to_chain", { length: 10 }),
  fromSpecificChain: varchar("from_specific_chain", { length: 20 }),
  toSpecificChain: varchar("to_specific_chain", { length: 20 }),
});

// Trades relations
export const tradesRelations = relations(trades, ({ one }) => ({
  team: one(teams, {
    fields: [trades.teamId],
    references: [teams.id],
  }),
  competition: one(competitions, {
    fields: [trades.competitionId],
    references: [competitions.id],
  }),
}));

// Prices table
export const prices = pgTable("prices", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 50 }).notNull(),
  price: decimal("price", { precision: 30, scale: 15 }).notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  chain: varchar("chain", { length: 10 }),
  specificChain: varchar("specific_chain", { length: 20 }),
});

// Portfolio Snapshots table
export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: serial("id").primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  competitionId: uuid("competition_id")
    .notNull()
    .references(() => competitions.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  totalValue: decimal("total_value", { precision: 30, scale: 15 }).notNull(),
});

// Portfolio Snapshots relations
export const portfolioSnapshotsRelations = relations(
  portfolioSnapshots,
  ({ one, many }) => ({
    team: one(teams, {
      fields: [portfolioSnapshots.teamId],
      references: [teams.id],
    }),
    competition: one(competitions, {
      fields: [portfolioSnapshots.competitionId],
      references: [competitions.id],
    }),
    tokenValues: many(portfolioTokenValues),
  }),
);

// Portfolio Token Values table
export const portfolioTokenValues = pgTable("portfolio_token_values", {
  id: serial("id").primaryKey(),
  portfolioSnapshotId: serial("portfolio_snapshot_id")
    .notNull()
    .references(() => portfolioSnapshots.id, { onDelete: "cascade" }),
  tokenAddress: varchar("token_address", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 30, scale: 15 }).notNull(),
  valueUsd: decimal("value_usd", { precision: 30, scale: 15 }).notNull(),
  price: decimal("price", { precision: 30, scale: 15 }).notNull(),
  specificChain: varchar("specific_chain", { length: 20 }),
});

// Portfolio Token Values relations
export const portfolioTokenValuesRelations = relations(
  portfolioTokenValues,
  ({ one }) => ({
    portfolioSnapshot: one(portfolioSnapshots, {
      fields: [portfolioTokenValues.portfolioSnapshotId],
      references: [portfolioSnapshots.id],
    }),
  }),
);

// Type exports
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
