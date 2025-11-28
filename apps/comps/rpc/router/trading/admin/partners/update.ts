import { ORPCError } from "@orpc/server";

import {
  AdminPartnerParamsSchema,
  AdminUpdatePartnerSchema,
} from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Update a partner
 */
export const updatePartner = base
  .use(adminMiddleware)
  .input(AdminUpdatePartnerSchema.merge(AdminPartnerParamsSchema))
  .route({
    method: "PUT",
    path: "/admin/partners/{id}",
    summary: "Update partner",
    description: "Update an existing partner's information",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    try {
      const { id } = input;
      const updateData = input;
      const partner = await context.partnerService.update(id, updateData);
      return { success: true, partner };
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

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

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({ message: "Failed to update partner" });
    }
  });

export type UpdatePartnerType = typeof updatePartner;
