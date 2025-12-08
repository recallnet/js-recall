import { z } from "zod";

import { CacheTags, invalidateCacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";
import { assertNever } from "@/rpc/router/utils/assert-never";

export const boostAgent = base
  .use(authMiddleware)
  .input(
    z.object({
      competitionId: z.string(),
      agentId: z.string().uuid(),
      amount: z.bigint().min(1n),
      idemKey: z
        .string()
        .base64()
        .transform((s) => Buffer.from(s, "base64")),
    }),
  )
  .errors({
    OUTSIDE_BOOST_WINDOW: {},
    COMPETITION_MISSING_BOOST_DATES: {},
    ALREADY_BOOSTED_AGENT: {},
  })
  .handler(async ({ input, context, errors }) => {
    const res = await context.boostService.boostAgent({
      userId: context.user.id,
      competitionId: input.competitionId,
      agentId: input.agentId,
      amount: input.amount,
      idemKey: input.idemKey,
    });
    if (res.isErr()) {
      context.logger.warn(
        {
          errorType: res.error.type,
          error: res.error,
          userId: context.user.id,
          competitionId: input.competitionId,
          agentId: input.agentId,
        },
        `Boost agent failed: ${res.error.type}`,
      );

      switch (res.error.type) {
        case "RepositoryError":
          throw errors.INTERNAL({ message: res.error.message });
        case "UserNotFound":
          throw errors.NOT_FOUND();
        case "CompetitionNotFound":
          throw errors.NOT_FOUND();
        case "CompetitionMissingBoostDates":
          throw errors.COMPETITION_MISSING_BOOST_DATES();
        case "OutsideCompetitionBoostWindow":
          throw errors.OUTSIDE_BOOST_WINDOW();
        case "AlreadyBoostedAgent":
          throw errors.ALREADY_BOOSTED_AGENT();
        default:
          assertNever(res.error);
      }
    } else {
      // Invalidate the agentBoostTotals cache for this competition
      invalidateCacheTags([CacheTags.agentBoostTotals(input.competitionId)]);

      return res.value;
    }
  });
