import { ORPCError } from "@orpc/server";

import { AdminDeleteAgentParamsSchema } from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Delete an agent
 */
export const deleteAgent = base
  .use(adminMiddleware)
  .handler(async ({ context, errors }) => {
    const input = AdminDeleteAgentParamsSchema.parse(context.params);

    try {
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

      throw errors.INTERNAL({ message: "Failed to delete agent" });
    }
  });

export type DeleteAgentType = typeof deleteAgent;
