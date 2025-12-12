import { AdminSetupSchema } from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Setup initial admin account
 * This route does not require authentication as it's for initial setup
 */
export const setupAdmin = adminBase
  .use(errorHandlerMiddleware)
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
  .handler(async ({ input, context }) => {
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
  });

export type SetupAdminType = typeof setupAdmin;
