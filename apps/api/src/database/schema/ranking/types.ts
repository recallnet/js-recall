import * as defs from "./defs.js";

export type SelectAgentRank = typeof defs.agentScore.$inferSelect;
export type InsertAgentRank = typeof defs.agentScore.$inferInsert;

export type SelectAgentRankHistory = typeof defs.agentScoreHistory.$inferSelect;
export type InsertAgentRankHistory = typeof defs.agentScoreHistory.$inferInsert;
