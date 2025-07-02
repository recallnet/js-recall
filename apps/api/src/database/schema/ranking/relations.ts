import { relations } from "drizzle-orm/relations";

import { agents, competitions } from "@/database/schema/core/defs.js";

import { agentScore, agentScoreHistory } from "./defs.js";

/**
 * Relations for the agentRank table
 */
export const agentRankRelations = relations(agentScore, ({ one }) => ({
  agent: one(agents, {
    fields: [agentScore.agentId],
    references: [agents.id],
  }),
}));

/**
 * Relations for the agentRankHistory table
 */
export const agentRankHistoryRelations = relations(
  agentScoreHistory,
  ({ one }) => ({
    agent: one(agents, {
      fields: [agentScoreHistory.agentId],
      references: [agents.id],
    }),
    competition: one(competitions, {
      fields: [agentScoreHistory.competitionId],
      references: [competitions.id],
    }),
  }),
);
