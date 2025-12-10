import { AdminReactivateAgentParamsSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Reactivate an agent
 */
export const reactivateAgent = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminReactivateAgentParamsSchema)
  .route({
    method: "POST",
    path: "/admin/agents/{agentId}/reactivate",
    summary: "Reactivate agent",
    description: "Reactivate a previously deactivated agent",
    tags: ["admin"],
  })
  .handler(async ({ context, input, errors }) => {
    // Get the agent first to check if it exists and is actually inactive
    const agent = await context.agentService.getAgent(input.agentId);

    if (!agent) {
      throw errors.NOT_FOUND({ message: "Agent not found" });
    }

    // Check if agent is already active
    if (agent.status === "active") {
      throw errors.BAD_REQUEST({
        message: "Agent is already active",
      });
    }

    // Reactivate the agent
    const reactivatedAgent = await context.agentService.reactivateAgent(
      input.agentId,
    );

    if (!reactivatedAgent) {
      throw errors.INTERNAL({ message: "Failed to reactivate agent" });
    }

    return {
      success: true,
      agent: {
        id: reactivatedAgent.id,
        name: reactivatedAgent.name,
        status: reactivatedAgent.status,
      },
    };
  });

export type ReactivateAgentType = typeof reactivateAgent;
