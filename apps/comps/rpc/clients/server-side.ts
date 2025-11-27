import {
  SafeClient,
  createSafeClient as createSafeRouterClient,
} from "@orpc/client";
import { type RouterClient, createRouterClient } from "@orpc/server";
import { cookies, headers } from "next/headers";

import { createLogger } from "@/lib/logger";
import { privyClient } from "@/lib/privy-client";
import { competitionRepository } from "@/lib/repositories";
import {
  adminService,
  agentService,
  airdropService,
  arenaService,
  balanceService,
  boostAwardService,
  boostService,
  competitionService,
  emailService,
  leaderboardService,
  partnerService,
  portfolioSnapshotterService,
  rewardsService,
  sportsService,
  userService,
} from "@/lib/services";
import { router } from "@/rpc/router/index";

export async function createClient(): Promise<RouterClient<typeof router>> {
  return createRouterClient(router, {
    context: {
      cookies: await cookies(),
      headers: await headers(),
      params: {},
      privyClient,
      adminService,
      airdropService,
      boostService,
      boostAwardService,
      userService,
      competitionService,
      competitionRepository,
      agentService,
      arenaService,
      partnerService,
      balanceService,
      portfolioSnapshotterService,
      emailService,
      leaderboardService,
      rewardsService,
      sportsService,
      logger: createLogger("ServerSideRpcClient"),
    },
  });
}

type Client = Awaited<ReturnType<typeof createClient>>;

export async function createSafeClient(): Promise<SafeClient<Client>> {
  return createSafeRouterClient(await createClient());
}
