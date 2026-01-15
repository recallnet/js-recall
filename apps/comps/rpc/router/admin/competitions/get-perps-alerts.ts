import {
  AdminGetCompetitionTransferViolationsParamsSchema,
  AdminGetPerpsAlertsQuerySchema,
} from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Get perps self-funding alerts for a competition
 */
export const getPerpsSelfFundingAlerts = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(
    AdminGetCompetitionTransferViolationsParamsSchema.merge(
      AdminGetPerpsAlertsQuerySchema,
    ),
  )
  .route({
    method: "GET",
    path: "/admin/competitions/{competitionId}/perps/alerts",
    summary: "Get perps self-funding alerts",
    description:
      "Get unreviewed self-funding alerts for a perpetual futures competition",
    tags: ["admin"],
  })
  .handler(async ({ input, context }) => {
    const { competitionId, reviewed, detectionMethod } = input;

    // Build filters for repository query
    const filters: {
      reviewed?: boolean;
      detectionMethod?: "transfer_history" | "balance_reconciliation";
    } = {};

    if (reviewed !== "all") {
      filters.reviewed = reviewed === "true";
    }

    if (detectionMethod && detectionMethod !== "all") {
      filters.detectionMethod = detectionMethod;
    }

    // Get alerts from service with SQL filtering
    const alerts = await context.competitionService.getPerpsSelfFundingAlerts(
      competitionId,
      filters,
    );

    return {
      success: true,
      alerts,
    };
  });

export type GetPerpsSelfFundingAlertsType = typeof getPerpsSelfFundingAlerts;
