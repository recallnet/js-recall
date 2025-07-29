import { createUpdateSchema } from "drizzle-zod";
import { z } from "zod/v4";

import * as defs from "./defs.js";

export type SelectUser = typeof defs.users.$inferSelect;
export type InsertUser = typeof defs.users.$inferInsert;

export type SelectAgent = typeof defs.agents.$inferSelect;
export type InsertAgent = typeof defs.agents.$inferInsert;

export type SelectAdmin = typeof defs.admins.$inferSelect;
export type InsertAdmin = typeof defs.admins.$inferInsert;

export type SelectCompetition = typeof defs.competitions.$inferSelect;
export type InsertCompetition = typeof defs.competitions.$inferInsert;
export const UpdateCompetitionSchema = createUpdateSchema(defs.competitions);
export type UpdateCompetition = z.infer<typeof UpdateCompetitionSchema>;

export type SelectCompetitionAgent = typeof defs.competitionAgents.$inferSelect;
export type InsertCompetitionAgent = typeof defs.competitionAgents.$inferInsert;

export type SelectVote = typeof defs.votes.$inferSelect;
export type InsertVote = typeof defs.votes.$inferInsert;

export type SelectCompetitionsLeaderboard =
  typeof defs.competitionsLeaderboard.$inferSelect;
export type InsertCompetitionsLeaderboard =
  typeof defs.competitionsLeaderboard.$inferInsert;

export type SelectEmailVerificationToken =
  typeof defs.emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken =
  typeof defs.emailVerificationTokens.$inferInsert;

export type SelectReward = typeof defs.rewards.$inferSelect;
export type InsertReward = typeof defs.rewards.$inferInsert;
