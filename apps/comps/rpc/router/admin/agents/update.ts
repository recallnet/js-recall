import {
  AdminUpdateAgentBodySchema,
  AdminUpdateAgentParamsSchema,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Update an agent
 */
export const updateAgent = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminUpdateAgentBodySchema.merge(AdminUpdateAgentParamsSchema))
  .route({
    method: "PUT",
    path: "/admin/agents/{agentId}",
    summary: "Update agent",
    description: "Update an agent's information",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    const { agentId } = input;
    const updateData = input;

    // Get the current agent
    const agent = await context.agentService.getAgent(agentId);
    if (!agent) {
      throw errors.NOT_FOUND({ message: "Agent not found" });
    }

    // Update with only provided fields
    const updatedAgent = await context.agentService.updateAgent({
      ...agent,
      name: updateData.name ?? agent.name,
      handle: updateData.handle ?? agent.handle,
      description: updateData.description ?? agent.description,
      imageUrl: updateData.imageUrl ?? agent.imageUrl,
      email: updateData.email ?? agent.email,
      metadata: updateData.metadata ?? agent.metadata,
      isRewardsIneligible:
        updateData.isRewardsIneligible ?? agent.isRewardsIneligible,
      rewardsIneligibilityReason:
        updateData.rewardsIneligibilityReason ??
        agent.rewardsIneligibilityReason,
    });

    return { success: true, agent: updatedAgent };
  });

export type UpdateAgentType = typeof updateAgent;
