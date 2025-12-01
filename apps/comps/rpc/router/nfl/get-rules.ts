import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { CacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

export const getRules = base
  .input(
    z.object({
      competitionId: z.uuid(),
    }),
  )
  .use(
    cacheMiddleware({
      revalidateSecs: 300,
      getTags: (input) => [
        CacheTags.competition(input.competitionId),
        `nfl-rules-${input.competitionId}`,
      ],
    }),
  )
  .handler(async ({ context, input, errors }) => {
    try {
      const rules = await context.sportsService.gamePredictionService.getRules(
        input.competitionId,
      );
      return rules;
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

      throw errors.INTERNAL({ message: "Failed to get rules." });
    }
  });

export type GetRulesType = typeof getRules;
