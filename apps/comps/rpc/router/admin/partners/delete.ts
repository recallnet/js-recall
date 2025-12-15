import { AdminPartnerParamsSchema } from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Delete a partner
 */
export const deletePartner = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminPartnerParamsSchema)
  .route({
    method: "DELETE",
    path: "/admin/partners/{id}",
    summary: "Delete partner",
    description: "Delete a partner by ID",
    tags: ["admin"],
  })
  .handler(async ({ context, input }) => {
    await context.partnerService.delete(input.id);
    return {
      success: true,
      message: `Partner ${input.id} deleted successfully`,
    };
  });

export type DeletePartnerType = typeof deletePartner;
