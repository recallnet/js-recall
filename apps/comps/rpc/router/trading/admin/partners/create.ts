import { AdminCreatePartnerSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Create a new partner
 */
export const createPartner = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminCreatePartnerSchema)
  .route({
    method: "POST",
    path: "/admin/partners",
    summary: "Create a new partner",
    description: "Create a new partner for competitions",
    tags: ["admin"],
    successStatus: 201,
  })
  .handler(async ({ input, context }) => {
    const partner = await context.partnerService.createPartner(input);
    context.logger.debug({ partner }, "partner");
    return { success: true, partner };
  });

export type CreatePartnerType = typeof createPartner;
