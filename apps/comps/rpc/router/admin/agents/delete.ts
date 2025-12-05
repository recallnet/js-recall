import { AdminDeleteAgentParamsSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Delete an agent
 */
export const deleteAgent = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminDeleteAgentParamsSchema)
  .route({
    method: "DELETE",
    path: "/admin/agents/{agentId}",
    summary: "Delete agent",
    description: "Delete an agent by ID",
    tags: ["admin"],
  })
  .handler(async ({ context, input, errors }) => {
    // Get the agent first to check if it exists
    const agent = await context.agentService.getAgent(input.agentId);

    if (!agent) {
      throw errors.NOT_FOUND({ message: "Agent not found" });
    }

    // Delete the agent
    const deleted = await context.agentService.deleteAgent(input.agentId);

    if (deleted) {
      return {
        success: true,
        message: "Agent successfully deleted",
      };
    } else {
      throw errors.INTERNAL({ message: "Failed to delete agent" });
    }
  });

export type DeleteAgentType = typeof deleteAgent;
