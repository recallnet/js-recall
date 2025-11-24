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
 * Create a new competition
 */
export const createCompetition = base
  .use(adminMiddleware)
  .input(
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      tradingType: z
        .enum(["disallowAll", "disallowXParent", "allow"])
        .optional(),
      sandboxMode: z.boolean().optional(),
      type: z.enum(["trading", "perpetual_futures"]).optional(),
      externalUrl: z.string().optional(),
      imageUrl: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      boostStartDate: z.string().datetime().optional(),
      boostEndDate: z.string().datetime().optional(),
      joinStartDate: z.string().datetime().optional(),
      joinEndDate: z.string().datetime().optional(),
      maxParticipants: z.number().int().min(1).optional(),
      minimumStake: z.number().min(0).optional(),
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
      arenaId: z.string(),
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
      const competition = await context.competitionService.createCompetition({
        ...input,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        boostStartDate: input.boostStartDate
          ? new Date(input.boostStartDate)
          : undefined,
        boostEndDate: input.boostEndDate
          ? new Date(input.boostEndDate)
          : undefined,
        joinStartDate: input.joinStartDate
          ? new Date(input.joinStartDate)
          : undefined,
        joinEndDate: input.joinEndDate
          ? new Date(input.joinEndDate)
          : undefined,
      });
      return { success: true, competition };
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

      if (error instanceof ApiError) {
        switch (error.statusCode) {
          case 400:
            throw errors.BAD_REQUEST({ message: error.message });
          case 409:
            throw errors.CONFLICT({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({ message: "Failed to create competition" });
    }
  });

export type CreateCompetitionType = typeof createCompetition;
