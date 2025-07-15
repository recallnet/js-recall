import { NextFunction, Request, Response } from "express";

import { EventDataBuilder } from "@/services/event-tracker.service.js";
import { EVENTS } from "@/services/event-tracker.service.js";
import { ServiceRegistry } from "@/services/index.js";

export function makeAuthController(services: ServiceRegistry) {
  /**
   * Auth Controller
   * Handles auth endpoints
   */
  return {
    async getNonce(req: Request, res: Response, next: NextFunction) {
      try {
        req.session.nonce = await services.authService.getNonce();
        await req.session.save();
        res.status(200).json({ nonce: req.session.nonce });
      } catch (error) {
        next(error);
      }
    },

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

    async login(req: Request, res: Response, next: NextFunction) {
      try {
        const { message, signature } = req.body;
        const { session } = req;
        const { success, userId, wallet } = await services.authService.login({
          message,
          signature,
          session,
        });
        if (!success) {
          return res
            .status(401)
            .json({ error: "Unauthorized: invalid signature" });
        }

        const event = new EventDataBuilder()
          .type(EVENTS.USER_LOGGED_IN)
          .source("api")
          .addField("user_id", userId)
          .build();

        await services.eventTracker.track(event);

        console.log(
          `[AuthController] Login successful for ${wallet} (userId: ${userId ? userId : "N/A"})`,
        );
        res.status(200).json({ userId, wallet });
      } catch (error) {
        next(error);
      }
    },

    async logout(req: Request, res: Response, next: NextFunction) {
      try {
        await services.authService.logout(req.session);
        res.status(200).json({ message: "Logged out successfully" });
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
