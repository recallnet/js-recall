import axios, { AxiosInstance } from "axios";

import {
  AdminTeamResponse,
  AdminTeamsListResponse,
  ApiResponse,
  BalancesResponse,
  BlockchainType,
  CompetitionRulesResponse,
  CompetitionStatusResponse,
  CreateCompetitionResponse,
  CrossChainTradingType,
  DetailedHealthCheckResponse,
  ErrorResponse,
  HealthCheckResponse,
  LeaderboardResponse,
  LoginResponse,
  LogoutResponse,
  NonceResponse,
  PortfolioResponse,
  PriceHistoryResponse,
  PriceResponse,
  QuoteResponse,
  ResetApiKeyResponse,
  SpecificChain,
  StartCompetitionResponse,
  TeamApiKeyResponse,
  TeamMetadata,
  TeamProfileResponse,
  TeamRegistrationResponse,
  TokenInfoResponse,
  TradeExecutionParams,
  TradeHistoryResponse,
  TradeResponse,
  UpcomingCompetitionsResponse,
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

  /**
   * Create a new API client
   *
   * @param apiKey API key for authentication
   * @param baseUrl Optional custom base URL
   */
  constructor(apiKey?: string, baseUrl: string = getBaseUrl()) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;

    // Create axios instance
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
      withCredentials: true, // Enable sending cookies with cross-origin requests
    });

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
          config.url?.includes("competition")) &&
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
  ): Promise<AdminTeamResponse | ErrorResponse> {
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

  /**
   * Login as admin (this method now expects the admin API key directly)
   */
  async loginAsAdmin(apiKey: string): Promise<boolean> {
    try {
      // Store the admin API key
      this.adminApiKey = apiKey;

      // Verify the API key by making a simple admin request
      const response = await this.axiosInstance.get("/api/admin/teams");
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
   * @param agentName Optional name for the user's first agent
   * @param agentDescription Optional description for the agent
   * @param agentImageUrl Optional image URL for the agent
   * @param agentMetadata Optional metadata for the agent
   */
  async registerUser(
    walletAddress: string,
    name?: string,
    email?: string,
    userImageUrl?: string,
    agentName?: string,
    agentDescription?: string,
    agentImageUrl?: string,
    agentMetadata?: Record<string, unknown>,
  ): Promise<any | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post("/api/admin/users", {
        walletAddress,
        name,
        email,
        userImageUrl,
        agentName,
        agentDescription,
        agentImageUrl,
        agentMetadata,
      });

      return response.data;
    } catch (error) {
      return this.handleApiError(error, "register user");
    }
  }

  /**
   * Register a new team (admin only) - DEPRECATED
   * This method now creates a user and agent for backward compatibility
   * @deprecated Use registerUser instead
   */
  async registerTeam(
    name: string,
    email: string,
    contactPerson: string,
    walletAddress?: string,
    metadata?: any,
    imageUrl?: string,
  ): Promise<any | ErrorResponse> {
    console.warn("registerTeam is deprecated. Use registerUser instead.");

    // Generate a random Ethereum address if one isn't provided
    const address = walletAddress || this.generateRandomEthAddress();

    // Use the new user registration endpoint
    return this.registerUser(
      address,
      contactPerson, // Use contactPerson as user name
      email,
      undefined, // userImageUrl
      name, // Use team name as agent name
      `Agent for ${name}`, // agentDescription
      imageUrl, // agentImageUrl
      metadata, // agentMetadata
    );
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
          externalLink?: string;
          imageUrl?: string;
        }
      | string,
    description?: string,
    agentIds?: string[],
    tradingType?: CrossChainTradingType,
    externalLink?: string,
    imageUrl?: string,
  ): Promise<StartCompetitionResponse | ErrorResponse> {
    try {
      let requestData;

      // Handle both object-based and individual parameter calls
      if (typeof params === "object") {
        requestData = params;
      } else {
        requestData = {
          name: params,
          description,
          agentIds: agentIds || [],
          tradingType,
          externalLink,
          imageUrl,
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
    externalLink?: string,
    imageUrl?: string,
  ): Promise<CreateCompetitionResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        "/api/admin/competition/create",
        {
          name,
          description,
          tradingType,
          externalLink,
          imageUrl,
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
    externalLink?: string,
    imageUrl?: string,
  ): Promise<StartCompetitionResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        "/api/admin/competition/start",
        {
          competitionId,
          agentIds,
          crossChainTradingType,
          externalLink,
          imageUrl,
        },
      );

      return response.data;
    } catch (error) {
      return this.handleApiError(error, "start existing competition");
    }
  }

  /**
   * Create a team client with a provided API key
   */
  createTeamClient(apiKey: string): ApiClient {
    return new ApiClient(apiKey, this.baseUrl);
  }

  /**
   * Get team profile
   */
  async getProfile(): Promise<TeamProfileResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get("/api/account/profile");
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get profile");
    }
  }

  /**
   * Update team profile
   * @param profileData Profile data to update including contactPerson, metadata, and imageUrl
   */
  async updateProfile(profileData: {
    contactPerson?: string;
    metadata?: TeamMetadata;
    imageUrl?: string;
  }): Promise<TeamProfileResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.put(
        "/api/account/profile",
        profileData,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "update profile");
    }
  }

  /**
   * List all agents (admin only)
   */
  async listAllAgents(): Promise<any | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get("/api/admin/agents");
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "list agents");
    }
  }

  /**
   * List all teams (admin only) - DEPRECATED
   * @deprecated Use listAllAgents instead
   */
  async listAllTeams(): Promise<AdminTeamsListResponse | ErrorResponse> {
    console.warn("listAllTeams is deprecated. Use listAllAgents instead.");
    return this.listAllAgents();
  }

  /**
   * Alias for listAllAgents for better readability in tests
   */
  async listAgents(): Promise<any | ErrorResponse> {
    return this.listAllAgents();
  }

  /**
   * Alias for listAllTeams for backward compatibility
   * @deprecated Use listAgents instead
   */
  async listTeams(): Promise<AdminTeamsListResponse | ErrorResponse> {
    return this.listAllTeams();
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
   * Delete a team (admin only) - DEPRECATED
   * @deprecated Use deleteAgent instead
   */
  async deleteTeam(teamId: string): Promise<ApiResponse | ErrorResponse> {
    console.warn("deleteTeam is deprecated. Use deleteAgent instead.");
    return this.deleteAgent(teamId);
  }

  /**
   * Deactivate an agent (admin only)
   * @param agentId ID of the agent to deactivate
   * @param reason Reason for deactivation
   */
  async deactivateAgent(
    agentId: string,
    reason: string,
  ): Promise<any | ErrorResponse> {
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

  /**
   * Deactivate a team (admin only) - DEPRECATED
   * @deprecated Use deactivateAgent instead
   */
  async deactivateTeam(
    teamId: string,
    reason: string,
  ): Promise<AdminTeamResponse | ErrorResponse> {
    console.warn("deactivateTeam is deprecated. Use deactivateAgent instead.");
    return this.deactivateAgent(teamId, reason);
  }

  /**
   * Reactivate an agent (admin only)
   * @param agentId ID of the agent to reactivate
   */
  async reactivateAgent(agentId: string): Promise<any | ErrorResponse> {
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
   * Reactivate a team (admin only) - DEPRECATED
   * @deprecated Use reactivateAgent instead
   */
  async reactivateTeam(
    teamId: string,
  ): Promise<AdminTeamResponse | ErrorResponse> {
    console.warn("reactivateTeam is deprecated. Use reactivateAgent instead.");
    return this.reactivateAgent(teamId);
  }

  /**
   * Get an agent's API key (admin only)
   * @param agentId ID of the agent
   */
  async getAgentApiKey(agentId: string): Promise<any | ErrorResponse> {
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
   * Get a team's API key (admin only) - DEPRECATED
   * @deprecated Use getAgentApiKey instead
   */
  async getTeamApiKey(
    teamId: string,
  ): Promise<TeamApiKeyResponse | ErrorResponse> {
    console.warn("getTeamApiKey is deprecated. Use getAgentApiKey instead.");
    return this.getAgentApiKey(teamId);
  }

  /**
   * Get account balances
   */
  async getBalance(): Promise<BalancesResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get("/api/account/balances");
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
      const response = await this.axiosInstance.get("/api/account/portfolio");
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
      const response = await this.axiosInstance.get("/api/account/trades");
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
  async getLeaderboard(): Promise<LeaderboardResponse | ErrorResponse> {
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
    status: string,
    sort?: string,
  ): Promise<UpcomingCompetitionsResponse | ErrorResponse> {
    try {
      let url = `/api/competitions?status=${status}`;
      if (typeof sort === "string") {
        url += `&sort=${sort}`;
      }

      const response = await this.axiosInstance.get(url);
      return response.data as UpcomingCompetitionsResponse;
    } catch (error) {
      return this.handleApiError(
        error,
        `get competitions: sort=${sort}, status=${status}`,
      );
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
   * Publicly register a new team (no authentication required)
   * @param name Team name
   * @param email Team email
   * @param contactPerson Contact person name
   * @param walletAddress Optional Ethereum wallet address (random valid address will be generated if not provided)
   * @param metadata Optional metadata for the team agent
   * @param imageUrl Optional image URL for the team
   */
  async publicRegisterTeam(
    name: string,
    email: string,
    contactPerson: string,
    walletAddress?: string,
    metadata?: TeamMetadata,
    imageUrl?: string,
  ): Promise<TeamRegistrationResponse | ErrorResponse> {
    try {
      // Generate a random Ethereum address if one isn't provided
      const address = walletAddress || this.generateRandomEthAddress();

      const response = await this.axiosInstance.post(
        "/api/public/teams/register",
        {
          teamName: name,
          email,
          contactPerson,
          walletAddress: address,
          metadata,
          imageUrl,
        },
      );

      return response.data;
    } catch (error) {
      return this.handleApiError(error, "publicly register team");
    }
  }

  /**
   * Reset the team's API key
   * @returns A promise that resolves to the reset API key response
   */
  async resetApiKey(): Promise<ResetApiKeyResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        "/api/account/reset-api-key",
      );
      return response.data as ResetApiKeyResponse;
    } catch (error) {
      return this.handleApiError(error, "reset API key");
    }
  }

  /**
   * Search teams by various criteria (admin only)
   * @param searchParams Search parameters (email, name, walletAddress, contactPerson, active, includeAdmins)
   */
  async searchTeams(searchParams: {
    email?: string;
    name?: string;
    walletAddress?: string;
    contactPerson?: string;
    active?: boolean;
    includeAdmins?: boolean;
  }): Promise<AdminTeamsListResponse | ErrorResponse> {
    try {
      // Convert search parameters to query string
      const queryParams = new URLSearchParams();

      if (searchParams.email) queryParams.append("email", searchParams.email);
      if (searchParams.name) queryParams.append("name", searchParams.name);
      if (searchParams.walletAddress)
        queryParams.append("walletAddress", searchParams.walletAddress);
      if (searchParams.contactPerson)
        queryParams.append("contactPerson", searchParams.contactPerson);
      if (searchParams.active !== undefined)
        queryParams.append("active", searchParams.active.toString());
      if (searchParams.includeAdmins !== undefined)
        queryParams.append(
          "includeAdmins",
          searchParams.includeAdmins.toString(),
        );

      const url = `/api/admin/teams/search?${queryParams.toString()}`;

      return this.request<AdminTeamsListResponse>("get", url);
    } catch (error) {
      return this.handleApiError(error, "search teams");
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
}
