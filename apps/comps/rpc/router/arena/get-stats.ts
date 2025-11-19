import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

/**
 * Get arena statistics (avg score, top score, total agents)
 */
export const getStats = base
  .input(
    z.object({
      arenaId: z.string(),
    }),
  )
  .use(
    cacheMiddleware({
      revalidateSecs: 60, // 1 minute - stats don't change frequently
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      return await context.leaderboardService.getArenaStats(input.arenaId);
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
      throw errors.INTERNAL({ message: "Failed to get arena stats" });
    }
  });

export type GetStatsType = typeof getStats;
