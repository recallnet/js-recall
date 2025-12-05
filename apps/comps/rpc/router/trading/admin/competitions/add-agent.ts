import { AdminAddAgentToCompetitionParamsSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Add an agent to a competition
 */
export const addAgentToCompetition = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminAddAgentToCompetitionParamsSchema)
  .route({
    method: "POST",
    path: "/admin/competitions/{competitionId}/agents/{agentId}",
    summary: "Add agent to competition",
    description: "Add an agent to a specific competition",
    tags: ["admin"],
  })
  .handler(async ({ context, input }) => {
    // Check if competition exists
    const competition = await context.competitionService.getCompetition(
      input.competitionId,
    );
    if (!competition) {
      throw new Error("Competition not found");
    }

    // Check if agent exists
    const agent = await context.agentService.getAgent(input.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    // Check if agent is already in the competition
    const isInCompetition =
      await context.competitionService.isAgentInCompetition(
        input.competitionId,
        input.agentId,
      );
    if (isInCompetition) {
      throw new Error("Agent is already participating in this competition");
    }

    // Check if competition is ended
    if (competition.status === "ended") {
      throw new Error("Cannot add agent to ended competition");
    }

    // HARD RULE: Cannot add agents to active non-sandbox competitions
    if (competition.status === "active" && !competition.sandboxMode) {
      throw new Error(
        "Cannot add agents to active non-sandbox competitions - this would be unfair to existing participants",
      );
    }

    // In sandbox mode, reset agent balances
    if (competition.sandboxMode) {
      await context.balanceService.resetAgentBalances(
        input.agentId,
        input.competitionId,
        competition.type,
      );
    }

    // Add agent to competition
    await context.competitionRepository.addAgentToCompetition(
      input.competitionId,
      input.agentId,
    );

    // Take initial snapshot for sandbox mode
    if (competition.sandboxMode) {
      await context.portfolioSnapshotterService.takePortfolioSnapshotForAgent(
        input.competitionId,
        input.agentId,
      );
    }

    return {
      success: true,
      message: `Agent ${agent.name} added to competition ${competition.name}`,
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

export type AddAgentToCompetitionType = typeof addAgentToCompetition;
