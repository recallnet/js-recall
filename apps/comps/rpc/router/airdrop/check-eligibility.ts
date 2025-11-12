import { z } from "zod";

import { base } from "@/rpc/context/base";

export const checkEligibility = base
  .input(z.object({ address: z.string(), season: z.number() }))
  .handler(async ({ input, context }) => {
    const res = await context.airdropService.checkEligibility(
      input.address,
      input.season,
    );
    return res;
  });
