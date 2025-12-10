import { AdminEndCompetitionSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/admin";
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
  .handler(async ({ context, input, errors }) => {
    const competition = await context.competitionService.getCompetition(
      input.competitionId,
    );
    if (!competition) {
      throw errors.NOT_FOUND({ message: "Competition not found" });
    }

    // End the NFL competition (note: slightly different leaderboard format)
    if (competition.type === "sports_prediction") {
      const { competition: endedCompetition, leaderboard } =
        await context.competitionService.endNflCompetition(input.competitionId);
      return { success: true, competition: endedCompetition, leaderboard };
    }

    // End the competition for all other competition types
    const { competition: endedCompetition, leaderboard } =
      await context.competitionService.endCompetition(input.competitionId);

    context.logger.info(
      `Successfully ended competition, id: ${input.competitionId}`,
    );

    return { success: true, competition: endedCompetition, leaderboard };
  });

export type EndCompetitionType = typeof endCompetition;
