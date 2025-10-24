import { NextFunction, Request, Response } from "express";

import { AdminService } from "@recallnet/services";
import { ApiError } from "@recallnet/services/types";

import { middlewareLogger } from "@/lib/logger.js";
import { extractApiKey } from "@/middleware/auth-helpers.js";

/**
 * Admin Authentication Middleware
 * Specifically for admin-only endpoints that require admin API key authentication
 */
export const adminAuthMiddleware = (adminService: AdminService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      middlewareLogger.debug(`========== ADMIN AUTH REQUEST ==========`);
      middlewareLogger.debug(
        `Received request to ${req.method} ${req.originalUrl}`,
      );

      // Extract API key from Authorization header
      const apiKey = extractApiKey(req);

      middlewareLogger.debug(
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
      middlewareLogger.debug(
        `Validating admin API key: ${apiKey.substring(0, 8)}...`,
      );
      const adminId = await adminService.validateApiKey(apiKey);

      middlewareLogger.debug(
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
      middlewareLogger.debug(`Getting admin details for ID: ${adminId}`);
      const admin = await adminService.getAdmin(adminId);

      middlewareLogger.debug(
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

      middlewareLogger.debug(
        `Admin authentication successful for: ${admin.username}`,
      );
      middlewareLogger.debug(`========== END ADMIN AUTH ==========`);

      next();
    } catch (error) {
      middlewareLogger.error({ error }, `Error in authentication`);
      next(error);
    }
  };
};
