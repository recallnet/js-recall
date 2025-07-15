import { NextFunction, Request, Response } from "express";

import { flatParse } from "@/lib/flat-parse.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";

import { LoginBodySchema, VerifyAgentWalletBodySchema } from "./auth.schema.js";

export function makeAuthController(services: ServiceRegistry) {
  /**
   * Auth Controller
   * Handles auth endpoints
   */
  return {
    /**
     * Generate nonce for user SIWE authentication
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
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
     * @param req Express request with agentId from API key
     * @param res Express response
     * @param next Express next function
     */
    async getAgentNonce(req: Request, res: Response, next: NextFunction) {
      try {
        const agentId = req.agentId; // Set by agentAuthMiddleware

        if (!agentId) {
          throw new ApiError(401, "Agent authentication required");
        }

        // Agent nonce generation - store in database
        const result =
          await services.agentManager.generateNonceForAgent(agentId);

        if (!result.success) {
          throw new ApiError(
            500,
            result.error || "Failed to generate nonce for agent",
          );
        }

        res.status(200).json({ nonce: result.nonce });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Login with SIWE signature
     * @param req Express request with SIWE message and signature
     * @param res Express response
     * @param next Express next function
     */
    async login(req: Request, res: Response, next: NextFunction) {
      try {
        const { message, signature } = flatParse(
          LoginBodySchema,
          req.body,
          "body",
        );
        const { session } = req;
        const { success, userId, wallet } = await services.authService.login({
          message,
          signature,
          session,
        });
        if (!success) {
          throw new ApiError(401, "Unauthorized: invalid signature");
        }
        console.log(
          `[AuthController] Login successful for ${wallet} (userId: ${userId ? userId : "N/A"})`,
        );
        res.status(200).json({ userId, wallet });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Logout user session
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
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
     * @param req Express request with agentId from API key and message/signature in body
     * @param res Express response
     * @param next Express next function
     */
    async verifyAgentWallet(req: Request, res: Response, next: NextFunction) {
      try {
        const { message, signature } = flatParse(
          VerifyAgentWalletBodySchema,
          req.body,
          "body",
        );
        const agentId = req.agentId; // Set by authMiddleware

        if (!agentId) {
          throw new ApiError(401, "Agent authentication required");
        }

        const result = await services.agentManager.verifyWalletOwnership(
          agentId,
          message,
          signature,
        );

        if (!result.success) {
          const statusCode = result.error?.includes("already") ? 409 : 400;
          throw new ApiError(statusCode, result.error || "Verification failed");
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
