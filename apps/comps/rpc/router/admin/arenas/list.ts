import { ORPCError } from "@orpc/server";

import { AdminListArenasQuerySchema } from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * List all arenas with pagination
 */
export const listArenas = base
  .use(adminMiddleware)
  .input(AdminListArenasQuerySchema)
  .handler(async ({ input, context, errors }) => {
    try {
      const { nameFilter, ...pagingParams } = input;
      const result = await context.arenaService.findAll(
        pagingParams,
        nameFilter,
      );
      return {
        success: true,
        arenas: result.arenas,
        pagination: result.pagination,
      };
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

      if (error instanceof ApiError) {
        switch (error.statusCode) {
          case 400:
            throw errors.BAD_REQUEST({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({ message: "Failed to list arenas" });
    }
  });

export type ListArenasType = typeof listArenas;
