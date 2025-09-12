import { cookies } from "next/headers";

import { API_BASE_URL } from "@/config";

async function proxy(req: Request, path: string[]) {
  // 1) Read HttpOnly cookie server-side (SameSite Strict is fine here)
  const token = (await cookies()).get("privy-id-token")?.value;

  // 2) Build upstream URL safely
  const incomingUrl = new URL(req.url);
  const safePath = (path ?? []).map(encodeURIComponent).join("/");
  const upstreamUrl = new URL(`${API_BASE_URL}/${safePath}`);
  upstreamUrl.search = incomingUrl.search; // preserve query string

  // 3) Prepare headers for upstream (don’t leak app cookies)
  const hdr = new Headers(req.headers);
  hdr.delete("cookie"); // remove app cookies
  hdr.delete("host");
  hdr.delete("connection");
  hdr.delete("keep-alive");
  hdr.delete("transfer-encoding");
  hdr.delete("upgrade");
  hdr.delete("accept-encoding");
  hdr.delete("content-length");

  // Authenticate upstream via cookie only if a token exists
  if (token) {
    hdr.set("cookie", `privy-id-token=${token}`);
  }

  const method = req.method;
  const hasBody = !["GET", "HEAD"].includes(method);

  type NextFetchInit = RequestInit & {
    next?: { revalidate?: number };
    cache?: RequestCache;
  };

  const fetchInit: NextFetchInit = {
    method,
    headers: hdr,
  };

  // Only attach a body for methods that support it
  if (hasBody) {
    const bodyBuffer = await req.arrayBuffer();
    if (bodyBuffer && bodyBuffer.byteLength > 0) {
      fetchInit.body = bodyBuffer;
    }
  }

  const upstream = await fetch(upstreamUrl, fetchInit);

  // 4) Don’t forward Set-Cookie from another domain
  const respHeaders = new Headers(upstream.headers);
  respHeaders.delete("set-cookie");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
}

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

async function handleRequest(req: Request, ctx: RouteContext) {
  const params = await ctx.params;
  const { path } = params;
  return proxy(req, path);
}

export async function GET(req: Request, ctx: RouteContext) {
  return handleRequest(req, ctx);
}

export async function POST(req: Request, ctx: RouteContext) {
  return handleRequest(req, ctx);
}

export async function PUT(req: Request, ctx: RouteContext) {
  return handleRequest(req, ctx);
}

export async function PATCH(req: Request, ctx: RouteContext) {
  return handleRequest(req, ctx);
}

export async function DELETE(req: Request, ctx: RouteContext) {
  return handleRequest(req, ctx);
}
