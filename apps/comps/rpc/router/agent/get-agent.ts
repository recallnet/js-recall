import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { CacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

export const getAgent = base
  .input(z.object({ agentId: z.string().uuid() }))
  .use(({ next }, input) =>
    next({
      context: {
        revalidateSecs: 30,
        tags: [CacheTags.agent(input.agentId)],
        key: undefined,
      },
    }),
  )
  .use(cacheMiddleware)
  .handler(async ({ input, context, errors }) => {
    try {
      const { agentId } = input;

      // Get the agent using the service
      const agent = await context.agentService.getAgent(agentId);

      if (!agent) {
        throw errors.NOT_FOUND({ message: "Agent not found" });
      }

      // Get the owner user information
      const owner = await context.userService.getUser(agent.ownerId);

      // Prepare owner info for public display (null if user not found)
      const ownerInfo = owner
        ? {
            id: owner.id,
            name: owner.name || null,
            walletAddress: owner.walletAddress,
          }
        : null;

      const sanitizedAgent = context.agentService.sanitizeAgent(agent);
      const computedAgent =
        await context.agentService.attachAgentMetrics(sanitizedAgent);

      // Return the agent with owner information
      return {
        agent: computedAgent,
        owner: ownerInfo,
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
      throw errors.INTERNAL({ message: "Failed to get agent" });
    }
  });
