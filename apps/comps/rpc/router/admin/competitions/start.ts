import { AdminStartCompetitionSchema } from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Start a competition
 */
export const startCompetition = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminStartCompetitionSchema)
  .route({
    method: "POST",
    path: "/admin/competition/start",
    summary: "Start a competition",
    description: "Start an existing competition or create and start a new one",
    tags: ["admin"],
  })
  .handler(async ({ input, context }) => {
    const { competitionId, agentIds, tradingConstraints, ...creationFields } =
      input;

    const competition =
      await context.competitionService.startOrCreateCompetition({
        competitionId,
        agentIds,
        tradingConstraints,
        creationParams: competitionId
          ? undefined
          : {
              ...creationFields,
              name: creationFields.name!,
              arenaId: creationFields.arenaId!,
              startDate: creationFields.startDate,
              endDate: creationFields.endDate,
              boostStartDate: creationFields.boostStartDate,
              boostEndDate: creationFields.boostEndDate,
              joinStartDate: creationFields.joinStartDate,
              joinEndDate: creationFields.joinEndDate,
            },
      });

    return { success: true, competition };
  });

export type StartCompetitionType = typeof startCompetition;
