import { base } from "@/rpc/context/base";

export const privyUserMiddleware = base.use(async ({ context, next }) => {
  try {
    const idToken = context.cookies.get("privy-id-token")?.value;
    const user = idToken
      ? await context.privyClient.getUser({ idToken: idToken })
      : undefined;
    return next({
      context: {
        privyUser: user,
        privyIdToken: idToken,
      },
    });
  } catch {
    return next({
      context: {
        privyUser: undefined,
        privyIdToken: undefined,
      },
    });
  }
});
