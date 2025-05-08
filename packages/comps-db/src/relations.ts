import { relations } from "drizzle-orm/relations";

import {
  balances,
  competitionTeams,
  competitions,
  portfolioSnapshots,
  portfolioTokenValues,
  teams,
  trades,
} from "./schema.js";

export const balancesRelations = relations(balances, ({ one }) => ({
  team: one(teams, {
    fields: [balances.teamId],
    references: [teams.id],
  }),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  balances: many(balances),
  trades: many(trades),
  portfolioSnapshots: many(portfolioSnapshots),
  competitionTeams: many(competitionTeams),
}));

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

export const competitionsRelations = relations(competitions, ({ many }) => ({
  trades: many(trades),
  portfolioSnapshots: many(portfolioSnapshots),
  competitionTeams: many(competitionTeams),
}));

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
    portfolioTokenValues: many(portfolioTokenValues),
  }),
);

export const portfolioTokenValuesRelations = relations(
  portfolioTokenValues,
  ({ one }) => ({
    portfolioSnapshot: one(portfolioSnapshots, {
      fields: [portfolioTokenValues.portfolioSnapshotId],
      references: [portfolioSnapshots.id],
    }),
  }),
);

export const competitionTeamsRelations = relations(
  competitionTeams,
  ({ one }) => ({
    competition: one(competitions, {
      fields: [competitionTeams.competitionId],
      references: [competitions.id],
    }),
    team: one(teams, {
      fields: [competitionTeams.teamId],
      references: [teams.id],
    }),
  }),
);
