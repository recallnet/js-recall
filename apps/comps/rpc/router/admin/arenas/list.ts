import { AdminListArenasQuerySchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * List all arenas with pagination
 */
export const listArenas = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminListArenasQuerySchema)
  .route({
    method: "GET",
    path: "/admin/arenas",
    summary: "List all arenas",
    description: "Get paginated list of arenas with optional name filtering",
    tags: ["admin"],
  })
  .handler(async ({ input, context }) => {
    const { nameFilter, ...pagingParams } = input;
    const result = await context.arenaService.findAll(pagingParams, nameFilter);
    return {
      success: true,
      arenas: result.arenas,
      pagination: result.pagination,
    };
  });

export type ListArenasType = typeof listArenas;
