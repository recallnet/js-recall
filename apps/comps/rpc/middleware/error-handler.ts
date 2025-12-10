import { ORPCError } from "@orpc/server";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/admin";

/**
 * Error handling middleware that converts ApiError to ORPC errors
 * This prevents having to repeat error handling in every handler
 */
export const errorHandlerMiddleware = base.middleware(
  async ({ context, next, errors }) => {
    try {
      return await next({ context });
    } catch (error) {
      context.logger.debug({ error }, "error");

      // Handle ORPC errors with validation issues
      if (error instanceof ORPCError) {
        const data = error.data as
          | {
              issues?: Array<{
                message?: string;
                path?: Array<string | number>;
              }>;
            }
          | undefined;

        // Handle validation issues in error.data.issues format
        if (data?.issues && Array.isArray(data.issues)) {
          const validationMessages = data.issues
            .map(
              (issue: { message?: string; path?: Array<string | number> }) => {
                if (!issue.message) return "";

                // Clean up the error message by removing redundant "Invalid input: " prefix
                // and improve casing for mid-sentence words
                const cleanMessage = issue.message
                  .replace(/^Invalid input: /, "")
                  .replace(/^./, (char) => char.toLowerCase());

                // Include field path if available
                if (issue.path && issue.path.length > 0) {
                  const fieldPath = issue.path.join(".");
                  return `${fieldPath} (${cleanMessage})`;
                }

                return cleanMessage;
              },
            )
            .filter(Boolean)
            .join("; ");

          const message = `${error.message}: ${validationMessages}`;
          throw errors.BAD_REQUEST({
            message,
            data,
          });
        }

        throw error;
      }

      // Convert ApiError to appropriate ORPC error
      if (error instanceof ApiError) {
        switch (error.statusCode) {
          case 400:
            throw errors.BAD_REQUEST({ message: error.message });
          case 403:
            throw errors.FORBIDDEN({ message: error.message });
          case 404:
            throw errors.NOT_FOUND({ message: error.message });
          case 409:
            throw errors.CONFLICT({ message: error.message });
          case 503:
            throw errors.SERVICE_UNAVAILABLE({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      // Convert generic Error to INTERNAL
      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      // Unknown error type
      throw errors.INTERNAL({
        message: "An unexpected error occurred",
      });
    }
  },
);
