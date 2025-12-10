import { AdminListPartnersQuerySchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * List all partners with pagination
 */
export const listPartners = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminListPartnersQuerySchema)
  .route({
    method: "GET",
    path: "/admin/partners",
    summary: "List all partners",
    description: "Get paginated list of partners with optional name filtering",
    tags: ["admin"],
  })
  .handler(async ({ input, context }) => {
    const { nameFilter, ...pagingParams } = input;
    const result = await context.partnerService.findAll(
      pagingParams,
      nameFilter,
    );
    return {
      success: true,
      partners: result.partners,
      pagination: result.pagination,
    };
  });

export type ListPartnersType = typeof listPartners;
