import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

const TradingConstraintsSchema = z.object({
  minimumPairAgeHours: z.number().min(0).optional(),
  minimum24hVolumeUsd: z.number().min(0).optional(),
  minimumLiquidityUsd: z.number().min(0).optional(),
  minimumFdvUsd: z.number().min(0).optional(),
  minTradesPerDay: z.number().min(0).nullable().optional(),
});

const PerpsProviderSchema = z.object({
  provider: z.enum(["symphony", "hyperliquid"]),
  initialCapital: z.number(),
  selfFundingThreshold: z.number(),
  minFundingThreshold: z.number().min(0),
  apiUrl: z.string().optional(),
});

/**
 * Update a competition
 */
export const updateCompetition = base
  .use(adminMiddleware)
  .input(
    z.object({
      competitionId: z.string().uuid(),
      name: z.string().optional(),
      description: z.string().optional(),
      type: z.enum(["trading", "perpetual_futures"]).optional(),
      externalUrl: z.string().optional(),
      imageUrl: z.string().optional(),
      boostStartDate: z.string().datetime().optional(),
      boostEndDate: z.string().datetime().optional(),
      tradingConstraints: TradingConstraintsSchema.optional(),
      rewards: z.record(z.string(), z.number()).optional(),
      evaluationMetric: z
        .enum(["calmar_ratio", "sortino_ratio", "simple_return"])
        .optional(),
      perpsProvider: PerpsProviderSchema.optional(),
      prizePools: z
        .object({
          agent: z.number().min(0).optional(),
          users: z.number().min(0).optional(),
        })
        .optional(),
      minimumStake: z.number().min(0).nullable().optional(),
      arenaId: z.string().optional(),
      engineId: z
        .enum(["spot_paper_trading", "perpetual_futures", "spot_live_trading"])
        .optional(),
      engineVersion: z.string().optional(),
      vips: z.array(z.string()).optional(),
      allowlist: z.array(z.string()).optional(),
      blocklist: z.array(z.string()).optional(),
      minRecallRank: z.number().int().optional(),
      allowlistOnly: z.boolean().optional(),
      agentAllocation: z.number().optional(),
      agentAllocationUnit: z.enum(["RECALL", "USDC", "USD"]).optional(),
      boosterAllocation: z.number().optional(),
      boosterAllocationUnit: z.enum(["RECALL", "USDC", "USD"]).optional(),
      rewardRules: z.string().optional(),
      rewardDetails: z.string().optional(),
      displayState: z
        .enum(["active", "waitlist", "cancelled", "pending", "paused"])
        .optional(),
      rewardsIneligible: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const {
        competitionId,
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
