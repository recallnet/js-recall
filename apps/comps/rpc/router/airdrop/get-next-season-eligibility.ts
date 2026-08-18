import { z } from "zod";

import { config } from "@/config/private";
import { base } from "@/rpc/context/base";

/**
 * RPC endpoint to get eligibility data for next season conviction rewards.
 *
 * Returns full eligibility information including:
 * - Whether the address is eligible
 * - Active stake amount
 * - Potential reward amount
 * - Eligibility reasons (boosted/competed competition IDs, total unique competitions)
 * - Pool statistics (total stakes, available rewards, forfeited amounts)
 */
export const getNextAirdropEligibility = base
  .input(
    z.object({
      address: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
      airdrop: z.number().int().positive().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      context.logger.info(
        `Getting next season eligibility for address: ${input.address}`,
      );

      const eligibility =
        await context.airdropService.getNextAirdropEligibility(
          input.address,
          input.airdrop,
        );

      return {
        ...eligibility,
        minCompetitionsRequired: config.airdrop.minCompetitionsForEligibility,
      };
    } catch (error) {
      context.logger.error({ error }, "Error fetching next season eligibility");
      throw errors.INTERNAL({
        message: "Error fetching next season eligibility",
      });
    }
  });
