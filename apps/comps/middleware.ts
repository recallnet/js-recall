import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Only intercept API calls
  if (request.nextUrl.pathname.startsWith("/api/")) {
    // Get the backend URL from environment variables
    const backendUrl =
      process.env.BACKEND_API_URL ||
      process.env.DEFAULT_API_URL ||
      "https://api.competitions.recall.network/api";

    // Build the proxied URL
    const apiPath = request.nextUrl.pathname.replace("/api", "");
    const searchParams = request.nextUrl.search;
    const targetUrl = `${backendUrl}${apiPath}${searchParams}`;

    // Create the proxied request
    const headers = new Headers(request.headers);

    // Update the host header to match the backend
    headers.set("host", new URL(backendUrl).host);

    // Skip ngrok browser warning in development
    if (process.env.NODE_ENV === "development") {
      headers.set("ngrok-skip-browser-warning", "true");
    }

    // Remove any existing cookie domain restrictions in the request
    // and forward all other headers as-is

    return NextResponse.rewrite(new URL(targetUrl), {
      request: {
        headers,
      },
    });
  }

  // For non-API requests, continue normally
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
