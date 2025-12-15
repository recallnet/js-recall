import { AdminRevokeBonusBoostSchema } from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Revoke bonus boost(s)
 */
export const revokeBonusBoost = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminRevokeBonusBoostSchema)
  .route({
    method: "POST",
    path: "/admin/boost-bonus/revoke",
    summary: "Revoke bonus boost",
    description: "Revoke one or more bonus boosts by their IDs",
    tags: ["admin"],
  })
  .handler(async ({ input, context }) => {
    const { boostIds } = input;

    // Use batch method to revoke all boosts in a single transaction
    const batchResults =
      await context.boostBonusService.revokeBoostBonusBatch(boostIds);

    // Map results to the expected response format
    const results = batchResults.map((result, i) => ({
      index: i,
      boostId: result.boostBonusId,
      removedCount: result.removedFromCompetitions.length,
      keptCount: result.keptInCompetitions.length,
      id: result.boostBonusId,
      revoked: result.revoked,
      revokedAt: result.revokedAt.toISOString(),
      removedFromCompetitions: result.removedFromCompetitions,
      keptInCompetitions: result.keptInCompetitions,
    }));

    return {
      success: true,
      data: {
        results,
      },
    };
  });

export type RevokeBonusBoostType = typeof revokeBonusBoost;
