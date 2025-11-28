import { ORPCError } from "@orpc/server";

import { AdminPartnerParamsSchema } from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Get partner by ID
 */
export const getPartnerById = base
  .use(adminMiddleware)
  .handler(async ({ context, errors }) => {
    const input = AdminPartnerParamsSchema.parse(context.params);

    try {
      const partner = await context.partnerService.findById(input.id);
      return { success: true, partner };
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

      if (error instanceof ApiError) {
        switch (error.statusCode) {
          case 404:
            throw errors.NOT_FOUND({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({ message: "Failed to get partner" });
    }
  });

export type GetPartnerByIdType = typeof getPartnerById;
