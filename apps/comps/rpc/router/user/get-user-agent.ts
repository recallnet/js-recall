import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { ApiError } from "@recallnet/services/types";

import { userAgentMiddleware } from "@/rpc/middleware/user-agent";

export const getUserAgent = userAgentMiddleware
  .input(z.object({ agentId: z.string().uuid() }))
  .handler(async ({ context, errors }) => {
    try {
      const { agent } = context;

      // Remove sensitive fields, but add back the email and deactivation since the user should see them
      const sanitizedAgent = context.agentService.sanitizeAgent(agent);
      const agentWithMetrics =
        await context.agentService.attachAgentMetrics(sanitizedAgent);
      return {
        ...agentWithMetrics,
        email: agent.email,
        deactivationReason: agent.deactivationReason,
        deactivationDate: agent.deactivationDate,
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
      throw errors.INTERNAL({ message: "Failed to get agent" });
    }
  });
