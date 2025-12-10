import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

/**
 * Get EigenAI verification statistics for a competition
 */
export const getCompetitionStats = base
  .input(
    z.object({
      competitionId: z.uuid(),
    }),
  )
  .use(
    cacheMiddleware({
      revalidateSecs: 60,
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      return await context.eigenaiService.getCompetitionStats(
        input.competitionId,
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
      throw errors.INTERNAL({
        message: "Failed to get EigenAI competition stats",
      });
    }
  });

export type GetCompetitionStatsType = typeof getCompetitionStats;
