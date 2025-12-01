import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError, UuidSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

const ReactivateAgentInCompetitionParamsSchema = z.object({
  competitionId: UuidSchema,
  agentId: UuidSchema,
});

/**
 * Reactivate an agent in a competition
 */
export const reactivateAgentInCompetition = base
  .use(adminMiddleware)
  .input(ReactivateAgentInCompetitionParamsSchema)
  .route({
    method: "POST",
    path: "/admin/competitions/{competitionId}/agents/{agentId}/reactivate",
    summary: "Reactivate agent in competition",
    description: "Reactivate a previously deactivated agent in a competition",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    try {
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

      // Reactivate agent in competition
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
        message: "Failed to reactivate agent in competition",
      });
    }
  });

export type ReactivateAgentInCompetitionType =
  typeof reactivateAgentInCompetition;
