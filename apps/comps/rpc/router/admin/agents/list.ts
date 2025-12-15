import { AdminListAllAgentsQuerySchema } from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * List all agents with pagination
 */
export const listAgents = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminListAllAgentsQuerySchema)
  .route({
    method: "GET",
    path: "/admin/agents",
    summary: "List all agents",
    description: "Get paginated list of all agents",
    tags: ["admin"],
  })
  .handler(async ({ input, context }) => {
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
  });

export type ListAgentsType = typeof listAgents;
