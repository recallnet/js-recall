import {
  SafeClient,
  createSafeClient as createSafeRouterClient,
} from "@orpc/client";
import { type RouterClient, createRouterClient } from "@orpc/server";
import { cookies } from "next/headers";

import { createLogger } from "@/lib/logger";
import { privyClient } from "@/lib/privy-client";
import {
  agentService,
  airdropService,
  boostAwardService,
  boostService,
  competitionService,
  emailService,
  leaderboardService,
  rewardsService,
  userService,
} from "@/lib/services";
import { router } from "@/rpc/router/index";

export async function createClient(): Promise<RouterClient<typeof router>> {
  return createRouterClient(router, {
    context: {
      cookies: await cookies(),
      privyClient,
      airdropService,
      boostService,
      boostAwardService,
      userService,
      competitionService,
      agentService,
      emailService,
      leaderboardService,
      rewardsService,
      logger: createLogger("ServerSideRpcClient"),
    },
  });
}

type Client = Awaited<ReturnType<typeof createClient>>;

export async function createSafeClient(): Promise<SafeClient<Client>> {
  return createSafeRouterClient(await createClient());
}
