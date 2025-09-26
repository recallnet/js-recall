import {
  SafeClient,
  createSafeClient as createSafeRouterClient,
} from "@orpc/client";
import { createRouterClient } from "@orpc/server";
import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { privyClient } from "@/lib/privy-client";
import { boostService, userService } from "@/lib/services";
import { router } from "@/rpc/router/index";

export async function createClient() {
  return createRouterClient(router, {
    context: {
      cookies: await cookies(),
      db,
      privyClient,
      boostService,
      userService,
    },
  });
}

type Client = Awaited<ReturnType<typeof createClient>>;

export async function createSafeClient(): Promise<SafeClient<Client>> {
  return createSafeRouterClient(await createClient());
}
