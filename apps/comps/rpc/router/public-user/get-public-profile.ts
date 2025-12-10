import { ORPCError } from "@orpc/server";
import { z } from "zod/v4";

import { CacheTags } from "@/lib/cache-tags";
import { base } from "@/rpc/context/base";
import { cacheMiddleware } from "@/rpc/middleware/cache";

/**
 * Public user profile response type
 * Excludes sensitive fields like name and email
 */
export interface PublicUserProfile {
  id: string;
  walletAddress: string;
  imageUrl: string | null;
  metadata: {
    website?: string;
  } | null;
  createdAt: Date;
}

const GetPublicProfileInputSchema = z.object({
  userId: z.uuid(),
});

/**
 * Get a public user profile by ID
 * Returns sanitized user data without PII (name, email)
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

      // Get the user using the service
      const user = await context.userService.getUser(userId);

      if (!user) {
        throw errors.NOT_FOUND({ message: "User not found" });
      }

      // Return sanitized public profile (no name, email, or sensitive data)
      const publicProfile: PublicUserProfile = {
        id: user.id,
        walletAddress: user.walletAddress,
        imageUrl: user.imageUrl,
        metadata: user.metadata,
        createdAt: user.createdAt,
      };

      return { user: publicProfile };
    } catch (error) {
      // Re-throw if already an oRPC error
      if (error instanceof ORPCError) {
        throw error;
      }

      // Handle generic Error instances
      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      // Unknown error type
      throw errors.INTERNAL({ message: "Failed to get public profile" });
    }
  });
