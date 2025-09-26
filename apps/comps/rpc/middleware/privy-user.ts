import { PrivyClient } from "@privy-io/node";
import { cookies } from "next/headers";

import { base } from "@/rpc/context/base";

export const privyUserMiddleware = base.middleware(
  async ({ context, next }) => {
    try {
      const idToken = context.cookies.get("privy-id-token")?.value;
      const user = idToken
        ? await context.privyClient.users().get({ id_token: idToken })
        : undefined;
      return next({
        context: {
          privyUser: user,
        },
      });
    } catch (error) {
      return await next({
        context: {
          privyUser: undefined,
        },
      });
    }
  },
);
