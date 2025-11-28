import { ORPCError } from "@orpc/server";

import { AdminEndCompetitionSchema, ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * End a competition
 */
export const endCompetition = base
  .use(adminMiddleware)
  .route({
    method: "POST",
    path: "/admin/competition/end",
    summary: "End a competition",
    description: "End a competition and calculate final results",
    tags: ["admin"],
  })
  .handler(async ({ context, errors }) => {
    const input = AdminEndCompetitionSchema.parse(context.params);

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
