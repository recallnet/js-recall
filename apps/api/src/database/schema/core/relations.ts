import { relations } from "drizzle-orm/relations";

import {
  rewards,
  rewardsRoots,
  rewardsTree,
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
  competitionRewards,
  competitions,
  competitionsLeaderboard,
  users,
  votes,
} from "./defs.js";

export const usersRelations = relations(users, ({ many }) => ({
  agents: many(agents),
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
}));

export const competitionsRelations = relations(
  competitions,
  ({ one, many }) => ({
    tradingCompetition: one(tradingCompetitions),
    trades: many(trades),
    portfolioSnapshots: many(portfolioSnapshots),
    competitionAgents: many(competitionAgents),
    votes: many(votes),
    rewards: many(rewards),
    rewardsTree: many(rewardsTree),
    rewardsRoots: many(rewardsRoots),
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

export const competitionRewardsRelations = relations(
  competitionRewards,
  ({ one }) => ({
    competition: one(competitions, {
      fields: [competitionRewards.competitionId],
      references: [competitions.id],
    }),
    agent: one(agents, {
      fields: [competitionRewards.agentId],
      references: [agents.id],
    }),
  }),
);
