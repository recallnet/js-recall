import { createUpdateSchema } from "drizzle-zod";
import { z } from "zod/v4";

import * as defs from "./defs.js";

export type SelectUser = typeof defs.users.$inferSelect;
export type InsertUser = typeof defs.users.$inferInsert;

export type SelectAgent = typeof defs.agents.$inferSelect;
export type InsertAgent = typeof defs.agents.$inferInsert;

/**
 * Agent with competition-specific status fields
 * Used when querying agents within a specific competition context
 */
export type SelectAgentWithCompetitionStatus = SelectAgent & {
  competitionStatus: string;
  competitionDeactivationReason: string | null;
};

export type SelectAdmin = typeof defs.admins.$inferSelect;
export type InsertAdmin = typeof defs.admins.$inferInsert;

export type SelectArena = typeof defs.arenas.$inferSelect;
export type InsertArena = typeof defs.arenas.$inferInsert;

export type SelectCompetition = typeof defs.competitions.$inferSelect;
export type InsertCompetition = typeof defs.competitions.$inferInsert;
export const UpdateCompetitionSchema = createUpdateSchema(defs.competitions);
export type UpdateCompetition = z.infer<typeof UpdateCompetitionSchema>;

export type SelectCompetitionPartner =
  typeof defs.competitionPartners.$inferSelect;
export type InsertCompetitionPartner =
  typeof defs.competitionPartners.$inferInsert;

export type SelectCompetitionAgent = typeof defs.competitionAgents.$inferSelect;
export type InsertCompetitionAgent = typeof defs.competitionAgents.$inferInsert;

export type SelectCompetitionsLeaderboard =
  typeof defs.competitionsLeaderboard.$inferSelect;
export type InsertCompetitionsLeaderboard =
  typeof defs.competitionsLeaderboard.$inferInsert;

export type SelectCompetitionReward =
  typeof defs.competitionRewards.$inferSelect;
export type InsertCompetitionReward =
  typeof defs.competitionRewards.$inferInsert;

export type SelectCompetitionPrizePool =
  typeof defs.competitionPrizePools.$inferSelect;
export type InsertCompetitionPrizePool =
  typeof defs.competitionPrizePools.$inferInsert;
