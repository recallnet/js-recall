import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { CacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

/**
 * Get arena by ID
 */
export const getById = base
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .use(
    cacheMiddleware({
      revalidateSecs: 300, // 5 minutes - arena metadata changes infrequently
      getTags: (input) => [CacheTags.arena(input.id)],
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      return await context.arenaService.findById(input.id);
    } catch (error) {
      // Re-throw if already an oRPC error
      if (error instanceof ORPCError) {
        throw error;
      }

      // Handle ApiError instances from service layer
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

      // Handle generic Error instances
      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      // Unknown error type
      throw errors.INTERNAL({ message: "Failed to get arena" });
    }
  });

export type GetByIdType = typeof getById;
