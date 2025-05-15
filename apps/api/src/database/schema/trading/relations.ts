import { relations } from "drizzle-orm/relations";

import { competitions, teams } from "../core/defs.js";
import {
  balances,
  portfolioSnapshots,
  portfolioTokenValues,
  trades,
  tradingCompetitions,
} from "./defs.js";

export const tradingCompetitionsRelations = relations(
  tradingCompetitions,
  ({ one }) => ({
    competition: one(competitions, {
      fields: [tradingCompetitions.competitionId],
      references: [competitions.id],
    }),
  }),
);

export const balancesRelations = relations(balances, ({ one }) => ({
  team: one(teams, {
    fields: [balances.teamId],
    references: [teams.id],
  }),
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
