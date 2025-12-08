import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError, PagingParamsSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

export const getCompetitions = base
  .input(
    z.object({
      arenaId: z.string(),
      paging: PagingParamsSchema.optional(),
    }),
  )
  .use(
    cacheMiddleware({
      revalidateSecs: 30,
    }),
  )
  .handler(async ({ context, input, errors }) => {
    try {
      const res = await context.competitionService.getCompetitionsByArenaId(
        input.arenaId,
        input.paging || PagingParamsSchema.parse({}),
      );
      return res;
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

      throw errors.INTERNAL({
        message: "Failed to get arena competitions",
      });
    }
  });

export type GetCompetitionsType = typeof getCompetitions;
