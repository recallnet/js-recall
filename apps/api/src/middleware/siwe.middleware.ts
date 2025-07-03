import { NextFunction, Request, Response } from "express";
import { getIronSession } from "iron-session";

import { config } from "@/config/index.js";
import { SessionData } from "@/types/index.js";

import { ApiError } from "./errorHandler.js";

/**
 * Middleware to initialize and manage SIWE sessions using iron-session.
 * It attaches the session object to the request.
 */
export const siweSessionMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Detect if we're using Cloudflare tunnels for testing
    const isCloudflareTestMode = config.app.url?.includes('trycloudflare.com');

    const session = await getIronSession<SessionData>(req, res, {
      cookieName: config.app.cookieName,
      password: config.security.rootEncryptionKey,
      ttl: config.app.sessionTtl,
      // See here for available options: https://github.com/jshttp/cookie#options-1
      cookieOptions: {
        secure: config.server.nodeEnv === "production" || isCloudflareTestMode,
        httpOnly: true,
        sameSite: isCloudflareTestMode ? "none" : "lax", // Allow cross-origin cookies for Cloudflare tunnels
        path: "/",
        maxAge: config.app.sessionTtl,
        domain:
          config.server.nodeEnv === "production"
            ? config.app.domain
            : undefined,
      },
    });

    // Session expiry check
    if (
      session.siwe &&
      session.siwe.expirationTime &&
      Date.now() > new Date(session.siwe.expirationTime).getTime()
    ) {
      session.destroy();
      throw new ApiError(401, "Session expired");
    }

    req.session = session;
    next();
  } catch (error) {
    next(error);
  }
};
