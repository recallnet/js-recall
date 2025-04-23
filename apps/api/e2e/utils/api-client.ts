import axios, { AxiosInstance } from 'axios';
import {
  ApiResponse,
  ErrorResponse,
  BlockchainType,
  SpecificChain,
  TeamProfileResponse,
  BalancesResponse,
  TradeHistoryResponse,
  TradeResponse,
  CompetitionStatusResponse,
  LeaderboardResponse,
  PriceResponse,
  TokenInfoResponse,
  PriceHistoryResponse,
  AdminTeamResponse,
  AdminTeamsListResponse,
  TeamRegistrationResponse,
  CreateCompetitionResponse,
  StartCompetitionResponse,
  CompetitionRulesResponse,
  HealthCheckResponse,
  DetailedHealthCheckResponse,
  TradeExecutionParams,
  QuoteResponse,
  PortfolioResponse,
  TeamApiKeyResponse,
  TeamMetadata,
} from './api-types';
import { getBaseUrl } from './server';

/**
 * API client for testing the Solana Trading Simulator
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
        'Content-Type': 'application/json',
      },
    });

    // Add interceptor to add authentication header
    this.axiosInstance.interceptors.request.use((config) => {
      // Add common headers
      config.headers = config.headers || {};

      // Set authentication header if API key is available
      if (this.apiKey) {
        config.headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      // For admin routes, use admin API key if available and different from regular API key
      if (
        this.adminApiKey &&
        (config.url?.startsWith('/api/admin') ||
          config.url?.includes('admin') ||
          config.url?.includes('competition')) &&
        this.adminApiKey !== this.apiKey
      ) {
        config.headers['Authorization'] = `Bearer ${this.adminApiKey}`;
      }

      // Log request (simplified)
      console.log(`[ApiClient] Request to ${config.method?.toUpperCase()} ${config.url}`);

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
  private handleApiError(error: any, operation: string): ErrorResponse {
    console.error(`Failed to ${operation}:`, error);

    // Extract the detailed error message from the axios error response
    if (axios.isAxiosError(error) && error.response?.data) {
      // Return the actual error message from the server with correct status
      return {
        success: false,
        error: error.response.data.error || error.response.data.message || error.message,
        status: error.response.status,
      };
    }

    // Fallback to the generic error message
    return { success: false, error: (error as any).message, status: 500 };
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
      const response = await this.axiosInstance.post('/api/admin/setup', {
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
      return this.handleApiError(error, 'create admin account');
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
      const response = await this.axiosInstance.get('/api/admin/teams');
      return response.data.success;
    } catch (error) {
      // Clear the admin API key if login fails
      this.adminApiKey = undefined;
      return this.handleApiError(error, 'login as admin').success;
    }
  }

  /**
   * Generate a random Ethereum address
   * @returns A valid Ethereum address (0x + 40 hex characters)
   */
  private generateRandomEthAddress(): string {
    const chars = '0123456789abcdef';
    let address = '0x';

    // Generate 40 random hex characters
    for (let i = 0; i < 40; i++) {
      address += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return address;
  }

  /**
   * Register a new team (admin only)
   * @param name Team name
   * @param email Team email
   * @param contactPerson Contact person name
   * @param walletAddress Optional Ethereum wallet address (random valid address will be generated if not provided)
   * @param metadata Optional metadata for the team agent
   */
  async registerTeam(
    name: string,
    email: string,
    contactPerson: string,
    walletAddress?: string,
    metadata?: TeamMetadata,
  ): Promise<TeamRegistrationResponse | ErrorResponse> {
    try {
      // Generate a random Ethereum address if one isn't provided
      const address = walletAddress || this.generateRandomEthAddress();

      const response = await this.axiosInstance.post('/api/admin/teams/register', {
        teamName: name,
        email,
        contactPerson,
        walletAddress: address,
        metadata,
      });

      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'register team');
    }
  }

  /**
   * Start a competition
   */
  async startCompetition(
    name: string,
    description: string,
    teamIds: string[],
  ): Promise<StartCompetitionResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post('/api/admin/competition/start', {
        name,
        description,
        teamIds,
      });

      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'start competition');
    }
  }

  /**
   * Create a competition in PENDING state
   */
  async createCompetition(
    name: string,
    description?: string,
  ): Promise<CreateCompetitionResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post('/api/admin/competition/create', {
        name,
        description,
      });

      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'create competition');
    }
  }

  /**
   * Start an existing competition
   */
  async startExistingCompetition(
    competitionId: string,
    teamIds: string[],
  ): Promise<StartCompetitionResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post('/api/admin/competition/start', {
        competitionId,
        teamIds,
      });

      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'start existing competition');
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
      const response = await this.axiosInstance.get('/api/account/profile');
      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'get profile');
    }
  }

  /**
   * Update team profile
   */
  async updateProfile(profileData: {
    contactPerson?: string;
    metadata?: TeamMetadata;
  }): Promise<TeamProfileResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.put('/api/account/profile', profileData);
      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'update profile');
    }
  }

  /**
   * List all teams (admin only)
   */
  async listAllTeams(): Promise<AdminTeamsListResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get('/api/admin/teams');
      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'list teams');
    }
  }

  /**
   * Alias for listAllTeams for better readability in tests
   */
  async listTeams(): Promise<AdminTeamsListResponse | ErrorResponse> {
    return this.listAllTeams();
  }

  /**
   * Delete a team (admin only)
   * @param teamId ID of the team to delete
   */
  async deleteTeam(teamId: string): Promise<ApiResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.delete(`/api/admin/teams/${teamId}`);
      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'delete team');
    }
  }

  /**
   * Get account balances
   */
  async getBalance(): Promise<BalancesResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get('/api/account/balances');
      return response.data as BalancesResponse;
    } catch (error) {
      return this.handleApiError(error, 'get balances');
    }
  }
  /**
   * Get portfolio value and information
   */
  async getPortfolio(): Promise<PortfolioResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get('/api/account/portfolio');
      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'get portfolio');
    }
  }

  /**
   * Get competition rules
   */
  async getCompetitionRules(): Promise<CompetitionRulesResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get('/api/competition/rules');
      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'get competition rules');
    }
  }

  /**
   * Get trade history
   */
  async getTradeHistory(): Promise<TradeHistoryResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get('/api/account/trades');
      return response.data as TradeHistoryResponse;
    } catch (error) {
      return this.handleApiError(error, 'get trade history');
    }
  }

  /**
   * Execute a trade
   */
  async executeTrade(params: TradeExecutionParams): Promise<TradeResponse | ErrorResponse> {
    console.log(`[ApiClient] executeTrade called with params: ${JSON.stringify(params, null, 2)}`);

    try {
      // Debug log
      console.log(`[ApiClient] About to execute trade with: ${JSON.stringify(params, null, 2)}`);

      // Make the API call with the exact parameters
      const response = await this.axiosInstance.post('/api/trade/execute', params);

      return response.data as TradeResponse;
    } catch (error) {
      return this.handleApiError(error, 'execute trade');
    }
  }

  /**
   * Get competition status
   */
  async getCompetitionStatus(): Promise<CompetitionStatusResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get('/api/competition/status');
      return response.data as CompetitionStatusResponse;
    } catch (error) {
      return this.handleApiError(error, 'get competition status');
    }
  }

  /**
   * Get competition leaderboard
   */
  async getLeaderboard(): Promise<LeaderboardResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get('/api/competition/leaderboard');
      return response.data as LeaderboardResponse;
    } catch (error) {
      return this.handleApiError(error, 'get leaderboard');
    }
  }

  /**
   * Get competition rules
   */
  async getRules(): Promise<CompetitionRulesResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get('/api/competition/rules');
      return response.data as CompetitionRulesResponse;
    } catch (error) {
      return this.handleApiError(error, 'get competition rules');
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
      return this.handleApiError(error, 'get price');
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
      return this.handleApiError(error, 'get token info');
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
      return this.handleApiError(error, 'get price history');
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
      return this.handleApiError(error, 'get quote');
    }
  }

  /**
   * End a competition (admin only)
   * @param competitionId ID of the competition to end
   */
  async endCompetition(competitionId: string): Promise<ApiResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post('/api/admin/competition/end', {
        competitionId,
      });
      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'end competition');
    }
  }

  /**
   * Deactivate a team (admin only)
   * @param teamId ID of the team to deactivate
   * @param reason Reason for deactivation
   */
  async deactivateTeam(teamId: string, reason: string): Promise<AdminTeamResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(`/api/admin/teams/${teamId}/deactivate`, {
        reason,
      });
      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'deactivate team');
    }
  }

  /**
   * Reactivate a team (admin only)
   * @param teamId ID of the team to reactivate
   */
  async reactivateTeam(teamId: string): Promise<AdminTeamResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(`/api/admin/teams/${teamId}/reactivate`);
      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'reactivate team');
    }
  }

  /**
   * Get basic system health status
   */
  async getHealthStatus(): Promise<HealthCheckResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get('/api/health');
      return response.data as HealthCheckResponse;
    } catch (error) {
      return this.handleApiError(error, 'get health status');
    }
  }

  /**
   * Get detailed system health status
   */
  async getDetailedHealthStatus(): Promise<DetailedHealthCheckResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get('/api/health/detailed');
      return response.data as DetailedHealthCheckResponse;
    } catch (error) {
      return this.handleApiError(error, 'get detailed health status');
    }
  }

  /**
   * Generic API request method for custom endpoints
   * @param method HTTP method (get, post, put, delete)
   * @param path API path
   * @param data Optional request data
   */
  async request<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
    data?: any,
  ): Promise<T | ErrorResponse> {
    try {
      let response;
      if (method === 'get') {
        response = await this.axiosInstance.get(path);
      } else if (method === 'post') {
        response = await this.axiosInstance.post(path, data);
      } else if (method === 'put') {
        response = await this.axiosInstance.put(path, data);
      } else if (method === 'delete') {
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
   * Get a team's API key (admin only)
   * @param teamId The ID of the team
   */
  async getTeamApiKey(teamId: string): Promise<TeamApiKeyResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(`/api/admin/teams/${teamId}/key`);
      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'get team API key');
    }
  }

  /**
   * Publicly register a new team (no authentication required)
   * @param name Team name
   * @param email Team email
   * @param contactPerson Contact person name
   * @param walletAddress Optional Ethereum wallet address (random valid address will be generated if not provided)
   * @param metadata Optional metadata for the team agent
   */
  async publicRegisterTeam(
    name: string,
    email: string,
    contactPerson: string,
    walletAddress?: string,
    metadata?: TeamMetadata,
  ): Promise<TeamRegistrationResponse | ErrorResponse> {
    try {
      // Generate a random Ethereum address if one isn't provided
      const address = walletAddress || this.generateRandomEthAddress();

      const response = await this.axiosInstance.post('/api/public/teams/register', {
        teamName: name,
        email,
        contactPerson,
        walletAddress: address,
        metadata,
      });

      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'publicly register team');
    }
  }
}
