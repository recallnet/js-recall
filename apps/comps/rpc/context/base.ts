/**
 * Defines the base context for RPC handlers in the comps app.
 *
 * This context provides common dependencies and utilities for RPC procedures,
 * including:
 *   - HTTP cookies (from Next.js headers)
 *   - PrivyClient for authentication/session management
 *   - BoostService for boost-related business logic
 *   - AgentService for agent management operations
 *   - Database instance for data access
 *
 * It also standardizes common error types for use in RPC responses.
 */
import { os } from "@orpc/server";
import { PrivyClient } from "@privy-io/server-auth";
import { RequestCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { Logger } from "pino";

import {
  AgentService,
  AirdropService,
  ArenaService,
  BoostAwardService,
  BoostService,
  CompetitionService,
  EigenaiService,
  EmailService,
  LeaderboardService,
  RewardsService,
  SportsService,
  UserService,
} from "@recallnet/services";

export interface CookieStore {
  get(...args: [name: string] | [RequestCookie]): RequestCookie | undefined;
}

/**
 * The base context object for RPC procedures. The properties included
 * in the context are available in all RPC handlers.
 *
 * @property cookies - HTTP cookies from the request (Next.js)
 * @property privyClient - Privy authentication/session client
 * @property boostService - Service for boost-related operations
 * @property boostAwardService - Service for boost awards and staking
 * @property userService - Service for user-related operations
 * @property competitionService - Service for competition operations
 * @property agentService - Service for agent management operations
 * @property arenaService - Service for arena operations
 * @property eigenaiService - Service for EigenAI verification badge operations
 * @property emailService - Service for email operations
 * @property leaderboardService - Service for leaderboard operations
 * @property rewardsService - Service for reward operations
 *
 * Standard errors:
 *   - NOT_FOUND: Resource not found
 *   - INTERNAL: Internal server error
 *   - UNAUTHORIZED: Unauthorized access
 *   - BAD_REQUEST: Invalid request parameters
 */
export const base = os
  .$context<{
    cookies: CookieStore;
    privyClient: PrivyClient;
    airdropService: AirdropService;
    boostService: BoostService;
    boostAwardService: BoostAwardService;
    userService: UserService;
    competitionService: CompetitionService;
    agentService: AgentService;
    arenaService: ArenaService;
    eigenaiService: EigenaiService;
    emailService: EmailService;
    leaderboardService: LeaderboardService;
    rewardsService: RewardsService;
    sportsService: SportsService;
    logger: Logger;
  }>()
  .errors({
    NOT_FOUND: {
      message: "The resource was not found",
    },
    INTERNAL: {
      message: "An internal server error occurred",
    },
    UNAUTHORIZED: {},
    BAD_REQUEST: {
      message: "Bad request",
    },
    CONFLICT: {
      message: "Resource conflict",
    },
    SERVICE_UNAVAILABLE: {
      message: "External service unavailable",
    },
  });
