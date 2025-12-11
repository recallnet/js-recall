import { AdminAddAgentToCompetitionParamsSchema } from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Add an agent to a competition
 */
export const addAgentToCompetition = adminBase
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
  .handler(async ({ context, input, errors }) => {
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

    // Check if agent owner's email is verified (security layer)
    const owner = await context.userService.getUser(agent.ownerId);
    if (!owner) {
      throw errors.NOT_FOUND({ message: "Agent not found" });
    }

    // Validate wallet address for competitions requiring on-chain wallets
    if (
      (competition.type === "perpetual_futures" ||
        competition.type === "spot_live_trading") &&
      !agent.walletAddress
    ) {
      throw errors.BAD_REQUEST({
        message:
          "Agent must have a wallet address to participate in this competition",
      });
    }

    // Check if agent is already in the competition
    const isInCompetition =
      await context.competitionService.isAgentInCompetition(
        input.competitionId,
        input.agentId,
      );
    if (isInCompetition) {
      throw errors.BAD_REQUEST({
        message: "Agent is already participating in this competition",
      });
    }

    // Check if competition is ended
    if (competition.status === "ended") {
      throw errors.BAD_REQUEST({
        message: "Cannot add agent to ended competition",
      });
    }

    // HARD RULE: Cannot add agents to active non-sandbox competitions
    if (competition.status === "active" && !competition.sandboxMode) {
      throw errors.BAD_REQUEST({
        message:
          "Cannot add agents to active non-sandbox competitions - this would be unfair to existing participants",
      });
    }

    // In sandbox mode, we need to reset the agent's balances to starting values when the agent
    // joins the always on competition, since we can't rely on 'startCompetition' to do so.
    // For non-sandbox mode, we must *not* do this, since agents can join competitions before
    // they've started, when they might be in another ongoing competition as well, and we don't
    // want to reset their balances in the middle of the ongoing competition. So in that case
    // wait for the new competition to start and let 'startCompetition' do the reset.
    if (competition.sandboxMode) {
      context.logger.info(
        `Resetting agent balance as part of applying sandbox mode logic for admin adding agent ${input.agentId} to competition ${input.competitionId}`,
      );

      await context.balanceService.resetAgentBalances(
        input.agentId,
        input.competitionId,
        competition.type,
      );
    }

    // Add agent to competition using repository method
    try {
      await context.competitionRepository.addAgentToCompetition(
        input.competitionId,
        input.agentId,
      );
    } catch (error) {
      // Handle specific error for participant limit
      if (
        error instanceof Error &&
        error.message.includes("maximum participant limit")
      ) {
        throw errors.CONFLICT({ message: error.message });
      }
      // Handle one-agent-per-user error
      if (
        error instanceof Error &&
        error.message.includes("already has an agent registered")
      ) {
        throw errors.CONFLICT({
          message:
            "This user already has another agent registered in this competition. Each user can only register one agent per competition.",
        });
      }
      // Re-throw other errors
      throw error;
    }

    // Take initial snapshot for sandbox mode
    if (competition.sandboxMode) {
      await context.portfolioSnapshotterService.takePortfolioSnapshotForAgent(
        input.competitionId,
        input.agentId,
      );
      context.logger.info(
        `Sandbox mode logic completed for agent ${input.agentId}`,
      );
    }

    return {
      success: true,
      message: `Agent ${agent.name} added to competition ${competition.name}`,
      agent: {
        id: agent.id,
        name: agent.name,
        handle: agent.handle,
        ownerId: agent.ownerId,
      },
      competition: {
        id: competition.id,
        name: competition.name,
        status: competition.status,
      },
    };
  });

export type AddAgentToCompetitionType = typeof addAgentToCompetition;
