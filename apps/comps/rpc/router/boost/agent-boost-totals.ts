import { z } from "zod";

import { CacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { cacheMiddleware, inputTags } from "@/rpc/middleware/cache";

export const agentBoostTotals = base
  .use(
    cacheMiddleware({
      revalidateSecs: 30,
      getTags: inputTags<{ competitionId: string }>((input) => [
        CacheTags.agentBoostTotals(input.competitionId),
      ]),
    }),
  )
  .input(z.object({ competitionId: z.string() }))
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
