import { z } from "zod";

import { config } from "@/config/public";
import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";
import { assertNever } from "@/rpc/router/utils/assert-never";

export const claimBoost = base
  .use(authMiddleware)
  .errors({
    BOOST_ALREADY_CLAIMED: {
      message: "Boost already claimed",
    },
    NOT_SUPPORTED_POST_TGE: {
      message: "Claiming boost is not supported after TGE",
    },
  })
  .input(
    z.object({
      competitionId: z.string().uuid(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    if (config.publicFlags.tge) {
      throw errors.NOT_SUPPORTED_POST_TGE();
    }
    const res = await context.boostService.claimBoost(
      context.user.id,
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
