import { NextFunction, Request, Response } from "express";

import { config } from "@/config/index.js";
import { flatParse } from "@/lib/flat-parse.js";
import { ServiceRegistry } from "@/services/index.js";

import { EmailVerificationQuerySchema } from "./email-verification.schema.js";

export function makeEmailVerificationController(services: ServiceRegistry) {
  /**
   * Email Verification Controller
   * Handles email verification endpoints
   */
  return {
    /**
     * Verify an email verification token
     * @param req Request object
     * @param res Response object
     * @param next Next function
     */
    async verifyEmail(req: Request, res: Response, next: NextFunction) {
      let token: string;
      try {
        token = flatParse(
          EmailVerificationQuerySchema,
          req.query,
          "query",
        ).token;
      } catch {
        return res.redirect(
          `${config.app.url}/verify-email?success=false&message=${encodeURIComponent("Token is required")}`,
        );
      }

      try {
        const result =
          await services.emailVerificationService.verifyToken(token);

        if (!result.success) {
          let message = "Verification failed";

          switch (result.error.type) {
            case "InvalidToken":
              message = "Invalid verification token";
              break;
            case "TokenHasBeenUsed":
              message = "Token has already been used";
              break;
            case "TokenHasExpired":
              message = "Token has expired";
              break;
            case "NoAssociation":
              message = "Token is not associated with a user or agent";
              break;
            case "SystemError":
              message = result.error.message;
              break;
          }

          return res.redirect(
            `${config.app.url}/verify-email?success=false&message=${encodeURIComponent(message)}`,
          );
        }

        return res.redirect(
          `${config.app.url}/verify-email?success=true&message=${encodeURIComponent(result.value.message)}`,
        );
      } catch (error) {
        next(error);
      }
    },
  };
}

export type EmailVerificationController = ReturnType<
  typeof makeEmailVerificationController
>;
