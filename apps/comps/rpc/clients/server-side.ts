import { createRouterClient, os } from "@orpc/server";
import { cookies } from "next/headers";

import { db } from "@/db";
import { router } from "@/rpc/router/index";
import { sessionOptions } from "@/session";

export const makeClient = async () =>
  createRouterClient(router, {
    context: {
      cookies: await cookies(),
      db,
      sessionOptions,
    },
  });
