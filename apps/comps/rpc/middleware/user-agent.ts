import { authMiddleware } from "./auth";

/**
 * Middleware that verifies a user owns a specific agent
 * Requires authenticated user in context
 * Takes agentId as input and adds the verified agent to context
 */
export const userAgentMiddleware = authMiddleware.use(
  async ({ context, next, errors }, input) => {
    const { agentId } = input as { agentId: string };

    // Get the agent
    const agent = await context.agentService.getAgent(agentId);

    if (!agent) {
      throw errors.NOT_FOUND({ message: "Agent not found" });
    }

    // Verify ownership
    if (agent.ownerId !== context.user.id) {
      throw errors.UNAUTHORIZED({
        message: "Access denied: You don't own this agent",
      });
    }

    return next({
      context: {
        agent,
      },
    });
  },
);
