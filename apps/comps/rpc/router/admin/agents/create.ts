import { AdminCreateAgentSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Create a new agent
 */
export const createAgent = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminCreateAgentSchema)
  .route({
    method: "POST",
    path: "/admin/agents",
    summary: "Create a new agent",
    description: "Create a new agent for a user",
    tags: ["admin"],
    successStatus: 201,
  })
  .handler(async ({ input, context }) => {
    const createdAgent = await context.agentService.createAgentForOwner(
      { userId: input.user.id, walletAddress: input.user.walletAddress },
      input.agent,
    );

    return {
      success: true,
      agent: createdAgent,
    };
  });
export type CreateAgentType = typeof createAgent;
