import type { z } from "zod/v4";

import {
  AdminUpdateCompetitionParamsSchema,
  AdminUpdateCompetitionSchema,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

type UpdateCompetitionInput = z.infer<
  typeof AdminUpdateCompetitionParamsSchema
> &
  z.infer<typeof AdminUpdateCompetitionSchema>;

function inputRefinement(data: UpdateCompetitionInput) {
  const {
    rewards,
    tradingConstraints,
    evaluationMetric,
    perpsProvider,
    prizePools,
    gameIds,
    paperTradingConfig,
    paperTradingInitialBalances,
    ...updates
  } = data;

  return (
    Object.keys(updates).length > 1 ||
    rewards !== undefined ||
    tradingConstraints !== undefined ||
    evaluationMetric !== undefined ||
    perpsProvider !== undefined ||
    prizePools !== undefined ||
    gameIds !== undefined ||
    paperTradingConfig !== undefined ||
    paperTradingInitialBalances !== undefined
  );
}

/**
 * Update a competition
 */
export const updateCompetition = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(
    AdminUpdateCompetitionParamsSchema.merge(
      AdminUpdateCompetitionSchema,
    ).refine(inputRefinement, {
      message: "No valid fields provided for update",
    }),
  )
  .route({
    method: "PUT",
    path: "/admin/competition/{competitionId}",
    summary: "Update competition",
    description: "Update an existing competition's configuration",
    tags: ["admin"],
  })
  .handler(async ({ input, context }) => {
    context.logger.debug({ input });
    const { competitionId } = input;
    const {
      rewards,
      tradingConstraints,
      evaluationMetric,
      perpsProvider,
      prizePools,
      gameIds,
      paperTradingConfig,
      paperTradingInitialBalances,
      ...updates
    } = input;

    const { competition: updatedCompetition, updatedRewards } =
      await context.competitionService.updateCompetition(
        competitionId,
        updates,
        tradingConstraints,
        rewards,
        evaluationMetric,
        perpsProvider,
        prizePools,
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
