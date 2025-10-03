import { LeaderboardParamsSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";

/**
 * Get global leaderboard across all relevant competitions
 *
 * Note: LeaderboardService.getGlobalLeaderboard never throws errors.
 * It returns an empty response as fallback on any failure.
 */
export const getGlobal = base
  .input(LeaderboardParamsSchema)
  .handler(async ({ input, context }) => {
    return await context.leaderboardService.getGlobalLeaderboard(input);
  });
