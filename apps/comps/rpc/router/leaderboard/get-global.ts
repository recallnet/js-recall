import { ORPCError } from "@orpc/server";

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
  .handler(async ({ input, context, errors }) => {
    try {
      return await context.leaderboardService.getGlobalLeaderboard(input);
    } catch (error) {
      // Re-throw if already an oRPC error
      if (error instanceof ORPCError) {
        throw error;
      }

      // Handle generic Error instances
      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      // Unknown error type
      throw errors.INTERNAL({ message: "Failed to get global leaderboard" });
    }
  });
