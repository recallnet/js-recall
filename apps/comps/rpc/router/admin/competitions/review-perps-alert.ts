import {
  AdminReviewPerpsAlertBodySchema,
  AdminReviewPerpsAlertParamsSchema,
} from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Review a perps self-funding alert
 */
export const reviewPerpsSelfFundingAlert = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(
    AdminReviewPerpsAlertParamsSchema.merge(AdminReviewPerpsAlertBodySchema),
  )
  .route({
    method: "PUT",
    path: "/admin/competitions/{competitionId}/perps/alerts/{alertId}/review",
    summary: "Review perps self-funding alert",
    description: "Review and take action on a perps self-funding alert",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    const { competitionId, alertId, reviewNote, actionTaken } = input;

    // Get admin ID from context (set by adminMiddleware)
    const adminId = context.admin.id;

    // Update alert (service validates alert belongs to competition)
    const updatedAlert =
      await context.competitionService.reviewPerpsSelfFundingAlert(
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

export type ReviewPerpsSelfFundingAlertType =
  typeof reviewPerpsSelfFundingAlert;
