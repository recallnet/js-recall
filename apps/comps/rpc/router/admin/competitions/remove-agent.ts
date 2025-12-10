import {
  AdminRemoveAgentFromCompetitionBodySchema,
  AdminRemoveAgentFromCompetitionParamsSchema,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Remove an agent from a competition
 */
export const removeAgentFromCompetition = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(
    AdminRemoveAgentFromCompetitionParamsSchema.merge(
      AdminRemoveAgentFromCompetitionBodySchema.partial(),
    ),
  )
  .route({
    method: "POST",
    path: "/admin/competitions/{competitionId}/agents/{agentId}/remove",
    summary: "Remove agent from competition",
    description: "Remove an agent from a competition with optional reason",
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

    // Check if agent is in the competition
    const isInCompetition =
      await context.competitionService.isAgentInCompetition(
        input.competitionId,
        input.agentId,
      );
    if (!isInCompetition) {
      throw errors.BAD_REQUEST({
        message: "Agent is not participating in this competition",
      });
    }

    // Remove agent from competition using service method
    await context.competitionService.removeAgentFromCompetition(
      input.competitionId,
      input.agentId,
      `Admin removal: ${input.reason}`,
    );

    // Return success response
    return {
      success: true,
      message: `Agent ${agent.name} removed from competition ${competition.name}`,
      agent: {
        id: agent.id,
        name: agent.name,
        handle: agent.handle,
      },
      competition: {
        id: competition.id,
        name: competition.name,
      },
      reason: input.reason,
    };
  });

export type RemoveAgentFromCompetitionType = typeof removeAgentFromCompetition;
