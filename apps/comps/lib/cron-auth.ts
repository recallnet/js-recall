import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { createLogger } from "@/lib/logger";

const logger = createLogger("CronAuth");

/**
 * Validates the cron secret token from the request
 *
 * Vercel Cron Jobs automatically include the following headers:
 * - `x-vercel-cron: 1` - Indicates the request is from Vercel Cron
 * - `authorization: Bearer <CRON_SECRET>` - The configured secret
 *
 * For security, this middleware validates:
 * 1. The Authorization header contains a valid Bearer token
 * 2. The token matches the CRON_SECRET environment variable
 *
 * @param request - The incoming Next.js request
 * @returns true if authenticated, false otherwise
 */
function validateCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("Cron request missing or invalid Authorization header");
    return false;
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    logger.error(
      "CRON_SECRET environment variable not set - cron jobs will not work",
    );
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  // timingSafeEqual requires buffers of equal length
  let isValid = false;
  try {
    const tokenBuffer = Buffer.from(token);
    const expectedBuffer = Buffer.from(expectedToken);

    // Only compare if lengths match (timing-safe length check)
    if (tokenBuffer.length === expectedBuffer.length) {
      isValid = timingSafeEqual(tokenBuffer, expectedBuffer);
    }
  } catch (error) {
    logger.warn({ error }, "Error during token comparison:");
    isValid = false;
  }

  if (!isValid) {
    logger.warn("Cron request with invalid token");
  }

  return isValid;
}

/**
 * Middleware wrapper for cron job endpoints
 *
 * Validates authentication and returns a 401 response if unauthorized.
 * Use this to protect your cron endpoints.
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const authResult = validateCronAuth(request);
 *   if (authResult) return authResult; // Return 401 if auth failed
 *
 *   // Your cron logic here
 *   return NextResponse.json({ success: true });
 * }
 * ```
 *
 * @param request - The incoming Next.js request
 * @returns NextResponse with 401 error if unauthorized, null if authorized
 */
function validateCronAuth(request: NextRequest): NextResponse | null {
  if (!validateCronSecret(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized. Valid bearer token required.",
        timestamp: new Date().toISOString(),
      },
      { status: 401 },
    );
  }

  return null; // Auth successful
}

/**
 * Higher-order function that wraps a cron handler with authentication
 *
 * This is the recommended way to create cron endpoints. It automatically
 * handles authentication and error handling.
 *
 * @example
 * ```typescript
 * const handler = withCronAuth(async (request) => {
 *   await myService.doWork();
 *   return { success: true, message: "Work completed" };
 * });
 *
 * export const POST = handler;
 * export const GET = handler; // Support GET for manual testing
 * ```
 *
 * @param handler - The cron job handler function
 * @returns A Next.js request handler with authentication
 */
export function withCronAuth(
  handler: (request: NextRequest) => Promise<{
    success: boolean;
    [key: string]: unknown;
  }>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Validate authentication
    const authError = validateCronAuth(request);
    if (authError) return authError;

    try {
      // Execute the cron handler
      const result = await handler(request);

      return NextResponse.json(
        {
          ...result,
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error({ error }, "Cron job failed:");

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }
  };
}
