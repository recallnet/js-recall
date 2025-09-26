import { SelectUser } from "@recallnet/db/schema/core/types";

import { base } from "@/rpc/context/base";
import { userMiddleware } from "@/rpc/middleware/user";

/**
 * Convert database user to frontend-compatible format
 */
function toFrontendUser(dbUser: SelectUser) {
  return {
    id: dbUser.id,
    walletAddress: dbUser.walletAddress,
    walletLastVerifiedAt: dbUser.walletLastVerifiedAt?.toISOString(),
    embeddedWalletAddress: dbUser.embeddedWalletAddress ?? undefined,
    privyId: dbUser.privyId ?? undefined,
    status: dbUser.status as "active" | "inactive" | "suspended" | "deleted",
    name: dbUser.name ?? undefined,
    email: dbUser.email ?? "",
    isSubscribed: dbUser.isSubscribed,
    imageUrl: dbUser.imageUrl ?? undefined,
    metadata: dbUser.metadata
      ? (dbUser.metadata as { website?: string })
      : undefined,
    createdAt: dbUser.createdAt.toISOString(),
    updatedAt: dbUser.updatedAt.toISOString(),
    lastLoginAt: dbUser.lastLoginAt?.toISOString(),
  };
}

export const profile = base
  .use(userMiddleware)
  .handler(async ({ context, errors }) => {
    if (!context.user) {
      throw errors.UNAUTHORIZED();
    }

    return toFrontendUser(context.user);
  });
