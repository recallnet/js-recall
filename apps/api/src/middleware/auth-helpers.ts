import { Request } from "express";

import { authLogger } from "@/lib/logger.js";

/**
 * Extract API key from request's Authorization header
 * @param req Express request
 * @returns The API key or undefined if not found
 */
export function extractApiKey(req: Request): string | undefined {
  const authHeader = req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return undefined;
  }

  const apiKey = authHeader.substring(7);

  // Log partial key for debugging (only first 8 chars)
  const partialKey = apiKey ? `${apiKey.substring(0, 8)}...` : "undefined";
  authLogger.debug(`Using API Key: ${partialKey}`);

  return apiKey;
}

/**
 * Check if a path is a login endpoint
 * @param path - The path to check
 * @returns True if the path is a login endpoint, false otherwise
 */
export const isLoginEndpoint = (path: string) =>
  path.includes("/api/auth/login");
