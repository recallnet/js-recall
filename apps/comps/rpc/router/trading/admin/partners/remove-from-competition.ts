import { ORPCError } from "@orpc/server";

import { AdminCompetitionPartnerParamsSchema } from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Remove partner from competition
 */
export const removePartnerFromCompetition = base
  .use(adminMiddleware)
  .handler(async ({ context, errors }) => {
    const input = AdminCompetitionPartnerParamsSchema.parse(context.params);

    try {
      await context.partnerService.removeFromCompetition(
        input.competitionId,
        input.partnerId,
      );
      return {
        success: true,
        message: "Partner removed from competition successfully",
      };
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

      if (error instanceof ApiError) {
        switch (error.statusCode) {
          case 404:
            throw errors.NOT_FOUND({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({
        message: "Failed to remove partner from competition",
      });
    }
  });

export type RemovePartnerFromCompetitionType =
  typeof removePartnerFromCompetition;
