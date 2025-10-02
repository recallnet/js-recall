import {
  SafeClient,
  createSafeClient as createSafeRouterClient,
} from "@orpc/client";
import { createRouterClient } from "@orpc/server";
import { cookies } from "next/headers";

import { privyClient } from "@/lib/privy-client";
import {
  agentService,
  boostAwardService,
  boostService,
  userService,
} from "@/lib/services";
import { router } from "@/rpc/router/index";

export async function createClient() {
  return createRouterClient(router, {
    context: {
      cookies: await cookies(),
      privyClient,
      boostService,
      boostAwardService,
      userService,
      agentService,
    },
  });
}

type Client = Awaited<ReturnType<typeof createClient>>;

export async function createSafeClient(): Promise<SafeClient<Client>> {
  return createSafeRouterClient(await createClient());
}
