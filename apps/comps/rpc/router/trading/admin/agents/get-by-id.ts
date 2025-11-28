import { ORPCError } from "@orpc/server";

import { AdminGetAgentParamsSchema } from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Get agent by ID
 */
export const getAgentById = base
  .use(adminMiddleware)
  .route({
    method: "GET",
    path: "/admin/agents/{agentId}",
    summary: "Get agent by ID",
    description: "Get detailed information about a specific agent",
    tags: ["admin"],
  })
  .handler(async ({ context, errors }) => {
    const input = AdminGetAgentParamsSchema.parse(context.params);

    try {
      const agent = await context.agentService.getAgent(input.agentId);

      if (!agent) {
        throw errors.NOT_FOUND({ message: "Agent not found" });
      }

      return { success: true, agent };
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

      if (error instanceof ApiError) {
        switch (error.statusCode) {
          case 404:
            throw errors.NOT_FOUND({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({ message: "Failed to get agent" });
    }
  });

export type GetAgentByIdType = typeof getAgentById;
