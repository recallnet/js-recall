import { ORPCError } from "@orpc/server";

import { AdminListAllAgentsQuerySchema } from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * List all agents with pagination
 */
export const listAgents = base
  .use(adminMiddleware)
  .input(AdminListAllAgentsQuerySchema)
  .handler(async ({ input, context, errors }) => {
    try {
      const { limit = 50, offset = 0, sort = "-createdAt" } = input;

      const agents = await context.agentService.getAgents({
        pagingParams: { limit, offset, sort },
      });

      const totalCount = await context.agentService.countAgents();

      return {
        success: true,
        agents,
        pagination: {
          limit,
          offset,
          total: totalCount,
          hasMore: offset + agents.length < totalCount,
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
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({ message: "Failed to list agents" });
    }
  });

export type ListAgentsType = typeof listAgents;
