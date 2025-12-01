import { ORPCError } from "@orpc/server";

import {
  AdminGetAgentApiKeyParamsSchema,
  ApiError,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Get agent API key
 */
export const getAgentApiKey = base
  .use(adminMiddleware)
  .input(AdminGetAgentApiKeyParamsSchema)
  .route({
    method: "GET",
    path: "/admin/agents/{agentId}/key",
    summary: "Get agent API key",
    description: "Retrieve the API key for a specific agent",
    tags: ["admin"],
  })
  .handler(async ({ context, input, errors }) => {
    try {
      // Get the decrypted API key using the agent service
      const result = await context.agentService.getDecryptedApiKeyById(
        input.agentId,
      );

      return {
        success: true,
        agent: {
          id: result.agent.id,
          name: result.agent.name,
          apiKey: result.apiKey,
        },
      };
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

      throw errors.INTERNAL({ message: "Failed to get agent API key" });
    }
  });

export type GetAgentApiKeyType = typeof getAgentApiKey;
