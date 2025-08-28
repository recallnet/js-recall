import { Request } from "express";
import qs from "qs";

import { config } from "@/config/index.js";
import { UpdateCompetitionSchema } from "@/database/schema/core/types.js";
import { ApiError } from "@/middleware/errorHandler.js";
import {
  AdminSearchUsersAndAgentsQuery,
  AdminSearchUsersAndAgentsQuerySchema,
  AgentCompetitionsParamsSchema,
  CompetitionAllowedUpdateSchema,
  PagingParamsSchema,
  UuidSchema,
} from "@/types/index.js";

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
 * Ensure the query parameters are valid agent competition filters
 * @param req Express request
 * @returns The agent competition filters
 */
export function ensureAgentCompetitionFilters(req: Request) {
  const { success, data } = AgentCompetitionsParamsSchema.safeParse(req.query);
  if (!success) {
    throw new ApiError(400, "Invalid sort filter page params");
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

/**
 * Check if the request is authenticated as a frontend request (no user or agent context)
 * @param req Express request
 * @returns True if the request is authenticated as an admin, false otherwise
 */
export function checkIsPublicRequest(req: Request) {
  return !req.userId && !req.agentId && !checkIsAdmin(req);
}

/**
 * Check if the cache is enabled
 * @returns True if the cache is enabled, false otherwise
 */
export function checkIsCacheEnabled() {
  return (
    config.server.nodeEnv !== "test" && config.server.nodeEnv !== "development"
  );
}

/**
 * Build a pagination response object
 * @param total The total number of items
 * @param limit The number of items to return
 * @param offset The index of the first item to return
 * @returns The pagination response object
 */
export function buildPaginationResponse(
  total: number,
  limit: number,
  offset: number,
) {
  return {
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}

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
