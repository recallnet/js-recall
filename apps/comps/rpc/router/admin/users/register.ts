import { AdminRegisterUserSchema } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * Register a new user and optionally create their first agent
 */
export const registerUser = base
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminRegisterUserSchema)
  .route({
    method: "POST",
    path: "/admin/users",
    summary: "Register a new user",
    description:
      "Admin-only endpoint to register a new user and optionally create their first agent",
    tags: ["admin"],
  })
  .handler(async ({ input, context }) => {
    const { user, agent, agentError } =
      await context.adminService.registerUserAndAgent(input);

    // Handle case where agent creation failed but user was created successfully
    if (agentError) {
      return {
        success: true,
        user,
        agentError,
      };
    }

    return {
      success: true,
      user,
      agent,
    };
  });

export type RegisterUserType = typeof registerUser;
