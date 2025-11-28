import { ORPCError } from "@orpc/server";

import { AdminRegisterUserSchema } from "@recallnet/services/types";
import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * Register a new user and optionally create their first agent
 */
export const registerUser = base
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
  .handler(async ({ input, context, errors }) => {
    try {
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

      throw errors.INTERNAL({ message: "Failed to register user" });
    }
  });

export type RegisterUserType = typeof registerUser;
