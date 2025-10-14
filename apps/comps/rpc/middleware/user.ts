import { privyUserMiddleware } from "./privy-user";

export const userMiddleware = privyUserMiddleware.use(
  async ({ context, next }) => {
    const privyId = context.privyUser?.id;
    if (!privyId) {
      return next({
        context: {
          user: undefined,
        },
      });
    }

    const user = await context.userService.getUserByPrivyId(privyId);

    return next({
      context: {
        user: user || undefined,
      },
    });
  },
);
