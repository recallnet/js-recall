import {
  attoValueToNumberValue,
  valueToAttoString,
} from "@recallnet/conversions/atto-conversions";

import {
  AgentCompetitionsResponse,
  CompetitionPerpsPositionsResponse,
  CompetitionResponse,
  CompetitionTradesResponse,
  CompetitionsResponse,
  GetAgentCompetitionsParams,
  GetCompetitionPerpsPositionsParams,
  GetCompetitionTradesParams,
  GetCompetitionsParams,
  LinkWalletRequest,
  NonceResponse,
  ProfileResponse,
  UpdateProfileRequest,
  UserCompetitionsResponse,
  VerifyEmailResponse,
} from "@/types";

const PROXY_API_ENDPOINT = "/api/proxy";

/**
 * Base HTTP error class with status code support
 */
export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly statusText: string;

  constructor(statusCode: number, statusText: string, message?: string) {
    super(message || statusText);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.statusText = statusText;
  }
}

/**
 * Custom error class for unauthorized (401) responses
 */
export class UnauthorizedError extends HttpError {
  constructor(message?: string) {
    message = message?.includes(
      "[AuthMiddleware] Authentication required. Invalid Privy token or no API key provided. Use Authorization: Bearer YOUR_API_KEY",
    )
      ? "Error authenticating. Please try again."
      : message;
    super(401, "Unauthorized", message || "Unauthorized access");
    this.name = "UnauthorizedError";
  }
}

/**
 * Custom error class for not found (404) responses
 */
export class NotFoundError extends HttpError {
  constructor(message?: string) {
    super(404, "Not Found", message || "Resource not found");
    this.name = "NotFoundError";
  }
}

/**
 * Custom error class for conflict (409) responses
 */
export class ConflictError extends HttpError {
  constructor(message?: string) {
    super(409, "Conflict", message || "Conflict");
    this.name = "ConflictError";
  }
}

/**
 * Custom error class for bad request (400) responses
 */
export class BadRequestError extends HttpError {
  constructor(message?: string) {
    super(400, "Bad Request", message || "Bad request");
    this.name = "BadRequestError";
  }
}

/**
 * Custom error class for server errors (5xx) responses
 */
export class ServerError extends HttpError {
  constructor(statusCode: number, message?: string) {
    super(statusCode, "Server Error", message || "Internal server error");
    this.name = "ServerError";
  }
}

/**
 * API client for interactions with the competitions API
 */
