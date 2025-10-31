import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { buildPaginationResponse } from "@recallnet/services/lib";
import {
  AgentCompetitionsFiltersSchema,
  ApiError,
  PagingParamsSchema,
  UuidSchema,
} from "@recallnet/services/types";

import { CacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

const GetAgentCompetitionsInputSchema = z.object({
  agentId: UuidSchema,
  filters: AgentCompetitionsFiltersSchema,
  paging: PagingParamsSchema,
});

/**
 * Get competitions for a specific agent
 */
export const getCompetitions = base
  .input(GetAgentCompetitionsInputSchema)
  .use(({ next }, input) =>
    next({
      context: {
        revalidateSecs: 30,
        tags: [CacheTags.agentCompetitions(input.agentId)],
        key: undefined,
      },
    }),
  )
  .use(cacheMiddleware)
  .handler(async ({ input, context, errors }) => {
    try {
      const { agentId, filters, paging } = input;

      const results = await context.agentService.getCompetitionsForAgent(
        agentId,
        filters,
        paging,
      );

      return {
        competitions: results.competitions,
        pagination: buildPaginationResponse(
          results.total,
          paging.limit,
          paging.offset,
        ),
      };
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
      throw errors.INTERNAL({ message: "Failed to get agent competitions" });
    }
  });
