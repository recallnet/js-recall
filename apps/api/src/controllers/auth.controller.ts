import { NextFunction, Request, Response } from "express";

import { ServiceRegistry } from "@/services/index.js";

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
        const nonce =
          await services.agentService.generateNonceForAgent(agentId);

        res.status(200).json({ nonce });
      } catch (error) {
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

        const walletAddress = await services.agentService.verifyWalletOwnership(
          agentId,
          message,
          signature,
        );

        res.status(200).json({
          success: true,
          walletAddress,
          message: "Wallet verified successfully",
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

export type AuthController = ReturnType<typeof makeAuthController>;
