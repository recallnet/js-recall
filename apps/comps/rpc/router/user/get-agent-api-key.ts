import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { userAgentMiddleware } from "@/rpc/middleware/user-agent";

export const getAgentApiKey = base
  .input(z.object({ agentId: z.string().uuid() }))
  .use(userAgentMiddleware, (input) => ({ agentId: input.agentId }))
  .handler(async ({ context, errors }) => {
    try {
      const { agent } = context;

      // Get the decrypted API key
      const result = await context.agentService.getDecryptedApiKeyById(
        agent.id,
      );

      return {
        agentId: agent.id,
        agentName: agent.name,
        agentHandle: agent.handle,
        apiKey: result.apiKey,
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
      throw errors.INTERNAL({ message: "Failed to get agent API key" });
    }
  });
