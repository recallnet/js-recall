import { z } from "zod";

import { CacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

export const agentBoostTotals = base
  .input(z.object({ competitionId: z.string() }))
  .use(
    cacheMiddleware({
      revalidateSecs: 30,
      getTags: (input) => [CacheTags.agentBoostTotals(input.competitionId)],
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const res = await context.boostService.getAgentBoostTotals(
      input.competitionId,
    );
    if (res.isErr()) {
      throw errors.INTERNAL({ message: res.error.message });
    } else {
      // Convert BigInt values to strings for JSON serialization
      const serializable: Record<string, string> = {};
      for (const [agentId, total] of Object.entries(res.value)) {
        serializable[agentId] = total.toString();
      }
      return serializable;
    }
  });
