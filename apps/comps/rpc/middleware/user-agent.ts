import { base } from "@/rpc/context/base";

import { authMiddleware } from "./auth";

/**
 * Middleware that verifies a user owns a specific agent
 * Requires authenticated user in context
 * Takes agentId as input and adds the verified agent to context
 */
export const userAgentMiddleware = base
  .middleware(authMiddleware)
  .concat(async ({ context, next, errors }, input: { agentId: string }) => {
    // Get the agent
    const agent = await context.agentService.getAgent(input.agentId);

    if (!agent) {
      throw errors.NOT_FOUND({ message: "Agent not found" });
    }

    // Verify ownership
    if (agent.ownerId !== context.user.id) {
      throw errors.UNAUTHORIZED({
        message: "Access denied: You don't own this agent",
      });
    }

    return await next({
      context: {
        agent,
      },
    });
  });
