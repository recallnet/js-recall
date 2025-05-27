import { relations } from "drizzle-orm/relations";

import {
  balances,
  portfolioSnapshots,
  trades,
  tradingCompetitions,
} from "../trading/defs.js";
import { agents, competitionAgents, competitions, users } from "./defs.js";

export const usersRelations = relations(users, ({ many }) => ({
  agents: many(agents),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  owner: one(users, {
    fields: [agents.ownerId],
    references: [users.id],
  }),
  balances: many(balances),
  trades: many(trades),
  portfolioSnapshots: many(portfolioSnapshots),
  competitionAgents: many(competitionAgents),
}));

export const competitionsRelations = relations(
  competitions,
  ({ one, many }) => ({
    tradingCompetition: one(tradingCompetitions),
    trades: many(trades),
    portfolioSnapshots: many(portfolioSnapshots),
    competitionAgents: many(competitionAgents),
  }),
);

export const competitionAgentsRelations = relations(
  competitionAgents,
  ({ one }) => ({
    competition: one(competitions, {
      fields: [competitionAgents.competitionId],
      references: [competitions.id],
    }),
    agent: one(agents, {
      fields: [competitionAgents.agentId],
      references: [agents.id],
    }),
  }),
);
