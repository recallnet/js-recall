import { AdminCreateCompetitionSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Create a new competition
 */
export const createCompetition = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminCreateCompetitionSchema)
  .route({
    method: "POST",
    path: "/admin/competition/create",
    summary: "Create a new competition",
    description: "Create a new competition with specified configuration",
    tags: ["admin"],
    successStatus: 201,
  })
  .handler(async ({ input, context }) => {
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
      joinEndDate: input.joinEndDate ? new Date(input.joinEndDate) : undefined,
    });
    return { success: true, competition };
  });

export type CreateCompetitionType = typeof createCompetition;
