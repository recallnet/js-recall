import { ORPCError } from "@orpc/server";

import { LeaderboardParamsSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

/**
 * Get global leaderboard across all relevant competitions matching a specific competition type
 *
 * Note: LeaderboardService.getGlobalLeaderboardForType never throws errors.
 * It returns an empty response as fallback on any failure.
 */
export const getGlobal = base
  .use(({ next }) =>
    next({
      context: {
        revalidateSecs: 30,
        tags: undefined,
        key: undefined,
      },
    }),
  )
  .use(cacheMiddleware)
  .input(LeaderboardParamsSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      return await context.leaderboardService.getGlobalLeaderboardForType(
        input,
      );
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
