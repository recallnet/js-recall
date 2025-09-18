import { Request } from "express";

import { config } from "@/config/index.js";

/**
 * Check if the user is an admin
 * @param req Express request
 * @returns True if the user is an admin, false otherwise
 */
export function checkIsAdmin(req: Request) {
  return req.isAdmin === true;
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
 * Generate a cache key in the format: `<name>:<visibility>:<params>`
 *
 * - `<name>`: The name of the cache
 * - `<visibility>`: The visibility of the cache ("user", "anon", "admin", "agent")
 * - `<params>`: The parameters to include in the cache key (note: will be JSON stringified)
 *
 * @param name The name of the cache
 * @param visibility The visibility level
 * @param params (Optional) arbitrary parameters to include in the cache key as a JSON string.
 * Note: For user-specific data, include userId in the params object.
 * @returns The cache key
 */
export function generateCacheKey(
  name: string,
  visibility: "user" | "anon" | "admin" | "agent",
  params?: Record<string, unknown>,
): string {
  return params
    ? `${name}:${visibility}:${JSON.stringify(params)}`
    : `${name}:${visibility}`;
}

/**
 * Check if caching should be enabled based on environment
 * @param environment The environment string
 * @returns True if caching should be enabled
 */
export function shouldCacheForEnvironment(environment?: string): boolean {
  return environment !== "test" && environment !== "development";
}

/**
 * Determine cache visibility based on user context
 * @param userId User ID if present
 * @param agentId Agent ID if present
 * @param isAdmin Whether user is admin
 * @returns Cache visibility level
 */
export function getCacheVisibility(
  userId?: string,
  agentId?: string,
  isAdmin?: boolean,
): "user" | "anon" | "admin" | "agent" {
  if (isAdmin) return "admin";
  if (agentId) return "agent";
  if (userId) return "user";
  return "anon";
}

/**
 * Check if caching should be enabled for service-level operations
 * @param environment Environment string
 * @param userId User ID if present
 * @param agentId Agent ID if present
 * @param isAdmin Whether user is admin
 * @returns True if caching should be enabled
 */
export function shouldCacheServiceResponse(
  environment?: string,
  userId?: string,
  agentId?: string,
  isAdmin?: boolean,
): boolean {
  // Don't cache in test/dev environments
  if (!shouldCacheForEnvironment(environment)) {
    return false;
  }

  // Don't cache agent or admin requests (matches original logic)
  return !agentId && !isAdmin;
}
