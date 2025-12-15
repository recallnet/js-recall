import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { CacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

const GetPublicProfileInputSchema = z.object({
  userId: z.uuid(),
});

/**
 * Get a public user profile by ID
 * Returns sanitized user data without PII (email)
 */
export const getPublicProfile = base
  .input(GetPublicProfileInputSchema)
  .use(
    cacheMiddleware({
      revalidateSecs: 60,
      getTags: (input) => [CacheTags.publicUser(input.userId)],
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { userId } = input;
      const user = await context.userService.getUser(userId);
      if (!user) {
        throw errors.NOT_FOUND({ message: "User not found" });
      }

      // Return sanitized public profile (no email or sensitive data)
      // Only include allowed metadata fields (website)
      return {
        user: {
          id: user.id,
          name: user.name,
          walletAddress: user.walletAddress,
          imageUrl: user.imageUrl,
          metadata: user.metadata ? { website: user.metadata.website } : null,
          createdAt: user.createdAt,
        },
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
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      // Handle generic Error instances
      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      // Unknown error type
      throw errors.INTERNAL({ message: "Failed to get public profile" });
    }
  });
