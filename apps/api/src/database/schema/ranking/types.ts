import * as defs from "./defs.js";

export type SelectAgentScore = typeof defs.agentScore.$inferSelect;
export type InsertAgentScore = typeof defs.agentScore.$inferInsert;

export type SelectAgentScoreHistory =
  typeof defs.agentScoreHistory.$inferSelect;
export type InsertAgentScoreHistory =
  typeof defs.agentScoreHistory.$inferInsert;
