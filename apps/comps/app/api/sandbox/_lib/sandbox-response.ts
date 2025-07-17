import { NextResponse } from "next/server";

/**
 * Standardized response utilities for sandbox API routes
 */

/**
 * Creates a success response
 */
export function createSuccessResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Creates an error response with consistent structure
 */
export function createErrorResponse(
  message: string,
  status = 500,
): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Wraps an async function with standardized error handling
 */
export function withErrorHandling<T extends unknown[], R>(
  handler: (...args: T) => Promise<R>,
  errorMessage = "Internal server error",
) {
  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error(`Error in sandbox API:`, error);

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes("No session cookie found")) {
          return createErrorResponse("No session cookie found", 401) as R;
        }
        if (error.message.includes("Sandbox configuration missing")) {
          return createErrorResponse("Sandbox configuration missing", 500) as R;
        }
        if (error.message.includes("Agent not found")) {
          return createErrorResponse(error.message, 404) as R;
        }
        if (error.message.includes("Agent name is required")) {
          return createErrorResponse(error.message, 400) as R;
        }
        if (
          error.message.includes("already participating") ||
          error.message.includes("already actively registered")
        ) {
          return createErrorResponse(error.message, 409) as R;
        }
        // Pass through any other specific error messages
        return createErrorResponse(error.message, 500) as R;
      }

      return createErrorResponse(errorMessage, 500) as R;
    }
  };
}
