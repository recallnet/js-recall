import { z } from "zod/v4";

import {
  CompetitionStatusSchema,
  PagingParamsSchema,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { userMiddleware } from "@/rpc/middleware/user";

export const listEnriched = base
  .use(userMiddleware)
  .input(
    z.object({
      status: CompetitionStatusSchema,
      paging: PagingParamsSchema.optional(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    try {
      const res = await context.competitionService.getEnrichedCompetitions({
        status: input.status,
        userId: context.user?.id,
        pagingParams: input.paging || PagingParamsSchema.parse({}),
      });
      return res;
    } catch (error) {
      throw errors.INTERNAL({
        cause: error,
        message: "Failed to list competitions.",
      });
    }
  });

export type ListEnrichedType = typeof listEnriched;
