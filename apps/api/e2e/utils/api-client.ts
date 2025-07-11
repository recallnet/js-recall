import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

import { PagingParams } from "@/types/index.js";

import {
  AdminAgentResponse,
  AdminAgentsListResponse,
  AdminReactivateAgentInCompetitionResponse,
  AdminRemoveAgentFromCompetitionResponse,
  AdminSearchParams,
  AdminSearchUsersAndAgentsResponse,
  AdminUserResponse,
  AdminUsersListResponse,
  AgentApiKeyResponse,
  AgentMetadata,
  AgentNonceResponse,
  AgentProfileResponse,
  AgentWalletVerificationResponse,
  AgentsGetResponse,
  ApiResponse,
  BalancesResponse,
  BlockchainType,
  CompetitionAgentsResponse,
  CompetitionDetailResponse,
  CompetitionJoinResponse,
  CompetitionLeaveResponse,
  CompetitionRulesResponse,
  CompetitionStatusResponse,
  CreateCompetitionResponse,
  CrossChainTradingType,
  DetailedHealthCheckResponse,
  ErrorResponse,
  GetUserAgentsResponse,
  GlobalLeaderboardResponse,
  HealthCheckResponse,
  LeaderboardResponse,
  LoginResponse,
  LogoutResponse,
  NonceResponse,
  PortfolioResponse,
  PriceHistoryResponse,
  PriceResponse,
  PublicAgentResponse,
  QuoteResponse,
  ResetApiKeyResponse,
  SpecificChain,
  StartCompetitionResponse,
  TokenInfoResponse,
  TradeExecutionParams,
  TradeHistoryResponse,
  TradeResponse,
  UpcomingCompetitionsResponse,
  UserAgentApiKeyResponse,
  UserCompetitionsResponse,
  UserMetadata,
  UserProfileResponse,
  UserRegistrationResponse,
  UserVotesResponse,
  VoteResponse,
  VotingStateResponse,
} from "./api-types.js";
import { getBaseUrl } from "./server.js";

/**
 * API client for testing the Trading Simulator
 *
 * This client handles authentication and convenience methods
 * for interacting with the API endpoints.
 */
export class ApiClient {
  private axiosInstance: AxiosInstance;
  private apiKey: string | undefined;
  private baseUrl: string;
  private adminApiKey: string | undefined;
  private cookieJar: CookieJar;

  /**
   * Create a new API client
   *
   * @param apiKey API key for authentication
   * @param baseUrl Optional custom base URL
   */
  constructor(apiKey?: string, baseUrl: string = getBaseUrl()) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.cookieJar = new CookieJar();

    // Create axios instance with cookie jar support
    this.axiosInstance = wrapper(
      axios.create({
        baseURL: baseUrl,
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true, // Enable sending cookies with cross-origin requests
        jar: this.cookieJar, // Add cookie jar for session persistence
      }),
    );

