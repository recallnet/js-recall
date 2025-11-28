import { ORPCError } from "@orpc/server";

import {
  AdminAddPartnerToCompetitionSchema,
  AdminCompetitionParamsSchema,
} from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Add partner to competition
 */
export const addPartnerToCompetition = base
  .use(adminMiddleware)
  .input(AdminAddPartnerToCompetitionSchema)
  .handler(async ({ input, context, errors }) => {
    const params = AdminCompetitionParamsSchema.parse(context.params);

    try {
      const association = await context.partnerService.addToCompetition({
        competitionId: params.competitionId,
        partnerId: input.partnerId,
        position: input.position,
      });
      return { success: true, association };
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

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

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({
        message: "Failed to add partner to competition",
      });
    }
  });

export type AddPartnerToCompetitionType = typeof addPartnerToCompetition;
