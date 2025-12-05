import { z } from "zod/v4";

import { UuidSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

const AllocateRewardsBodySchema = z.object({
  competitionId: UuidSchema,
  startTimestamp: z
    .number()
    .int()
    .min(0)
    .describe("Unix timestamp for reward period start"),
});

/**
 * Allocate rewards for a competition
 */
export const allocateRewards = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AllocateRewardsBodySchema)
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
