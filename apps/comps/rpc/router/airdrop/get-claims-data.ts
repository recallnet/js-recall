import { z } from "zod";

import { base } from "@/rpc/context/base";

export const getClaimsData = base
  .input(
    z.object({
      address: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      context.logger.info(`Getting claims data for address: ${input.address}`);

      const claimsData = await context.airdropService.getAccountClaimsData(
        input.address,
      );

      // Convert BigInt values to strings for JSON serialization
      const serializedData = claimsData.map((claim) => ({
        season: claim.season,
        seasonName: claim.seasonName,
        allocation: {
          amount: claim.allocation.amount.toString(),
          proof: claim.allocation.proof,
          ineligibleReason: claim.allocation.ineligibleReason,
        },
        claim: {
          status: claim.claim.status,
          claimedAmount: claim.claim.claimedAmount?.toString(),
          stakeDuration: claim.claim.stakeDuration,
          unlocksAt: claim.claim.unlocksAt?.toISOString(),
        },
      }));

      return serializedData;
    } catch (error) {
      context.logger.error("Error fetching claims data:", error);
      throw error;
    }
  });
