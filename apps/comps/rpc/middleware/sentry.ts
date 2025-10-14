import { ORPCError, os } from "@orpc/server";
import * as Sentry from "@sentry/nextjs";

/**
 * Sentry error capture middleware for oRPC handlers.
 *
 * This middleware captures unexpected errors and sends them to Sentry with
 * contextual information including input parameters and user identity.
 * It runs BEFORE oRPC's internal error handling, ensuring all unexpected
 * errors are captured.
 *
 * **Error Handling Strategy:**
 * - ORPCError (expected/business logic errors): NOT sent to Sentry
 * - Unexpected errors: Captured with context (input, user)
 *
 * **Context Captured:**
 * - Input parameters
 * - User ID and email (if authenticated)
 */
export const sentryMiddleware = os.middleware(
  async ({ context, next }, input) => {
    try {
      return await next({ context });
    } catch (error) {
      // Don't capture expected business logic errors
      if (error instanceof ORPCError) {
        throw error;
      }

      // Capture unexpected errors with available context
      Sentry.withScope((scope) => {
        // Add input parameters
        if (input !== undefined) {
          scope.setContext("rpc.input", input as Record<string, unknown>);
        }

        // Add user context if available (context may have user from auth middleware)
        const contextWithUser = context as {
          user?: { id: string; email?: string | null };
        };
        if (contextWithUser.user) {
          scope.setUser({
            id: contextWithUser.user.id,
            email: contextWithUser.user.email ?? undefined,
          });
        }

        Sentry.captureException(error);
      });

      // Re-throw so oRPC can handle it properly
      throw error;
    }
  },
);
