import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { CacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { cacheMiddleware, inputTags } from "@/rpc/middleware/cache";

export const getAgent = base
  .use(
    cacheMiddleware({
      revalidateSecs: 30,
      getTags: inputTags<{ agentId: string }>((input) => [
        CacheTags.agent(input.agentId),
      ]),
    }),
  )
  .input(z.object({ agentId: z.string().uuid() }))
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
