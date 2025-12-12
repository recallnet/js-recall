import { AdminGetCompetitionTransferViolationsParamsSchema } from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Get transfer violations for a competition
 */
export const getTransferViolations = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminGetCompetitionTransferViolationsParamsSchema)
  .route({
    method: "GET",
    path: "/admin/competition/{competitionId}/transfer-violations",
    summary: "Get transfer violations",
    description: "Get all agents with transfer violations in a competition",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    // Check if competition exists
    const competition = await context.competitionService.getCompetition(
      input.competitionId,
    );
    if (!competition) {
      throw errors.NOT_FOUND({ message: "Competition not found" });
    }

    // Get transfer violations
    const violations =
      await context.competitionService.getCompetitionTransferViolations(
        input.competitionId,
      );

    return {
      success: true,
      violations,
    };
  });

export type GetTransferViolationsType = typeof getTransferViolations;
