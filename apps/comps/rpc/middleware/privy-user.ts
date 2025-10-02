import { PrivyClient } from "@privy-io/server-auth";
import { cookies } from "next/headers";

import { base } from "@/rpc/context/base";

export const privyUserMiddleware = base.middleware(
  async ({ context, next }) => {
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
    } catch (error) {
      return await next({
        context: {
          privyUser: undefined,
          privyIdToken: undefined,
        },
      });
    }
  },
);
