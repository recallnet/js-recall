import { AdminRewardsAllocationSchema } from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Allocate rewards for a competition
 */
export const allocateRewards = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminRewardsAllocationSchema)
  .route({
    method: "POST",
    path: "/admin/rewards/allocate",
    summary: "Allocate rewards",
    description: "Allocate and distribute rewards for a competition period",
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

    // Allocate rewards
    await context.rewardsService.calculateAndAllocate(
      input.competitionId,
      input.startTimestamp,
    );

    return {
      success: true,
      message: "Rewards allocated successfully",
      competitionId: input.competitionId,
    };
  });

export type AllocateRewardsType = typeof allocateRewards;
