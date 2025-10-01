import { base } from "@/rpc/context/base";

import { privyUserMiddleware } from "./privy-user";

export const userMiddleware = base
  .middleware(privyUserMiddleware)
  .concat(async ({ context, next }) => {
    const privyId = context.privyUser?.id;
    if (!privyId) {
      return await next({
        context: {
          user: undefined,
        },
      });
    }

    const user = await context.userService.getUserByPrivyId(privyId);

    return await next({
      context: {
        user: user || undefined,
      },
    });
  });
