import { ORPCError } from "@orpc/server";

import { buildPaginationResponse } from "@recallnet/services/lib";
import {
  AgentFilterSchema,
  PagingParamsSchema,
} from "@recallnet/services/types";

import { CacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

export const listAgents = base
  .use(({ next }) =>
    next({
      context: {
        revalidateSecs: 60,
        tags: [CacheTags.agentList()],
        key: undefined,
      },
    }),
  )
  .use(cacheMiddleware)
  .input(
    PagingParamsSchema.extend({
      filter: AgentFilterSchema.optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { filter, limit, offset, sort } = input;

      // Get agents with pagination
      const agents = await context.agentService.getAgents({
        filter,
        pagingParams: { limit, offset, sort },
      });

      // Get total count for pagination metadata
      const totalCount = await context.agentService.countAgents(filter);

      // Return sanitized agents
      return {
        pagination: buildPaginationResponse(totalCount, limit, offset),
        agents: agents.map(
          context.agentService.sanitizeAgent.bind(context.agentService),
        ),
      };
    } catch (error) {
      // Re-throw if already an oRPC error
      if (error instanceof ORPCError) {
        throw error;
      }

      // Handle generic Error instances
      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      // Unknown error type
      throw errors.INTERNAL({ message: "Failed to get agents" });
    }
  });
