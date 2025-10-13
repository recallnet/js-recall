import { eq } from "drizzle-orm";
import { NextFunction, Request, Response } from "express";

import { competitions } from "@recallnet/db/schema/core/defs";
import { ApiError } from "@recallnet/services/types";

import { config } from "@/config/index.js";
import { db } from "@/database/db.js";
import { middlewareLogger } from "@/lib/logger.js";

/**
 * Active Competition Filter Middleware
 *
 * This middleware checks if there is an active competition. If no active competition
 * is found, it responds with a 403 Forbidden error.
 */
export const activeCompMiddleware = function () {
  return async function (req: Request, _: Response, next: NextFunction) {
    try {
      const activeCompetition = await getActiveComp();
      if (!activeCompetition) {
        middlewareLogger.debug(
          {
            agentId: req.agentId,
          },
          "Active comp middleware: No active competition found",
        );
        return next(new ApiError(403, "No active competition"));
      }

      req.competitionId = activeCompetition.id;

      next();
    } catch (error) {
      middlewareLogger.error(
        { error, agentId: req.agentId },
        `Active comp middleware: Error checking active competition`,
      );
      next(error);
    }
  };
};

// Cache for active competition check (includes both positive and negative cases)
type ActiveComp = { id: string; name: string } | null;

let cached: { value: ActiveComp; expiresAt: number } | null = null;
let inFlight: Promise<ActiveComp> | null = null;
const CACHE_ACTIVE_COMP_TTL_MS = config.cache.activeCompetitionTtlMs;

export async function getActiveComp(): Promise<ActiveComp> {
  // Check cache first
  const now = Date.now();

  if (cached && now < cached.expiresAt) {
    middlewareLogger.debug("Active comp middleware: using cached result");
    return cached.value;
  }
  if (inFlight) {
    return inFlight;
  }

  // Check database if cache is not available
  middlewareLogger.debug("Active comp middleware: querying database");
  inFlight = (async () => {
    const [row] = await db
      .select({ id: competitions.id, name: competitions.name })
      .from(competitions)
      .where(eq(competitions.status, "active"))
      .limit(1);
    const value: ActiveComp = row ?? null;
    cached = { value, expiresAt: Date.now() + CACHE_ACTIVE_COMP_TTL_MS };
    inFlight = null;

    return value;
  })().catch((err) => {
    inFlight = null;
    throw err;
  });

  return inFlight;
}

export function activeCompResetCache() {
  cached = null;
  inFlight = null;
}
