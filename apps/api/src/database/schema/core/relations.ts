import { relations } from "drizzle-orm/relations";

import { objectIndex } from "@/database/schema/syncing/defs.js";
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
import {
  agents,
  competitionAgents,
  competitions,
  competitionsLeaderboard,
  users,
  votes,
} from "./defs.js";

export const usersRelations = relations(users, ({ many }) => ({
  agents: many(agents),
  stakes: many(stakes),
  voteAssignments: many(voteAssignments),
  votesAvailable: many(votesAvailable),
  votesPerformed: many(votesPerformed),
  votes: many(votes),
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
  votes: many(votes),
  objectIndexes: many(objectIndex),
}));

export const competitionsRelations = relations(
  competitions,
  ({ one, many }) => ({
    tradingCompetition: one(tradingCompetitions),
    trades: many(trades),
    portfolioSnapshots: many(portfolioSnapshots),
    competitionAgents: many(competitionAgents),
    votes: many(votes),
    objectIndexes: many(objectIndex),
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

export const votesRelations = relations(votes, ({ one }) => ({
  user: one(users, {
    fields: [votes.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [votes.agentId],
    references: [agents.id],
  }),
  competition: one(competitions, {
    fields: [votes.competitionId],
    references: [competitions.id],
  }),
}));

export const competitionsLeaderboardRelations = relations(
  competitionsLeaderboard,
  ({ one }) => ({
    agent: one(agents, {
      fields: [competitionsLeaderboard.agentId],
      references: [agents.id],
    }),
    competition: one(competitions, {
      fields: [competitionsLeaderboard.competitionId],
      references: [competitions.id],
    }),
  }),
);
