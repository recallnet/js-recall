import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError, UuidSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

const GetCompetitionSnapshotsParamsSchema = z.object({
  competitionId: UuidSchema,
});

const GetCompetitionSnapshotsQuerySchema = z.object({
  agentId: UuidSchema.optional(),
});

/**
 * Get portfolio snapshots for an agent in a competition
 */
export const getCompetitionSnapshots = base
  .use(adminMiddleware)
  .input(
    GetCompetitionSnapshotsParamsSchema.merge(
      GetCompetitionSnapshotsQuerySchema,
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
    try {
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
        message: "Failed to get competition snapshots",
      });
    }
  });

export type GetCompetitionSnapshotsType = typeof getCompetitionSnapshots;
