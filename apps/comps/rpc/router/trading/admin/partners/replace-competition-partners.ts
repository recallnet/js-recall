import {
  AdminCompetitionParamsSchema,
  AdminReplaceCompetitionPartnersSchema,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Replace all partners for a competition
 */
export const replaceCompetitionPartners = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(
    AdminCompetitionParamsSchema.merge(AdminReplaceCompetitionPartnersSchema),
  )
  .route({
    method: "PUT",
    path: "/admin/competitions/{competitionId}/partners/replace",
    summary: "Replace all competition partners",
    description: "Replace all partners for a competition in a single operation",
    tags: ["admin"],
  })
  .handler(async ({ input, context }) => {
    // Replace all partners
    const associations =
      await context.partnerService.replaceCompetitionPartners(
        input.competitionId,
        input.partners,
      );

    return {
      success: true,
      partners: associations,
    };
  });

export type ReplaceCompetitionPartnersType = typeof replaceCompetitionPartners;
