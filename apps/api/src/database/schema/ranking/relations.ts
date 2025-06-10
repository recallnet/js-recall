import { relations } from "drizzle-orm/relations";

import { agents, competitions } from "@/database/schema/core/defs.js";

import { agentRank, agentRankHistory } from "./defs.js";

/**
 * Relations for the agentRank table
 */
export const agentRankRelations = relations(agentRank, ({ one }) => ({
  agent: one(agents, {
    fields: [agentRank.agentId],
    references: [agents.id],
  }),
}));

/**
 * Relations for the agentRankHistory table
 */
export const agentRankHistoryRelations = relations(
  agentRankHistory,
  ({ one }) => ({
    agent: one(agents, {
      fields: [agentRankHistory.agentId],
      references: [agents.id],
    }),
    competition: one(competitions, {
      fields: [agentRankHistory.competitionId],
      references: [competitions.id],
    }),
  }),
);
