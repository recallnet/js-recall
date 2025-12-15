import {
  AdminArenaParamsSchema,
  AdminUpdateArenaSchema,
} from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Update an arena
 */
export const updateArena = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminArenaParamsSchema.merge(AdminUpdateArenaSchema))
  .route({
    method: "PUT",
    path: "/admin/arenas/{id}",
    summary: "Update arena",
    description: "Update an existing arena's configuration",
    tags: ["admin"],
  })
  .handler(async ({ input, context }) => {
    const { id } = input;
    const updateData = input;
    const arena = await context.arenaService.update(id, updateData);
    return { success: true, arena };
  });

export type UpdateArenaType = typeof updateArena;
