import { AdminArenaParamsSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Delete an arena
 */
export const deleteArena = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminArenaParamsSchema)
  .route({
    method: "DELETE",
    path: "/admin/arenas/{id}",
    summary: "Delete arena",
    description: "Delete an arena by ID",
    tags: ["admin"],
  })
  .handler(async ({ context, input }) => {
    await context.arenaService.delete(input.id);
    return {
      success: true,
      message: `Arena ${input.id} deleted successfully`,
    };
  });

export type DeleteArenaType = typeof deleteArena;
