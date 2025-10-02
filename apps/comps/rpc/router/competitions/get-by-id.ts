import { z } from "zod/v4";

import { base } from "@/rpc/context/base";
import { userMiddleware } from "@/rpc/middleware/user";

export const getById = base
  .use(userMiddleware)
  .input(
    z.object({
      id: z.uuid(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    try {
      const res = await context.competitionService.getCompetitionById({
        competitionId: input.id,
        userId: context.user?.id,
      });
      return res.competition;
    } catch (error) {
      throw errors.INTERNAL({
        cause: error,
        message: "Failed to get competition by id.",
      });
    }
  });

export type GetByIdType = typeof getById;
