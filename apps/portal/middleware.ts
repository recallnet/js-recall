import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathnameIn = request.nextUrl.pathname;

  const basePathRegex = /^(\/buckets\/0x[a-fA-F0-9]+)\//;
  const match = pathnameIn.match(basePathRegex);

  if (!match) return NextResponse.next();

  const basePathLength = match[0].length;
  const bucketPath = pathnameIn.substring(basePathLength);

  const pathname = match[1] ?? "";

  const isObject = request.nextUrl.searchParams.has("object");
  const path = bucketPath + (isObject ? "" : "/");

  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.searchParams.delete("object");
  url.searchParams.set("path", path);

  return NextResponse.redirect(url);
}

export const config = {
  matcher: "/buckets/:address/:path+",
};
