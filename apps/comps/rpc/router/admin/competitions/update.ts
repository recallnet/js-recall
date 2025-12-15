import {
  AdminUpdateCompetitionParamsSchema,
  AdminUpdateCompetitionSchema,
} from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Update a competition
 */
export const updateCompetition = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminUpdateCompetitionParamsSchema.merge(AdminUpdateCompetitionSchema))
  .route({
    method: "PUT",
    path: "/admin/competition/{competitionId}",
    summary: "Update competition",
    description: "Update an existing competition's configuration",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    context.logger.debug({ input });
    const { competitionId } = input;
    const {
      rewards,
      tradingConstraints,
      evaluationMetric,
      perpsProvider,
      prizePools,
      spotLiveConfig,
      gameIds,
      paperTradingConfig,
      paperTradingInitialBalances,
      ...updates
    } = input;

    if (
      Object.keys(updates).length === 1 &&
      !rewards &&
      !tradingConstraints &&
      !evaluationMetric &&
      !perpsProvider &&
      !prizePools &&
      !spotLiveConfig &&
      !gameIds &&
      !paperTradingConfig &&
      !paperTradingInitialBalances
    ) {
      throw errors.BAD_REQUEST({
        message: "No valid fields provided for update",
      });
    }

    const { competition: updatedCompetition, updatedRewards } =
      await context.competitionService.updateCompetition(
        competitionId,
        updates,
        tradingConstraints,
        rewards,
        evaluationMetric,
        perpsProvider,
        prizePools,
        spotLiveConfig,
        gameIds,
        paperTradingConfig,
        paperTradingInitialBalances,
      );

    return {
      success: true,
      competition: {
        ...updatedCompetition,
        rewards: updatedRewards.map((reward) => ({
          rank: reward.rank,
          reward: reward.reward,
        })),
        gameIds,
      },
    };
  });

export type UpdateCompetitionType = typeof updateCompetition;
