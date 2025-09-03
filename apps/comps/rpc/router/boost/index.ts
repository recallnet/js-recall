import { os } from "@orpc/server";
import { SessionOptions } from "iron-session";
import { cookies, headers } from "next/headers";

import { authCombinedMiddleware } from "@/rpc/middleware/auth-combined";
import { Database } from "@/rpc/types";

import { balance } from "./balance";
import { boostAgent } from "./boost-agent";

export const router = os
  .$context<{
    cookies: Awaited<ReturnType<typeof cookies>>;
    sessionOptions: SessionOptions;
    db: Database;
  }>()
  .use(authCombinedMiddleware)
  .router({
    balance: balance,
    boostAgent: boostAgent,
  });
