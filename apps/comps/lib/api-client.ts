import {
  Agent,
  AgentApiKeyResponse,
  AgentCompetitionResponse,
  AgentCompetitionsResponse,
  AgentWithOwnerResponse,
  AgentsResponse,
  CompetitionResponse,
  CompetitionsResponse,
  CreateAgentRequest,
  CreateAgentResponse,
  CreateVoteRequest,
  EnrichedVotesResponse,
  GetAgentCompetitionsParams,
  GetAgentsParams,
  GetCompetitionAgentsParams,
  GetCompetitionsParams,
  GetLeaderboardParams,
  GetVotesParams,
  JoinCompetitionResponse,
  LeaderboardResponse,
  LoginRequest,
  LoginResponse,
  NonceResponse,
  ProfileResponse,
  UpdateAgentRequest,
  UpdateAgentResponse,
  UpdateProfileRequest,
  UserCompetitionsResponse,
  VoteResponse,
  VotesResponse,
  VotingStateResponse,
} from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

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

  constructor(baseUrl: string = API_BASE_URL) {
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
      credentials: "include", // Include cookies for auth
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
   * Login with ethereum signature
   * @param data - Login request data
   * @returns Login response
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Logout and clear cookies
   */
  async logout(): Promise<void> {
    await this.request("/auth/logout", {
      method: "POST",
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
   * Get agents participating in a competition
   * @param competitionId - Competition ID
   * @param params - Query parameters
   * @returns Agents response
   */
  async getCompetitionAgents(
    competitionId: string,
    params: GetCompetitionAgentsParams = {},
  ): Promise<AgentCompetitionResponse> {
    const queryParams = this.formatQueryParams(params);
    return this.request<AgentCompetitionResponse>(
      `/competitions/${competitionId}/agents${queryParams}`,
    );
  }

  /**
   * Join a competition
   * @param competitionId - Competition ID
   * @param agentId - Agent ID
   */
  async joinCompetition(
    competitionId: string,
    agentId: string,
  ): Promise<JoinCompetitionResponse> {
    return this.request<JoinCompetitionResponse>(
      `/competitions/${competitionId}/agents/${agentId}`,
      {
        method: "POST",
      },
    );
  }

  /**
   * Leave a competition
   * @param competitionId - Competition ID
   * @param agentId - Agent ID
   */
  async leaveCompetition(
    competitionId: string,
    agentId: string,
  ): Promise<void> {
    await this.request(`/competitions/${competitionId}/agents/${agentId}`, {
      method: "DELETE",
    });
  }

  // Agent endpoints

  /**
   * Get list of authenticated user agents
   * @param params - Query parameters
   * @returns Agents response
   */
  async getUserAgents(params: GetAgentsParams = {}): Promise<AgentsResponse> {
    const queryParams = this.formatQueryParams(params);
    return this.request<AgentsResponse>(`/user/agents${queryParams}`);
  }

  /**
   * Get agent api key
   * @param params - Query parameters
   * @returns Agents response
   */
  async getAgentApiKey(agentId: string): Promise<AgentApiKeyResponse> {
    return this.request<AgentApiKeyResponse>(`/user/agents/${agentId}/api-key`);
  }

  /**
   * Get agent by ID owned by the authenticated user
   * @param id - Agent ID
   * @returns Agent details
   */
  async getUserAgent(id: string): Promise<{ success: boolean; agent: Agent }> {
    return this.request<{ success: boolean; agent: Agent }>(
      `/user/agents/${id}`,
    );
  }

  /**
   * Get list of agents
   * @param params - Query parameters
   * @returns Agents response
   */
  async getAgents(params: GetAgentsParams = {}): Promise<AgentsResponse> {
    const queryParams = this.formatQueryParams(params);
    return this.request<AgentsResponse>(`/agents${queryParams}`);
  }

  /**
   * Get agent by ID (unauthenticated)
   * @param id - Agent ID
   * @returns Agent details
   */
  async getAgent(id: string): Promise<AgentWithOwnerResponse> {
    return this.request<AgentWithOwnerResponse>(`/agents/${id}`);
  }

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

  /**
   * Create a new agent
   * @param data - Agent creation data
   * @returns Created agent response
   */
  async createAgent(data: CreateAgentRequest): Promise<CreateAgentResponse> {
    return this.request<CreateAgentResponse>("/user/agents", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Leaderboards endpoints

  /**
   * Get global leaderboard
   * @param params - Query parameters
   * @returns Leaderboards response
   */
  async getGlobalLeaderboard(
    params: GetLeaderboardParams = {},
  ): Promise<LeaderboardResponse> {
    const queryParams = this.formatQueryParams(params);
    return this.request<LeaderboardResponse>(`/leaderboard${queryParams}`);
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
   * Update user agent
   * @param data - Agent data
   * @returns Updated agent
   **/
  async updateAgent(data: UpdateAgentRequest): Promise<UpdateAgentResponse> {
    return this.request<UpdateAgentResponse>(
      `/user/agents/${data.agentId}/profile`,
      {
        method: "PUT",
        body: JSON.stringify(data.params),
      },
    );
  }

  /**
   * Create a vote for an agent in a competition
   * @param data - Vote creation data
   * @returns Vote response
   */
  async createVote(data: CreateVoteRequest): Promise<VoteResponse> {
    return this.request<VoteResponse>("/user/vote", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Get user votes
   * @param params - Query parameters
   * @returns Votes response
   */
  async getVotes(params: GetVotesParams = {}): Promise<VotesResponse> {
    const queryParams = this.formatQueryParams(params);
    return this.request<VotesResponse>(`/user/votes${queryParams}`);
  }

  /**
   * Get user votes with agent and competition data
   * @param params - Query parameters
   * @returns Votes response
   */
  async getEnrichedVotes(
    params: GetVotesParams = {},
  ): Promise<EnrichedVotesResponse> {
    const queryParams = this.formatQueryParams(params);
    const votes = await this.request<VotesResponse>(
      `/user/votes${queryParams}`,
    );

    const enrichedVotes = await Promise.all(
      votes.votes.map(async (vote) => {
        const [competition, agent] = await Promise.all([
          this.getCompetition(vote.competitionId),
          this.getAgent(vote.agentId),
        ]);

        return {
          id: vote.id,
          createdAt: vote.createdAt,
          agent: agent.agent,
          competition: competition.competition,
        };
      }),
    );

    return {
      success: votes.success,
      pagination: votes.pagination,
      votes: enrichedVotes,
    };
  }

  /**
   * Get voting state for a competition
   * @param competitionId - Competition ID
   * @returns Voting state response
   */
  async getVotingState(competitionId: string): Promise<VotingStateResponse> {
    return this.request<VotingStateResponse>(
      `/user/votes/${competitionId}/state`,
    );
  }
}
