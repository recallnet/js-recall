import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError, UuidSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

const GetPerformanceReportParamsSchema = z.object({
  competitionId: UuidSchema,
});

/**
 * Get performance report for a competition
 */
export const getPerformanceReport = base
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
    try {
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
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({
        message: "Failed to get performance report",
      });
    }
  });

export type GetPerformanceReportType = typeof getPerformanceReport;
