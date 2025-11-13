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

      return claimsData;
    } catch (error) {
      context.logger.error("Error fetching claims data:", error);
      throw error;
    }
  });
