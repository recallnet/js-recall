import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { CacheTags, invalidateCacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";

export const join = base
  .use(authMiddleware)
  .input(
    z.object({
      competitionId: z.uuid(),
      agentId: z.uuid(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    try {
      await context.competitionService.joinCompetition(
        input.competitionId,
        input.agentId,
        context.user.id,
        undefined,
      );

      // Invalidate caches for this agent (competitions list and agent profile with metrics)
      // Also invalidate the competition cache since participant count changed
      invalidateCacheTags([
        CacheTags.competition(input.competitionId),
        CacheTags.agentCompetitions(input.agentId),
        CacheTags.agent(input.agentId),
      ]);
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
          case 401:
            throw errors.UNAUTHORIZED({ message: error.message });
          case 403:
            throw errors.UNAUTHORIZED({ message: error.message });
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
      throw errors.INTERNAL({ message: "Failed to join competition" });
    }
  });

export type JoinType = typeof join;
