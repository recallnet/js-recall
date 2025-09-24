import { z } from "zod";

import { BoostError } from "@recallnet/services/boost";

import { base } from "@/rpc/context/base";
import { assertNever } from "@/rpc/router/utils/assert-never";

export const agentBoostTotals = base
  .input(z.object({ competitionId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const res = await context.boostService.getAgentBoostTotals(
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
      return { boostTotals: res.value };
    }
  });
