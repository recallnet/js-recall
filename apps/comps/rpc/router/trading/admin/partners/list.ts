import { ORPCError } from "@orpc/server";

import { AdminListPartnersQuerySchema } from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * List all partners with pagination
 */
export const listPartners = base
  .use(adminMiddleware)
  .input(AdminListPartnersQuerySchema)
  .route({
    method: "GET",
    path: "/admin/partners",
    summary: "List all partners",
    description: "Get paginated list of partners with optional name filtering",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    try {
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
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

      if (error instanceof ApiError) {
        switch (error.statusCode) {
          case 400:
            throw errors.BAD_REQUEST({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({ message: "Failed to list partners" });
    }
  });

export type ListPartnersType = typeof listPartners;
