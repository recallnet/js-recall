import { z } from "zod";

import { base } from "@/rpc/context/base";

/**
 * RPC endpoint to get eligibility data for next season conviction rewards.
 *
 * Returns full eligibility information including:
 * - Whether the address is eligible
 * - Active stake amount
 * - Potential reward amount
 * - Eligibility reasons (boosted agents, competed in competitions)
 * - Pool statistics (total stakes, available rewards, forfeited amounts)
 */
export const getNextSeasonEligibility = base
  .input(
    z.object({
      address: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
      season: z.number().int().positive().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      context.logger.info(
        `Getting next season eligibility for address: ${input.address}`,
      );

      const eligibility = await context.airdropService.getNextSeasonEligibility(
        input.address,
        input.season,
      );

      // Convert bigint values to strings for JSON serialization
      return {
        isEligible: eligibility.isEligible,
        season: eligibility.season,
        seasonName: eligibility.seasonName,
        activitySeason: {
          number: eligibility.activitySeason.number,
          name: eligibility.activitySeason.name,
          startDate: eligibility.activitySeason.startDate.toISOString(),
          endDate: eligibility.activitySeason.endDate.toISOString(),
        },
        activeStake: eligibility.activeStake.toString(),
        potentialReward: eligibility.potentialReward.toString(),
        eligibilityReasons: eligibility.eligibilityReasons,
        poolStats: {
          totalActiveStakes: eligibility.poolStats.totalActiveStakes.toString(),
          availableRewardsPool:
            eligibility.poolStats.availableRewardsPool.toString(),
          totalForfeited: eligibility.poolStats.totalForfeited.toString(),
          totalAlreadyClaimed:
            eligibility.poolStats.totalAlreadyClaimed.toString(),
        },
      };
    } catch (error) {
      context.logger.error({ error }, "Error fetching next season eligibility");
      throw errors.INTERNAL({
        message: "Error fetching next season eligibility",
      });
    }
  });
