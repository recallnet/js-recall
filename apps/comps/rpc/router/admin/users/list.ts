import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";

/**
 * List all users
 */
export const listUsers = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .route({
    method: "GET",
    path: "/admin/users",
    summary: "List all users",
    description: "Get a list of all users in the system",
    tags: ["admin"],
  })
  .handler(async ({ context }) => {
    const users = await context.userService.getAllUsers();
    return { success: true, users };
  });

export type ListUsersType = typeof listUsers;
