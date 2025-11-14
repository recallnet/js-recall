import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError, PagingParamsSchema } from "@recallnet/services/types";

import { CacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

/**
 * List all arenas with pagination
 */
export const list = base
  .input(
    PagingParamsSchema.extend({
      name: z.string().optional(),
    }),
  )
  .use(
    cacheMiddleware({
      revalidateSecs: 300, // 5 minutes - arenas change infrequently
      getTags: () => [CacheTags.arenaList()],
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      return await context.arenaService.findAll(input, input.name);
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
      throw errors.INTERNAL({ message: "Failed to list arenas" });
    }
  });

export type ListType = typeof list;
