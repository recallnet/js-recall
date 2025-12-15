import { AdminCreateArenaSchema } from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Create a new arena
 */
export const createArena = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminCreateArenaSchema)
  .route({
    method: "POST",
    path: "/admin/arenas",
    summary: "Create a new arena",
    description: "Create a new arena with specified configuration",
    tags: ["admin"],
    successStatus: 201,
  })
  .handler(async ({ input, context }) => {
    const arena = await context.arenaService.createArena(input);
    return { success: true, arena };
  });

export type CreateArenaType = typeof createArena;
