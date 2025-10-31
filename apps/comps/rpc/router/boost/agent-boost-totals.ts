import { z } from "zod";

import { CacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

export const agentBoostTotals = base
  .input(z.object({ competitionId: z.string() }))
  .use(({ next }, input) =>
    next({
      context: {
        revalidateSecs: 30,
        tags: [CacheTags.agentBoostTotals(input.competitionId)],
        key: undefined,
      },
    }),
  )
  .use(cacheMiddleware)
  .handler(async ({ input, context, errors }) => {
    const res = await context.boostService.getAgentBoostTotals(
      input.competitionId,
    );
    if (res.isErr()) {
      throw errors.INTERNAL({ message: res.error.message });
    } else {
      return res.value;
    }
  });
