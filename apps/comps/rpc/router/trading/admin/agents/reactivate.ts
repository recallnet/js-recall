import { ORPCError } from "@orpc/server";

import { AdminReactivateAgentParamsSchema } from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Reactivate an agent
 */
export const reactivateAgent = base
  .use(adminMiddleware)
  .handler(async ({ context, errors }) => {
    const input = AdminReactivateAgentParamsSchema.parse(context.params);

    try {
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
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

      if (error instanceof ApiError) {
        switch (error.statusCode) {
          case 400:
            throw errors.BAD_REQUEST({ message: error.message });
          case 404:
            throw errors.NOT_FOUND({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({ message: "Failed to reactivate agent" });
    }
  });

export type ReactivateAgentType = typeof reactivateAgent;
