import { ORPCError } from "@orpc/server";

import { AdminSetupSchema, ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";

/**
 * Setup initial admin account
 * This route does not require authentication as it's for initial setup
 */
export const setupAdmin = base
  .input(AdminSetupSchema)
  .route({
    method: "POST",
    path: "/admin/setup",
    summary: "Set up initial admin account",
    description:
      "Creates the first admin account. This endpoint is only available when no admin exists in the system.",
    tags: ["admin"],
    successStatus: 201,
  })
  .handler(async ({ input, context, errors }) => {
    try {
      // Create admin account
      const admin = await context.adminService.setupInitialAdmin(
        input.username,
        input.password,
        input.email,
      );

      return {
        success: true,
        message: "Admin account created successfully",
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          createdAt: admin.createdAt,
          apiKey: admin.apiKey,
        },
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

      throw errors.INTERNAL({ message: "Failed to setup admin account" });
    }
  });

export type SetupAdminType = typeof setupAdmin;
