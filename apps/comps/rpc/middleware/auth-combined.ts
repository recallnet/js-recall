import { os } from "@orpc/server";
import { SessionOptions } from "iron-session";
import { cookies } from "next/headers";

import { authMiddleware } from "@/rpc/middleware/auth";
import { ironSessionMiddleware } from "@/rpc/middleware/iron-session";
import { userMiddleware } from "@/rpc/middleware/user";
import { Database } from "@/rpc/types";

export const authCombinedMiddleware = os
  .$context<{
    cookies: Awaited<ReturnType<typeof cookies>>;
    sessionOptions: SessionOptions;
    db: Database;
  }>()
  .middleware(ironSessionMiddleware)
  .concat(userMiddleware)
  .concat(authMiddleware);
