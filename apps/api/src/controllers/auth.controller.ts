import { NextFunction, Request, Response } from "express";

import { authLogger } from "@/lib/logger.js";
import { verifyPrivyIdentityTokenAndUpdateUser } from "@/lib/privy/verify.js";
import { ServiceRegistry } from "@/services/index.js";

import { checkUserUniqueConstraintViolation } from "./request-helpers.js";

export function makeAuthController(services: ServiceRegistry) {
  /**
   * Auth Controller
   * Handles auth endpoints
   */
  return {
    /**
     * Generate nonce for agent wallet verification
     */
    async getAgentNonce(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = req.agentId; // Set by agentAuthMiddleware

        if (!agentId) {
          return res
            .status(401)
            .json({ error: "Agent authentication required" });
        }

        // Agent nonce generation - store in database
        const result =
          await services.agentManager.generateNonceForAgent(agentId);

        if (!result.success) {
          return res.status(500).json({
            error: result.error || "Failed to generate nonce for agent",
          });
        }

        res.status(200).json({ nonce: result.nonce });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Login a user by updating their last login at. Note: users are automatically created as part
     * of the authorization middleware.
     */
    async login(req: Request, res: Response, next: NextFunction) {
      try {
        const identityToken = req.privyToken;
        if (!identityToken) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        const { id: userId, walletAddress } =
          await verifyPrivyIdentityTokenAndUpdateUser(
            identityToken,
            services.userManager,
          );

        authLogger.debug(
          `Login successful for user '${userId}' with wallet address '${walletAddress}'`,
        );
        res.status(200).json({ success: true, userId, wallet: walletAddress });
      } catch (error) {
        // Unique constraint violations → 409 Conflict with friendly message
        const violatedField = checkUserUniqueConstraintViolation(error);
        if (violatedField) {
          return res.status(409).json({
            success: false,
            error: `A user with this ${violatedField} already exists`,
          });
        }
        next(error);
      }
    },

    /**
     * Verify agent wallet ownership via custom message signature
     */
    async verifyAgentWallet(req: Request, res: Response, next: NextFunction) {
      try {
        const { message, signature } = req.body;
        const agentId = req.agentId; // Set by authMiddleware

        if (!agentId) {
          return res
            .status(401)
            .json({ error: "Agent authentication required" });
        }

        if (!message || !signature) {
          return res
            .status(400)
            .json({ error: "Message and signature are required" });
        }

        const result = await services.agentManager.verifyWalletOwnership(
          agentId,
          message,
          signature,
        );

        if (!result.success) {
          const statusCode = result.error?.includes("already") ? 409 : 400;
          return res
            .status(statusCode)
            .json({ error: result.error || "Verification failed" });
        }

        res.status(200).json({
          success: true,
          walletAddress: result.walletAddress,
          message: "Wallet verified successfully",
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

export type AuthController = ReturnType<typeof makeAuthController>;
