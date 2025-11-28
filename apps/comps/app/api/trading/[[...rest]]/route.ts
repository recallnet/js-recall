import { OpenAPIHandler } from "@orpc/openapi/fetch";
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
import { router } from "@/rpc/router/trading/index";

const openApiHandler = new OpenAPIHandler(router);

async function handleRequest(
  request: Request,
  { params }: { params: Promise<Record<string, string | string[]>> },
) {
  const { matched, response } = await openApiHandler.handle(request, {
    prefix: "/api/trading",
    context: {
      cookies: await cookies(),
      headers: await headers(),
      params: await params,
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
      logger: createLogger("OpenApiHandler"),
    },
  });

  if (matched) {
    return response;
  }

  return new Response("Not found", { status: 404 });
}

export const HEAD = handleRequest;
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
