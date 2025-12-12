import { AdminArenaParamsSchema } from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Get arena by ID
 */
export const getArenaById = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminArenaParamsSchema)
  .route({
    method: "GET",
    path: "/admin/arenas/{id}",
    summary: "Get arena by ID",
    description: "Get detailed information about a specific arena",
    tags: ["admin"],
  })
  .handler(async ({ context, input }) => {
    const arena = await context.arenaService.findById(input.id);
    return { success: true, arena };
  });

export type GetArenaByIdType = typeof getArenaById;
