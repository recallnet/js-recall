import {
  AdminPartnerParamsSchema,
  AdminUpdatePartnerSchema,
} from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Update a partner
 */
export const updatePartner = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminUpdatePartnerSchema.merge(AdminPartnerParamsSchema))
  .route({
    method: "PUT",
    path: "/admin/partners/{id}",
    summary: "Update partner",
    description: "Update an existing partner's information",
    tags: ["admin"],
  })
  .handler(async ({ input, context }) => {
    const { id } = input;
    const updateData = input;
    const partner = await context.partnerService.update(id, updateData);
    return { success: true, partner };
  });

export type UpdatePartnerType = typeof updatePartner;
