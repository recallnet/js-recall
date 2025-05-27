import { NextFunction, Request, Response } from "express";

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
      console.log(`\n[AdminAuthMiddleware] ========== AUTH REQUEST ==========`);
      console.log(
        `[AdminAuthMiddleware] Received request to ${req.method} ${req.originalUrl}`,
      );

      // Extract API key from Authorization header
      const apiKey = extractApiKey(req);

      console.log(
        `[AdminAuthMiddleware] API Key extraction result: ${apiKey ? "Found key" : "No key found"}`,
      );

      if (!apiKey) {
        console.log("[AdminAuthMiddleware] No API key found in request");
        throw new ApiError(
          401,
          "Admin authentication required. Use Authorization: Bearer YOUR_ADMIN_API_KEY",
        );
      }

      // Validate admin API key
      console.log(
        `[AdminAuthMiddleware] Validating admin API key: ${apiKey.substring(0, 8)}...`,
      );
      const adminId = await adminManager.validateApiKey(apiKey);

      console.log(
        `[AdminAuthMiddleware] Validation result: ${adminId ? `Valid, admin: ${adminId}` : "Invalid key"}`,
      );

      if (!adminId) {
        console.log("[AdminAuthMiddleware] Invalid admin API key");
        throw new ApiError(
          401,
          "Invalid admin API key. This key may have been reset or is no longer associated with an active admin account.",
        );
      }

      // Get the admin details
      console.log(
        `[AdminAuthMiddleware] Getting admin details for ID: ${adminId}`,
      );
      const admin = await adminManager.getAdmin(adminId);

      console.log(
        `[AdminAuthMiddleware] Admin details: ${admin ? `Username: ${admin.username}, Status: ${admin.status}` : "Admin not found"}`,
      );

      if (!admin || admin.status !== "active") {
        console.log(
          "[AdminAuthMiddleware] Admin access denied - admin not found or inactive",
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

      console.log(
        `[AdminAuthMiddleware] Admin authentication successful for: ${admin.username}`,
      );
      console.log(`[AdminAuthMiddleware] ========== END AUTH ==========\n`);

      next();
    } catch (error) {
      console.log(`[AdminAuthMiddleware] Error in authentication:`, error);
      next(error);
    }
  };
};
