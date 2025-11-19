import { NextFunction, Request, Response } from "express";

import { ApiError } from "@recallnet/services/types";

import { serviceLogger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

import { ensureUserId } from "./request-helpers.js";

// No query parameters needed - wallet address comes from authenticated user

/**
 * Rewards Controller
 * Handles reward-related operations with SIWE session authentication
 * All endpoints require authenticated user session (req.userId)
 */
export function makeRewardsController(services: ServiceRegistry) {
  return {
    /**
     * Get total claimable rewards for the authenticated user
     * GET /api/user/rewards/total
     * @param req Express request with userId from session
     * @param res Express response
     * @param next Express next function
     */
    async getTotalClaimableRewards(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const userId = ensureUserId(req);

        // Get user to retrieve wallet address
        const user = await services.userService.getUser(userId);
        if (!user) {
          throw new ApiError(404, "User not found");
        }

        const totalRewards =
          await services.rewardsService.getTotalClaimableRewards(
            user.walletAddress,
          );

        serviceLogger.debug(
          `[RewardsController] Retrieved total claimable rewards for address ${user.walletAddress}: ${totalRewards}`,
        );

        res.status(200).json({
          success: true,
          address: user.walletAddress,
          totalClaimableRewards: totalRewards.toString(),
        });
      } catch (error) {
        serviceLogger.error(
          { error },
          "[RewardsController] Error in getTotalClaimableRewards:",
        );
        next(error);
      }
    },

    /**
     * Get rewards with proofs for the authenticated user
     * GET /api/user/rewards/proofs
     * @param req Express request with userId from session
     * @param res Express response
     * @param next Express next function
     */
    async getRewardsWithProofs(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const userId = ensureUserId(req);

        // Get user to retrieve wallet address
        const user = await services.userService.getUser(userId);
        if (!user) {
          throw new ApiError(404, "User not found");
        }

        const rewardsWithProofs =
          await services.rewardsService.getRewardsWithProofs(
            user.walletAddress,
          );

        serviceLogger.debug(
          `[RewardsController] Retrieved ${rewardsWithProofs.length} rewards with proofs for address ${user.walletAddress}`,
        );

        res.status(200).json({
          success: true,
          address: user.walletAddress,
          rewards: rewardsWithProofs,
        });
      } catch (error) {
        serviceLogger.error(
          { error },
          "[RewardsController] Error in getRewardsWithProofs:",
        );
        next(error);
      }
    },
  };
}

export type RewardsController = ReturnType<typeof makeRewardsController>;
