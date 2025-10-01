import { SelectUser } from "@recallnet/db/schema/core/types";
import { ActorStatus } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";
import { User as FrontendUser } from "@/types";

/**
 * Serialize database user to frontend format
 * Converts null to undefined and Date objects to ISO strings
 */
function serializeUser(dbUser: SelectUser): FrontendUser {
  return {
    id: dbUser.id,
    walletAddress: dbUser.walletAddress,
    embeddedWalletAddress: dbUser.embeddedWalletAddress ?? undefined,
    walletLastVerifiedAt: dbUser.walletLastVerifiedAt?.toISOString(),
    name: dbUser.name ?? undefined,
    email: dbUser.email ?? "",
    isSubscribed: dbUser.isSubscribed,
    privyId: dbUser.privyId ?? undefined,
    imageUrl: dbUser.imageUrl ?? undefined,
    metadata: dbUser.metadata
      ? (dbUser.metadata as { website?: string })
      : undefined,
    status: dbUser.status as ActorStatus,
    createdAt: dbUser.createdAt.toISOString(),
    updatedAt: dbUser.updatedAt.toISOString(),
    lastLoginAt: dbUser.lastLoginAt?.toISOString(),
  };
}

export const getProfile = base
  .use(authMiddleware)
  .handler(async ({ context, errors }) => {
    try {
      const user = await context.userService.getUser(context.user.id);

      if (!user) {
        throw errors.NOT_FOUND();
      }

      return serializeUser(user);
    } catch (error) {
      // Re-throw if it's already one of our defined errors
      if (error && typeof error === "object" && "code" in error) {
        throw error;
      }

      // Wrap unexpected errors as INTERNAL
      throw errors.INTERNAL({
        message:
          error instanceof Error ? error.message : "Failed to get user profile",
      });
    }
  });
