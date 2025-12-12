import {
  AdminGetCompetitionSnapshotsParamsSchema,
  AdminGetCompetitionSnapshotsQuerySchema,
} from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Get portfolio snapshots for an agent in a competition
 */
export const getCompetitionSnapshots = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(
    AdminGetCompetitionSnapshotsParamsSchema.merge(
      AdminGetCompetitionSnapshotsQuerySchema,
    ),
  )
  .route({
    method: "GET",
    path: "/admin/competition/{competitionId}/snapshots",
    summary: "Get competition snapshots",
    description:
      "Get portfolio snapshots for agents in a competition, optionally filtered by agentId",
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

    // Get snapshots based on whether an agent ID was provided
    let snapshots;
    if (input.agentId) {
      // Check if the agent exists
      const agent = await context.agentService.getAgent(input.agentId);
      if (!agent) {
        throw errors.NOT_FOUND({ message: "Agent not found" });
      }

      // Check if the agent is in the competition
      const agentInCompetition =
        await context.competitionService.isAgentInCompetition(
          input.competitionId,
          input.agentId,
        );

      if (!agentInCompetition) {
        throw errors.BAD_REQUEST({
          message: "Agent is not participating in this competition",
        });
      }

      // Get snapshots for the specific agent
      snapshots =
        await context.portfolioSnapshotterService.getAgentPortfolioSnapshots(
          input.competitionId,
          input.agentId,
        );
    } else {
      // Get snapshots for all agents in the competition (including inactive ones)
      const agents = await context.competitionService.getAllCompetitionAgents(
        input.competitionId,
      );
      snapshots = [];

      for (const agentId of agents) {
        const agentSnapshots =
          await context.portfolioSnapshotterService.getAgentPortfolioSnapshots(
            input.competitionId,
            agentId,
          );
        snapshots.push(...agentSnapshots);
      }
    }

    return {
      success: true,
      snapshots,
    };
  });

export type GetCompetitionSnapshotsType = typeof getCompetitionSnapshots;
