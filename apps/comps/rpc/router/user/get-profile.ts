import { SelectUser } from "@recallnet/db/schema/core/types";
import { ActorStatus } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";
import { User } from "@/types";

/**
 * Serialize database user to frontend format
 * Converts null to undefined and Date objects to ISO strings to match frontend expectations
 */
function serializeUser(dbUser: SelectUser): User {
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
  .handler(async ({ context }) => {
    return serializeUser(context.user);
  });
