import { NextFunction, Request, Response } from "express";
import {
  IRateLimiterOptions,
  RateLimiterMemory,
  RateLimiterRes,
} from "rate-limiter-flexible";

import { ApiError } from "@/middleware/errorHandler.js";

// Define rate limiter configurations
const rateLimiterConfigs = {
  trade: {
    points: 100, // 100 requests
    duration: 60, // per 60 seconds
  },
  price: {
    points: 300, // 300 requests
    duration: 60, // per 60 seconds
  },
  account: {
    points: 30, // 30 requests
    duration: 60, // per 60 seconds
  },
  global: {
    points: 3000, // 3000 requests
    duration: 60, // per 60 seconds
  },
  hourly: {
    points: 10000, // 10000 requests
    duration: 3600, // per hour
  },
};

// Map to store per-agent rate limiters
const rateLimiters = new Map<string, Map<string, RateLimiterMemory>>();

/**
 * Get a rate limiter for a specific agent and type
 * This ensures each agent has its own isolated rate limiters
 */
function getRateLimiter(
  agentId: string,
  type: "trade" | "price" | "account" | "global" | "hourly",
): RateLimiterMemory {
  // Create a map for this agent if it doesn't exist
  if (!rateLimiters.has(agentId)) {
    rateLimiters.set(agentId, new Map<string, RateLimiterMemory>());
  }

  const agentLimiters = rateLimiters.get(agentId)!;

  // Create this type of limiter for the agent if it doesn't exist
  if (!agentLimiters.has(type)) {
    const options: IRateLimiterOptions = rateLimiterConfigs[type];
    agentLimiters.set(type, new RateLimiterMemory(options));
  }

  return agentLimiters.get(type)!;
}

/**
 * Rate limiting middleware
 * Enforces API rate limits based on endpoint and agent
 * Each agent now has their own set of rate limiters to ensure proper isolation
 */
export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Skip rate limiting for health check endpoint
    if (
      req.originalUrl === "/health" ||
      req.originalUrl.startsWith("/health")
    ) {
      return next();
    }

    // Get agent ID from request (set by auth middleware)
    const agentId = req.agentId || "anonymous";

    // For debugging in development and testing
    const isDev =
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
    if (isDev) {
      console.log(
        `[RateLimiter] Processing request for agent ${agentId} to ${req.originalUrl}`,
      );
    }

    // Apply global rate limit first - this is still per-agent but for all endpoints
    await getRateLimiter(agentId, "global").consume(`global:${agentId}`);

    // Apply hourly rate limit - per-agent
    await getRateLimiter(agentId, "hourly").consume(`hourly:${agentId}`);

    // Apply endpoint-specific rate limits - use originalUrl for full path
    // Note: We need to ensure we match the correct paths
    const path = req.originalUrl.toLowerCase();

    if (path.includes("/api/trade")) {
      if (isDev)
        console.log(
          `[RateLimiter] Applying trade rate limit for agent ${agentId}`,
        );
      await getRateLimiter(agentId, "trade").consume(`trade:${agentId}`);
    } else if (path.includes("/api/price")) {
      if (isDev)
        console.log(
          `[RateLimiter] Applying price rate limit for agent ${agentId}`,
        );
      await getRateLimiter(agentId, "price").consume(`price:${agentId}`);
    } else if (path.includes("/api/agent")) {
      if (isDev)
        console.log(
          `[RateLimiter] Applying account rate limit for agent ${agentId}`,
        );
      await getRateLimiter(agentId, "account").consume(`account:${agentId}`);
    }

    // If we get here, all rate limits passed
    next();
  } catch (error) {
    // Type guard to ensure error is a RateLimiterRes
    if (error && typeof error === "object" && "msBeforeNext" in error) {
      const rateLimiterRes = error as RateLimiterRes;

      // Calculate time until reset
      const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;

      // Set rate limit headers
      res.set("Retry-After", String(secs));
      res.set(
        "X-RateLimit-Reset",
        String(Date.now() + rateLimiterRes.msBeforeNext),
      );

      // Return rate limit error
      next(
        new ApiError(429, `Rate limit exceeded. Try again in ${secs} seconds.`),
      );
    } else {
      // Handle unexpected errors
      next(new ApiError(500, "Rate limiting error"));
    }
  }
};

/**
 * For testing purposes only - reset all rate limiters
 * This helps ensure tests don't affect each other
 */
export const resetRateLimiters = (): void => {
  rateLimiters.clear();
  console.log("[RateLimiter] All rate limiters have been reset");
};
