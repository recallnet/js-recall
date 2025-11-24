import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Update an arena
 */
export const updateArena = base
  .use(adminMiddleware)
  .input(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      category: z.string().optional(),
      skill: z.string().optional(),
      venues: z.array(z.string()).optional(),
      chains: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { id, ...updateData } = input;
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
