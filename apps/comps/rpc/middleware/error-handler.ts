import { ORPCError } from "@orpc/server";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";

/**
 * Error handling middleware that converts ApiError to ORPC errors
 * This prevents having to repeat error handling in every handler
 */
export const errorHandlerMiddleware = base.middleware(
  async ({ context, next, errors }) => {
    try {
      return await next({ context });
    } catch (error) {
      // Re-throw ORPC errors as-is
      if (error instanceof ORPCError) {
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
