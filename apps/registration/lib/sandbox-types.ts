/**
 * Sandbox Types and Error Classes
 *
 * Type definitions and error classes for sandbox operations.
 * Used by hooks that call internal Next.js API routes.
 */

/**
 * Base HTTP error class with status code support
 */
export class SandboxHttpError extends Error {
  public readonly statusCode: number;
  public readonly statusText: string;

  constructor(statusCode: number, statusText: string, message?: string) {
    super(message || statusText);
    this.name = "SandboxHttpError";
    this.statusCode = statusCode;
    this.statusText = statusText;
  }
}

/**
 * Custom error class for unauthorized (401) responses
 */
export class SandboxUnauthorizedError extends SandboxHttpError {
  constructor(message?: string) {
    super(401, "Unauthorized", message || "Unauthorized access");
    this.name = "SandboxUnauthorizedError";
  }
}

/**
 * Custom error class for not found (404) responses
 */
export class SandboxNotFoundError extends SandboxHttpError {
  constructor(message?: string) {
    super(404, "Not Found", message || "Resource not found");
    this.name = "SandboxNotFoundError";
  }
}

/**
 * Custom error class for conflict (409) responses
 */
export class SandboxConflictError extends SandboxHttpError {
  constructor(message?: string) {
    super(409, "Conflict", message || "Conflict");
    this.name = "SandboxConflictError";
  }
}

/**
 * Custom error class for bad request (400) responses
 */
export class SandboxBadRequestError extends SandboxHttpError {
  constructor(message?: string) {
    super(400, "Bad Request", message || "Bad request");
    this.name = "SandboxBadRequestError";
  }
}

/**
 * Custom error class for server errors (5xx) responses
 */
export class SandboxServerError extends SandboxHttpError {
  constructor(statusCode: number, message?: string) {
    super(statusCode, "Server Error", message || "Internal server error");
    this.name = "SandboxServerError";
  }
}

// Types for admin API operations
export interface SandboxSearchParams {
  // New structured search parameters
  "user.walletAddress"?: string;
  "user.email"?: string;
  "user.name"?: string;
  "user.status"?: "active" | "suspended" | "deleted";
  "agent.name"?: string;
  "agent.email"?: string;
  "agent.walletAddress"?: string;
  "agent.status"?: "active" | "suspended" | "deleted";
  "agent.description"?: string;

  // Control parameters
  join?: boolean | string; // When present, performs left join to get user's agents

  // Legacy parameters (kept for backward compatibility)
  email?: string;
  name?: string;
  walletAddress?: string;
  status?: "active" | "suspended" | "deleted";
  searchType?: "users" | "agents" | "both";
}

export interface SandboxUser {
  id: string;
  walletAddress: string;
  name: string | null;
  email: string | null;
  status: string;
  imageUrl: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface SandboxAgent {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  email: string | null;
  walletAddress: string | null;
  status: string;
  imageUrl: string | null;
  metadata: Record<string, unknown> | null;
  apiKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SandboxSearchResponse {
  success: boolean;
  searchType: string;
  results: {
    users: Array<SandboxUser & { type: "user" }>;
    agents: Array<SandboxAgent & { type: "agent" }>;
  };
}

export interface SandboxRegisterUserRequest {
  walletAddress: string;
  name?: string;
  email?: string;
  userImageUrl?: string;
  userMetadata?: Record<string, unknown>;
  agentName?: string;
  agentDescription?: string;
  agentImageUrl?: string;
  agentMetadata?: Record<string, unknown>;
  agentWalletAddress?: string;
}

export interface SandboxRegisterUserResponse {
  success: boolean;
  user: SandboxUser;
  agent?: SandboxAgent;
  agentError?: string;
}

export interface SandboxRegisterAgentRequest {
  user: {
    id?: string;
    walletAddress?: string;
  };
  agent: {
    name: string;
    email?: string;
    walletAddress?: string;
    description?: string;
    imageUrl?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface SandboxRegisterAgentResponse {
  success: boolean;
  agent: SandboxAgent;
}

export interface SandboxGetAgentResponse {
  success: boolean;
  agent: SandboxAgent;
}

export interface SandboxGetAgentApiKeyResponse {
  success: boolean;
  agent: {
    id: string;
    name: string;
    apiKey: string;
  };
}

export interface SandboxErrorResponse {
  success: false;
  error: string;
  status?: number;
}
