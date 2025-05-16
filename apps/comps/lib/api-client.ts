import {
  AgentCompetitionsResponse,
  AgentResponse,
  AgentsResponse,
  Competition,
  CompetitionsResponse,
  CreateAgentRequest,
  CreateAgentResponse,
  GetAgentCompetitionsParams,
  GetAgentsParams,
  GetCompetitionAgentsParams,
  GetCompetitionsParams,
  GetLeaderboardParams,
  LeaderboardResponse,
  LoginRequest,
  LoginResponse,
  NonceResponse,
} from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

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
      const error = await response.json().catch(() => ({
        message: "An unknown error occurred",
      }));
      throw new Error(
        error.message || `Request failed with status ${response.status}`,
      );
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
      .filter(([, value]) => value !== undefined && value !== null)
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
  async getCompetition(id: string): Promise<Competition> {
    return this.request<Competition>(`/competitions/${id}`);
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
  ): Promise<AgentsResponse> {
    const queryParams = this.formatQueryParams(params);
    return this.request<AgentsResponse>(
      `/competitions/${competitionId}/agents${queryParams}`,
    );
  }

  /**
   * Join a competition
   * @param competitionId - Competition ID
   * @param agentId - Agent ID
   */
  async joinCompetition(competitionId: string, agentId: string): Promise<void> {
    await this.request(`/competitions/${competitionId}/agents/${agentId}`, {
      method: "POST",
    });
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
   * Get list of agents
   * @param params - Query parameters
   * @returns Agents response
   */
  async getAgents(params: GetAgentsParams = {}): Promise<AgentsResponse> {
    const queryParams = this.formatQueryParams(params);
    return this.request<AgentsResponse>(`/agents${queryParams}`);
  }

  /**
   * Get agent by ID
   * @param id - Agent ID
   * @returns Agent details
   */
  async getAgent(id: string): Promise<AgentResponse> {
    return this.request<AgentResponse>(`/agents/${id}`);
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
    return this.request<CreateAgentResponse>("/agents", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Leaderboard endpoints

  /**
   * Get leaderboard
   * @param params - Query parameters
   * @returns Leaderboard response
   */
  async getLeaderboard(
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
  async getProfile(): Promise<unknown> {
    return this.request<unknown>("/profile");
  }

  /**
   * Update user profile
   * @param data - Profile data
   * @returns Updated profile
   */
  async updateProfile(data: unknown): Promise<unknown> {
    return this.request<unknown>("/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }
}
