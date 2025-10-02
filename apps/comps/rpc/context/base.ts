/**
 * Defines the base context for RPC handlers in the comps app.
 *
 * This context provides common dependencies and utilities for RPC procedures,
 * including:
 *   - HTTP cookies (from Next.js headers)
 *   - PrivyClient for authentication/session management
 *   - BoostService for boost-related business logic
 *   - Database instance for data access
 *
 * It also standardizes common error types for use in RPC responses.
 */
import { os } from "@orpc/server";
import { PrivyClient } from "@privy-io/server-auth";
import { cookies } from "next/headers";

import { Database } from "@recallnet/db/types";
import {
  BoostAwardService,
  BoostService,
  CompetitionService,
  UserService,
} from "@recallnet/services";

/**
 * The base context object for RPC procedures. The properties included
 * in the context are available in all RPC handlers.
 *
 * @property cookies - HTTP cookies from the request (Next.js)
 * @property privyClient - Privy authentication/session client
 * @property boostService - Service for boost-related operations
 * @property boostAwardService - Service for boost awards and staking
 * @property userService - Service for user-related operations
 *
 * Standard errors:
 *   - NOT_FOUND: Resource not found
 *   - INTERNAL: Internal server error
 *   - UNAUTHORIZED: Unauthorized access
 *   - BAD_REQUEST: Invalid request parameters
 */
export const base = os
  .$context<{
    cookies: Awaited<ReturnType<typeof cookies>>;
    privyClient: PrivyClient;
    boostService: BoostService;
    boostAwardService: BoostAwardService;
    userService: UserService;
    competitionService: CompetitionService;
    db: Database;
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
  });
