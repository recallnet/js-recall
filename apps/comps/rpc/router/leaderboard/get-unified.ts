import { ORPCError } from "@orpc/server";

import { BenchmarkLeaderboardData } from "@recallnet/services/types";

import benchmarkData from "@/public/data/benchmark-leaderboard.json";
import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

/**
 * Get unified leaderboard combining benchmark models with trading/futures agents
 * Loads benchmark data from static JSON file and combines with live trading data
 */
export const getUnified = base
  .use(({ next }) =>
    next({
      context: {
        revalidateSecs: 60,
        tags: undefined,
        key: undefined,
      },
    }),
  )
  .use(cacheMiddleware)
  .handler(async ({ context, errors }) => {
    try {
      // Call service to build unified leaderboard with imported benchmark data
      return await context.leaderboardService.getUnifiedLeaderboard(
        benchmarkData as unknown as BenchmarkLeaderboardData,
      );
    } catch (error) {
      // Re-throw if already an oRPC error
      if (error instanceof ORPCError) {
        throw error;
      }

      // Handle unexpected errors
      if (error instanceof Error) {
        context.logger.error(
          "[getUnified] Failed to get unified leaderboard:",
          error,
        );
        throw errors.INTERNAL({ message: error.message });
      }

      // Unknown error type
      throw errors.INTERNAL({
        message: "Failed to get unified leaderboard",
      });
    }
  });
