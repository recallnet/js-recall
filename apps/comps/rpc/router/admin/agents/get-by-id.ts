import { AdminGetAgentParamsSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Get agent by ID
 */
export const getAgentById = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminGetAgentParamsSchema)
  .route({
    method: "GET",
    path: "/admin/agents/{agentId}",
    summary: "Get agent by ID",
    description: "Get detailed information about a specific agent",
    tags: ["admin"],
  })
  .handler(async ({ context, input, errors }) => {
    const agent = await context.agentService.getAgent(input.agentId);

    if (!agent) {
      throw errors.NOT_FOUND({ message: "Agent not found" });
    }

    return { success: true, agent };
  });

export type GetAgentByIdType = typeof getAgentById;
