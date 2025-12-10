import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError, PagingParamsSchema } from "@recallnet/services/types";

import { CacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

const GetPublicAgentsInputSchema = z.object({
  userId: z.uuid(),
  paging: PagingParamsSchema.optional(),
});

/**
 * Get agents owned by a user (public endpoint)
 * Returns sanitized agent data without sensitive fields
 */
export const getPublicAgents = base
  .input(GetPublicAgentsInputSchema)
  .use(
    cacheMiddleware({
      revalidateSecs: 60,
      getTags: (input) => [CacheTags.publicUserAgents(input.userId)],
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { userId, paging } = input;

      // Verify user exists
      const user = await context.userService.getUser(userId);
      if (!user) {
        throw errors.NOT_FOUND({ message: "User not found" });
      }

      // Get agents owned by this user
      const agents = await context.agentService.getAgentsByOwner(
        userId,
        paging ?? { limit: 100, offset: 0, sort: "-createdAt" },
      );

      // Sanitize agents (removes API key and other sensitive fields)
      const sanitizedAgents = agents.map((agent) =>
        context.agentService.sanitizeAgent(agent),
      );

      // Attach metrics to agents
      const agentsWithMetrics =
        await context.agentService.attachBulkAgentMetrics(sanitizedAgents);

      return {
        userId,
        agents: agentsWithMetrics,
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
          case 409:
            throw errors.CONFLICT({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      // Handle generic Error instances
      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      // Unknown error type
      throw errors.INTERNAL({ message: "Failed to get public user agents" });
    }
  });
