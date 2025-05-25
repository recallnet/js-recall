import { NextFunction, Request, Response } from "express";

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

    async login(req: Request, res: Response, next: NextFunction) {
      try {
        const { message, signature } = req.body;
        const { session } = req;
        const { success, teamId, wallet } = await services.authService.login({
          message,
          signature,
          session,
        });
        if (!success) {
          return res
            .status(401)
            .json({ error: "Unauthorized: invalid signature" });
        }
        console.log(
          `[AuthController] Login successful for ${wallet} (teamId: ${teamId ? teamId : "N/A"})`,
        );
        res.status(200).json({ teamId, wallet });
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
  };
}

export type AuthController = ReturnType<typeof makeAuthController>;
