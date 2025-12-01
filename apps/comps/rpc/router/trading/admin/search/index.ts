import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

// Simplified schema - the actual parsing will be done via special logic
const GlobalSearchParamsSchema = z.object({
  // User filters
  "user.query": z.string().optional(),
  "user.id": z.string().optional(),
  "user.walletAddress": z.string().optional(),
  "user.email": z.string().optional(),
  "user.name": z.string().optional(),

  // Agent filters
  "agent.query": z.string().optional(),
  "agent.id": z.string().optional(),
  "agent.name": z.string().optional(),
  "agent.email": z.string().optional(),

  // Join logic
  join: z.enum(["and", "or"]).optional(),
});

interface AdminSearchResults {
  users: any[];
  agents: any[];
}

/**
 * Global search for users and agents
 */
export const globalSearch = base
  .use(adminMiddleware)
  .input(GlobalSearchParamsSchema)
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

      // Extract user filters
      const userFilters: any = {};
      if (input["user.query"]) userFilters.query = input["user.query"];
      if (input["user.id"]) userFilters.id = input["user.id"];
      if (input["user.walletAddress"])
        userFilters.walletAddress = input["user.walletAddress"];
      if (input["user.email"]) userFilters.email = input["user.email"];
      if (input["user.name"]) userFilters.name = input["user.name"];

      // Extract agent filters
      const agentFilters: any = {};
      if (input["agent.query"]) agentFilters.query = input["agent.query"];
      if (input["agent.id"]) agentFilters.id = input["agent.id"];
      if (input["agent.name"]) agentFilters.name = input["agent.name"];
      if (input["agent.email"]) agentFilters.email = input["agent.email"];

      const hasUserFilters = Object.keys(userFilters).length > 0;
      const hasAgentFilters = Object.keys(agentFilters).length > 0;

      // Search users if requested
      if (hasUserFilters) {
        const users = await context.userService.searchUsers(userFilters);
        results.users = users;
      }

      // Search agents if requested
      if (hasAgentFilters) {
        results.agents = await context.agentService.searchAgents(agentFilters);
      }

      // Handle join logic
      const join = input.join;
      if (join === "and") {
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
        join,
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
