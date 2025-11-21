import * as defs from "./defs.js";

export type SelectAgentBoostTotal = typeof defs.agentBoostTotals.$inferSelect;
export type InsertAgentBoostTotal = typeof defs.agentBoostTotals.$inferInsert;

export type SelectAgentBoost = typeof defs.agentBoosts.$inferSelect;
export type InsertAgentBoost = typeof defs.agentBoosts.$inferInsert;

export type SelectStakeBoostAward = typeof defs.stakeBoostAwards.$inferSelect;
export type InsertStakeBoostAward = typeof defs.stakeBoostAwards.$inferInsert;

export type SelectBoostBonus = typeof defs.boostBonus.$inferSelect;
export type InsertBoostBonus = typeof defs.boostBonus.$inferInsert;