export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = PROXY_API_ENDPOINT) {
    this.baseUrl = baseUrl;
  }

  /**
   * Helper method to make API requests
   * @param endpoint - API endpoint path
   * @param options - fetch options
   * @returns Response data
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // Include cookies for auth (in case automatic cookies are enabled)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({
        error: "An unknown error occurred",
      }));

      const errorMessage =
        data.error || `Request failed with status ${response.status}`;

      // Create appropriate error based on status code
      switch (response.status) {
        case 400:
          throw new BadRequestError(errorMessage);
        case 401:
          throw new UnauthorizedError(errorMessage);
        case 404:
          throw new NotFoundError(errorMessage);
        case 409:
          throw new ConflictError(errorMessage);
        case 500:
          throw new ServerError(response.status, errorMessage);
        default:
          throw new HttpError(
            response.status,
            response.statusText,
            errorMessage,
          );
      }
    }

    return response.json() as Promise<T>;
  }

  /**
   * Format query parameters for URL
   * @param params - Object containing query parameters
   * @returns Formatted query string
   */
  private formatQueryParams<T extends object>(params: T): string {
    const validParams = Object.entries(params as Record<string, unknown>)
      .filter(
        ([, value]) => value !== undefined && value !== null && value !== "",
      )
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join("&");

    return validParams ? `?${validParams}` : "";
  }

  // Authentication endpoints

  /**
   * Get nonce for message signature
   * @returns Nonce response
   */
  async getNonce(): Promise<NonceResponse> {
    return this.request<NonceResponse>("/auth/nonce");
  }

  /**
   * Link a wallet to the authenticated user (Privy ID token provides custom wallet info)
   * @returns Profile response
   */
  async linkWallet(data: LinkWalletRequest): Promise<ProfileResponse> {
    return this.request<ProfileResponse>("/user/wallet/link", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Competition endpoints

  /**
   * Get list of competitions
   * @param params - Query parameters
   * @returns Competitions response
   */
  async getCompetitions(
    params: GetCompetitionsParams = {},
  ): Promise<CompetitionsResponse> {
    const queryParams = this.formatQueryParams(params);
    return this.request<CompetitionsResponse>(`/competitions${queryParams}`);
  }

  /**
   * Get competition by ID
   * @param id - Competition ID
   * @returns Competition details
   */
  async getCompetition(id: string): Promise<CompetitionResponse> {
    return this.request<CompetitionResponse>(`/competitions/${id}`);
  }

  /**
   * Get trades for a competition
   * @param competitionId - Competition ID
   * @param params - Query parameters
   * @returns Trades response
   */
  async getCompetitionTrades(
    competitionId: string,
    params: GetCompetitionTradesParams = {},
  ): Promise<CompetitionTradesResponse> {
    const queryParams = this.formatQueryParams(params);
    return this.request<CompetitionTradesResponse>(
      `/competitions/${competitionId}/trades${queryParams}`,
    );
  }

  /**
   * Get perps positions for a competition
   * @param competitionId - Competition ID
   * @param params - Query parameters
   * @returns Perps positions response
   */
  async getCompetitionPerpsPositions(
    competitionId: string,
    params: GetCompetitionPerpsPositionsParams = {},
  ): Promise<CompetitionPerpsPositionsResponse> {
    const queryParams = this.formatQueryParams(params);
    return this.request<CompetitionPerpsPositionsResponse>(
      `/competitions/${competitionId}/perps/all-positions${queryParams}`,
    );
  }

  // Agent endpoints

  /**
   * Get competitions for an agent
   * @param agentId - Agent ID
   * @param params - Query parameters
   * @returns Agent competitions response
   */
  async getAgentCompetitions(
    agentId: string,
    params: GetAgentCompetitionsParams = {},
  ): Promise<AgentCompetitionsResponse> {
    const queryParams = this.formatQueryParams(params);
    return this.request<AgentCompetitionsResponse>(
      `/agents/${agentId}/competitions${queryParams}`,
    );
  }

  // Profile endpoints

  /**
   * Get user profile
   * @returns User profile
   */
  async getProfile(): Promise<ProfileResponse> {
    return this.request<ProfileResponse>("/user/profile");
  }

  /**
   * Update user profile
   * @param data - Profile data
   * @returns Updated profile
   */
  async verifyEmail(): Promise<VerifyEmailResponse> {
    return this.request<VerifyEmailResponse>("/user/verify-email", {
      method: "POST",
    });
  }

  /**
   * Verifies user email
   * @param data - Profile data
   * @returns Updated profile
   */
  async updateProfile(data: UpdateProfileRequest): Promise<ProfileResponse> {
    return this.request<ProfileResponse>("/user/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /**
   * Get competitions for the authenticated user
   * @param params - Query parameters
   * @returns Competitions response
   */
  async getUserCompetitions(
    params: GetCompetitionsParams = {},
  ): Promise<UserCompetitionsResponse> {
    const queryParams = this.formatQueryParams(params);
    return this.request<UserCompetitionsResponse>(
      `/user/competitions${queryParams}`,
    );
  }

  /**
   * Get user's boost balance for a competition
   * @param competitionId - Competition ID
   * @returns User's balance
   */
  async getBoostBalance({ competitionId }: { competitionId: string }): Promise<{
    success: boolean;
    balance: number;
  }> {
    const res = await this.request<{ success: boolean; balance: string }>(
      `/competitions/${competitionId}/boost`,
    );

    return {
      ...res,
      balance: attoValueToNumberValue(res.balance),
    };
  }

  /**
   * Get user's agent boost totals for a competition
   * @param competitionId - Competition ID
   * @returns Users total boost amount per agent id
   */
  async getBoosts({
    competitionId,
  }: {
    competitionId: string;
  }): Promise<{ success: boolean; boosts: Record<string, number> }> {
    const res = await this.request<{
      success: boolean;
      boosts: Record<string, string>;
    }>(`/competitions/${competitionId}/boosts`);

    return {
      ...res,
      boosts: Object.fromEntries(
        Object.entries(res.boosts).map(([key, value]) => [
          key,
          attoValueToNumberValue(value),
        ]),
      ),
    };
  }

  async getAgentBoostTotals({
    competitionId,
  }: {
    competitionId: string;
  }): Promise<{ success: boolean; boostTotals: Record<string, number> }> {
    const res = await this.request<{
      success: boolean;
      boostTotals: Record<string, string>;
    }>(`/competitions/${competitionId}/agents/boosts`);

    return {
      ...res,
      boostTotals: Object.fromEntries(
        Object.entries(res.boostTotals).map(([key, value]) => [
          key,
          attoValueToNumberValue(value),
        ]),
      ),
    };
  }

  /**
   * Boost an agent in a competition
   * @param competitionId - Competition ID
   * @param agentId - The agent to boost
   * @param currentAgentBoostTotal - The current agent boost total, used for idempotency
   * @param amount - The amount to boost
   * @returns The new agent boost total
   */
  async boostAgent({
    competitionId,
    agentId,
    currentAgentBoostTotal,
    amount,
  }: {
    competitionId: string;
    agentId: string;
    currentAgentBoostTotal: number;
    amount: number;
  }): Promise<{ success: boolean; agentTotal: number }> {
    const idemKey = btoa(
      `${competitionId}-${agentId}-${currentAgentBoostTotal}`,
    );

    const data = {
      amount: valueToAttoString(amount),
      idemKey,
    };

    const res = await this.request<{ success: boolean; agentTotal: string }>(
      `/competitions/${competitionId}/agents/${agentId}/boost`,
      { method: "POST", body: JSON.stringify(data) },
    );

    return {
      ...res,
      agentTotal: attoValueToNumberValue(res.agentTotal),
    };
  }
}

/**
 * Singleton API client instance
 * Use this instead of creating multiple instances
 */
export const apiClient = new ApiClient();
