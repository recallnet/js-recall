import { Request } from "express";
import qs from "qs";

import { UpdateCompetitionSchema } from "@recallnet/db/schema/core/types";
import {
  AdminSearchUsersAndAgentsQuery,
  AdminSearchUsersAndAgentsQuerySchema,
  AgentCompetitionsFiltersSchema,
  AgentCompetitionsParamsSchema,
  ApiError,
  CompetitionAllowedUpdateSchema,
  PagingParamsSchema,
  UuidSchema,
} from "@recallnet/services/types";

import { config } from "@/config/index.js";
import { AuthenticatedRequest } from "@/types/index.js";

/**
 * Ensure the request has a user ID
 * @param req Express request
 * @returns The user ID
 */
export function ensureUserId(req: Request) {
  if (!req.userId) {
    throw new ApiError(401, "Invalid authentication: user ID is required");
  }
  return ensureUuid(req.userId);
}

/**
 * Ensure the request has an agent ID
 * @param req Express request
 * @returns The agent ID
 */
export function ensureAgentId(req: Request) {
  if (!req.agentId) {
    throw new ApiError(401, "Invalid authentication: agent ID is required");
  }
  return ensureUuid(req.agentId);
}

/**
 * Ensure the parameter is a valid UUID
 * @param uuid The UUID to check
 * @returns The UUID
 */
export function ensureUuid(uuid: string | undefined) {
  const { success, data: id } = UuidSchema.safeParse(uuid);
  if (!success) {
    throw new ApiError(400, "Invalid UUID");
  }

  return id;
}

/**
 * Ensure the query parameters are valid paging parameters
 * @param req Express request
 * @returns The paging parameters
 */
export function ensurePaging(req: Request) {
  const { success, data, error } = PagingParamsSchema.safeParse(req.query);
  if (!success) {
    throw new ApiError(400, `Invalid pagination parameters: ${error.message}`);
  }

  return data;
}

/**
 * Ensure the query parameters are valid agent competition params (unified paging and filters)
 * @param req Express request
 * @returns The agent competition filters
 */
export function ensureAgentCompetitionParams(req: Request) {
  const { success, data } = AgentCompetitionsParamsSchema.safeParse(req.query);
  if (!success) {
    throw new ApiError(400, "Invalid filter and paging params");
  }

  return data;
}

/**
 * Ensure the query parameters are valid agent competition filters
 * @param req Express request
 * @returns The agent competition filters
 */
export function ensureAgentCompetitionFilters(req: Request) {
  const { success, data } = AgentCompetitionsFiltersSchema.safeParse(req.query);
  if (!success) {
    throw new ApiError(400, "Invalid filter page params");
  }

  return data;
}

/**
 * Ensure the request body is a valid competition update (for admins)
 * @param req Express request
 * @returns The competition update
 */
export function ensureCompetitionUpdate(req: Request) {
  const { success, data } = UpdateCompetitionSchema.safeParse(req.body);
  if (!success) {
    throw new ApiError(400, "Invalid competition update request body");
  }

  const { success: allowed } = CompetitionAllowedUpdateSchema.safeParse(data);
  if (!allowed) {
    throw new ApiError(
      403,
      "Invalid competition update, attempting to update forbidden field",
    );
  }

  return data;
}

/**
 * Check if the request is authenticated as an admin
 * @param req Express request
 * @returns True if the request is authenticated as an admin, false otherwise
 */
export function checkIsAdmin(req: Request) {
  return req.isAdmin === true;
}

export { buildPaginationResponse } from "@recallnet/services/lib";

/**
 * Helper function to parse nested query parameters like `user.email`, `agent.name`
 * Converts flat query strings to nested objects for Zod validation, and "special" URL
 * parsing is required to support this nested structure.
 * @param url The URL to parse
 * @returns The parsed query parameters
 */
export function parseAdminSearchQuery(
  url: string,
): AdminSearchUsersAndAgentsQuery {
  let result: Record<string, unknown> = {};
  if (url.includes("?")) {
    const queryString = url.split("?")[1];
    if (queryString) {
      result = qs.parse(queryString, { allowDots: true });
    }
  }
  if (!result.user && !result.agent) {
    throw new ApiError(
      400,
      "Invalid request format: must provide user or agent search parameters",
    );
  }

  const { success, data, error } =
    AdminSearchUsersAndAgentsQuerySchema.safeParse(result);
  if (!success) {
    throw new ApiError(400, `Invalid request format: ${error.message}`);
  }
  return data;
}

/**
 * Check if the request is public or from a user (not agent or admin)
 * @param req Express request
 * @returns True if the request is public or from a user, false otherwise
 */
export function checkIsPublicOrUserRequest(req: Request) {
  return !req.agentId && !checkIsAdmin(req);
}

/**
 * Check if the cache is enabled
 * @returns True if the cache is enabled, false otherwise
 */
export function checkIsCacheEnabled() {
  return !config.cache.api.disableCaching;
}

/**
 * Check if the cache should be created for the request
 * @param req Express request
 * @returns True if the cache should be created, false otherwise
 */
export function checkShouldCacheResponse(req: Request) {
  return checkIsCacheEnabled() && checkIsPublicOrUserRequest(req);
}

/**
 * Get cache visibility based on request context
 * @param req Express request
 * @returns Cache visibility level
 */
export function getCacheVisibility(
  req: Request,
): "user" | "anon" | "admin" | "agent" {
  if (req.isAdmin) return "admin";
  if (req.agentId) return "agent";
  if (req.userId) return "user";
  return "anon";
}

/**
 * Generate a cache key for the request in the format:
 * `<name>:<visibility>:<params>`
 *
 * - `<name>`: The name of the cache
 * - `<visibility>`: The visibility of the cache (either "user" or "anon")
 * - `<params>`: The parameters to include in the cache key (note: will be JSON stringified)
 *
 * @param req Express request
 * @param name The name of the cache
 * @param params (Optional) arbitrary parameters to include in the cache key as a JSON string.
 * Note: For user-specific data, include userId in the params object.
 * @returns The cache key
 */
export function generateCacheKey(
  req: AuthenticatedRequest,
  name: string,
  params?: Record<string, unknown>,
) {
  const visibility = req.userId ? "user" : "anon";
  return params
    ? `${name}:${visibility}:${JSON.stringify(params)}`
    : `${name}:${visibility}`;
}
