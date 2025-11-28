import { ORPCError } from "@orpc/server";

import { AdminCreateArenaSchema } from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Create a new arena
 */
export const createArena = base
  .use(adminMiddleware)
  .input(AdminCreateArenaSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      const arena = await context.arenaService.createArena(input);
      return { success: true, arena };
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

      throw errors.INTERNAL({ message: "Failed to create arena" });
    }
  });

export type CreateArenaType = typeof createArena;
