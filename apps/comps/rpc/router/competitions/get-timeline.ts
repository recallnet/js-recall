import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError, BucketParamSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

/**
 * Get competition timeline data for portfolio value over time
 *
 * @param input.competitionId - The UUID of the competition
 * @param input.bucket - Time bucket interval in minutes
 * @returns Array of timeline entries, one per agent, with timestamps and portfolio values
 */
export const getTimeline = base
  .input(
    z.object({
      competitionId: z.uuid(),
      bucket: BucketParamSchema.optional(),
    }),
  )
  .use(async ({ context, next }, input) => {
    const comp = await context.competitionService.getCompetitionById({
      competitionId: input.competitionId,
    });
    return next({
      context: {
        revalidateSecs: comp.competition.status === "active" ? 30 : 60 * 60,
        key: undefined,
        tags: undefined,
      },
    });
  })
  .use(cacheMiddleware)
  .handler(async ({ context, input, errors }) => {
    try {
      const bucket = input.bucket ?? BucketParamSchema.parse(undefined);
      const timeline = await context.competitionService.getCompetitionTimeline(
        input.competitionId,
        bucket,
      );
      return timeline;
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
        message: "Failed to get competition timeline.",
      });
    }
  });

export type GetTimelineType = typeof getTimeline;
