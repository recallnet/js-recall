import { ORPCError } from "@orpc/server";

import {
  AdminRemoveAgentFromCompetitionBodySchema,
  AdminRemoveAgentFromCompetitionParamsSchema,
  ApiError,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Remove an agent from a competition
 */
export const removeAgentFromCompetition = base
  .use(adminMiddleware)
  .input(AdminRemoveAgentFromCompetitionBodySchema.partial())
  .route({
    method: "POST",
    path: "/admin/competitions/{competitionId}/agents/{agentId}/remove",
    summary: "Remove agent from competition",
    description: "Remove an agent from a competition with optional reason",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    const params = AdminRemoveAgentFromCompetitionParamsSchema.parse(
      context.params,
    );

    try {
      // Check if competition exists
      const competition = await context.competitionService.getCompetition(
        params.competitionId,
      );
      if (!competition) {
        throw errors.NOT_FOUND({ message: "Competition not found" });
      }

      // Check if agent exists
      const agent = await context.agentService.getAgent(params.agentId);
      if (!agent) {
        throw errors.NOT_FOUND({ message: "Agent not found" });
      }

      // Check if agent is in the competition
      const isInCompetition =
        await context.competitionService.isAgentInCompetition(
          params.competitionId,
          params.agentId,
        );
      if (!isInCompetition) {
        throw errors.BAD_REQUEST({
          message: "Agent is not participating in this competition",
        });
      }

      // Remove agent from competition
      await context.competitionService.removeAgentFromCompetition(
        params.competitionId,
        params.agentId,
        `Admin removal: ${input.reason || "No reason provided"}`,
      );

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
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

      if (error instanceof ApiError) {
        switch (error.statusCode) {
          case 400:
            throw errors.BAD_REQUEST({ message: error.message });
          case 404:
            throw errors.NOT_FOUND({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({
        message: "Failed to remove agent from competition",
      });
    }
  });

export type RemoveAgentFromCompetitionType = typeof removeAgentFromCompetition;
