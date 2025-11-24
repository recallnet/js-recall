import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Create a new arena
 */
export const createArena = base
  .use(adminMiddleware)
  .input(
    z.object({
      id: z
        .string()
        .regex(/^[a-z0-9-]+$/, "Arena ID must be lowercase kebab-case"),
      name: z.string().min(1),
      createdBy: z.string().min(1),
      category: z.string().min(1),
      skill: z.string().min(1),
      venues: z.array(z.string()).optional(),
      chains: z.array(z.string()).optional(),
    }),
  )
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
