import { AdminEndCompetitionSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * End a competition
 */
export const endCompetition = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminEndCompetitionSchema)
  .route({
    method: "POST",
    path: "/admin/competition/end",
    summary: "End a competition",
    description: "End a competition and calculate final results",
    tags: ["admin"],
  })
  .handler(async ({ context, input }) => {
    const { competition, leaderboard } =
      await context.competitionService.endCompetition(input.competitionId);
    return { success: true, competition, leaderboard };
  });

export type EndCompetitionType = typeof endCompetition;
