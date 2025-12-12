import { AdminReactivateAgentInCompetitionParamsSchema } from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Reactivate an agent in a competition
 */
export const reactivateAgentInCompetition = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminReactivateAgentInCompetitionParamsSchema)
  .route({
    method: "POST",
    path: "/admin/competitions/{competitionId}/agents/{agentId}/reactivate",
    summary: "Reactivate agent in competition",
    description: "Reactivate a previously deactivated agent in a competition",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    // Check if competition exists
    const competition = await context.competitionService.getCompetition(
      input.competitionId,
    );
    if (!competition) {
      throw errors.NOT_FOUND({ message: "Competition not found" });
    }

    // Check if agent exists
    const agent = await context.agentService.getAgent(input.agentId);
    if (!agent) {
      throw errors.NOT_FOUND({ message: "Agent not found" });
    }

    // Check if competition is still active
    if (competition.status === "ended") {
      throw errors.BAD_REQUEST({
        message: "Cannot reactivate agent in ended competition",
      });
    }

    // Check if agent is in the competition
    const isInCompetition =
      await context.competitionService.isAgentInCompetition(
        input.competitionId,
        input.agentId,
      );
    if (!isInCompetition) {
      throw errors.BAD_REQUEST({
        message: "Agent is not in this competition",
      });
    }

    // Reactivate agent in competition using service method
    await context.competitionService.reactivateAgentInCompetition(
      input.competitionId,
      input.agentId,
    );

    return {
      success: true,
      message: `Agent ${agent.name} reactivated in competition ${competition.name}`,
      agent: {
        id: agent.id,
        name: agent.name,
        handle: agent.handle,
      },
      competition: {
        id: competition.id,
        name: competition.name,
      },
    };
  });

export type ReactivateAgentInCompetitionType =
  typeof reactivateAgentInCompetition;
