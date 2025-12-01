import { ORPCError } from "@orpc/server";

import {
  AdminCompetitionPartnerParamsSchema,
  AdminUpdatePartnerPositionSchema,
  ApiError,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Update partner position in a competition
 */
export const updateCompetitionPartnerPosition = base
  .use(adminMiddleware)
  .input(
    AdminCompetitionPartnerParamsSchema.merge(AdminUpdatePartnerPositionSchema),
  )
  .route({
    method: "PUT",
    path: "/admin/competitions/{competitionId}/partners/{partnerId}",
    summary: "Update partner position",
    description: "Update the display position of a partner in a competition",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    try {
      // Update partner position
      const association = await context.partnerService.updatePosition(
        input.competitionId,
        input.partnerId,
        input.position,
      );

      return {
        success: true,
        association,
      };
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
        message: "Failed to update partner position",
      });
    }
  });

export type UpdateCompetitionPartnerPositionType =
  typeof updateCompetitionPartnerPosition;
