import { AdminCompetitionParamsSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Get partners for a competition
 */
export const getCompetitionPartners = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminCompetitionParamsSchema)
  .route({
    method: "GET",
    path: "/admin/competitions/{competitionId}/partners",
    summary: "Get partners for a competition",
    description: "Get all partners associated with a specific competition",
    tags: ["admin"],
  })
  .handler(async ({ context, input }) => {
    const partners = await context.partnerService.findByCompetition(
      input.competitionId,
    );
    return { success: true, partners };
  });

export type GetCompetitionPartnersType = typeof getCompetitionPartners;
