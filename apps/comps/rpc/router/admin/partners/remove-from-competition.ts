import { AdminCompetitionPartnerParamsSchema } from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Remove partner from competition
 */
export const removePartnerFromCompetition = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminCompetitionPartnerParamsSchema)
  .route({
    method: "DELETE",
    path: "/admin/competitions/{competitionId}/partners/{partnerId}",
    summary: "Remove partner from competition",
    description: "Remove a partner association from a competition",
    tags: ["admin"],
  })
  .handler(async ({ context, input }) => {
    await context.partnerService.removeFromCompetition(
      input.competitionId,
      input.partnerId,
    );
    return {
      success: true,
      message: "Partner removed from competition successfully",
    };
  });

export type RemovePartnerFromCompetitionType =
  typeof removePartnerFromCompetition;
