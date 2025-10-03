import { ORPCError } from "@orpc/server";

import { ApiError, PagingParamsSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";
import { serializeAgent } from "@/rpc/router/utils/serialize-agent";

export const getUserAgents = base
  .use(authMiddleware)
  .input(PagingParamsSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      const paging = input;

      // Get agents owned by this user
      const agents = await context.agentService.getAgentsByOwner(
        context.user.id,
        paging,
      );

      // Remove sensitive fields and attach metrics
      const sanitizedAgents = agents.map((agent) =>
        context.agentService.sanitizeAgent(agent),
      );

      const agentsWithMetrics =
        await context.agentService.attachBulkAgentMetrics(sanitizedAgents);

      // Add back email and deactivation fields since the user should see them
      const agentsWithExtendedFields = agentsWithMetrics.map(
        (agentWithMetrics, index) => ({
          ...agentWithMetrics,
          email: agents[index]?.email,
          deactivationReason: agents[index]?.deactivationReason,
          deactivationDate: agents[index]?.deactivationDate,
        }),
      );

      // Serialize agents to frontend format
      const serializedAgents = agentsWithExtendedFields.map(serializeAgent);

      return {
        userId: context.user.id,
        agents: serializedAgents,
      };
    } catch (error) {
      // Re-throw if already an oRPC error
      if (error instanceof ORPCError) {
        throw error;
      }

      // Handle ApiError instances from service layer
      if (error instanceof ApiError) {
        switch (error.statusCode) {
          case 400:
            throw errors.BAD_REQUEST({ message: error.message });
          case 404:
            throw errors.NOT_FOUND({ message: error.message });
          case 409:
            throw errors.CONFLICT({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      // Handle generic Error instances
      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      // Unknown error type
      throw errors.INTERNAL({ message: "Failed to get agents" });
    }
  });
