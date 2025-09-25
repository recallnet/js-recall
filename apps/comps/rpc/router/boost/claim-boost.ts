import { z } from "zod";

import { BoostError } from "@recallnet/services/boost";

import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";
import { assertNever } from "@/rpc/router/utils/assert-never";

export const claimBoost = base
  .use(authMiddleware)
  .errors({
    BOOST_ALREADY_CLAIMED: {
      message: "Boost already claimed",
    },
  })
  .input(
    z.object({
      competitionId: z.string().uuid(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    const res = await context.boostService.claimBoost(
      context.user.id,
      context.user.walletAddress,
      input.competitionId,
    );
    if (res.isErr()) {
      switch (res.error) {
        case BoostError.RepositoryError:
          throw errors.INTERNAL();
        case BoostError.AlreadyClaimedBoost:
          throw errors.BOOST_ALREADY_CLAIMED();
        default:
          assertNever(res.error);
      }
    } else {
      return res.value;
    }
  });
