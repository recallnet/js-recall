import { base } from "@/rpc/context/base";

import { privyUserMiddleware } from "./privy-user";

export const userMiddleware = base
  .middleware(privyUserMiddleware)
  .concat(async ({ context, next }) => {
    const userId = context.privyUser?.id;
    if (!userId) {
      return await next({
        context: {
          user: undefined,
        },
      });
    }

    const userResult = await context.userService.getUserByPrivyId(userId);
    const user = userResult.isOk() ? userResult.value : undefined;

    return await next({
      context: {
        user,
      },
    });
  });
