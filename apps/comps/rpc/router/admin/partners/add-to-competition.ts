import {
  AdminAddPartnerToCompetitionSchema,
  AdminCompetitionParamsSchema,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Add partner to competition
 */
export const addPartnerToCompetition = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminAddPartnerToCompetitionSchema.merge(AdminCompetitionParamsSchema))
  .route({
    method: "POST",
    path: "/admin/competitions/{competitionId}/partners",
    summary: "Add partner to competition",
    description:
      "Associate a partner with a competition at a specific position",
    tags: ["admin"],
  })
  .handler(async ({ input, context }) => {
    const association = await context.partnerService.addToCompetition({
      competitionId: input.competitionId,
      partnerId: input.partnerId,
      position: input.position,
    });
    return { success: true, association };
  });

export type AddPartnerToCompetitionType = typeof addPartnerToCompetition;
