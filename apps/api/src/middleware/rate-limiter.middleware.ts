import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory, RateLimiterRes, IRateLimiterOptions } from 'rate-limiter-flexible';
import { ApiError } from './errorHandler';

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

// Map to store per-team rate limiters
const rateLimiters = new Map<string, Map<string, RateLimiterMemory>>();

/**
 * Get a rate limiter for a specific team and type
 * This ensures each team has its own isolated rate limiters
 */
function getRateLimiter(
  teamId: string,
  type: 'trade' | 'price' | 'account' | 'global' | 'hourly',
): RateLimiterMemory {
  // Create a map for this team if it doesn't exist
  if (!rateLimiters.has(teamId)) {
    rateLimiters.set(teamId, new Map<string, RateLimiterMemory>());
  }

  const teamLimiters = rateLimiters.get(teamId)!;

  // Create this type of limiter for the team if it doesn't exist
  if (!teamLimiters.has(type)) {
    const options: IRateLimiterOptions = rateLimiterConfigs[type];
    teamLimiters.set(type, new RateLimiterMemory(options));
  }

  return teamLimiters.get(type)!;
}

/**
 * Rate limiting middleware
 * Enforces API rate limits based on endpoint and team
 * Each team now has their own set of rate limiters to ensure proper isolation
 */
export const rateLimiterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip rate limiting for health check endpoint
    if (req.path === '/health') {
      return next();
    }

    // Get team ID from request (set by auth middleware)
    const teamId = req.teamId || 'anonymous';

    // For debugging in development and testing
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    if (isDev) {
      console.log(`[RateLimiter] Processing request for team ${teamId} to ${req.path}`);
    }

    // Apply global rate limit first - this is still per-team but for all endpoints
    await getRateLimiter(teamId, 'global').consume(`global:${teamId}`);

    // Apply hourly rate limit - per-team
    await getRateLimiter(teamId, 'hourly').consume(`hourly:${teamId}`);

    // Apply endpoint-specific rate limits - use path prefix matching
    // Note: We need to ensure we match the correct paths
    const path = req.path.toLowerCase();

    if (path.includes('/api/trade')) {
      if (isDev) console.log(`[RateLimiter] Applying trade rate limit for team ${teamId}`);
      await getRateLimiter(teamId, 'trade').consume(`trade:${teamId}`);
    } else if (path.includes('/api/price')) {
      if (isDev) console.log(`[RateLimiter] Applying price rate limit for team ${teamId}`);
      await getRateLimiter(teamId, 'price').consume(`price:${teamId}`);
    } else if (path.includes('/api/account')) {
      if (isDev) console.log(`[RateLimiter] Applying account rate limit for team ${teamId}`);
      await getRateLimiter(teamId, 'account').consume(`account:${teamId}`);
    }

    // If we get here, all rate limits passed
    next();
  } catch (error) {
    // Type guard to ensure error is a RateLimiterRes
    if (error && typeof error === 'object' && 'msBeforeNext' in error) {
      const rateLimiterRes = error as RateLimiterRes;

      // Calculate time until reset
      const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;

      // Set rate limit headers
      res.set('Retry-After', String(secs));
      res.set('X-RateLimit-Reset', String(Date.now() + rateLimiterRes.msBeforeNext));

      // Return rate limit error
      next(new ApiError(429, `Rate limit exceeded. Try again in ${secs} seconds.`));
    } else {
      // Handle unexpected errors
      next(new ApiError(500, 'Rate limiting error'));
    }
  }
};

/**
 * For testing purposes only - reset all rate limiters
 * This helps ensure tests don't affect each other
 */
export const resetRateLimiters = (): void => {
  rateLimiters.clear();
  console.log('[RateLimiter] All rate limiters have been reset');
};
