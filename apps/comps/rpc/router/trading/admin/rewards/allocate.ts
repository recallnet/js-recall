import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError, UuidSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

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
    try {
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

      throw errors.INTERNAL({ message: "Failed to allocate rewards" });
    }
  });

export type AllocateRewardsType = typeof allocateRewards;
