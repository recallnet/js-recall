import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware to check maintenance mode and handle basic routing
 * Simplified version without NextAuth dependency since app uses SIWE
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check for maintenance mode first - this takes precedence over everything
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";

  // Allow access to the maintenance page itself and static assets during maintenance
  const isMaintenancePage = pathname === "/maintenance";
  const isStaticAsset =
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/android-chrome-") ||
    pathname.startsWith("/apple-touch-icon") ||
    // Only allow specific static file extensions
    /\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot)$/i.test(pathname);

  // If in maintenance mode, redirect all non-maintenance, non-static routes to maintenance page
  if (isMaintenanceMode && !isMaintenancePage && !isStaticAsset) {
    return NextResponse.redirect(new URL("/maintenance", req.url));
  }

  // If not in maintenance mode but trying to access maintenance page, redirect to home
  if (!isMaintenanceMode && isMaintenancePage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Continue for all other paths
  return NextResponse.next();
}

/**
 * Configure middleware to run on all routes for maintenance mode check
 */
export const config = {
  matcher: [
    // Apply middleware to all routes except static assets
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
