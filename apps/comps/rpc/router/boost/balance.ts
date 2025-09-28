import { z } from "zod";

import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";
import { assertNever } from "@/rpc/router/utils/assert-never";

export const balance = base
  .use(authMiddleware)
  .input(z.object({ competitionId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const res = await context.boostService.getUserBoostBalance(
      context.user.id,
      input.competitionId,
    );
    if (res.isErr()) {
      switch (res.error.type) {
        case "UserNotFound":
          throw errors.NOT_FOUND();
        case "RepositoryError":
          throw errors.INTERNAL({ message: res.error.message });
        default:
          assertNever(res.error);
      }
    } else {
      return res.value;
    }
  });
