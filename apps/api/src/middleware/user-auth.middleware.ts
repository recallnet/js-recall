import { NextFunction, Request, Response } from "express";

import type { UserService } from "@recallnet/services";
import { ApiError } from "@recallnet/services/types";

import { authLogger } from "@/lib/logger.js";
import { extractPrivyIdentityToken } from "@/lib/privy/utils.js";
import { verifyPrivyIdentityToken } from "@/lib/privy/verify.js";
import { isLoginEndpoint } from "@/middleware/auth-helpers.js";

/**
 * Try to apply Privy user authentication to the request.
 * - Reads identity token from header or cookie
 * - Verifies token
 * - Looks up user by Privy ID
 * - On success, sets req.privyToken and req.userId and returns true
 * - On any failure, returns false and does not throw
 *
 * @param req - Express request
 * @param userService - User service for DB lookups
 * @returns Promise<boolean> indicating whether auth was applied successfully
 */
export async function applyPrivyUserAuth(
  req: Request,
  userService: UserService,
): Promise<boolean> {
  try {
    const identityToken = extractPrivyIdentityToken(req);
    if (!identityToken) {
      return false;
    }

    const { privyId } = await verifyPrivyIdentityToken(identityToken);
    req.privyToken = identityToken;

    const user = await userService.getUserByPrivyId(privyId);
    if (!user) {
      return false;
    }

    req.userId = user.id;
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Express middleware that enforces Privy user-only authentication.
 *
 * Behavior:
 * - Extracts `privy-id-token` from request header (preferred) or cookie (fallback)
 * - Verifies the token and looks up the user by Privy ID
 * - Sets `req.userId` and `req.privyToken` on success and calls next()
 * - If user not found and the request targets the login endpoint, calls next() to allow login
 * - Otherwise, throws ApiError(401)
 *
 * @param userService - User service for user lookup by Privy ID
 * @returns Express middleware enforcing user authentication via Privy
 */
export function userAuthMiddleware(userService: UserService) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      authLogger.debug(
        `[UserAuthMiddleware] Received request to ${req.method} ${req.originalUrl}`,
      );

      const identityToken = extractPrivyIdentityToken(req);
      if (!identityToken) {
        throw new ApiError(401, "Authentication required: missing Privy token");
      }

      let privyId: string | undefined;
      try {
        ({ privyId } = await verifyPrivyIdentityToken(identityToken));
      } catch (error) {
        authLogger.error(
          `[UserAuthMiddleware] Privy token verification failed: ${error}`,
        );
        throw new ApiError(401, "Invalid Privy token");
      }

      if (!privyId) {
        throw new ApiError(401, "Invalid Privy token");
      }

      req.privyToken = identityToken;

      const user = await userService.getUserByPrivyId(privyId);
      if (!user) {
        const path = req.originalUrl;
        if (isLoginEndpoint(path)) {
          return next();
        }
        throw new ApiError(401, "Authentication failed: user not found");
      }

      req.userId = user.id;
      return next();
    } catch (error) {
      next(error);
    }
  };
}
