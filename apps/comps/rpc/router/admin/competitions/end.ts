import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * End a competition
 */
export const endCompetition = base
  .use(adminMiddleware)
  .input(
    z.object({
      competitionId: z.string().uuid(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { competition, leaderboard } =
        await context.competitionService.endCompetition(input.competitionId);
      return { success: true, competition, leaderboard };
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

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

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({ message: "Failed to end competition" });
    }
  });

export type EndCompetitionType = typeof endCompetition;
