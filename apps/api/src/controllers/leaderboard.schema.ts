import { z } from "zod/v4";

import { COMPETITION_TYPE, COMPETITION_TYPE_VALUES } from "@/types/index.js";

/**
 * Query string parameters for global leaderboard rankings
 */
export const LeaderboardParamsSchema = z.object({
  type: z.enum(COMPETITION_TYPE_VALUES).default(COMPETITION_TYPE.TRADING),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  sort: z.string().optional().default("rank"), // Default to rank ascending
});

export type LeaderboardParams = z.infer<typeof LeaderboardParamsSchema>;
