import { NextRequest } from "next/server";

import { API_BASE_URL } from "@/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Route context type
 */
interface RouteContext {
  params: Promise<{ path: string[] }>;
}

/**
 * Build the upstream URL
 * @param req - The request to proxy
 * @param path - The path to proxy the request to
 * @returns The upstream URL
 */
function buildUpstreamUrl(req: Request, path: string[]): URL {
  if (!API_BASE_URL) {
    throw new Error("API_BASE_URL is not set");
  }
  const incoming = new URL(req.url);
  const safePath = (path ?? []).map(encodeURIComponent).join("/");
  const url = new URL(`${API_BASE_URL.replace(/\/+$/, "")}/${safePath}`);
  url.search = incoming.search; // preserve query string
  return url;
}

/**
 * Build the headers for the upstream request
 * @param req - The request to proxy
 * @param token - The token to use for authentication
 * @returns The headers for the upstream request
 */
function buildHeaders(req: Request): Headers {
  const incoming = new Headers(req.headers);

  // Header allowlist
  const hdr = new Headers();

  // Typical safe forwards
  const accept = incoming.get("accept");
  if (accept) hdr.set("accept", accept);
  const acceptLang = incoming.get("accept-language");
  if (acceptLang) hdr.set("accept-language", acceptLang);
  const contentType = incoming.get("content-type");
  if (contentType) hdr.set("content-type", contentType);
  const cookie = incoming.get("cookie");
  if (cookie) hdr.set("cookie", cookie);
  const userAgent = incoming.get("user-agent");
  if (userAgent) hdr.set("user-agent", userAgent);
  const acceptEncoding = incoming.get("accept-encoding");
  if (acceptEncoding) hdr.set("accept-encoding", acceptEncoding);

  // Forward origin/referrer (e.g., for CSRF checks upstream)
  const origin = incoming.get("origin");
  if (origin) hdr.set("origin", origin);
  const referer = incoming.get("referer");
  if (referer) hdr.set("referer", referer);

  // Proxy headers that are helpful for Express behind proxy
  const xfwdFor = incoming.get("x-forwarded-for");
  if (xfwdFor) hdr.set("x-forwarded-for", xfwdFor);
  const xfwdHost = incoming.get("x-forwarded-host") ?? incoming.get("host");
  if (xfwdHost) hdr.set("x-forwarded-host", xfwdHost);
  const xfwdProto = incoming.get("x-forwarded-proto") ?? "https";
  hdr.set("x-forwarded-proto", xfwdProto);

  return hdr;
}

/**
 * Proxy a request to the core backend competitions API
 * @param req - The request to proxy
 * @param path - The path to proxy the request to
 * @returns The response from the core backend competitions API
 */
async function proxy(req: Request, path: string[]) {
  // 2) Build core backend competitions API URL safely & prepare headers
  const upstreamUrl = buildUpstreamUrl(req, path);
  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const init: RequestInit & { cache?: RequestCache } = {
    method,
    headers: buildHeaders(req),
    cache: "no-store",
    signal: req.signal,
  };

  // 3) Only attach a body for methods that support it
  if (hasBody) {
    // Consume body safely (note: `fetch` will set content-length)
    const body = await req.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
  }

  // 4) Fetch from the core backend competitions API
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, init);
  } catch (e) {
    return Response.json(
      { error: "Bad gateway", detail: String(e) },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  // 5) Copy headers
  const respHeaders = new Headers(upstream.headers);

  // 6) Strongly discourage CDN caching of proxied responses
  respHeaders.set("cache-control", "no-store");

  // 7) Remove compression and hop-by-hop headers to match actual bytes
  respHeaders.delete("content-encoding");
  respHeaders.delete("content-length");
  respHeaders.delete("transfer-encoding");
  respHeaders.delete("connection");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
}

/**
 * Handle a request to the proxy endpoint
 * @param req - The request to handle
 * @param ctx - The route context
 * @returns The response from the proxy endpoint
 */
async function handle(req: NextRequest | Request, ctx: RouteContext) {
  const { path } = await ctx.params;
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": "content-type, authorization",
        "cache-control": "no-store",
      },
    });
  }
  if (req.method === "HEAD") {
    const res = await proxy(req, path);
    return new Response(null, { status: res.status, headers: res.headers });
  }
  return proxy(req, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
