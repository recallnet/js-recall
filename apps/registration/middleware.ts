import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Secret key for JWT verification
const JWT_SECRET = process.env.JWT_SECRET;

// Routes that require authentication
const PROTECTED_ROUTES = ["/api/protected/"];

// Routes that are public but have redirects when authenticated
const AUTH_PUBLIC_ROUTES = ["/login"];

/**
 * Middleware to check JWT authentication for protected routes
 *
 * @param request The incoming request
 * @returns The response or redirect
 */
export function middleware(request: NextRequest) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined");
  }
  // Get the auth token from the cookie
  const authToken = request.cookies.get("auth-token")?.value;
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  );
  const isAuthPublicRoute = AUTH_PUBLIC_ROUTES.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  );

  // For protected routes, check if the user is authenticated
  if (isProtectedRoute) {
    if (!authToken) {
      // Redirect to login page if not authenticated
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      // Verify the token
      jwt.verify(authToken, JWT_SECRET);
      // Continue with the request
      return NextResponse.next();
    } catch (error) {
      // Token is invalid, redirect to login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // For login/register pages, redirect to dashboard if already authenticated
  if (isAuthPublicRoute && authToken) {
    try {
      // Verify the token
      jwt.verify(authToken, JWT_SECRET);
      // If valid, redirect to dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } catch (error) {
      // If token is invalid, continue with the request
      return NextResponse.next();
    }
  }

  // For all other routes, continue with the request
  return NextResponse.next();
}

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
