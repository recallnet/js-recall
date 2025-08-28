import { eq } from "drizzle-orm";
import { NextFunction, Request, Response } from "express";

import { config } from "@/config/index.js";
import { db } from "@/database/db.js";
import { competitions } from "@/database/schema/core/defs.js";
import { middlewareLogger } from "@/lib/logger.js";
import { ApiError } from "@/middleware/errorHandler.js";

/**
 * Active Competition Filter Middleware
 *
 * This middleware checks if there is an active competition. If no active competition
 * is found, it responds with a 403 Forbidden error.
 */
export const activeCompMiddleware = function () {
  return async function (req: Request, res: Response, next: NextFunction) {
    try {
      const activeCompetition = await getActiveComp();
      if (!activeCompetition) {
        console.log("NO ACTIVE COMP!!");
        middlewareLogger.debug(
          "Active comp middleware: No active competition found",
        );
        throw new ApiError(403, "No active competition");
      }

      req.competitionId = activeCompetition.id;

      next();
    } catch (error) {
      middlewareLogger.error(
        `Active comp middleware: Error checking active competition:`,
        error,
      );
      next(error);
    }
  };
};

// Cache for active competition check
let cachedActiveCompetition: { id: string; name: string } | null = null;
let lastQueryTime = 0;
const CACHE_ACTIVE_COMP_TTL_MS = config.cache.activeCompetitionTtlMs;

async function getActiveComp() {
  // Check cache first
  const now = Date.now();

  if (now - lastQueryTime < CACHE_ACTIVE_COMP_TTL_MS) {
    middlewareLogger.debug("Active comp middleware: Using cached result");
    return cachedActiveCompetition;
  }
  // Check for active competition with efficient exists query
  middlewareLogger.debug("Active comp middleware: Querying database");
  const [activeComp] = await db
    .select({ id: competitions.id, name: competitions.name })
    .from(competitions)
    .where(eq(competitions.status, "active"))
    .limit(1);

  // Update cache
  if (!activeComp) {
    return;
  }

  cachedActiveCompetition = activeComp || null;
  lastQueryTime = now;
  return cachedActiveCompetition;
}

export function activeCompResetCache() {
  lastQueryTime = 0;
}
