import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError, PagingParamsSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

export const getAgents = base
  .use(
    cacheMiddleware({
      revalidateSecs: 20,
    }),
  )
  .input(
    z.object({
      competitionId: z.uuid(),
      paging: PagingParamsSchema.optional(),
      includeInactive: z.boolean().optional(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    try {
      const res = await context.competitionService.getCompetitionAgents({
        competitionId: input.competitionId,
        queryParams: {
          ...(input.paging || PagingParamsSchema.parse({})),
          includeInactive: input.includeInactive ?? false,
        },
      });
      return res;
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
      throw errors.INTERNAL({ message: "Failed to get agents." });
    }
  });

export type GetAgentsType = typeof getAgents;
