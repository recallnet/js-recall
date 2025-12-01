import { ORPCError } from "@orpc/server";

import {
  AdminSearchResults,
  AdminSearchUsersAndAgentsQuerySchema,
  ApiError,
  toApiUser,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Global search for users and agents
 */
export const globalSearch = base
  .use(adminMiddleware)
  .input(AdminSearchUsersAndAgentsQuerySchema)
  .route({
    method: "GET",
    path: "/admin/search",
    summary: "Global search",
    description: "Search across users and agents with various filters",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    try {
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

      throw errors.INTERNAL({ message: "Search failed" });
    }
  });

export type GlobalSearchType = typeof globalSearch;
