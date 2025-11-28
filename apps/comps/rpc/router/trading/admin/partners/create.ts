import { ORPCError } from "@orpc/server";

import { AdminCreatePartnerSchema } from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Create a new partner
 */
export const createPartner = base
  .use(adminMiddleware)
  .input(AdminCreatePartnerSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      const partner = await context.partnerService.createPartner(input);
      return { success: true, partner };
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

      throw errors.INTERNAL({ message: "Failed to create partner" });
    }
  });

export type CreatePartnerType = typeof createPartner;
