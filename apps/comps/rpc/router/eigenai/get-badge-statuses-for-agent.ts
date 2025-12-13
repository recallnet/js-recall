import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

/**
 * Get all EigenAI badge statuses for a specific agent across all competitions.
 * Returns a map of competition IDs to their badge status (active/inactive + signatures count).
 * Used by the agent profile page to display badges for all competitions the agent participated in.
 */
export const getBadgeStatusesForAgent = base
  .input(
    z.object({
      agentId: z.uuid(),
    }),
  )
  .use(
    cacheMiddleware({
      revalidateSecs: 60, // 1 minute - badge status changes infrequently
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const statuses = await context.eigenaiService.getBadgeStatusesForAgent(
        input.agentId,
      );

      // Transform array to record keyed by competitionId for frontend convenience
      const statusMap: Record<
        string,
        { isBadgeActive: boolean; signaturesLast24h: number }
      > = {};

      for (const status of statuses) {
        statusMap[status.competitionId] = {
          isBadgeActive: status.isBadgeActive,
          signaturesLast24h: status.signaturesLast24h,
        };
      }

      return statusMap;
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
        message: "Failed to get EigenAI badge statuses for agent",
      });
    }
  });

export type GetBadgeStatusesForAgentType = typeof getBadgeStatusesForAgent;
