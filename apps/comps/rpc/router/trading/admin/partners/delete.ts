import { ORPCError } from "@orpc/server";

import { AdminPartnerParamsSchema } from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Delete a partner
 */
export const deletePartner = base
  .use(adminMiddleware)
  .route({
    method: "DELETE",
    path: "/admin/partners/{id}",
    summary: "Delete partner",
    description: "Delete a partner by ID",
    tags: ["admin"],
  })
  .handler(async ({ context, errors }) => {
    const input = AdminPartnerParamsSchema.parse(context.params);

    try {
      await context.partnerService.delete(input.id);
      return {
        success: true,
        message: `Partner ${input.id} deleted successfully`,
      };
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

      throw errors.INTERNAL({ message: "Failed to delete partner" });
    }
  });

export type DeletePartnerType = typeof deletePartner;
