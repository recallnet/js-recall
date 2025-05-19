import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED_ROUTES = ["/api/protected/"];

// Routes that are public but have redirects when authenticated
const AUTH_PUBLIC_ROUTES = ["/login"];

/**
 * Middleware to check authentication for protected routes
 * Uses NextAuth for authentication
 */
export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth?.token;

    // For protected routes, check if the user is authenticated
    const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
      pathname.startsWith(route),
    );

    // For public auth routes, redirect if already authenticated
    const isAuthPublicRoute = AUTH_PUBLIC_ROUTES.some((route) =>
      pathname.startsWith(route),
    );

    // If authenticated and trying to access auth routes (login), redirect to dashboard
    if (token && isAuthPublicRoute) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Continue for all other paths
    return NextResponse.next();
  },
  {
    callbacks: {
      // Only run this middleware on the specified paths
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Check if the route needs protection
        const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
          pathname.startsWith(route),
        );

        // For protected routes, require authentication
        if (isProtectedRoute) {
          return !!token;
        }

        // For all other routes, allow access regardless of auth status
        return true;
      },
    },
  },
);

/**
 * Configure middleware to run on specific paths
 */
export const config = {
  matcher: [
    // Apply middleware to protected API routes
    "/api/protected/:path*",
    // Apply to auth public routes (login, register, etc.)
    "/login",
  ],
};
