import { ORPCError } from "@orpc/server";

import {
  AdminStartCompetitionSchema,
  ApiError,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Start a competition
 */
export const startCompetition = base
  .use(adminMiddleware)
  .input(AdminStartCompetitionSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      const { competitionId, agentIds, tradingConstraints, ...creationFields } =
        input;

      const competition =
        await context.competitionService.startOrCreateCompetition({
          competitionId,
          agentIds,
          tradingConstraints,
          creationParams: competitionId
            ? undefined
            : {
                ...creationFields,
                name: creationFields.name!,
                arenaId: creationFields.arenaId!,
                startDate: creationFields.startDate,
                endDate: creationFields.endDate,
                boostStartDate: creationFields.boostStartDate,
                boostEndDate: creationFields.boostEndDate,
                joinStartDate: creationFields.joinStartDate,
                joinEndDate: creationFields.joinEndDate,
              },
        });

      return { success: true, competition };
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

      throw errors.INTERNAL({ message: "Failed to start competition" });
    }
  });

export type StartCompetitionType = typeof startCompetition;
