import { NextFunction, Request, Response } from "express";

import { middlewareLogger } from "@/lib/logger.js";
import { extractApiKey } from "@/middleware/auth-helpers.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { AdminManager } from "@/services/admin-manager.service.js";

/**
 * Admin Authentication Middleware
 * Specifically for admin-only endpoints that require admin API key authentication
 */
export const adminAuthMiddleware = (adminManager: AdminManager) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      middlewareLogger.info(`========== ADMIN AUTH REQUEST ==========`);
      middlewareLogger.info(
        `Received request to ${req.method} ${req.originalUrl}`,
      );

      // Extract API key from Authorization header
      const apiKey = extractApiKey(req);

      middlewareLogger.info(
        `API Key extraction result: ${apiKey ? "Found key" : "No key found"}`,
      );

      if (!apiKey) {
        middlewareLogger.warn("No API key found in request");
        throw new ApiError(
          401,
          "Admin authentication required. Use Authorization: Bearer YOUR_ADMIN_API_KEY",
        );
      }

      // Validate admin API key
      middlewareLogger.info(
        `Validating admin API key: ${apiKey.substring(0, 8)}...`,
      );
      const adminId = await adminManager.validateApiKey(apiKey);

      middlewareLogger.info(
        `Validation result: ${adminId ? `Valid, admin: ${adminId}` : "Invalid key"}`,
      );

      if (!adminId) {
        middlewareLogger.warn("Invalid admin API key");
        throw new ApiError(
          401,
          "Invalid admin API key. This key may have been reset or is no longer associated with an active admin account.",
        );
      }

      // Get the admin details
      middlewareLogger.info(`Getting admin details for ID: ${adminId}`);
      const admin = await adminManager.getAdmin(adminId);

      middlewareLogger.info(
        `Admin details: ${admin ? `Username: ${admin.username}, Status: ${admin.status}` : "Admin not found"}`,
      );

      if (!admin || admin.status !== "active") {
        middlewareLogger.warn(
          "Admin access denied - admin not found or inactive",
        );
        throw new ApiError(403, "Admin access denied - account inactive");
      }

      // Set admin properties in request
      req.adminId = adminId;
      req.isAdmin = true;
      req.admin = {
        id: adminId,
        name: admin.name || admin.username,
      };

      middlewareLogger.info(
        `Admin authentication successful for: ${admin.username}`,
      );
      middlewareLogger.info(`========== END ADMIN AUTH ==========`);

      next();
    } catch (error) {
      middlewareLogger.error(`Error in authentication:`, error);
      next(error);
    }
  };
};
