import { relations } from "drizzle-orm/relations";

import { agents, competitions } from "../core/defs.js";
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
  agent: one(agents, {
    fields: [balances.agentId],
    references: [agents.id],
  }),
}));

export const tradesRelations = relations(trades, ({ one }) => ({
  agent: one(agents, {
    fields: [trades.agentId],
    references: [agents.id],
  }),
  competition: one(competitions, {
    fields: [trades.competitionId],
    references: [competitions.id],
  }),
}));

export const portfolioSnapshotsRelations = relations(
  portfolioSnapshots,
  ({ one, many }) => ({
    agent: one(agents, {
      fields: [portfolioSnapshots.agentId],
      references: [agents.id],
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
