import { z } from "zod";

import { authMiddleware } from "@/rpc/middleware/auth";

export const userBoosts = authMiddleware
  .input(z.object({ competitionId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const res = await context.boostService.getUserBoosts(
      context.user.id,
      input.competitionId,
    );
    if (res.isErr()) {
      throw errors.INTERNAL({ message: res.error.message });
    } else {
      return res.value;
    }
  });
