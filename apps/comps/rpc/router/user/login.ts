import { ORPCError } from "@orpc/server";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";

/**
 * Authenticate user with Privy identity token and update/create user record.
 *
 * Handles the following scenarios:
 * - Post-Privy users with existing privyId in database
 * - Post-legacy but pre-Privy users (email exists)
 * - Legacy users (only wallet address exists)
 * - Brand new users (creates new record)
 */
export const login = base.handler(async ({ context, errors }) => {
  try {
    // Extract Privy identity token from cookies
    const idToken = context.cookies.get("privy-id-token")?.value;

    if (!idToken) {
      throw errors.UNAUTHORIZED({ message: "No authentication token found" });
    }

    // Authenticate and create/update user record
    const user = await context.userService.loginWithPrivyToken(
      idToken,
      context.privyClient,
    );

    return user;
  } catch (error) {
    // Re-throw if already an oRPC error
    if (error instanceof ORPCError) {
      throw error;
    }

    // Handle ApiError instances from service layer
    if (error instanceof ApiError) {
      switch (error.statusCode) {
        case 400:
          throw errors.BAD_REQUEST({ message: error.message });
        case 401:
          throw errors.UNAUTHORIZED({ message: error.message });
        case 409:
          throw errors.CONFLICT({ message: error.message });
        case 502:
        case 503:
          throw errors.SERVICE_UNAVAILABLE({ message: error.message });
        default:
          throw errors.INTERNAL({ message: error.message });
      }
    }

    // Handle generic Error instances
    if (error instanceof Error) {
      throw errors.INTERNAL({ message: error.message });
    }

    // Unknown error type
    throw errors.INTERNAL({ message: "Failed to login" });
  }
});
