import { z } from "zod";

import { BoostError } from "@recallnet/services/boost";

import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";
import { assertNever } from "@/rpc/router/utils/assert-never";

export const userBoosts = base
  .use(authMiddleware)
  .input(z.object({ competitionId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const res = await context.boostService.getUserBoosts(
      context.user.id,
      input.competitionId,
    );
    if (res.isErr()) {
      switch (res.error) {
        case BoostError.RepositoryError:
          throw errors.INTERNAL();
        default:
          assertNever(res.error);
      }
    } else {
      return res.value;
    }
  });
