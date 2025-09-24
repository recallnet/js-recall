import { createRouterClient, os } from "@orpc/server";
import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { privyClient } from "@/lib/privy-client";
import { boostService } from "@/lib/services";
import { router } from "@/rpc/router/index";

export const makeClient = async () =>
  createRouterClient(router, {
    context: {
      cookies: await cookies(),
      db,
      privyClient,
      boostService,
    },
  });
