import { eq } from "drizzle-orm";
import { NextFunction, Request, Response } from "express";

import { config } from "@/config/index.js";
import { db } from "@/database/db.js";
import { competitions } from "@/database/schema/core/defs.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { COMPETITION_STATUS } from "@/types/index.js";

/**
 * Active Competition Filter Middleware
 *
 * This middleware checks if there is an active competition. If no active competition
 * is found, it responds with a 403 Forbidden error.
 */
export const activeCompMiddleware = function () {
  return async function (req: Request, res: Response, next: NextFunction) {
    try {
      console.log("\n\n\n\n\n");
      console.log(
        `[ActiveCompFilterMiddleware] Received request to ${req.method} ${req.originalUrl}`,
      );
      console.log("\n\n\n\n\n");

      const activeCompetition = await getActiveComp();
      if (!activeCompetition) {
        console.log("[ActiveCompFilterMiddleware] No active competition found");
        throw new ApiError(403, "No active competition");
      }

      console.log(
        `[ActiveCompFilterMiddleware] Active competition found: ${activeCompetition.id}`,
      );

      // Set competition ID in request for downstream use
      req.competitionId = activeCompetition.id;

      console.log(
        `[ActiveCompFilterMiddleware] ========== END ACTIVE COMPETITION CHECK ==========\n`,
      );

      next();
    } catch (error) {
      console.error(
        `[ActiveCompFilterMiddleware] Error checking active competition:`,
        error,
      );
      next(error);
    }
  };
};

// Cache for active competition check
let cachedActiveCompetition: { id: string } | null = null;
let lastQueryTime = 0;
const CACHE_ACTIVE_COMP_TTL_MS = config.cache.activeCompetitionTtlMs;

async function getActiveComp() {
  // Check cache first
  const now = Date.now();

  if (now - lastQueryTime < CACHE_ACTIVE_COMP_TTL_MS) {
    console.log("[ActiveCompFilterMiddleware] Using cached result");
    return cachedActiveCompetition;
  }
  // Check for active competition with efficient exists query
  console.log("[ActiveCompFilterMiddleware] Querying database");
  const [activeComp] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.status, COMPETITION_STATUS.ACTIVE))
    .limit(1);

  // Update cache
  if (activeComp) {
    cachedActiveCompetition = activeComp || null;
    lastQueryTime = now;
  }

  return cachedActiveCompetition;
}

export function activeCompResetCache() {
  lastQueryTime = 0;
}
