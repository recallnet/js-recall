import { relations } from "drizzle-orm/relations";

import {
  balances,
  portfolioSnapshots,
  trades,
  tradingCompetitions,
} from "../trading/defs.js";
import { competitionTeams, competitions, teams } from "./defs.js";

export const teamsRelations = relations(teams, ({ many }) => ({
  balances: many(balances),
  trades: many(trades),
  portfolioSnapshots: many(portfolioSnapshots),
  competitionTeams: many(competitionTeams),
}));

export const competitionsRelations = relations(
  competitions,
  ({ one, many }) => ({
    tradingCompetition: one(tradingCompetitions),
    trades: many(trades),
    portfolioSnapshots: many(portfolioSnapshots),
    competitionTeams: many(competitionTeams),
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
