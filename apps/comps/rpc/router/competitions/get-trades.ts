import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { buildPaginationResponse } from "@recallnet/services/lib";
import { ApiError, PagingParamsSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

export const getTrades = base
  .use(
    cacheMiddleware({
      revalidateSecs: 30,
    }),
  )
  .input(
    z.object({
      competitionId: z.uuid(),
      paging: PagingParamsSchema.optional(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    try {
      const pagingParams = input.paging || PagingParamsSchema.parse({});

      const result = await context.competitionService.getCompetitionTrades({
        competitionId: input.competitionId,
        pagingParams,
      });

      return {
        trades: result.trades,
        pagination: buildPaginationResponse(
          result.total,
          pagingParams.limit,
          pagingParams.offset,
        ),
      };
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

      throw errors.INTERNAL({ message: "Failed to get competition trades" });
    }
  });

export type GetTradesType = typeof getTrades;
