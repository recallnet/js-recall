import { AdminGetAgentApiKeyParamsSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Get agent API key
 */
export const getAgentApiKey = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminGetAgentApiKeyParamsSchema)
  .route({
    method: "GET",
    path: "/admin/agents/{agentId}/key",
    summary: "Get agent API key",
    description: "Retrieve the API key for a specific agent",
    tags: ["admin"],
  })
  .handler(async ({ context, input }) => {
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
  });

export type GetAgentApiKeyType = typeof getAgentApiKey;
