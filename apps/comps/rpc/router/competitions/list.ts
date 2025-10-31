import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import {
  ApiError,
  CompetitionStatusSchema,
  PagingParamsSchema,
} from "@recallnet/services/types";

import { CacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

export const list = base
  .input(
    z.object({
      status: CompetitionStatusSchema,
      paging: PagingParamsSchema.optional(),
    }),
  )
  .use(({ next }) =>
    next({
      context: {
        revalidateSecs: 30, // 30 seconds
        tags: [CacheTags.competitionList()],
        key: undefined,
      },
    }),
  )
  .use(cacheMiddleware)
  .handler(async ({ context, input, errors }) => {
    try {
      const res = await context.competitionService.getEnrichedCompetitions({
        status: input.status,
        pagingParams: input.paging || PagingParamsSchema.parse({}),
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
      throw errors.INTERNAL({ message: "Failed to list competitions." });
    }
  });

export type ListType = typeof list;
