import { ORPCError } from "@orpc/server";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { adminMiddleware } from "@/rpc/middleware/admin";

/**
 * List all users
 */
export const listUsers = base
  .use(adminMiddleware)
  .handler(async ({ context, errors }) => {
    try {
      const users = await context.userService.getAllUsers();
      return { success: true, users };
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

      if (error instanceof ApiError) {
        throw errors.INTERNAL({ message: error.message });
      }

      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      throw errors.INTERNAL({ message: "Failed to list users" });
    }
  });

export type ListUsersType = typeof listUsers;
