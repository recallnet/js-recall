import { NextFunction, Request, Response } from "express";

import { serviceLogger } from "@/lib/logger.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";

// No query parameters needed - wallet address comes from authenticated session

/**
 * Rewards Controller
 * Handles reward-related operations with SIWE session authentication
 * All endpoints require authenticated user session (req.userId and req.wallet)
 */
export function makeRewardsController(services: ServiceRegistry) {
  return {
    /**
     * Get total claimable rewards for the authenticated user
     * GET /api/user/rewards/total
     * @param req Express request with wallet from session
     * @param res Express response
     * @param next Express next function
     */
    async getTotalClaimableRewards(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const address = req.wallet as string;
        if (!address) {
          throw new ApiError(401, "User not authenticated");
        }

        const totalRewards =
          await services.rewardsService.getTotalClaimableRewards(address);

        serviceLogger.debug(
          `[RewardsController] Retrieved total claimable rewards for address ${address}: ${totalRewards}`,
        );

        res.status(200).json({
          success: true,
          address,
          totalClaimableRewards: totalRewards.toString(),
        });
      } catch (error) {
        serviceLogger.error(
          "[RewardsController] Error in getTotalClaimableRewards:",
          error,
        );
        next(error);
      }
    },

    /**
     * Get rewards with proofs for the authenticated user
     * GET /api/user/rewards/proofs
     * @param req Express request with wallet from session
     * @param res Express response
     * @param next Express next function
     */
    async getRewardsWithProofs(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const address = req.wallet as string;
        if (!address) {
          throw new ApiError(401, "User not authenticated");
        }

        const rewardsWithProofs =
          await services.rewardsService.getRewardsWithProofs(address);

        serviceLogger.debug(
          `[RewardsController] Retrieved ${rewardsWithProofs.length} rewards with proofs for address ${address}`,
        );

        res.status(200).json({
          success: true,
          address,
          rewards: rewardsWithProofs,
        });
      } catch (error) {
        serviceLogger.error(
          "[RewardsController] Error in getRewardsWithProofs:",
          error,
        );
        next(error);
      }
    },

    /**
     * Claim all non-claimed rewards for the authenticated user
     * POST /api/user/rewards/claim
     * @param req Express request with wallet from session
     * @param res Express response
     * @param next Express next function
     */
    async claimAllRewards(req: Request, res: Response, next: NextFunction) {
      try {
        const address = req.wallet as string;
        if (!address) {
          throw new ApiError(401, "User not authenticated");
        }

        const claimedCount =
          await services.rewardsService.claimAllRewards(address);

        serviceLogger.info(
          `[RewardsController] Successfully claimed ${claimedCount} rewards for address ${address}`,
        );

        res.status(200).json({
          success: true,
          address,
          claimedCount,
        });
      } catch (error) {
        serviceLogger.error(
          "[RewardsController] Error in claimAllRewards:",
          error,
        );
        next(error);
      }
    },
  };
}

export type RewardsController = ReturnType<typeof makeRewardsController>;
