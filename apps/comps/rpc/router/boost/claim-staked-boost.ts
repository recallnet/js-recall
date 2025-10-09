import { z } from "zod";

import { config } from "@/config/public";
import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";
import { assertNever } from "@/rpc/router/utils/assert-never";

export const claimStakedBoost = base
  .use(authMiddleware)
  .errors({
    BOOST_ALREADY_CLAIMED: {
      message: "Boost already claimed",
    },
    NOT_SUPPORTED_PRE_TGE: {
      message: "Claiming staked boost is not supported before TGE",
    },
  })
  .input(
    z.object({
      competitionId: z.string().uuid(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    if (!config.publicFlags.tge) {
      throw errors.NOT_SUPPORTED_PRE_TGE();
    }
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
