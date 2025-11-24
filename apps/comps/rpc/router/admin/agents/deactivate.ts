import { ORPCError } from "@orpc/server";

import {
  AdminDeactivateAgentBodySchema,
  AdminDeactivateAgentParamsSchema,
} from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Deactivate an agent
 */
export const deactivateAgent = base
  .use(adminMiddleware)
  .input(AdminDeactivateAgentBodySchema)
  .handler(async ({ input, context, errors }) => {
    const params = AdminDeactivateAgentParamsSchema.parse(context.params);

    try {
      // Get the agent first to check if it exists
      const agent = await context.agentService.getAgent(params.agentId);

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
        params.agentId,
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

      throw errors.INTERNAL({ message: "Failed to deactivate agent" });
    }
  });

export type DeactivateAgentType = typeof deactivateAgent;
