import * as defs from "./defs.js";

export type SelectEpoch = typeof defs.epochs.$inferSelect;
export type InsertEpoch = typeof defs.epochs.$inferInsert;

export type SelectStake = typeof defs.stakes.$inferSelect;
export type InsertStake = typeof defs.stakes.$inferInsert;

export type SelectVoteAssignment = typeof defs.voteAssignments.$inferSelect;
export type InsertVoteAssignment = typeof defs.voteAssignments.$inferInsert;

export type SelectVotesAvailable = typeof defs.votesAvailable.$inferSelect;
export type InsertVotesAvailable = typeof defs.votesAvailable.$inferInsert;

export type SelectVotesPerformed = typeof defs.votesPerformed.$inferSelect;
export type InsertVotesPerformed = typeof defs.votesPerformed.$inferInsert;

export type SelectReward = typeof defs.rewards.$inferSelect;
export type InsertReward = typeof defs.rewards.$inferInsert;

export type SelectRewardsTree = typeof defs.rewardsTree.$inferSelect;
export type InsertRewardsTree = typeof defs.rewardsTree.$inferInsert;

export type SelectRewardsRoot = typeof defs.rewardsRoots.$inferSelect;
export type InsertRewardsRoot = typeof defs.rewardsRoots.$inferInsert;
