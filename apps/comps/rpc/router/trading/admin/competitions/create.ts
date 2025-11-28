import { ORPCError } from "@orpc/server";

import {
  AdminCreateCompetitionSchema,
  ApiError,
} from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Create a new competition
 */
export const createCompetition = base
  .use(adminMiddleware)
  .input(AdminCreateCompetitionSchema)
  .route({
    method: "POST",
    path: "/admin/competition/create",
    summary: "Create a new competition",
    description: "Create a new competition with specified configuration",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    try {
      const competition = await context.competitionService.createCompetition({
        ...input,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        boostStartDate: input.boostStartDate
          ? new Date(input.boostStartDate)
          : undefined,
        boostEndDate: input.boostEndDate
          ? new Date(input.boostEndDate)
          : undefined,
        joinStartDate: input.joinStartDate
          ? new Date(input.joinStartDate)
          : undefined,
        joinEndDate: input.joinEndDate
          ? new Date(input.joinEndDate)
          : undefined,
      });
      return { success: true, competition };
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

      if (error instanceof ApiError) {
        switch (error.statusCode) {
          case 400:
            throw errors.BAD_REQUEST({ message: error.message });
          case 409:
            throw errors.CONFLICT({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({ message: "Failed to create competition" });
    }
  });

export type CreateCompetitionType = typeof createCompetition;
