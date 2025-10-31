import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

export const getRules = base
  .use(({ next }) =>
    next({
      context: {
        revalidateSecs: 60 * 5, // 5 minutes
        tags: undefined,
        key: undefined,
      },
    }),
  )
  .use(cacheMiddleware)
  .input(
    z.object({
      competitionId: z.string().uuid(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    try {
      const result = await context.competitionService.getCompetitionRules(
        input.competitionId,
      );

      return result.rules;
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
      throw errors.INTERNAL({ message: "Failed to get competition rules." });
    }
  });

export type GetRulesType = typeof getRules;
