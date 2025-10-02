import { ORPCError } from "@orpc/server";

import { buildPaginationResponse } from "@recallnet/services/lib";
import {
  AgentCompetitionsParamsSchema,
  ApiError,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";

export const getCompetitions = base
  .use(authMiddleware)
  .input(AgentCompetitionsParamsSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      const params = input;

      // Get competitions for all user's agents
      const results = await context.agentService.getCompetitionsForUserAgents(
        context.user.id,
        params,
      );

      return {
        competitions: results.competitions,
        total: results.total,
        pagination: buildPaginationResponse(
          results.total,
          params.limit,
          params.offset,
        ),
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
      throw errors.INTERNAL({ message: "Failed to get competitions" });
    }
  });
