import * as defs from "./defs.js";

export type SelectEpoch = typeof defs.epochs.$inferSelect;
export type InsertEpoch = typeof defs.epochs.$inferInsert;

export type SelectReward = typeof defs.rewards.$inferSelect;
export type InsertReward = typeof defs.rewards.$inferInsert;

export type SelectRewardsTree = typeof defs.rewardsTree.$inferSelect;
export type InsertRewardsTree = typeof defs.rewardsTree.$inferInsert;

export type SelectRewardsRoot = typeof defs.rewardsRoots.$inferSelect;
export type InsertRewardsRoot = typeof defs.rewardsRoots.$inferInsert;
