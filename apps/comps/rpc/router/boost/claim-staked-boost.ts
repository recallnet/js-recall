import { z } from "zod";

import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";
import { assertNever } from "@/rpc/router/utils/assert-never";

export const claimStakedBoost = base
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
    const res = await context.boostService.claimStakedBoost(
      context.user.id,
      context.user.walletAddress,
      input.competitionId,
    );
    if (res.isErr()) {
      switch (res.error.type) {
        case "RepositoryError":
          throw errors.INTERNAL({ message: res.error.message });
        case "AlreadyClaimedBoost":
          throw errors.BOOST_ALREADY_CLAIMED();
        default:
          assertNever(res.error);
      }
    } else {
      return res.value;
    }
  });
