import { os } from "@orpc/server";
import { SessionOptions, getIronSession } from "iron-session";
import { cookies } from "next/headers";

import { SessionData } from "@/rpc/types";

export const ironSessionMiddleware = os
  .$context<{
    cookies: Awaited<ReturnType<typeof cookies>>;
    sessionOptions: SessionOptions;
  }>()
  .middleware(async ({ context, next }) => {
    const ironSession = await getIronSession<SessionData>(
      context.cookies,
      context.sessionOptions,
    );

    // Session expiry check
    if (
      ironSession.siwe &&
      ironSession.siwe.expirationTime &&
      Date.now() > new Date(ironSession.siwe.expirationTime).getTime()
    ) {
      ironSession.adminId = undefined;
      ironSession.agentId = undefined;
      ironSession.nonce = undefined;
      ironSession.siwe = undefined;
      ironSession.userId = undefined;
      ironSession.wallet = undefined;
      ironSession.destroy();
    }

    const result = await next({
      context: {
        ironSession,
      },
    });

    return result;
  });
