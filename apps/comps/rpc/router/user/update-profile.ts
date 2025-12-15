import { ORPCError } from "@orpc/server";

import { UpdateUserProfileBodySchema } from "@recallnet/services/types";

import { CacheTags, invalidateCacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";

const SANCTIONED_WALLET_ERROR =
  "This wallet address is not permitted for use on this platform";

export const updateProfile = base
  .use(authMiddleware)
  .input(UpdateUserProfileBodySchema)
  .errors({
    FORBIDDEN: {
      message: SANCTIONED_WALLET_ERROR,
    },
  })
  .handler(async ({ input, context, errors }) => {
    try {
      const updatedUser = await context.userService.updateUser({
        id: context.user.id,
        ...input,
      });

      invalidateCacheTags([CacheTags.publicUser(context.user.id)]);

      return updatedUser;
    } catch (error) {
      // Re-throw if already an oRPC error
      if (error instanceof ORPCError) {
        throw error;
      }

      // Handle known Error instances from UserService
      if (error instanceof Error) {
        // Exact match for sanctioned wallet (specific error message)
        if (error.message === SANCTIONED_WALLET_ERROR) {
          throw errors.FORBIDDEN();
        }

        // User not found error (contains "not found" in message)
        if (error.message.includes("not found")) {
          throw errors.NOT_FOUND();
        }

        // All other Error instances - pass message through
        throw errors.INTERNAL({ message: error.message });
      }

      // Unknown error type (not an Error instance)
      throw errors.INTERNAL({ message: "Failed to update profile" });
    }
  });
