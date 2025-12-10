import { z } from "zod/v4";

import {
  AdminGetSpotLiveAlertsQuerySchema,
  UuidSchema,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

const GetSpotLiveAlertsParamsSchema = z.object({
  competitionId: UuidSchema,
});

/**
 * Get spot live self-funding alerts for a competition
 */
export const getSpotLiveSelfFundingAlerts = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(GetSpotLiveAlertsParamsSchema.merge(AdminGetSpotLiveAlertsQuerySchema))
  .route({
    method: "GET",
    path: "/admin/competitions/:competitionId/spot-live/alerts",
    summary: "Get spot live self-funding alerts",
    description:
      "Get unreviewed self-funding alerts for a spot live competition",
    tags: ["admin"],
  })
  .handler(async ({ input, context }) => {
    const { competitionId, reviewed, violationType } = input;

    // Build filters for repository query
    const filters: {
      reviewed?: boolean;
      violationType?: string;
    } = {};

    if (reviewed !== "all") {
      filters.reviewed = reviewed === "true";
    }

    if (violationType && violationType !== "all") {
      filters.violationType = violationType;
    }

    // Get alerts from service with SQL filtering
    const alerts =
      await context.competitionService.getSpotLiveSelfFundingAlerts(
        competitionId,
        filters,
      );

    return {
      success: true,
      alerts,
    };
  });

export type GetSpotLiveSelfFundingAlertsType =
  typeof getSpotLiveSelfFundingAlerts;
