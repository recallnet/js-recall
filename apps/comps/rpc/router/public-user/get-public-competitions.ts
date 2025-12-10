import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { buildPaginationResponse } from "@recallnet/services/lib";
import {
  AgentCompetitionsParamsSchema,
  ApiError,
} from "@recallnet/services/types";

import { CacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

const GetPublicCompetitionsInputSchema = z.object({
  userId: z.uuid(),
  params: AgentCompetitionsParamsSchema.optional(),
});

/**
 * Get competitions for a user's agents (public endpoint)
 * Returns competition data without sensitive user information
 */
export const getPublicCompetitions = base
  .input(GetPublicCompetitionsInputSchema)
  .use(
    cacheMiddleware({
      revalidateSecs: 60,
      getTags: (input) => [CacheTags.publicUserCompetitions(input.userId)],
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { userId, params } = input;

      // Verify user exists
      const user = await context.userService.getUser(userId);
      if (!user) {
        throw errors.NOT_FOUND({ message: "User not found" });
      }

      // Default params
      const queryParams = params ?? {
        limit: 10,
        offset: 0,
        sort: "-startDate",
      };

      // Get competitions for all user's agents
      const results = await context.agentService.getCompetitionsForUserAgents(
        userId,
        queryParams,
      );

      return {
        competitions: results.competitions,
        total: results.total,
        pagination: buildPaginationResponse(
          results.total,
          queryParams.limit ?? 10,
          queryParams.offset ?? 0,
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
      throw errors.INTERNAL({
        message: "Failed to get public user competitions",
      });
    }
  });
