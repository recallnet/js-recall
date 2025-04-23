import { Request, Response, NextFunction } from 'express';
import { ApiError } from './errorHandler';
import { TeamManager } from '../services/team-manager.service';
import { extractApiKey } from './auth-helpers';

// Extend Express Request interface to include admin property
declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: string;
        name: string;
      };
    }
  }
}

/**
 * Admin Authentication Middleware
 */
export const adminAuthMiddleware = (teamManager: TeamManager) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log(`\n[AdminAuthMiddleware] ========== AUTH REQUEST ==========`);
      console.log(`[AdminAuthMiddleware] Received request to ${req.method} ${req.originalUrl}`);

      // Extract API key from Authorization header
      const apiKey = extractApiKey(req);

      console.log(
        `[AdminAuthMiddleware] API Key extraction result: ${apiKey ? 'Found key' : 'No key found'}`,
      );

      if (!apiKey) {
        console.log('[AdminAuthMiddleware] No API key found in request');
        throw new ApiError(401, 'Authentication required. Use Authorization: Bearer YOUR_API_KEY');
      }

      // Validate API key
      console.log(`[AdminAuthMiddleware] Validating API key: ${apiKey.substring(0, 8)}...`);
      const teamId = await teamManager.validateApiKey(apiKey);

      console.log(
        `[AdminAuthMiddleware] Validation result: ${teamId ? `Valid, team: ${teamId}` : 'Invalid key'}`,
      );

      if (!teamId) {
        console.log('[AdminAuthMiddleware] Invalid API key');
        throw new ApiError(401, 'Invalid API key');
      }

      // Get the team to check admin status
      console.log(`[AdminAuthMiddleware] Getting team details for ID: ${teamId}`);
      const team = await teamManager.getTeam(teamId);

      console.log(
        `[AdminAuthMiddleware] Team details: ${team ? `Name: ${team.name}, Admin: ${team.isAdmin}` : 'Team not found'}`,
      );

      if (!team || !team.isAdmin) {
        console.log('[AdminAuthMiddleware] Admin access denied - not an admin account');
        throw new ApiError(403, 'Admin access required');
      }

      // Set team ID and admin flag in request
      req.teamId = teamId;
      req.admin = {
        id: teamId,
        name: team.name,
      };

      console.log(`[AdminAuthMiddleware] Admin authentication successful for: ${team.name}`);
      console.log(`[AdminAuthMiddleware] ========== END AUTH ==========\n`);

      next();
    } catch (error) {
      console.log(`[AdminAuthMiddleware] Error in authentication:`, error);
      next(error);
    }
  };
};
