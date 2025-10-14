import { ORPCError } from "@orpc/server";

import { userMiddleware } from "./user";

export const authMiddleware = userMiddleware.use(async ({ context, next }) => {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({
    context: {
      user: context.user,
    },
  });
});
