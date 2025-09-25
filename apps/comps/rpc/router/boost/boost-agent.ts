import { z } from "zod";

import { BoostError } from "@recallnet/services/boost";

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
    COMPETITION_MISSING_VOTING_DATES: {},
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
      switch (res.error) {
        case BoostError.RepositoryError:
          throw errors.INTERNAL();
        case BoostError.UserNotFound:
          throw errors.NOT_FOUND();
        case BoostError.CompetitionNotFound:
          throw errors.NOT_FOUND();
        case BoostError.CompetitionMissingVotingDates:
          throw errors.COMPETITION_MISSING_VOTING_DATES();
        case BoostError.OutsideCompetitionBoostWindow:
          throw errors.OUTSIDE_BOOST_WINDOW();
        case BoostError.AlreadyBoostedAgent:
          throw errors.ALREADY_BOOSTED_AGENT();
        default:
          assertNever(res.error);
      }
    } else {
      return res.value;
    }
  });
