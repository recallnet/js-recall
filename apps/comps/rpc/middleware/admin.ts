import { ORPCError } from "@orpc/server";
import { Logger } from "pino";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/admin";

/**
 * Admin Authentication Middleware
 *
 * Validates admin API key and ensures the user has admin privileges.
 * The API key should be stored in a cookie named "admin-api-key".
 *
 * Note: For security, admin API keys should be transmitted securely.
 * This implementation uses cookies, but you may also accept the API key
 * as an input parameter if needed.
 */
export const adminMiddleware = base.middleware(
  async ({ context, next, errors }) => {
    try {
      const apiKey = extractApiKey(context, errors);

      // Validate admin API key
      const adminId = await context.adminService.validateApiKey(apiKey);
      if (!adminId) {
        throw errors.UNAUTHORIZED({
          message:
            "Invalid admin API key. This key may have been reset or is no longer associated with an active admin account.",
        });
      }

      // Get the admin details
      const admin = await context.adminService.getAdmin(adminId);

      if (!admin || admin.status !== "active") {
        throw errors.UNAUTHORIZED({
          message: "Admin access denied - account inactive",
        });
      }

      // Add admin information to context
      return await next({
        context: {
          admin: {
            id: adminId,
            username: admin.username,
            name: admin.name || admin.username,
          },
        },
      });
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ORPCError("INTERNAL", {
        message: "Failed to authenticate admin",
      });
    }
  },
);

function extractApiKey(
  context: { headers: Headers; logger: Logger },
  errors: { UNAUTHORIZED: (opts?: { message: string }) => Error },
): string {
  const authHeader = context.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw errors.UNAUTHORIZED();
  }

  const apiKey = authHeader.substring(7);

  if (!apiKey) {
    throw errors.UNAUTHORIZED({
      message:
        "Admin authentication required. Use Authorization: Bearer YOUR_ADMIN_API_KEY",
    });
  }

  // Log partial key for debugging (only first 8 chars)
  const partialKey = apiKey ? `${apiKey.substring(0, 8)}...` : "undefined";
  context.logger.debug(`Using API Key: ${partialKey}`);

  return apiKey;
}
