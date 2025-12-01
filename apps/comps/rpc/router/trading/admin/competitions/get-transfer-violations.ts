import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError, UuidSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

const GetTransferViolationsParamsSchema = z.object({
  competitionId: UuidSchema,
});

/**
 * Get transfer violations for a competition
 */
export const getTransferViolations = base
  .use(adminMiddleware)
  .input(GetTransferViolationsParamsSchema)
  .route({
    method: "GET",
    path: "/admin/competition/{competitionId}/transfer-violations",
    summary: "Get transfer violations",
    description: "Get all agents with transfer violations in a competition",
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

      // Get transfer violations
      const violations =
        await context.competitionService.getCompetitionTransferViolations(
          input.competitionId,
        );

      return {
        success: true,
        violations,
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
        message: "Failed to get transfer violations",
      });
    }
  });

export type GetTransferViolationsType = typeof getTransferViolations;
