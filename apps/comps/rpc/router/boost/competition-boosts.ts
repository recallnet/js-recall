import { z } from "zod";

import { base } from "@/rpc/context/base";

/**
 * Get paginated boost allocations for a competition
 */
export const competitionBoosts = base
  .input(
    z.object({
      competitionId: z.string(),
      limit: z.number().int().min(1).max(100).default(25),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const res = await context.boostService.getCompetitionBoosts(
      input.competitionId,
      { limit: input.limit, offset: input.offset },
    );
    if (res.isErr()) {
      throw errors.INTERNAL({ message: res.error.message });
    }
    return res.value;
  });