    // Add interceptor to add authentication header
    this.axiosInstance.interceptors.request.use((config) => {
      // Add common headers
      config.headers = config.headers || {};

      // Set authentication header if API key is available
      if (this.apiKey) {
        config.headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      // For admin routes, use admin API key if available and different from regular API key
      if (
        this.adminApiKey &&
        (config.url?.startsWith("/api/admin") ||
          config.url?.includes("admin") ||
          config.url?.includes("competition") ||
          config.url?.includes("metrics")) &&
        this.adminApiKey !== this.apiKey
      ) {
        config.headers["Authorization"] = `Bearer ${this.adminApiKey}`;
      }

      // Log request (simplified)
      console.log(
        `[ApiClient] Request to ${config.method?.toUpperCase()} ${config.url}`,
      );

      return config;
    });

    // Add interceptor to handle response
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        // Let the error propagate for specific handling
        return Promise.reject(error);
      },
    );
  }

  /**
   * Helper method to handle API errors consistently
   */
  private handleApiError(error: unknown, operation: string): ErrorResponse {
    console.error(`Failed to ${operation}:`, error);

    // Extract the detailed error message from the axios error response
    if (axios.isAxiosError(error) && error.response?.data) {
      // Return the actual error message from the server with correct status
      return {
        success: false,
        error:
          error.response.data.error ||
          error.response.data.message ||
          error.message,
        status: error.response.status,
      };
    }

    // Fallback to the generic error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage, status: 500 };
  }

  /**
   * Create an admin account
   */
  async createAdminAccount(
    username: string,
    password: string,
    email: string,
  ): Promise<AdminUserResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post("/api/admin/setup", {
        username,
        password,
        email,
      });

      // If admin creation is successful, store the returned API key
      if (response.data.success && response.data.admin?.apiKey) {
        this.adminApiKey = response.data.admin.apiKey;
      }

      return response.data;
    } catch (error) {
      return this.handleApiError(error, "create admin account");
    }
  }
  async getAgentCompetitions(
    agentId: string,
    params?: {
      status?: string;
      sort?: string;
      limit?: number;
      offset?: number;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any | ErrorResponse> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.status) queryParams.append("status", params.status);
      if (params?.sort) queryParams.append("sort", params.sort);
      if (params?.limit !== undefined)
        queryParams.append("limit", params.limit.toString());
      if (params?.offset !== undefined)
        queryParams.append("offset", params.offset.toString());

      const queryString = queryParams.toString();
      const url = `/api/agents/${agentId}/competitions${queryString ? `?${queryString}` : ""}`;

      const response = await this.axiosInstance.get(url);
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get agent competitions");
    }
  }
  /**
   * Login as admin (this method now expects the admin API key directly)
   */
  async loginAsAdmin(apiKey: string): Promise<boolean> {
    try {
      // Store the admin API key
      this.adminApiKey = apiKey;

      // Verify the API key by making a simple admin request
      const response = await this.axiosInstance.get("/api/admin/agents");
      return response.data.success;
    } catch (error) {
      // Clear the admin API key if login fails
      this.adminApiKey = undefined;
      return this.handleApiError(error, "login as admin").success;
    }
  }

  /**
   * Generate a random Ethereum address
   * @returns A valid Ethereum address (0x + 40 hex characters)
   */
  private generateRandomEthAddress(): string {
    const chars = "0123456789abcdef";
    let address = "0x";

    // Generate 40 random hex characters
    for (let i = 0; i < 40; i++) {
      address += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return address;
  }

  /**
   * Register a new user and optionally create their first agent (admin only)
   * @param walletAddress Ethereum wallet address for the user
   * @param name User's display name
   * @param email User email address
   * @param userImageUrl Optional image URL for the user
   * @param userMetadata Optional metadata for the user
   * @param agentName Optional name for the user's first agent
   * @param agentDescription Optional description for the agent
   * @param agentImageUrl Optional image URL for the agent
   * @param agentMetadata Optional metadata for the agent
   * @param agentWalletAddress Optional wallet address for the agent
   */
  async registerUser({
    walletAddress,
    name,
    email,
    userImageUrl,
    userMetadata,
    agentName,
    agentDescription,
    agentImageUrl,
    agentMetadata,
    agentWalletAddress,
  }: {
    walletAddress: string;
    name?: string;
    email?: string;
    userImageUrl?: string;
    userMetadata?: UserMetadata;
    agentName?: string;
    agentDescription?: string;
    agentImageUrl?: string;
    agentMetadata?: AgentMetadata;
    agentWalletAddress?: string;
  }): Promise<UserRegistrationResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post("/api/admin/users", {
        walletAddress,
        name,
        email,
        userImageUrl,
        userMetadata,
        agentName,
        agentDescription,
        agentImageUrl,
        agentMetadata,
        agentWalletAddress,
      });

      return response.data;
    } catch (error) {
      return this.handleApiError(error, "register user");
    }
  }

  /**
   * Register a new agent
   * @param name Agent name
   * @param userId Optional user ID to associate with the agent (if not provided, userWalletAddress must be provided)
   * @param userWalletAddress Optional user wallet address that owns the agent (if not provided, userId must be provided)
   * @param agentWalletAddress Optional wallet address for the agent
   * @param email Agent email
   * @param description Agent description
   * @param imageUrl Agent image URL
   * @param metadata Agent metadata
   */
  async registerAgent({
    user,
    agent,
  }: {
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
      metadata?: AgentMetadata;
    };
  }): Promise<AdminAgentResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post("/api/admin/agents", {
        user,
        agent,
      });
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "register agent");
    }
  }

  /**
   * Start a competition with agents
   */
  async startCompetition(
    params:
      | {
          name: string;
          description?: string;
          agentIds: string[];
          tradingType?: CrossChainTradingType;
          sandboxMode?: boolean;
          externalUrl?: string;
          imageUrl?: string;
          votingStartDate?: string;
          votingEndDate?: string;
        }
      | string,
    description?: string,
    agentIds?: string[],
    tradingType?: CrossChainTradingType,
    sandboxMode?: boolean,
    externalUrl?: string,
    imageUrl?: string,
    votingStartDate?: string,
    votingEndDate?: string,
  ): Promise<StartCompetitionResponse | ErrorResponse> {
    try {
      let requestData;

      // Ensure voting is allowed by default for this competition, and the
      // caller can set specific dates if they desire.
      const now = new Date().toISOString();

      // Handle both object-based and individual parameter calls
      if (typeof params === "object") {
        requestData = { votingStartDate: now, ...params };
      } else {
        requestData = {
          name: params,
          description,
          agentIds: agentIds || [],
          tradingType,
          sandboxMode,
          externalUrl,
          imageUrl,
          votingStartDate: votingStartDate || now,
          votingEndDate,
        };
      }

      const response = await this.axiosInstance.post(
        "/api/admin/competition/start",
        requestData,
      );

      return response.data;
    } catch (error) {
      return this.handleApiError(error, "start competition");
    }
  }

  /**
   * Create a competition in PENDING state
   */
  async createCompetition(
    name: string,
    description?: string,
    tradingType?: CrossChainTradingType,
    sandboxMode?: boolean,
    externalUrl?: string,
    imageUrl?: string,
    type?: string,
    votingStartDate?: string,
    votingEndDate?: string,
  ): Promise<CreateCompetitionResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        "/api/admin/competition/create",
        {
          name,
          description,
          tradingType,
          sandboxMode,
          externalUrl,
          imageUrl,
          type,
          votingStartDate,
          votingEndDate,
        },
      );

      return response.data;
    } catch (error) {
      return this.handleApiError(error, "create competition");
    }
  }

  /**
   * Start an existing competition with agents
   */
  async startExistingCompetition(
    competitionId: string,
    agentIds: string[],
    crossChainTradingType?: CrossChainTradingType,
    sandboxMode?: boolean,
    externalUrl?: string,
    imageUrl?: string,
  ): Promise<StartCompetitionResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        "/api/admin/competition/start",
        {
          competitionId,
          agentIds,
          crossChainTradingType,
          sandboxMode,
          externalUrl,
          imageUrl,
        },
      );

      return response.data;
    } catch (error) {
      return this.handleApiError(error, "start existing competition");
    }
  }

  /**
   * Create an agent client with a provided API key
   */
  createAgentClient(apiKey: string): ApiClient {
    return new ApiClient(apiKey, this.baseUrl);
  }

  /**
   * Get user profile
   */
  async getUserProfile(): Promise<UserProfileResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get("/api/user/profile");
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get profile");
    }
  }

  /**
   * Get user profile
   */
  async getAgentProfile(): Promise<AgentProfileResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get("/api/agent/profile");
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get profile");
    }
  }

  /**
   * Update a user profile
   * @param profileData Profile data to update including name and imageUrl only (users have limited self-service editing)
   */
  async updateUserProfile(profileData: {
    name?: string;
    imageUrl?: string;
    metadata?: Record<string, unknown>;
  }): Promise<UserProfileResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.put(
        "/api/user/profile",
        profileData,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "update user profile");
    }
  }

  /**
   * Update an agent profile
   * @param profileData Profile data to update including name, description, and imageUrl only (agents have limited self-service editing)
   */
  async updateAgentProfile(profileData: {
    name?: string;
    description?: string;
    imageUrl?: string;
  }): Promise<AgentProfileResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.put(
        "/api/agent/profile",
        profileData,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "update agent profile");
    }
  }

  /**
   * Update a user's agent profile (via SIWE authentication)
   * @param agentId ID of the agent to update
   * @param profileData Profile data to update including name, description, and imageUrl only
   */
  async updateUserAgentProfile(
    agentId: string,
    profileData: {
      name?: string;
      description?: string;
      imageUrl?: string;
      email?: string;
      metadata?: AgentMetadata;
    },
  ): Promise<AgentProfileResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.put(
        `/api/user/agents/${agentId}/profile`,
        profileData,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "update user agent profile");
    }
  }

  /**
   * List all agents (admin only)
   */
  async listAgents(): Promise<AdminAgentsListResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get("/api/admin/agents");
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "list agents");
    }
  }

  /**
   * List all agents (auth only)
   */
  async getAgents(
    pagingParams: PagingParams,
    filter?: string,
  ): Promise<AgentsGetResponse | ErrorResponse> {
    try {
      let url = `/api/agents?limit=${pagingParams.limit}&offset=${pagingParams.offset}`;
      if (pagingParams.sort) {
        url += `&sort=${pagingParams.sort}`;
      }
      if (filter) {
        url += `&filter=${filter}`;
      }

      const response = await this.axiosInstance.get(url);
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "list agents");
    }
  }

  /**
   * List all users (admin only)
   */
  async listUsers(): Promise<AdminUsersListResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get("/api/admin/users");
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "list users");
    }
  }

  /**
   * Delete an agent (admin only)
   * @param agentId ID of the agent to delete
   */
  async deleteAgent(agentId: string): Promise<ApiResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.delete(
        `/api/admin/agents/${agentId}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "delete agent");
    }
  }

  /**
   * Delete a user (admin only)
   */
  async deleteUser(userId: string): Promise<ApiResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.delete(
        `/api/admin/users/${userId}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "delete user");
    }
  }

  /**
   * Deactivate an agent (admin only)
   * @param agentId ID of the agent to deactivate
   * @param reason Reason for deactivation
   */
  async deactivateAgent(
    agentId: string,
    reason: string,
  ): Promise<ApiResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        `/api/admin/agents/${agentId}/deactivate`,
        { reason },
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "deactivate agent");
    }
  }

  // /**
  //  * Deactivate a user (admin only) - DEPRECATED
  //  * @deprecated Use deactivateAgent instead
  //  */
  // TODO: Implement this
  // async deactivateUser(
  //   userId: string,
  //   reason: string,
  // ): Promise<AdminUserResponse | ErrorResponse> {
  //   try {
  //     const response = await this.axiosInstance.post(
  //       `/api/admin/users/${userId}/deactivate`,
  //       { reason },
  //     );
  //     return response.data;
  //   } catch (error) {
  //     return this.handleApiError(error, "deactivate user");
  //   }
  // }

  /**
   * Reactivate an agent (admin only)
   * @param agentId ID of the agent to reactivate
   */
  async reactivateAgent(
    agentId: string,
  ): Promise<AdminAgentResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        `/api/admin/agents/${agentId}/reactivate`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "reactivate agent");
    }
  }

  /**
   * Remove an agent from a specific competition (admin only)
   * @param competitionId ID of the competition
   * @param agentId ID of the agent to remove
   * @param reason Reason for removal
   */
  async removeAgentFromCompetition(
    competitionId: string,
    agentId: string,
    reason: string,
  ): Promise<AdminRemoveAgentFromCompetitionResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        `/api/admin/competitions/${competitionId}/agents/${agentId}/remove`,
        { reason },
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "remove agent from competition");
    }
  }

  /**
   * Reactivate an agent in a specific competition (admin only)
   * @param competitionId ID of the competition
   * @param agentId ID of the agent to reactivate
   */
  async reactivateAgentInCompetition(
    competitionId: string,
    agentId: string,
  ): Promise<AdminReactivateAgentInCompetitionResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        `/api/admin/competitions/${competitionId}/agents/${agentId}/reactivate`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "reactivate agent in competition");
    }
  }

  /**
   * Get an agent's API key (admin only)
   * @param agentId ID of the agent
   */
  async getAgentApiKey(
    agentId: string,
  ): Promise<AgentApiKeyResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/admin/agents/${agentId}/key`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get agent API key");
    }
  }

  /**
   * Get specific agent details (admin only)
   * @param agentId ID of the agent to retrieve
   */
  async getAgent(agentId: string): Promise<AdminAgentResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/admin/agents/${agentId}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get admin agent");
    }
  }

  /**
   * Get specific agent details (admin only)
   * @param agentId ID of the agent to retrieve
   */
  async getPublicAgent(
    agentId: string,
  ): Promise<PublicAgentResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(`/api/agents/${agentId}`);
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get public agent");
    }
  }

  /**
   * Get account balances
   */
  async getBalance(): Promise<BalancesResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get("/api/agent/balances");
      return response.data as BalancesResponse;
    } catch (error) {
      return this.handleApiError(error, "get balances");
    }
  }
  /**
   * Get portfolio value and information
   */
  async getPortfolio(): Promise<PortfolioResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get("/api/agent/portfolio");
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get portfolio");
    }
  }

  /**
   * Get trade history
   */
  async getTradeHistory(): Promise<TradeHistoryResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get("/api/agent/trades");
      return response.data as TradeHistoryResponse;
    } catch (error) {
      return this.handleApiError(error, "get trade history");
    }
  }

  /**
   * Execute a trade
   */
  async executeTrade(
    params: TradeExecutionParams,
  ): Promise<TradeResponse | ErrorResponse> {
    console.log(
      `[ApiClient] executeTrade called with params: ${JSON.stringify(params, null, 2)}`,
    );

    try {
      // Debug log
      console.log(
        `[ApiClient] About to execute trade with: ${JSON.stringify(params, null, 2)}`,
      );

      // Make the API call with the exact parameters
      const response = await this.axiosInstance.post(
        "/api/trade/execute",
        params,
      );

      return response.data as TradeResponse;
    } catch (error) {
      return this.handleApiError(error, "execute trade");
    }
  }

  /**
   * Get competition status
   */
  async getCompetitionStatus(): Promise<
    CompetitionStatusResponse | ErrorResponse
  > {
    try {
      const response = await this.axiosInstance.get("/api/competitions/status");
      return response.data as CompetitionStatusResponse;
    } catch (error) {
      return this.handleApiError(error, "get competition status");
    }
  }

  /**
   * Get competition leaderboard
   */
  async getCompetitionLeaderboard(): Promise<
    LeaderboardResponse | ErrorResponse
  > {
    try {
      const response = await this.axiosInstance.get(
        "/api/competitions/leaderboard",
      );
      return response.data as LeaderboardResponse;
    } catch (error) {
      return this.handleApiError(error, "get leaderboard");
    }
  }

  /**
   * Get the global leaderboard (global rankings)
   */
  async getGlobalLeaderboard(params?: {
    limit?: number;
    offset?: number;
    sort?: string;
  }): Promise<GlobalLeaderboardResponse | ErrorResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.limit !== undefined)
        queryParams.append("limit", params.limit.toString());
      if (params?.offset !== undefined)
        queryParams.append("offset", params.offset.toString());
      if (params?.sort !== undefined) queryParams.append("sort", params.sort);
      const response = await this.axiosInstance.get(
        `/api/leaderboard?${queryParams.toString()}`,
      );
      return response.data as GlobalLeaderboardResponse;
    } catch (error) {
      return this.handleApiError(error, "get leaderboards");
    }
  }

  /**
   * Get competition rules
   */
  async getRules(): Promise<CompetitionRulesResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get("/api/competitions/rules");
      return response.data as CompetitionRulesResponse;
    } catch (error) {
      return this.handleApiError(error, "get competition rules");
    }
  }

  /**
   * Get upcoming competitions (status=PENDING)
   */
  async getUpcomingCompetitions(): Promise<
    UpcomingCompetitionsResponse | ErrorResponse
  > {
    return this.getCompetitions("pending");
  }

  /**
   * Get competitions with given status
   */
  async getCompetitions(
    status?: string,
    sort?: string,
    limit?: number,
    offset?: number,
  ): Promise<UpcomingCompetitionsResponse | ErrorResponse> {
    try {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (sort) params.append("sort", sort);
      if (limit !== undefined) params.append("limit", limit.toString());
      if (offset !== undefined) params.append("offset", offset.toString());

      const url = `/api/competitions?${params.toString()}`;
      const response = await this.axiosInstance.get(url);
      return response.data as UpcomingCompetitionsResponse;
    } catch (error) {
      return this.handleApiError(
        error,
        `get competitions: sort=${sort}, status=${status}, limit=${limit}, offset=${offset}`,
      );
    }
  }

  /**
   * Get competition details by ID
   * @param competitionId Competition ID
   * @returns Competition details
   */
  async getCompetition(
    competitionId: string,
  ): Promise<CompetitionDetailResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/competitions/${competitionId}`,
      );
      return response.data as CompetitionDetailResponse;
    } catch (error) {
      return this.handleApiError(error, `get competition: ${competitionId}`);
    }
  }

  /**
   * Get agents participating in a competition
   * @param competitionId Competition ID
   * @param params Optional query parameters for filtering, sorting, and pagination
   * @returns Competition agents response
   */
  async getCompetitionAgents(
    competitionId: string,
    params?: {
      filter?: string;
      sort?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<CompetitionAgentsResponse | ErrorResponse> {
    const queryParams = new URLSearchParams();

    if (params?.filter) {
      queryParams.append("filter", params.filter);
    }
    if (params?.sort) {
      queryParams.append("sort", params.sort);
    }
    if (params?.limit !== undefined) {
      queryParams.append("limit", params.limit.toString());
    }
    if (params?.offset !== undefined) {
      queryParams.append("offset", params.offset.toString());
    }

    const queryString = queryParams.toString();
    const url = `/api/competitions/${competitionId}/agents${queryString ? `?${queryString}` : ""}`;

    return this.request<CompetitionAgentsResponse>("get", url);
  }

  /**
   * Join a competition
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @returns A promise that resolves to the join response
   */
  async joinCompetition(
    competitionId: string,
    agentId: string,
  ): Promise<CompetitionJoinResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        `/api/competitions/${competitionId}/agents/${agentId}`,
      );
      return response.data as CompetitionJoinResponse;
    } catch (error) {
      return this.handleApiError(error, "join competition");
    }
  }

  /**
   * Leave a competition
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @returns A promise that resolves to the leave response
   */
  async leaveCompetition(
    competitionId: string,
    agentId: string,
  ): Promise<CompetitionLeaveResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.delete(
        `/api/competitions/${competitionId}/agents/${agentId}`,
      );
      return response.data as CompetitionLeaveResponse;
    } catch (error) {
      return this.handleApiError(error, "leave competition");
    }
  }

  /**
   * Get token price
   *
   * @param token The token address
   * @param chain Optional blockchain type (auto-detected if not provided)
   * @param specificChain Optional specific chain for EVM tokens
   * @returns A promise that resolves to the price response
   */
  async getPrice(
    token: string,
    chain?: BlockchainType,
    specificChain?: SpecificChain,
  ): Promise<PriceResponse | ErrorResponse> {
    try {
      let path = `/api/price?token=${encodeURIComponent(token)}`;
      if (chain) {
        path += `&chain=${encodeURIComponent(chain)}`;
      }
      if (specificChain) {
        path += `&specificChain=${encodeURIComponent(specificChain)}`;
      }
      const response = await this.axiosInstance.get(path);
      return response.data as PriceResponse;
    } catch (error) {
      return this.handleApiError(error, "get price");
    }
  }

  /**
   * Get detailed token information
   *
   * @param token The token address
   * @param chain Optional blockchain type (auto-detected if not provided)
   * @param specificChain Optional specific chain for EVM tokens
   * @returns A promise that resolves to the token info response
   */
  async getTokenInfo(
    token: string,
    chain?: BlockchainType,
    specificChain?: SpecificChain,
  ): Promise<TokenInfoResponse | ErrorResponse> {
    try {
      let path = `/api/price/token-info?token=${encodeURIComponent(token)}`;
      if (chain) {
        path += `&chain=${encodeURIComponent(chain)}`;
      }
      if (specificChain) {
        path += `&specificChain=${encodeURIComponent(specificChain)}`;
      }
      const response = await this.axiosInstance.get(path);
      return response.data as TokenInfoResponse;
    } catch (error) {
      return this.handleApiError(error, "get token info");
    }
  }

  /**
   * Get price history for a token
   *
   * @param token The token address
   * @param interval Time interval (e.g., '1h', '1d')
   * @param chain Optional blockchain type
   * @param specificChain Optional specific chain
   * @param startTime Optional start time
   * @param endTime Optional end time
   */
  async getPriceHistory(
    token: string,
    interval: string,
    chain?: BlockchainType,
    specificChain?: SpecificChain,
    startTime?: string,
    endTime?: string,
  ): Promise<PriceHistoryResponse | ErrorResponse> {
    try {
      let path = `/api/price/history?token=${encodeURIComponent(token)}&interval=${interval}`;
      if (chain) {
        path += `&chain=${encodeURIComponent(chain)}`;
      }
      if (specificChain) {
        path += `&specificChain=${encodeURIComponent(specificChain)}`;
      }
      if (startTime) {
        path += `&startTime=${encodeURIComponent(startTime)}`;
      }
      if (endTime) {
        path += `&endTime=${encodeURIComponent(endTime)}`;
      }

      const response = await this.axiosInstance.get(path);
      return response.data as PriceHistoryResponse;
    } catch (error) {
      return this.handleApiError(error, "get price history");
    }
  }

  /**
   * Get a quote for a trade
   */
  async getQuote(
    fromToken: string,
    toToken: string,
    amount: string,
  ): Promise<QuoteResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/trade/quote?fromToken=${encodeURIComponent(fromToken)}&toToken=${encodeURIComponent(toToken)}&amount=${encodeURIComponent(amount)}`,
      );
      return response.data as QuoteResponse;
    } catch (error) {
      return this.handleApiError(error, "get quote");
    }
  }

  /**
   * End a competition (admin only)
   * @param competitionId ID of the competition to end
   */
  async endCompetition(
    competitionId: string,
  ): Promise<ApiResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        "/api/admin/competition/end",
        {
          competitionId,
        },
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "end competition");
    }
  }

  /**
   * Get basic system health status
   */
  async getHealthStatus(): Promise<HealthCheckResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get("/api/health");
      return response.data as HealthCheckResponse;
    } catch (error) {
      return this.handleApiError(error, "get health status");
    }
  }

  /**
   * Get detailed system health status
   */
  async getDetailedHealthStatus(): Promise<
    DetailedHealthCheckResponse | ErrorResponse
  > {
    try {
      const response = await this.axiosInstance.get("/api/health/detailed");
      return response.data as DetailedHealthCheckResponse;
    } catch (error) {
      return this.handleApiError(error, "get detailed health status");
    }
  }

  /**
   * Get Prometheus metrics
   * @returns A promise that resolves to the metrics response (plain text)
   */
  async getMetrics(): Promise<string | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get("/api/metrics");
      return response.data as string;
    } catch (error) {
      return this.handleApiError(error, "get metrics");
    }
  }

  /**
   * Generic API request method for custom endpoints
   * @param method HTTP method (get, post, put, delete)
   * @param path API path
   * @param data Optional request data
   */
  async request<T>(
    method: "get" | "post" | "put" | "delete",
    path: string,
    data?: unknown,
  ): Promise<T | ErrorResponse> {
    try {
      let response;
      if (method === "get") {
        response = await this.axiosInstance.get(path);
      } else if (method === "post") {
        response = await this.axiosInstance.post(path, data);
      } else if (method === "put") {
        response = await this.axiosInstance.put(path, data);
      } else if (method === "delete") {
        response = await this.axiosInstance.delete(path);
      } else {
        throw new Error(`Unsupported method: ${method}`);
      }
      return response.data as T;
    } catch (error) {
      return this.handleApiError(error, `${method} ${path}`);
    }
  }

  /**
   * Reset the agent's API key
   * @returns A promise that resolves to the reset API key response
   */
  async resetApiKey(): Promise<ResetApiKeyResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        "/api/agent/reset-api-key",
      );
      return response.data as ResetApiKeyResponse;
    } catch (error) {
      return this.handleApiError(error, "reset API key");
    }
  }

  /**
   * Verify agent wallet ownership via custom message signature
   * @param message The verification message
   * @param signature The signature of the message
   * @returns A promise that resolves to the verification response
   */
  async verifyAgentWallet(
    message: string,
    signature: string,
  ): Promise<AgentWalletVerificationResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post("/api/auth/verify", {
        message,
        signature,
      });
      return response.data as AgentWalletVerificationResponse;
    } catch (error) {
      return this.handleApiError(error, "verify agent wallet");
    }
  }

  /**
   * Search users and agents (admin only)
   * @param searchParams Search parameters (user.<field>, agent.<field>, join)
   */
  async searchUsersAndAgents(
    searchParams: AdminSearchParams,
  ): Promise<AdminSearchUsersAndAgentsResponse | ErrorResponse> {
    try {
      const queryParams = new URLSearchParams();

      if (searchParams.user?.email)
        queryParams.append("user.email", searchParams.user?.email);
      if (searchParams.user?.name)
        queryParams.append("user.name", searchParams.user?.name);
      if (searchParams.user?.walletAddress)
        queryParams.append(
          "user.walletAddress",
          searchParams.user?.walletAddress,
        );
      if (searchParams.user?.status)
        queryParams.append("user.status", searchParams.user?.status);
      if (searchParams.agent?.name)
        queryParams.append("agent.name", searchParams.agent?.name);
      if (searchParams.agent?.ownerId)
        queryParams.append("agent.ownerId", searchParams.agent?.ownerId);
      if (searchParams.agent?.walletAddress)
        queryParams.append(
          "agent.walletAddress",
          searchParams.agent?.walletAddress,
        );
      if (searchParams.agent?.status)
        queryParams.append("agent.status", searchParams.agent?.status);
      if (searchParams?.join)
        queryParams.append("join", searchParams.join.toString());

      const url = `/api/admin/search?${queryParams.toString()}`;

      return this.request("get", url);
    } catch (error) {
      return this.handleApiError(error, "search users and agents");
    }
  }

  /**
   * Get a nonce for SIWE authentication
   * @returns A promise that resolves to the nonce response
   */
  async getNonce(): Promise<NonceResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get("/api/auth/nonce");
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get nonce");
    }
  }

  /**
   * Get a nonce for agent wallet verification
   * @returns A promise that resolves to the agent nonce response
   */
  async getAgentNonce(): Promise<AgentNonceResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get("/api/auth/agent/nonce");
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get agent nonce");
    }
  }

  /**
   * Login with SIWE
   * @param message The SIWE message
   * @param signature The signature of the SIWE message
   * @returns A promise that resolves to the login response
   */
  async login(
    message: string,
    signature: string,
  ): Promise<LoginResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post("/api/auth/login", {
        message,
        signature,
      });
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "login with SIWE");
    }
  }

  /**
   * Logout and destroy the session
   * @returns A promise that resolves to the logout response
   */
  async logout(): Promise<LogoutResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post("/api/auth/logout");
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "logout");
    }
  }

  /**
   * Create a new agent for the authenticated user
   * @param name Agent name (required, must be unique for this user)
   * @param description Optional agent description
   * @param imageUrl Optional agent image URL
   * @param metadata Optional agent metadata
   */
  async createAgent(
    name: string,
    description?: string,
    imageUrl?: string,
    metadata?: Record<string, unknown>,
  ): Promise<AgentProfileResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post("/api/user/agents", {
        name,
        description,
        imageUrl,
        metadata,
      });
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "create agent");
    }
  }

  /**
   * Get all agents owned by the authenticated user
   * @param params Optional pagination and sorting parameters
   */
  async getUserAgents(params?: {
    limit?: number;
    offset?: number;
    sort?: string;
  }): Promise<GetUserAgentsResponse | ErrorResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.limit !== undefined) {
        queryParams.append("limit", params.limit.toString());
      }
      if (params?.offset !== undefined) {
        queryParams.append("offset", params.offset.toString());
      }
      if (params?.sort) {
        queryParams.append("sort", params.sort);
      }

      const url = `/api/user/agents${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const response = await this.axiosInstance.get(url);
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get user agents");
    }
  }

  /**
   * Get details of a specific agent owned by the authenticated user
   * @param agentId ID of the agent to retrieve
   */
  async getUserAgent(
    agentId: string,
  ): Promise<AgentProfileResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/user/agents/${agentId}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get user agent");
    }
  }

  /**
   * Get the API key for a specific agent owned by the authenticated user
   * @param agentId ID of the agent to get the API key for
   */
  async getUserAgentApiKey(
    agentId: string,
  ): Promise<UserAgentApiKeyResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/user/agents/${agentId}/api-key`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get user agent API key");
    }
  }

  // ===========================
  // Vote-related methods
  // ===========================

  /**
   * Cast a vote for an agent in a competition
   * Requires SIWE session authentication
   */
  async castVote(
    agentId: string,
    competitionId: string,
  ): Promise<VoteResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post("/api/user/vote", {
        agentId,
        competitionId,
      });
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "cast vote");
    }
  }

  /**
   * Get user's votes (optionally filtered by competition)
   * Requires SIWE session authentication
   */
  async getUserVotes(
    competitionId?: string,
  ): Promise<UserVotesResponse | ErrorResponse> {
    try {
      const queryParams = competitionId
        ? `?competitionId=${encodeURIComponent(competitionId)}`
        : "";
      const response = await this.axiosInstance.get(
        `/api/user/votes${queryParams}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get user votes");
    }
  }

  /**
   * Get voting state for a user in a specific competition
   * Requires SIWE session authentication
   */
  async getVotingState(
    competitionId: string,
  ): Promise<VotingStateResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/user/votes/${encodeURIComponent(competitionId)}/state`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get voting state");
    }
  }

  /**
   * Get competitions for user's agents
   * Requires SIWE session authentication
   */
  async getUserCompetitions(params?: {
    status?: string;
    claimed?: boolean;
    limit?: number;
    offset?: number;
    sort?: string;
  }): Promise<UserCompetitionsResponse | ErrorResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append("status", params.status);
      if (params?.claimed !== undefined)
        queryParams.append("claimed", String(params.claimed));
      if (params?.limit) queryParams.append("limit", String(params.limit));
      if (params?.offset) queryParams.append("offset", String(params.offset));
      if (params?.sort) queryParams.append("sort", params.sort);

      const queryString = queryParams.toString();
      const url = `/api/user/competitions${queryString ? `?${queryString}` : ""}`;

      const response = await this.axiosInstance.get(url);
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get user competitions");
    }
  }

  /**
   * Sync object index data (admin only)
   * @param params Optional parameters for syncing
   */
  async syncObjectIndex(params?: {
    competitionId?: string;
    dataTypes?: string[];
  }): Promise<
    | {
        success: boolean;
        message: string;
        dataTypes: string[];
        competitionId: string;
      }
    | ErrorResponse
  > {
    try {
      const response = await this.axiosInstance.post(
        "/api/admin/object-index/sync",
        params || {},
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "sync object index");
    }
  }

  /**
   * Get object index entries (admin only)
   * @param params Query parameters for filtering
   */
  async getObjectIndex(params?: {
    competitionId?: string;
    agentId?: string;
    dataType?: string;
    limit?: number;
    offset?: number;
  }): Promise<
    | {
        success: boolean;
        data: {
          entries: Array<{
            id: string;
            competitionId: string | null;
            agentId: string;
            dataType: string;
            data: string;
            sizeBytes: number;
            metadata: Record<string, unknown>;
            eventTimestamp: string;
            createdAt: string;
          }>;
          pagination: {
            total: number;
            limit: number;
            offset: number;
          };
        };
      }
    | ErrorResponse
  > {
    try {
      const queryParams = new URLSearchParams();
      if (params?.competitionId)
        queryParams.append("competitionId", params.competitionId);
      if (params?.agentId) queryParams.append("agentId", params.agentId);
      if (params?.dataType) queryParams.append("dataType", params.dataType);
      if (params?.limit) queryParams.append("limit", String(params.limit));
      if (params?.offset) queryParams.append("offset", String(params.offset));

      const queryString = queryParams.toString();
      const url = `/api/admin/object-index${queryString ? `?${queryString}` : ""}`;

      const response = await this.axiosInstance.get(url);
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get object index");
    }
  }

  /**
   * Verify user email with token
   * Requires SIWE session authentication
   * @param token Email verification token
   */
  async verifyEmail(): Promise<ApiResponse> {
    try {
      const response = await this.axiosInstance.post("/api/user/verify-email");
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "verify email");
    }
  }
}
