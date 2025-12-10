import {
  AdminSearchResults,
  AdminSearchUsersAndAgentsQuerySchema,
  toApiUser,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Global search for users and agents
 */
export const globalSearch = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminSearchUsersAndAgentsQuerySchema)
  .route({
    method: "GET",
    path: "/admin/search",
    summary: "Global search",
    description: "Search across users and agents with various filters",
    tags: ["admin"],
  })
  .handler(async ({ input, context }) => {
    context.logger.debug({ input }, "input");

    const results: AdminSearchResults = {
      users: [],
      agents: [],
    };

    // Search users if requested
    if (input.user) {
      const users = await context.userService.searchUsers(input.user);
      results.users = users.map(toApiUser);
    }

    // Search agents if requested
    if (input.agent) {
      results.agents = await context.agentService.searchAgents(input.agent);
    }

    // Handle join logic
    if (input.join) {
      // Filter agents to only include those whose owners are in the user results
      const userMap = new Map(results.users.map((user) => [user.id, user]));

      results.agents = results.agents
        .map((agent) => {
          const user = userMap.get(agent.ownerId);
          if (!user) return null;
          return agent;
        })
        .filter((entry) => entry !== null);
    }

    return {
      success: true,
      join: input.join,
      results,
    };
  });

export type GlobalSearchType = typeof globalSearch;
