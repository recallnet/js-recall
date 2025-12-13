import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { verifyPrivyUserHasLinkedWallet } from "@recallnet/services/lib";

import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";

export const linkWallet = base
  .use(authMiddleware)
  .input(z.object({ walletAddress: z.string() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const idToken = context.privyIdToken;
      if (!idToken) {
        throw errors.UNAUTHORIZED();
      }

      const isLinked = await verifyPrivyUserHasLinkedWallet(
        idToken,
        context.privyClient,
        input.walletAddress,
      );

      if (!isLinked) {
        throw errors.BAD_REQUEST({ message: "Wallet not linked to user" });
      }

      // Update user with the new wallet address and verification timestamp
      const now = new Date();
      const updatedUser = await context.userService.updateUser({
        id: context.user.id,
        walletAddress: input.walletAddress,
        walletLastVerifiedAt: now,
        updatedAt: now,
      });

      // Grant initial boost
      await context.boostAwardService.initForStake(updatedUser.walletAddress);

      return updatedUser;
    } catch (error) {
      // Re-throw if already an oRPC error
      if (error instanceof ORPCError) {
        throw error;
      }

      // Handle known UserService errors
      if (error instanceof Error) {
        // User not found error
        if (error.message.includes("not found")) {
          throw errors.NOT_FOUND();
        }

        // Sanctioned wallet error
        if (error.message.includes("not permitted")) {
          throw errors.BAD_REQUEST({ message: error.message });
        }

        // All other errors with message
        throw errors.INTERNAL({ message: error.message });
      }

      // Unknown error type
      throw errors.INTERNAL({ message: "Failed to link wallet" });
    }
  });
