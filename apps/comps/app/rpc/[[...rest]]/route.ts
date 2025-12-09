import { RPCHandler } from "@orpc/server/fetch";
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
  boostBonusService,
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

const handler = new RPCHandler(router);

async function handleRequest(
  request: Request,
  { params }: { params: Promise<Record<string, string | string[]>> },
) {
  const { response } = await handler.handle(request, {
    prefix: "/rpc",
    context: {
      cookies: await cookies(),
      headers: await headers(),
      params: await params,
      privyClient,
      adminService,
      airdropService,
      boostService,
      boostAwardService,
      boostBonusService,
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
      logger: createLogger("RpcHandler"),
    },
  });

  return response ?? new Response("Not found", { status: 404 });
}

export const HEAD = handleRequest;
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
