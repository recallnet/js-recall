import { ORPCError } from "@orpc/server";

import {
  AdminArenaParamsSchema,
  AdminUpdateArenaSchema,
} from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Update an arena
 */
export const updateArena = base
  .use(adminMiddleware)
  .input(AdminArenaParamsSchema.merge(AdminUpdateArenaSchema))
  .route({
    method: "PUT",
    path: "/admin/arenas/{id}",
    summary: "Update arena",
    description: "Update an existing arena's configuration",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    try {
      const { id } = input;
      const updateData = input;
      const arena = await context.arenaService.update(id, updateData);
      return { success: true, arena };
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

      throw errors.INTERNAL({ message: "Failed to update arena" });
    }
  });

export type UpdateArenaType = typeof updateArena;
