import { ORPCError } from "@orpc/server";

import { base } from "@/rpc/context/base";

import { userMiddleware } from "./user";

export const authMiddleware = base
  .middleware(userMiddleware)
  .concat(async ({ context, next }) => {
    if (!context.user) {
      throw new ORPCError("UNAUTHORIZED");
    }
    return await next({
      context: {
        user: context.user,
      },
    });
  });
