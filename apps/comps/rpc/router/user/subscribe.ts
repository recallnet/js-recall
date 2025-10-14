import { ORPCError } from "@orpc/server";

import { ApiError } from "@recallnet/services/types";

import { authMiddleware } from "@/rpc/middleware/auth";

export const subscribe = authMiddleware.handler(async ({ context, errors }) => {
  try {
    const user = context.user;

    if (!user.email) {
      // Note: this should never happen post-Privy migration since Privy guarantees an email
      throw errors.NOT_FOUND({ message: "User email not found" });
    }

    // If already subscribed, return current state
    if (user.isSubscribed) {
      return {
        userId: user.id,
        isSubscribed: true,
      };
    }

    // Subscribe to Loops mailing list
    const result = await context.emailService.subscribeUser(user.email);

    if (!result?.success) {
      throw errors.SERVICE_UNAVAILABLE({
        message: "Failed to subscribe user to mailing list",
      });
    }

    const updatedUser = await context.userService.updateUser({
      id: user.id,
      isSubscribed: true,
    });

    return {
      userId: user.id,
      isSubscribed: updatedUser.isSubscribed,
    };
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
        case 404:
          throw errors.NOT_FOUND({ message: error.message });
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
    throw errors.INTERNAL({ message: "Failed to subscribe" });
  }
});
