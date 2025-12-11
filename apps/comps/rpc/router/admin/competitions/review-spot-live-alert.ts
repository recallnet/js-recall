import {
  AdminReviewSpotLiveAlertBodySchema,
  AdminReviewSpotLiveAlertParamsSchema,
} from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Review a spot live self-funding alert
 */
export const reviewSpotLiveSelfFundingAlert = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(
    AdminReviewSpotLiveAlertParamsSchema.merge(
      AdminReviewSpotLiveAlertBodySchema,
    ),
  )
  .route({
    method: "PUT",
    path: "/admin/competitions/:competitionId/spot-live/alerts/:alertId/review",
    summary: "Review spot live self-funding alert",
    description: "Review and take action on a spot live self-funding alert",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    const { competitionId, alertId, reviewNote, actionTaken } = input;

    // Get admin ID from context (set by adminMiddleware)
    const adminId = context.admin.id;

    // Update alert (service validates alert belongs to competition)
    const updatedAlert =
      await context.competitionService.reviewSpotLiveSelfFundingAlert(
        competitionId,
        alertId,
        {
          reviewed: true,
          reviewedAt: new Date(),
          reviewNote,
          actionTaken,
          reviewedBy: adminId,
        },
      );

    if (!updatedAlert) {
      throw errors.NOT_FOUND({ message: "Alert not found" });
    }

    return {
      success: true,
      alert: updatedAlert,
    };
  });

export type ReviewSpotLiveSelfFundingAlertType =
  typeof reviewSpotLiveSelfFundingAlert;
