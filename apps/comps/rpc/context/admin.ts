/**
 * Defines the admin context for OpenAPI admin handlers in the comps app.
 *
 * This context provides dependencies and utilities for admin RPC procedures,
 * including:
 *   - HTTP headers, and params (from Next.js)
 *   - AdminService for admin operations
 *   - BoostBonusService for boost bonus management
 *   - AgentService for agent management operations
 *   - Competition services and repositories
 *   - Partner, balance, and rewards services
 *
 * It also standardizes common error types for use in RPC responses.
 */
import { os } from "@orpc/server";
import { RequestCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import {
  AdminService,
  AgentService,
  ArenaService,
  BalanceService,
  BoostBonusService,
  CompetitionService,
  PartnerService,
  PortfolioSnapshotterService,
  RewardsService,
  UserService,
} from "@recallnet/services";

export interface CookieStore {
  get(...args: [name: string] | [RequestCookie]): RequestCookie | undefined;
}

/**
 * The admin context object for RPC procedures. The properties included
 * in the context are available in all admin RPC handlers.
 *
 * @property cookies - HTTP cookies from the request (Next.js)
 * @property headers - HTTP headers from the request
 * @property params - Route parameters
 * @property adminService - Service for admin operations
 * @property boostBonusService - Service for boost bonus management
 * @property userService - Service for user-related operations
 * @property competitionService - Service for competition operations
 * @property competitionRepository - Repository for competition data access
 * @property agentService - Service for agent management operations
 * @property arenaService - Service for arena operations
 * @property partnerService - Service for partner operations
 * @property balanceService - Service for balance operations
 * @property portfolioSnapshotterService - Service for portfolio snapshot operations
 * @property rewardsService - Service for reward operations
 * @property logger - Logger instance
 *
 * Standard errors:
 *   - NOT_FOUND: Resource not found
 *   - INTERNAL: Internal server error
 *   - UNAUTHORIZED: Unauthorized access
 *   - FORBIDDEN: Forbidden access
 *   - BAD_REQUEST: Invalid request parameters
 *   - CONFLICT: Resource conflict
 *   - SERVICE_UNAVAILABLE: External service unavailable
 */
export const adminBase = os
  .$context<{
    cookies: CookieStore;
    headers: Headers;
    params: Record<string, string | string[]>;
    adminService: AdminService;
    boostBonusService: BoostBonusService;
    userService: UserService;
    competitionService: CompetitionService;
    competitionRepository: CompetitionRepository;
    agentService: AgentService;
    arenaService: ArenaService;
    partnerService: PartnerService;
    balanceService: BalanceService;
    portfolioSnapshotterService: PortfolioSnapshotterService;
    rewardsService: RewardsService;
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
    FORBIDDEN: {},
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
