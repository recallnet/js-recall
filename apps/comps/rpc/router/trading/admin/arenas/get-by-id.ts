import { ORPCError } from "@orpc/server";

import { AdminArenaParamsSchema } from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Get arena by ID
 */
export const getArenaById = base
  .use(adminMiddleware)
  .input(AdminArenaParamsSchema)
  .route({
    method: "GET",
    path: "/admin/arenas/{id}",
    summary: "Get arena by ID",
    description: "Get detailed information about a specific arena",
    tags: ["admin"],
  })
  .handler(async ({ context, input, errors }) => {
    try {
      const arena = await context.arenaService.findById(input.id);
      return { success: true, arena };
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

      if (error instanceof ApiError) {
        switch (error.statusCode) {
          case 404:
            throw errors.NOT_FOUND({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({ message: "Failed to get arena" });
    }
  });

export type GetArenaByIdType = typeof getArenaById;
