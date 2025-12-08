import { relations } from "drizzle-orm/relations";

import { rewards, rewardsRoots, rewardsTree } from "../rewards/defs.js";
import {
  balances,
  portfolioSnapshots,
  trades,
  tradingCompetitions,
} from "../trading/defs.js";
import {
  agents,
  arenas,
  competitionAgents,
  competitionPartners,
  competitionRewards,
  competitions,
  competitionsLeaderboard,
  partners,
  users,
} from "./defs.js";

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

export const arenasRelations = relations(arenas, ({ many }) => ({
  competitions: many(competitions),
}));

export const competitionsRelations = relations(
  competitions,
  ({ one, many }) => ({
    arena: one(arenas, {
      fields: [competitions.arenaId],
      references: [arenas.id],
    }),
    tradingCompetition: one(tradingCompetitions),
    partners: many(competitionPartners),
    trades: many(trades),
    portfolioSnapshots: many(portfolioSnapshots),
    competitionAgents: many(competitionAgents),
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

export const partnersRelations = relations(partners, ({ many }) => ({
  competitionPartners: many(competitionPartners),
}));

export const competitionPartnersRelations = relations(
  competitionPartners,
  ({ one }) => ({
    competition: one(competitions, {
      fields: [competitionPartners.competitionId],
      references: [competitions.id],
    }),
    partner: one(partners, {
      fields: [competitionPartners.partnerId],
      references: [partners.id],
    }),
  }),
);
