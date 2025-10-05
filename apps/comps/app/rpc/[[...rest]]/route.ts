import { RPCHandler } from "@orpc/server/fetch";
import { cookies } from "next/headers";

import { privyClient } from "@/lib/privy-client";
import {
  agentService,
  boostAwardService,
  boostService,
  competitionService,
  emailService,
  leaderboardService,
  userService,
} from "@/lib/services";
import { router } from "@/rpc/router/index";

const handler = new RPCHandler(router);

async function handleRequest(request: Request) {
  const { response } = await handler.handle(request, {
    prefix: "/rpc",
    context: {
      cookies: await cookies(),
      privyClient,
      boostService,
      boostAwardService,
      userService,
      competitionService,
      agentService,
      emailService,
      leaderboardService,
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
