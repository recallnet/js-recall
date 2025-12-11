import { z } from "zod/v4";

import { UuidSchema } from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

const GetPerformanceReportParamsSchema = z.object({
  competitionId: UuidSchema,
});

/**
 * Get performance report for a competition
 */
export const getPerformanceReport = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(GetPerformanceReportParamsSchema)
  .route({
    method: "GET",
    path: "/admin/reports/performance",
    summary: "Get performance report",
    description: "Get comprehensive performance report for a competition",
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

    // Get leaderboard for the competition
    const leaderboard = await context.competitionService.getLeaderboard(
      input.competitionId,
    );

    return {
      success: true,
      competition: {
        id: competition.id,
        name: competition.name,
        description: competition.description,
        startDate: competition.startDate,
        endDate: competition.endDate,
        externalUrl: competition.externalUrl,
        imageUrl: competition.imageUrl,
        status: competition.status,
        crossChainTradingType: competition.crossChainTradingType,
        type: competition.type,
      },
      leaderboard,
    };
  });

export type GetPerformanceReportType = typeof getPerformanceReport;
