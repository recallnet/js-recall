import { ORPCError } from "@orpc/server";

import { ApiError, LeaderboardParamsSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

/**
 * Get global leaderboard across all relevant competitions matching a specific competition type
 * or arena-specific leaderboard if arenaId is provided
 */
export const getGlobal = base
  .use(
    cacheMiddleware({
      revalidateSecs: 30,
    }),
  )
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

      // Handle ApiError instances from service layer
      if (error instanceof ApiError) {
        switch (error.statusCode) {
          case 400:
            throw errors.BAD_REQUEST({ message: error.message });
          case 404:
            throw errors.NOT_FOUND({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      // Handle generic Error instances
      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      // Unknown error type
      throw errors.INTERNAL({ message: "Failed to get global leaderboard" });
    }
  });
