import { ORPCError } from "@orpc/server";

import { AdminCreateAgentSchema } from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Create a new agent
 */
export const createAgent = base
  .use(adminMiddleware)
  .input(AdminCreateAgentSchema)
  .route({
    method: "POST",
    path: "/admin/agents",
    summary: "Create a new agent",
    description: "Create a new agent for a user",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    try {
      const createdAgent = await context.agentService.createAgentForOwner(
        { userId: input.user.id, walletAddress: input.user.walletAddress },
        input.agent,
      );

      return {
        success: true,
        agent: createdAgent,
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
          case 409:
            throw errors.CONFLICT({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({ message: "Failed to create agent" });
    }
  });

export type CreateAgentType = typeof createAgent;
