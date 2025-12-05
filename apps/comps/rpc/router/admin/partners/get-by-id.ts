import { AdminPartnerParamsSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Get partner by ID
 */
export const getPartnerById = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminPartnerParamsSchema)
  .route({
    method: "GET",
    path: "/admin/partners/{id}",
    summary: "Get partner by ID",
    description: "Get detailed information about a specific partner",
    tags: ["admin"],
  })
  .handler(async ({ context, input }) => {
    const partner = await context.partnerService.findById(input.id);
    return { success: true, partner };
  });

export type GetPartnerByIdType = typeof getPartnerById;
