import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { ApiError } from "@recallnet/services/types";

import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";

export const availableAwards = base
  .use(authMiddleware)
  .input(z.object({ competitionId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const res = await context.boostAwardService.availableStakeAwards(
        context.user.walletAddress,
        input.competitionId,
      );
      return res;
    } catch (error) {
      // Re-throw if already an oRPC error
      if (error instanceof ORPCError) {
        throw error;
      }

      // Handle ApiError instances from service layer
      if (error instanceof ApiError) {
        switch (error.statusCode) {
          case 400:
            throw errors.BAD_REQUEST({ message: error.message });
          case 404:
            throw errors.NOT_FOUND({ message: error.message });
          default:
            throw errors.INTERNAL({ message: error.message });
        }
      }

      // Handle generic Error instances
      if (error instanceof Error) {
        throw errors.INTERNAL({ message: error.message });
      }

      // Unknown error type
      throw errors.INTERNAL({
        message: "Failed to get available boost awards.",
      });
    }
  });
