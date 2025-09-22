import { ORPCError, os } from "@orpc/server";

import { SelectUser } from "@recallnet/db/schema/core/types";

export const authMiddleware = os
  .$context<{
    user: SelectUser | undefined;
  }>()
  .middleware(async ({ context, next }) => {
    if (!context.user) {
      throw new ORPCError("UNAUTHORIZED");
    }
    return await next({
      context: {
        user: context.user,
      },
    });
  });
