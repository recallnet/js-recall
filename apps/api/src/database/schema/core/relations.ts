import { relations } from "drizzle-orm/relations";

import {
  stakes,
  voteAssignments,
  votesAvailable,
  votesPerformed,
} from "@/database/schema/voting/defs.js";

import {
  balances,
  portfolioSnapshots,
  trades,
  tradingCompetitions,
} from "../trading/defs.js";
import { agents, competitionAgents, competitions, users } from "./defs.js";

export const usersRelations = relations(users, ({ many }) => ({
  agents: many(agents),
  stakes: many(stakes),
  voteAssignments: many(voteAssignments),
  votesAvailable: many(votesAvailable),
  votesPerformed: many(votesPerformed),
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
