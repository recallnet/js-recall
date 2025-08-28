import { ORPCError, os } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { cookies, headers } from "next/headers";

import { router } from "@/rpc/router";

const handler = new RPCHandler(router);

async function handleRequest(request: Request) {
  const { response } = await handler.handle(request, {
    prefix: "/rpc",
    context: {
      headers: await headers(),
      cookies: await cookies(),
      cookieName: process.env.SESSION_COOKIE_NAME || "recall_session",
      cookiePassword:
        process.env.SESSION_COOKIE_PW ||
        "complex_password_at_least_32_characters_long",
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
