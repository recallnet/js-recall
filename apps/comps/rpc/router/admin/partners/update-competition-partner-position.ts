import {
  AdminCompetitionPartnerParamsSchema,
  AdminUpdatePartnerPositionSchema,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Update partner position in a competition
 */
export const updateCompetitionPartnerPosition = base
  .use(errorHandlerMiddleware)
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
  .handler(async ({ input, context }) => {
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
  });

export type UpdateCompetitionPartnerPositionType =
  typeof updateCompetitionPartnerPosition;
