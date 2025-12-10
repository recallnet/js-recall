import {
  AdminDeactivateAgentBodySchema,
  AdminDeactivateAgentParamsSchema,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Deactivate an agent
 */
export const deactivateAgent = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminDeactivateAgentBodySchema.merge(AdminDeactivateAgentParamsSchema))
  .route({
    method: "POST",
    path: "/admin/agents/{agentId}/deactivate",
    summary: "Deactivate agent",
    description: "Deactivate an agent with a reason",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    // Get the agent first to check if it exists
    const agent = await context.agentService.getAgent(input.agentId);

    if (!agent) {
      throw errors.NOT_FOUND({ message: "Agent not found" });
    }

    // Check if agent is already inactive
    if (agent.status !== "active") {
      throw errors.BAD_REQUEST({
        message: "Agent is already inactive",
      });
    }

    // Deactivate the agent
    const deactivatedAgent = await context.agentService.deactivateAgent(
      input.agentId,
      input.reason,
    );

    if (!deactivatedAgent) {
      throw errors.INTERNAL({ message: "Failed to deactivate agent" });
    }

    return {
      success: true,
      agent: {
        id: deactivatedAgent.id,
        name: deactivatedAgent.name,
        status: deactivatedAgent.status,
        deactivationReason: deactivatedAgent.deactivationReason,
        deactivationDate: deactivatedAgent.deactivationDate,
      },
    };
  });

export type DeactivateAgentType = typeof deactivateAgent;
