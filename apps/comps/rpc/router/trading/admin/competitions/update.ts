import { ORPCError } from "@orpc/server";

import {
  AdminUpdateCompetitionParamsSchema,
  AdminUpdateCompetitionSchema,
  ApiError,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Update a competition
 */
export const updateCompetition = base
  .use(adminMiddleware)
  .input(AdminUpdateCompetitionSchema.merge(AdminUpdateCompetitionParamsSchema))
  .route({
    method: "PUT",
    path: "/admin/competition/{competitionId}",
    summary: "Update competition",
    description: "Update an existing competition's configuration",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    try {
      const { competitionId } = input;
      const {
        rewards,
        tradingConstraints,
        evaluationMetric,
        perpsProvider,
        prizePools,
        ...updates
      } = input;

      const { competition, updatedRewards } =
        await context.competitionService.updateCompetition(
          competitionId,
          updates,
          tradingConstraints,
          rewards,
          evaluationMetric,
          perpsProvider,
          prizePools,
        );

      return {
        success: true,
        competition: {
          ...competition,
          rewards: updatedRewards.map((reward) => ({
            rank: reward.rank,
            reward: reward.reward,
          })),
        },
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

      throw errors.INTERNAL({ message: "Failed to update competition" });
    }
  });

export type UpdateCompetitionType = typeof updateCompetition;
