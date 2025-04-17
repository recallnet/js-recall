import { relations } from "drizzle-orm";
import {
  boolean,
  pgTable,
  primaryKey,
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

export type SelectTeam = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;

export type SelectCompetition = typeof competitions.$inferSelect;
export type InsertCompetition = typeof competitions.$inferInsert;

export type SelectCompetitionTeam = typeof competitionTeams.$inferSelect;
export type InsertCompetitionTeam = typeof competitionTeams.$inferInsert;
