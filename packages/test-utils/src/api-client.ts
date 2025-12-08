import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

import {
  AllocationUnit,
  DisplayState,
  EngineType,
  PagingParams,
} from "@recallnet/services/types";

import {
  PrivyAuthProvider,
  type TestPrivyUser,
  createMockPrivyToken,
  createTestPrivyUser,
} from "./privy.js";
import { getBaseUrl } from "./server.js";
import {
  AddBonusBoostsResponse,
  AddPartnerToCompetitionResponse,
  AdminAddAgentToCompetitionResponse,
  AdminAgentResponse,
  AdminAgentsListResponse,
  AdminCompetitionTransferViolationsResponse,
  AdminReactivateAgentInCompetitionResponse,
  AdminRemoveAgentFromCompetitionResponse,
  AdminSearchParams,
  AdminSearchUsersAndAgentsResponse,
  AdminUserResponse,
  AdminUsersListResponse,
  AgentApiKeyResponse,
  AgentCompetitionsResponse,
  AgentMetadata,
  AgentNonceResponse,
  AgentPerpsPositionsResponse,
  AgentProfileResponse,
  AgentWalletVerificationResponse,
  AgentsGetResponse,
  ApiResponse,
  BalancesResponse,
  BlockchainType,
  Competition,
  CompetitionAgentsResponse,
  CompetitionAllPerpsPositionsResponse,
  CompetitionBoostsResponse,
  CompetitionDetailResponse,
  CompetitionJoinResponse,
  CompetitionLeaveResponse,
  CompetitionPerpsPositionsResponse,
  CompetitionRulesResponse,
  CompetitionTimelineResponse,
  CompetitionType,
  CreateArenaResponse,
  CreateCompetitionResponse,
  CreatePartnerResponse,
  CrossChainTradingType,
  DeleteArenaResponse,
  DeletePartnerResponse,
  DetailedHealthCheckResponse,
  ErrorResponse,
  GetArenaResponse,
  GetCompetitionPartnersResponse,
  GetPartnerResponse,
  GetUserAgentsResponse,
  GlobalLeaderboardResponse,
  HealthCheckResponse,
  LinkUserWalletResponse,
  ListArenasResponse,
  ListPartnersResponse,
  LoginResponse,
  PerpsAccountResponse,
  PerpsPositionsResponse,
  PriceResponse,
  PublicAgentResponse,
  QuoteResponse,
  RemovePartnerFromCompetitionResponse,
  ReplaceCompetitionPartnersResponse,
  ResetApiKeyResponse,
  ReviewSpotLiveAlertResponse,
  RevokeBonusBoostsResponse,
  RewardsProofsResponse,
  RewardsTotalResponse,
  SpecificChain,
  SpotLiveAlertsResponse,
  SpotLiveConfig,
  StartCompetitionResponse,
  TradeExecutionParams,
  TradeHistoryResponse,
  TradeResponse,
  TradingConstraints,
  UpcomingCompetitionsResponse,
  UpdateArenaResponse,
  UpdateCompetitionResponse,
  UpdatePartnerPositionResponse,
  UpdatePartnerResponse,
  UserAgentApiKeyResponse,
  UserCompetitionsResponse,
  UserMetadata,
  UserProfileResponse,
  UserRegistrationResponse,
  UserSubscriptionResponse,
} from "./types.js";

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
  private jwtToken: string | undefined;

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

      // Set authentication header based on available credentials
      // Priority order: Admin API key > JWT token > Regular API key

      // For admin routes, use admin API key if available
      if (
        this.adminApiKey &&
        (config.url?.startsWith("/api/admin") ||
          config.url?.includes("admin") ||
          config.url?.includes("competition")) &&
        this.adminApiKey !== this.apiKey
      ) {
        config.headers["Authorization"] = `Bearer ${this.adminApiKey}`;
      }
      // For user routes that require JWT (Privy) authentication
      else if (this.jwtToken) {
        // Set the JWT token as a cookie header for Privy authentication
        const existingCookie =
          config.headers["Cookie"] || config.headers["cookie"] || "";
        const privyCookie = `privy-id-token=${this.jwtToken}`;
        config.headers["Cookie"] = existingCookie
          ? `${existingCookie}; ${privyCookie}`
          : privyCookie;
      }
      // Default to API key for agent authentication
      else if (this.apiKey) {
        config.headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

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
  ): Promise<AgentCompetitionsResponse | ErrorResponse> {
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
   * Set JWT token for Privy authentication
   * @param jwtToken The JWT token from Privy
   */
  setJwtToken(jwtToken: string): void {
    this.jwtToken = jwtToken;
  }

  /**
   * Clear JWT token
   */
  clearJwtToken(): void {
    this.jwtToken = undefined;
  }

  /**
   * Authenticate with Privy using a mock JWT token and sync profile
   * @param user Test user data for authentication
   * @returns Promise that resolves to the login response
   */
  async authenticateWithPrivy(user: {
    name?: string;
    email?: string;
    imageUrl?: string;
    provider?: PrivyAuthProvider;
    walletAddress?: string;
    walletChainType?: string;
    privyId?: string;
  }): Promise<LoginResponse | ErrorResponse> {
    try {
      // Create a mock JWT token
      const jwtToken = await createMockPrivyToken(user);
      this.setJwtToken(jwtToken);

      // Call the login endpoint to authenticate and create/update the user
      return await this.login();
    } catch (error) {
      return this.handleApiError(error, "authenticate with Privy");
    }
  }

  /**
   * Create a test user client authenticated with Privy
   * @param userData Optional user data overrides
   * @returns New ApiClient instance authenticated as the test user
   */
  async createPrivyUserClient(
    userData: Partial<TestPrivyUser> = {},
  ): Promise<ApiClient> {
    const testUser = createTestPrivyUser(userData);

    const client = new ApiClient(undefined, this.baseUrl);
    await client.authenticateWithPrivy(testUser);
    return client;
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
    embeddedWalletAddress,
    privyId,
    name,
    email,
    userImageUrl,
    userMetadata,
    agentName,
    agentHandle,
    agentDescription,
    agentImageUrl,
    agentMetadata,
    agentWalletAddress,
  }: {
    walletAddress?: string;
    embeddedWalletAddress?: string;
    privyId?: string;
    name?: string;
    email?: string;
    userImageUrl?: string;
    userMetadata?: UserMetadata;
    agentName?: string;
    agentHandle?: string;
    agentDescription?: string;
    agentImageUrl?: string;
    agentMetadata?: AgentMetadata;
    agentWalletAddress?: string;
  }): Promise<UserRegistrationResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post("/api/admin/users", {
        walletAddress,
        embeddedWalletAddress,
        privyId,
        name,
        email,
        userImageUrl,
        userMetadata,
        agentName,
        agentHandle,
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
      walletAddress?: string | null;
    };
    agent: {
      name: string;
      handle?: string;
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
          name?: string;
          competitionId?: string;
          description?: string;
          agentIds?: string[];
          type?: string;
          tradingType?: CrossChainTradingType;
          sandboxMode?: boolean;
          externalUrl?: string;
          imageUrl?: string;
          boostStartDate?: string;
          boostEndDate?: string;
          tradingConstraints?: TradingConstraints;
          rewards?: Record<number, number>;
          evaluationMetric?: "calmar_ratio" | "sortino_ratio" | "simple_return";
          perpsProvider?: {
            provider: string;
            initialCapital?: number;
            selfFundingThreshold?: number;
            minFundingThreshold?: number;
            apiUrl?: string;
          };
          spotLiveConfig?: SpotLiveConfig;
          prizePools?: {
            agent: number;
            users: number;
          };
          rewardsIneligible?: string[];
          arenaId?: string;
          paperTradingInitialBalances?: Array<{
            specificChain: string;
            tokenSymbol: string;
            amount: number;
          }>;
        }
      | string,
    description?: string,
    agentIds?: string[],
    tradingType?: CrossChainTradingType,
    sandboxMode?: boolean,
    externalUrl?: string,
    imageUrl?: string,
    boostStartDate?: string,
    boostEndDate?: string,
    tradingConstraints?: TradingConstraints,
  ): Promise<StartCompetitionResponse | ErrorResponse> {
    try {
      let requestData;

      // Ensure boosting is allowed by default for this competition, and the
      // caller can set specific dates if they desire.
      const now = new Date().toISOString();

      // Handle both object-based and individual parameter calls
      if (typeof params === "object") {
        requestData = { boostStartDate: now, ...params };
      } else {
        requestData = {
          name: params,
          description,
          agentIds: agentIds || [],
          tradingType,
          sandboxMode,
          externalUrl,
          imageUrl,
          boostStartDate: boostStartDate || now,
          boostEndDate,
          tradingConstraints,
        };
      }

      // Add default arenaId if not provided
      if (!requestData.arenaId) {
        if (requestData.type === "perpetual_futures") {
          requestData.arenaId = "default-perps-arena";
        } else if (requestData.type === "spot_live_trading") {
          requestData.arenaId = "default-spot-live-arena";
        } else {
          requestData.arenaId = "default-paper-arena";
        }
      }

      // Default paperTradingInitialBalances for paper trading competitions only
      // Only apply if creating a new competition (no competitionId) and it's a paper trading competition
      if (
        !requestData.competitionId &&
        requestData.type !== "perpetual_futures" &&
        !requestData.paperTradingInitialBalances
      ) {
        requestData.paperTradingInitialBalances = [
          // Solana (SVM) balances
          { specificChain: "svm", tokenSymbol: "sol", amount: 10 },
          { specificChain: "svm", tokenSymbol: "usdc", amount: 5000 },
          { specificChain: "svm", tokenSymbol: "usdt", amount: 1000 },
          // Ethereum balances
          { specificChain: "eth", tokenSymbol: "eth", amount: 1 },
          { specificChain: "eth", tokenSymbol: "usdc", amount: 5000 },
          // Optimism balances
          { specificChain: "optimism", tokenSymbol: "usdc", amount: 200 },
          // Polygon balances
          { specificChain: "polygon", tokenSymbol: "usdc", amount: 200 },
          // Arbitrum balances
          { specificChain: "arbitrum", tokenSymbol: "usdc", amount: 200 },
        ];
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
  async createCompetition({
    name,
    description,
    tradingType,
    sandboxMode,
    externalUrl,
    imageUrl,
    type,
    startDate,
    endDate,
    boostStartDate,
    boostEndDate,
    joinStartDate,
    joinEndDate,
    maxParticipants,
    minimumStake,
    tradingConstraints,
    rewards,
    evaluationMetric,
    perpsProvider,
    spotLiveConfig,
    prizePools,
    rewardsIneligible,
    arenaId,
    engineId,
    engineVersion,
    vips,
    allowlist,
    blocklist,
    minRecallRank,
    allowlistOnly,
    agentAllocation,
    agentAllocationUnit,
    boosterAllocation,
    boosterAllocationUnit,
    rewardRules,
    rewardDetails,
    displayState,
    gameIds,
    paperTradingInitialBalances,
    boostTimeDecayRate,
    paperTradingConfig,
  }: {
    name?: string;
    description?: string;
    tradingType?: CrossChainTradingType;
    sandboxMode?: boolean;
    externalUrl?: string;
    imageUrl?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    boostStartDate?: string;
    boostEndDate?: string;
    joinStartDate?: string;
    joinEndDate?: string;
    maxParticipants?: number;
    minimumStake?: number;
    tradingConstraints?: TradingConstraints;
    rewards?: Record<number, number>;
    evaluationMetric?: "calmar_ratio" | "sortino_ratio" | "simple_return";
    perpsProvider?: {
      provider: "symphony" | "hyperliquid";
      initialCapital: number;
      selfFundingThreshold: number;
      minFundingThreshold?: number;
      apiUrl?: string;
    };
    spotLiveConfig?: SpotLiveConfig;
    prizePools?: {
      agent: number;
      users: number;
    };
    rewardsIneligible?: string[];
    arenaId?: string;
    engineId?: EngineType;
    engineVersion?: string;
    vips?: string[];
    allowlist?: string[];
    blocklist?: string[];
    minRecallRank?: number;
    allowlistOnly?: boolean;
    agentAllocation?: number;
    agentAllocationUnit?: AllocationUnit;
    boosterAllocation?: number;
    boosterAllocationUnit?: AllocationUnit;
    rewardRules?: string;
    rewardDetails?: string;
    displayState?: DisplayState;
    gameIds?: string[];
    paperTradingInitialBalances?: Array<{
      specificChain: string;
      tokenSymbol: string;
      amount: number;
    }>;
    boostTimeDecayRate?: number;
    paperTradingConfig?: {
      maxTradePercentage?: number;
    };
  }): Promise<CreateCompetitionResponse | ErrorResponse> {
    const competitionName = name || `Test competition ${Date.now()}`;
    // Default arenaId based on competition type
    let defaultArenaId = "default-paper-arena";
    if (type === "perpetual_futures") {
      defaultArenaId = "default-perps-arena";
    } else if (type === "spot_live_trading") {
      defaultArenaId = "default-spot-live-arena";
    }

    // Default paperTradingInitialBalances for paper trading competitions only
    const competitionType = type ?? "trading";
    const isPaperTrading = competitionType === "trading";

    // Default balances - only include for paper trading competitions
    const defaultPaperTradingInitialBalances = isPaperTrading
      ? [
          // Solana (SVM) balances
          { specificChain: "svm", tokenSymbol: "sol", amount: 10 },
          { specificChain: "svm", tokenSymbol: "usdc", amount: 5000 },
          { specificChain: "svm", tokenSymbol: "usdt", amount: 1000 },
          // Ethereum balances
          { specificChain: "eth", tokenSymbol: "eth", amount: 1 },
          { specificChain: "eth", tokenSymbol: "usdc", amount: 5000 },
          // Note: INITIAL_ETH_USDT_BALANCE=0, so we skip it
          // Optimism balances
          { specificChain: "optimism", tokenSymbol: "usdc", amount: 200 },
          // Polygon balances
          { specificChain: "polygon", tokenSymbol: "usdc", amount: 200 },
          // Arbitrum balances
          { specificChain: "arbitrum", tokenSymbol: "usdc", amount: 200 },
        ]
      : undefined;

    // Determine final paperTradingInitialBalances to send
    const finalPaperTradingInitialBalances =
      paperTradingInitialBalances ||
      (isPaperTrading ? defaultPaperTradingInitialBalances : undefined);

    try {
      const response = await this.axiosInstance.post(
        "/api/admin/competition/create",
        {
          name: competitionName,
          description,
          tradingType,
          sandboxMode,
          externalUrl,
          imageUrl,
          type: competitionType,
          startDate,
          endDate,
          boostStartDate,
          boostEndDate,
          joinStartDate,
          joinEndDate,
          maxParticipants,
          minimumStake,
          tradingConstraints,
          rewards,
          evaluationMetric,
          perpsProvider,
          spotLiveConfig,
          prizePools,
          rewardsIneligible,
          arenaId: arenaId || defaultArenaId,
          engineId,
          engineVersion,
          vips,
          allowlist,
          blocklist,
          minRecallRank,
          allowlistOnly,
          agentAllocation,
          agentAllocationUnit,
          boosterAllocation,
          boosterAllocationUnit,
          rewardRules,
          rewardDetails,
          displayState,
          gameIds,
          boostTimeDecayRate,
          paperTradingConfig,
          ...(finalPaperTradingInitialBalances
            ? { paperTradingInitialBalances: finalPaperTradingInitialBalances }
            : {}),
        },
      );

      return response.data;
    } catch (error) {
      return this.handleApiError(error, "create competition");
    }
  }

  /**
   * Update a competition (admin only)
   */
  async updateCompetition(
    competitionId: string,
    {
      name,
      description,
      type,
      externalUrl,
      imageUrl,
      boostStartDate,
      boostEndDate,
      minimumStake,
      tradingConstraints,
      rewards,
      evaluationMetric,
      perpsProvider,
      prizePools,
      rewardsIneligible,
      arenaId,
      engineId,
      engineVersion,
      vips,
      allowlist,
      blocklist,
      minRecallRank,
      allowlistOnly,
      agentAllocation,
      agentAllocationUnit,
      boosterAllocation,
      boosterAllocationUnit,
      rewardRules,
      rewardDetails,
      displayState,
      spotLiveConfig,
      gameIds,
      boostTimeDecayRate,
      paperTradingConfig,
      paperTradingInitialBalances,
    }: {
      name?: string;
      description?: string;
      type?: string;
      externalUrl?: string;
      imageUrl?: string;
      boostStartDate?: string;
      boostEndDate?: string;
      minimumStake?: number;
      tradingConstraints?: TradingConstraints;
      rewards?: Record<number, number>;
      evaluationMetric?: "calmar_ratio" | "sortino_ratio" | "simple_return";
      perpsProvider?: {
        provider: "symphony" | "hyperliquid";
        initialCapital?: number;
        selfFundingThreshold?: number;
        minFundingThreshold?: number;
        apiUrl?: string;
      };
      prizePools?: {
        agent: number;
        users: number;
      };
      rewardsIneligible?: string[];
      arenaId?: string;
      engineId?: EngineType;
      engineVersion?: string;
      vips?: string[];
      allowlist?: string[];
      blocklist?: string[];
      minRecallRank?: number;
      allowlistOnly?: boolean;
      agentAllocation?: number;
      agentAllocationUnit?: AllocationUnit;
      boosterAllocation?: number;
      boosterAllocationUnit?: AllocationUnit;
      rewardRules?: string;
      rewardDetails?: string;
      displayState?: DisplayState;
      spotLiveConfig?: {
        dataSource?: "rpc_direct" | "envio_indexing" | "hybrid";
        dataSourceConfig?: Record<string, unknown>;
        selfFundingThresholdUsd?: number;
        minFundingThreshold?: number | null;
        syncIntervalMinutes?: number;
        chains?: string[];
        allowedProtocols?: Array<{ protocol: string; chain: string }>;
        allowedTokens?: Array<{ address: string; specificChain: string }>;
      };
      gameIds?: string[];
      boostTimeDecayRate?: number;
      paperTradingConfig?: {
        maxTradePercentage?: number;
      };
      paperTradingInitialBalances?: Array<{
        specificChain: string;
        tokenSymbol: string;
        amount: number;
      }>;
    },
  ): Promise<UpdateCompetitionResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.put(
        `/api/admin/competition/${competitionId}`,
        {
          name,
          description,
          type,
          externalUrl,
          imageUrl,
          boostStartDate,
          boostEndDate,
          minimumStake,
          tradingConstraints,
          rewards,
          evaluationMetric,
          perpsProvider,
          prizePools,
          rewardsIneligible,
          arenaId,
          engineId,
          engineVersion,
          vips,
          allowlist,
          blocklist,
          minRecallRank,
          allowlistOnly,
          agentAllocation,
          agentAllocationUnit,
          boosterAllocation,
          boosterAllocationUnit,
          rewardRules,
          rewardDetails,
          displayState,
          spotLiveConfig,
          gameIds,
          boostTimeDecayRate,
          paperTradingConfig,
          paperTradingInitialBalances,
        },
      );

      return response.data;
    } catch (error) {
      return this.handleApiError(error, "update competition");
    }
  }

  /**
   * Start an existing competition with agents
   */
  async startExistingCompetition({
    competitionId,
    agentIds,
    crossChainTradingType,
    sandboxMode,
    externalUrl,
    imageUrl,
  }: {
    competitionId: string;
    agentIds?: string[];
    crossChainTradingType?: CrossChainTradingType;
    sandboxMode?: boolean;
    externalUrl?: string;
    imageUrl?: string;
  }): Promise<StartCompetitionResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        "/api/admin/competition/start",
        {
          competitionId,
          agentIds,
          tradingType: crossChainTradingType,
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
    email?: string;
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
   * @param profileData Profile data to update including description and imageUrl only (agents have limited self-service editing)
   */
  async updateAgentProfile(profileData: {
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
      handle?: string;
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
   * Update an agent (admin only)
   * @param agentId ID of the agent to update
   * @param body Body of the update request
   */
  async updateAgentAsAdmin(
    agentId: string,
    body: {
      name?: string;
      description?: string;
      imageUrl?: string;
      email?: string;
      metadata?: Record<string, unknown>;
      isRewardsIneligible?: boolean;
      rewardsIneligibilityReason?: string;
    },
  ): Promise<ApiResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.put(
        `/api/admin/agents/${agentId}`,
        body,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "update agent");
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
   * Add an agent to a specific competition (admin only)
   * @param competitionId ID of the competition
   * @param agentId ID of the agent to add
   */
  async addAgentToCompetition(
    competitionId: string,
    agentId: string,
  ): Promise<AdminAddAgentToCompetitionResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        `/api/admin/competitions/${competitionId}/agents/${agentId}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "add agent to competition");
    }
  }

  /**
   * Get competition transfer violations (admin only)
   * @param competitionId ID of the competition
   * @returns Transfer violations for agents in the competition
   */
  async getCompetitionTransferViolations(
    competitionId: string,
  ): Promise<AdminCompetitionTransferViolationsResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/admin/competition/${competitionId}/transfer-violations`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get competition transfer violations");
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
   * Get account balances for a specific competition
   */
  async getBalance(
    competitionId: string,
  ): Promise<BalancesResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/agent/balances?competitionId=${encodeURIComponent(competitionId)}`,
      );
      return response.data as BalancesResponse;
    } catch (error) {
      return this.handleApiError(error, "get balances");
    }
  }

  /**
   * Get trade history
   */
  async getTradeHistory(
    competitionId: string,
  ): Promise<TradeHistoryResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/agent/trades?competitionId=${competitionId}`,
      );
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
   * Create an arena (admin only)
   * @param arenaData Arena data to create
   */
  async createArena(arenaData: {
    id: string;
    name: string;
    createdBy: string;
    category: string;
    skill: string;
    venues?: string[];
    chains?: string[];
  }): Promise<CreateArenaResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        "/api/admin/arenas",
        arenaData,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "create arena");
    }
  }

  /**
   * Get an arena by ID (admin only)
   * @param id Arena ID
   */
  async getArena(id: string): Promise<GetArenaResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(`/api/admin/arenas/${id}`);
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get arena");
    }
  }

  /**
   * List all arenas (admin only)
   * @param params Pagination and filter parameters
   */
  async listArenas(params?: {
    limit?: number;
    offset?: number;
    sort?: string;
    nameFilter?: string;
  }): Promise<ListArenasResponse | ErrorResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.limit !== undefined)
        queryParams.append("limit", params.limit.toString());
      if (params?.offset !== undefined)
        queryParams.append("offset", params.offset.toString());
      if (params?.sort) queryParams.append("sort", params.sort);
      if (params?.nameFilter)
        queryParams.append("nameFilter", params.nameFilter);

      const response = await this.axiosInstance.get(
        `/api/admin/arenas?${queryParams.toString()}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "list arenas");
    }
  }

  /**
   * Update an arena (admin only)
   * @param id Arena ID
   * @param updateData Fields to update
   */
  async updateArena(
    id: string,
    updateData: {
      name?: string;
      category?: string;
      skill?: string;
      venues?: string[];
      chains?: string[];
    },
  ): Promise<UpdateArenaResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.put(
        `/api/admin/arenas/${id}`,
        updateData,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "update arena");
    }
  }

  /**
   * Delete an arena (admin only)
   * @param id Arena ID
   */
  async deleteArena(id: string): Promise<DeleteArenaResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.delete(
        `/api/admin/arenas/${id}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "delete arena");
    }
  }

  /**
   * Create a partner (admin only)
   * @param partnerData Partner data to create
   */
  async createPartner(partnerData: {
    name: string;
    url?: string;
    logoUrl?: string;
    details?: string;
  }): Promise<CreatePartnerResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        "/api/admin/partners",
        partnerData,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "create partner");
    }
  }

  /**
   * Get a partner by ID (admin only)
   * @param id Partner ID
   */
  async getPartner(id: string): Promise<GetPartnerResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/admin/partners/${id}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get partner");
    }
  }

  /**
   * List all partners (admin only)
   * @param params Pagination and filter parameters
   */
  async listPartners(params?: {
    limit?: number;
    offset?: number;
    sort?: string;
    nameFilter?: string;
  }): Promise<ListPartnersResponse | ErrorResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.limit !== undefined)
        queryParams.append("limit", params.limit.toString());
      if (params?.offset !== undefined)
        queryParams.append("offset", params.offset.toString());
      if (params?.sort) queryParams.append("sort", params.sort);
      if (params?.nameFilter)
        queryParams.append("nameFilter", params.nameFilter);

      const response = await this.axiosInstance.get(
        `/api/admin/partners?${queryParams.toString()}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "list partners");
    }
  }

  /**
   * Update a partner (admin only)
   * @param id Partner ID
   * @param updateData Fields to update
   */
  async updatePartner(
    id: string,
    updateData: {
      name?: string;
      url?: string;
      logoUrl?: string;
      details?: string;
    },
  ): Promise<UpdatePartnerResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.put(
        `/api/admin/partners/${id}`,
        updateData,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "update partner");
    }
  }

  /**
   * Delete a partner (admin only)
   * @param id Partner ID
   */
  async deletePartner(
    id: string,
  ): Promise<DeletePartnerResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.delete(
        `/api/admin/partners/${id}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "delete partner");
    }
  }

  /**
   * Get partners for a competition (admin only)
   * @param competitionId Competition ID
   */
  async getCompetitionPartners(
    competitionId: string,
  ): Promise<GetCompetitionPartnersResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/admin/competitions/${competitionId}/partners`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get competition partners (admin)");
    }
  }

  /**
   * Add partner to competition (admin only)
   * @param competitionId Competition ID
   * @param partnerId Partner ID
   * @param position Display position
   */
  async addPartnerToCompetition(
    competitionId: string,
    partnerId: string,
    position: number,
  ): Promise<AddPartnerToCompetitionResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        `/api/admin/competitions/${competitionId}/partners`,
        { partnerId, position },
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "add partner to competition");
    }
  }

  /**
   * Update partner position in competition (admin only)
   * @param competitionId Competition ID
   * @param partnerId Partner ID
   * @param position Display position
   */
  async updatePartnerPosition(
    competitionId: string,
    partnerId: string,
    position: number,
  ): Promise<UpdatePartnerPositionResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.put(
        `/api/admin/competitions/${competitionId}/partners/${partnerId}`,
        { position },
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "update partner position");
    }
  }

  /**
   * Remove partner from competition (admin only)
   * @param competitionId Competition ID
   * @param partnerId Partner ID
   */
  async removePartnerFromCompetition(
    competitionId: string,
    partnerId: string,
  ): Promise<RemovePartnerFromCompetitionResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.delete(
        `/api/admin/competitions/${competitionId}/partners/${partnerId}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "remove partner from competition");
    }
  }

  /**
   * Replace all partners for a competition (admin only)
   * @param competitionId Competition ID
   * @param partners Array of partner IDs with positions
   */
  async replaceCompetitionPartners(
    competitionId: string,
    partners: Array<{ partnerId: string; position: number }>,
  ): Promise<ReplaceCompetitionPartnersResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.put(
        `/api/admin/competitions/${competitionId}/partners/replace`,
        { partners },
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "replace competition partners");
    }
  }

  /**
   * Get partners for a competition (public endpoint)
   * @param competitionId Competition ID
   */
  async getCompetitionPartnersPublic(
    competitionId: string,
  ): Promise<GetCompetitionPartnersResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/competitions/${competitionId}/partners`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get competition partners (public)");
    }
  }

  /**
   * List all arenas (public endpoint)
   * @param params Pagination parameters
   */
  async getArenas(params?: {
    limit?: number;
    offset?: number;
    sort?: string;
    name?: string;
  }): Promise<ListArenasResponse | ErrorResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.limit !== undefined)
        queryParams.append("limit", params.limit.toString());
      if (params?.offset !== undefined)
        queryParams.append("offset", params.offset.toString());
      if (params?.sort) queryParams.append("sort", params.sort);
      if (params?.name) queryParams.append("name", params.name);

      const response = await this.axiosInstance.get(
        `/api/arenas?${queryParams.toString()}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get arenas");
    }
  }

  /**
   * Get arena by ID (public endpoint)
   * @param id Arena ID
   */
  async getArenaById(id: string): Promise<GetArenaResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(`/api/arenas/${id}`);
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get arena by id");
    }
  }

  /**
   * Get the global leaderboard (global rankings)
   */
  async getGlobalLeaderboard(params?: {
    type?: CompetitionType;
    arenaId?: string;
    limit?: number;
    offset?: number;
  }): Promise<GlobalLeaderboardResponse | ErrorResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.limit !== undefined)
        queryParams.append("limit", params.limit.toString());
      if (params?.offset !== undefined)
        queryParams.append("offset", params.offset.toString());
      if (params?.type !== undefined) queryParams.append("type", params.type);
      if (params?.arenaId !== undefined)
        queryParams.append("arenaId", params.arenaId);
      const response = await this.axiosInstance.get(
        `/api/leaderboard?${queryParams.toString()}`,
      );
      return response.data as GlobalLeaderboardResponse;
    } catch (error) {
      return this.handleApiError(error, "get leaderboards");
    }
  }

  /**
   * Get competition rules for a specific competition
   * @param competitionId The competition ID to get rules for
   */
  async getRules(
    competitionId: string,
  ): Promise<CompetitionRulesResponse | ErrorResponse> {
    try {
      return this.getCompetitionRules(competitionId);
    } catch (error) {
      return this.handleApiError(error, "get competition rules");
    }
  }

  /**
   * Get competition rules by competition ID
   */
  async getCompetitionRules(
    competitionId: string,
  ): Promise<CompetitionRulesResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/competitions/${competitionId}/rules`,
      );
      return response.data as CompetitionRulesResponse;
    } catch (error) {
      return this.handleApiError(error, "get competition rules by ID");
    }
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
      includeInactive?: boolean;
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
    if (params?.includeInactive !== undefined) {
      queryParams.append("includeInactive", params.includeInactive.toString());
    }

    const queryString = queryParams.toString();
    const url = `/api/competitions/${competitionId}/agents${queryString ? `?${queryString}` : ""}`;

    return this.request<CompetitionAgentsResponse>("get", url);
  }

  /**
   * Get trades for a competition
   * @param competitionId Competition ID
   * @param limit Optional number of trades to return
   * @param offset Optional offset for pagination
   * @returns Array of Trade objects
   */
  async getCompetitionTrades(
    competitionId: string,
    limit?: number,
    offset?: number,
  ): Promise<TradeHistoryResponse | ErrorResponse> {
    try {
      const params = new URLSearchParams();
      if (limit !== undefined) params.append("limit", limit.toString());
      if (offset !== undefined) params.append("offset", offset.toString());

      const url = `/api/competitions/${competitionId}/trades?${params.toString()}`;
      const response = await this.axiosInstance.get(url);
      return response.data as TradeHistoryResponse;
    } catch (error) {
      return this.handleApiError(
        error,
        `get competition trades: competitionId=${competitionId}, limit=${limit}, offset=${offset}`,
      );
    }
  }

  /**
   * Get boost allocations for a competition
   * @param competitionId Competition ID
   * @param limit Optional number of boosts to return (default: 50, max: 100)
   * @param offset Optional offset for pagination (default: 0)
   * @returns Paginated boost allocations with agent information
   */
  async getCompetitionBoosts(
    competitionId: string,
    limit?: number,
    offset?: number,
  ): Promise<CompetitionBoostsResponse | ErrorResponse> {
    try {
      const params = new URLSearchParams();
      if (limit !== undefined) params.append("limit", limit.toString());
      if (offset !== undefined) params.append("offset", offset.toString());

      const url = `/api/competitions/${competitionId}/boosts/all${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await this.axiosInstance.get(url);
      return response.data as CompetitionBoostsResponse;
    } catch (error) {
      return this.handleApiError(
        error,
        `get competition boosts: competitionId=${competitionId}, limit=${limit}, offset=${offset}`,
      );
    }
  }

  /**
   * Get trades for an agent in a competition
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @param limit Optional number of trades to return
   * @param offset Optional offset for pagination
   * @returns Array of Trade objects
   */
  async getAgentTradesInCompetition(
    competitionId: string,
    agentId: string,
    limit?: number,
    offset?: number,
  ): Promise<TradeHistoryResponse | ErrorResponse> {
    try {
      const params = new URLSearchParams();
      if (limit !== undefined) params.append("limit", limit.toString());
      if (offset !== undefined) params.append("offset", offset.toString());

      const url = `/api/competitions/${competitionId}/agents/${agentId}/trades?${params.toString()}`;
      const response = await this.axiosInstance.get(url);
      return response.data as TradeHistoryResponse;
    } catch (error) {
      return this.handleApiError(
        error,
        `get agent trades in competition: competitionId=${competitionId}, agentId=${agentId}, limit=${limit}, offset=${offset}`,
      );
    }
  }

  /**
   * Get perps positions for an agent in a competition (public endpoint)
   * @param competitionId The competition ID
   * @param agentId The agent ID
   * @returns Perps positions response or error
   */
  async getAgentPerpsPositionsInCompetition(
    competitionId: string,
    agentId: string,
  ): Promise<AgentPerpsPositionsResponse | ErrorResponse> {
    try {
      const url = `/api/competitions/${competitionId}/agents/${agentId}/perps/positions`;
      const response = await this.axiosInstance.get(url);
      return response.data as AgentPerpsPositionsResponse;
    } catch (error) {
      return this.handleApiError(
        error,
        `get agent perps positions in competition: competitionId=${competitionId}, agentId=${agentId}`,
      );
    }
  }

  /**
   * Get all perps positions for a competition with pagination
   * @param competitionId Competition ID
   * @param limit Optional number of positions to return
   * @param offset Optional offset for pagination
   * @param status Optional status filter (Open, Closed, Liquidated, all)
   * @returns Array of perps positions with embedded agent info
   */
  async getCompetitionAllPerpsPositions(
    competitionId: string,
    limit?: number,
    offset?: number,
    status?: string,
  ): Promise<CompetitionAllPerpsPositionsResponse | ErrorResponse> {
    try {
      const params = new URLSearchParams();
      if (limit !== undefined) params.append("limit", limit.toString());
      if (offset !== undefined) params.append("offset", offset.toString());
      if (status !== undefined) params.append("status", status);

      const url = `/api/competitions/${competitionId}/perps/all-positions?${params.toString()}`;
      const response = await this.axiosInstance.get(url);
      return response.data as CompetitionAllPerpsPositionsResponse;
    } catch (error) {
      return this.handleApiError(
        error,
        `get competition all perps positions: competitionId=${competitionId}`,
      );
    }
  }

  /**
   * Get timeline for a competition
   * @param competitionId Competition ID
   * @param bucket Time bucket interval in minutes (default: 30)
   * @returns Competition timeline response
   */
  async getCompetitionTimeline(
    competitionId: string,
    bucket?: number,
  ): Promise<CompetitionTimelineResponse | ErrorResponse> {
    let path = `/api/competitions/${competitionId}/timeline`;
    const params = new URLSearchParams();

    if (bucket !== undefined) {
      params.append("bucket", bucket.toString());
    }

    if (params.toString()) {
      path += `?${params.toString()}`;
    }

    return this.request("get", path);
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
   * Get a quote for a trade
   */
  async getQuote(
    fromToken: string,
    toToken: string,
    amount: string,
    competitionId: string,
  ): Promise<QuoteResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/trade/quote?fromToken=${encodeURIComponent(fromToken)}&toToken=${encodeURIComponent(toToken)}&amount=${encodeURIComponent(amount)}&competitionId=${encodeURIComponent(competitionId)}`,
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
   * Get Prometheus metrics from the dedicated metrics server
   * @returns A promise that resolves to the metrics response (plain text)
   */
  async getMetrics(): Promise<string | ErrorResponse> {
    try {
      // Metrics are now served on a separate port (3003) without authentication
      // Extract the base URL and replace the port with the metrics port
      const url = new URL(this.baseUrl);
      const metricsPort = process.env.METRICS_PORT || "3003";
      url.port = metricsPort;
      url.pathname = "/metrics"; // Set the correct path

      const response = await axios.get(url.toString(), {
        headers: {
          "Content-Type": "application/json",
        },
        // No authentication required for metrics endpoint
      });
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
  async login(): Promise<LoginResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post("/api/auth/login");
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "login with Privy");
    }
  }

  /**
   * Create a new agent for the authenticated user
   * @param name Agent name (required, must be unique for this user)
   * @param handle Optional agent handle (auto-generated if not provided)
   * @param description Optional agent description
   * @param imageUrl Optional agent image URL
   * @param metadata Optional agent metadata
   */
  async createAgent(
    name: string,
    handle: string,
    description?: string,
    imageUrl?: string,
    metadata?: Record<string, unknown>,
  ): Promise<AgentProfileResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post("/api/user/agents", {
        name,
        handle,
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
   * Link a wallet to the authenticated user
   * @param walletAddress The wallet address to link
   * @returns A promise that resolves to the link wallet response
   */
  async linkUserWallet(
    walletAddress: string,
  ): Promise<LinkUserWalletResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post("/api/user/wallet/link", {
        walletAddress,
      });
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "link user wallet");
    }
  }

  /**
   * Get perps positions for the authenticated agent
   * @param competitionId The competition ID
   * @returns A promise that resolves to the perps positions response
   */
  async getPerpsPositions(
    competitionId: string,
  ): Promise<PerpsPositionsResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/agent/perps/positions?competitionId=${competitionId}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get perps positions");
    }
  }

  /**
   * Subscribe to the Loops mailing list
   * @returns A promise that resolves to the subscription response
   */
  async subscribeToMailingList(): Promise<
    UserSubscriptionResponse | ErrorResponse
  > {
    try {
      const response = await this.axiosInstance.post("/api/user/subscribe");
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "subscribe to mailing list");
    }
  }

  /**
   * Get perps account summary for the authenticated agent
   * @param competitionId The competition ID
   * @returns A promise that resolves to the perps account response
   */
  async getPerpsAccount(
    competitionId: string,
  ): Promise<PerpsAccountResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/agent/perps/account?competitionId=${competitionId}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get perps account");
    }
  }

  /**
   * Get agent perps positions
   * @param agentId The agent ID
   * @returns A promise that resolves to the perps positions response
   */
  async getAgentPerpsPositions(
    agentId: string,
  ): Promise<PerpsPositionsResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/agents/${agentId}/perps/positions`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get agent perps positions");
    }
  }

  /**
   * Get agent perps account summary
   * @param agentId The agent ID
   * @returns A promise that resolves to the perps account response
   */
  async getAgentPerpsAccount(
    agentId: string,
  ): Promise<PerpsAccountResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/agents/${agentId}/perps/account`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get agent perps account");
    }
  }

  /**
   * Get competition perps positions
   * @param competitionId The competition ID
   * @param params Pagination parameters
   * @returns A promise that resolves to the competition perps positions response
   */
  async getCompetitionPerpsPositions(
    competitionId: string,
    params?: PagingParams,
  ): Promise<CompetitionPerpsPositionsResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/competitions/${competitionId}/perps/positions`,
        { params },
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get competition perps positions");
    }
  }

  /**
   * Unsubscribe from the Loops mailing list
   * @returns A promise that resolves to the unsubscribe response
   */
  async unsubscribeFromMailingList(): Promise<
    UserSubscriptionResponse | ErrorResponse
  > {
    try {
      const response = await this.axiosInstance.post("/api/user/unsubscribe");
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "unsubscribe from mailing list");
    }
  }

  /**
   * Get total claimable rewards for the authenticated user
   * Requires SIWE session authentication
   */
  async getTotalClaimableRewards(): Promise<
    RewardsTotalResponse | ErrorResponse
  > {
    try {
      const response = await this.axiosInstance.get("/api/user/rewards/total");
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get total claimable rewards");
    }
  }

  /**
   * Get rewards with proofs for the authenticated user
   * Requires SIWE session authentication
   */
  async getRewardsWithProofs(): Promise<RewardsProofsResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.get("/api/user/rewards/proofs");
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get rewards with proofs");
    }
  }

  /**
   * Get spot live self-funding alerts for a competition (admin only)
   * @param competitionId Competition ID
   * @param params Optional filters for reviewed status and violation type
   * @returns Spot live alerts response
   */
  async getSpotLiveSelfFundingAlerts(
    competitionId: string,
    params?: {
      reviewed?: string;
      violationType?: string;
    },
  ): Promise<SpotLiveAlertsResponse | ErrorResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.reviewed) queryParams.append("reviewed", params.reviewed);
      if (params?.violationType)
        queryParams.append("violationType", params.violationType);

      const response = await this.axiosInstance.get(
        `/api/admin/competition/${competitionId}/spot-live/alerts?${queryParams.toString()}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get spot live self-funding alerts");
    }
  }

  /**
   * NFL API Methods
   */

  /**
   * Get open plays for an NFL competition
   */
  async getNflOpenPlays(
    competitionId: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    try {
      const response = await this.axiosInstance.get(
        `/api/nfl/competitions/${competitionId}/plays?state=open&limit=${limit}&offset=${offset}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get NFL open plays");
    }
  }

  /**
   * Review a spot live self-funding alert (admin only)
   * @param competitionId Competition ID
   * @param alertId Alert ID
   * @param reviewData Review note and action taken
   * @returns Updated alert
   */
  async reviewSpotLiveSelfFundingAlert(
    competitionId: string,
    alertId: string,
    reviewData: {
      reviewNote: string;
      actionTaken: string;
    },
  ): Promise<ReviewSpotLiveAlertResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.put(
        `/api/admin/competition/${competitionId}/spot-live/alerts/${alertId}/review`,
        reviewData,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "review spot live self-funding alert");
    }
  }

  /**
   * Submit a prediction for the next play in a game
   */
  async submitNflPrediction(
    competitionId: string,
    providerGameId: number,
    prediction: "run" | "pass",
    confidence: number,
  ) {
    try {
      const response = await this.axiosInstance.post(
        `/api/nfl/competitions/${competitionId}/games/${providerGameId}/predictions`,
        { prediction, confidence },
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "submit NFL prediction");
    }
  }

  /**
   * Get leaderboard for an NFL competition
   */
  async getNflLeaderboard(competitionId: string, gameId?: string) {
    try {
      const url = gameId
        ? `/api/nfl/competitions/${competitionId}/leaderboard?gameId=${gameId}`
        : `/api/nfl/competitions/${competitionId}/leaderboard`;
      const response = await this.axiosInstance.get(url);
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get NFL leaderboard");
    }
  }

  /**
   * Get all games for an NFL competition
   */
  async getNflGames(competitionId: string) {
    try {
      const response = await this.axiosInstance.get(
        `/api/nfl/competitions/${competitionId}/games`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get NFL games");
    }
  }

  /**
   * Get NFL competition rules
   */
  async getNflRules(competitionId: string) {
    try {
      const response = await this.axiosInstance.get(
        `/api/nfl/competitions/${competitionId}/rules`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get NFL rules");
    }
  }

  /**
   * Get specific game info
   */
  async getNflGameInfo(competitionId: string, gameId: string) {
    try {
      const response = await this.axiosInstance.get(
        `/api/nfl/competitions/${competitionId}/games/${gameId}`,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get NFL game info");
    }
  }

  /**
   * Get game plays
   */
  async getNflGamePlays(
    competitionId: string,
    gameId: string,
    limit: number = 50,
    offset: number = 0,
    latest: boolean = false,
  ) {
    try {
      const url = latest
        ? `/api/nfl/competitions/${competitionId}/games/${gameId}/plays?latest=true`
        : `/api/nfl/competitions/${competitionId}/games/${gameId}/plays?limit=${limit}&offset=${offset}`;
      const response = await this.axiosInstance.get(url);
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get NFL game plays");
    }
  }

  /**
   * Predict game winner
   */
  async predictGameWinner(
    competitionId: string,
    gameId: string,
    predictedWinner: string,
    confidence: number,
    reason: string,
  ) {
    try {
      const response = await this.axiosInstance.post(
        `/api/nfl/competitions/${competitionId}/games/${gameId}/predictions`,
        { predictedWinner, confidence, reason },
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "predict game winner");
    }
  }

  /**
   * Get game predictions
   */
  async getGamePredictions(
    competitionId: string,
    gameId: string,
    agentId?: string,
  ) {
    try {
      const url = agentId
        ? `/api/nfl/competitions/${competitionId}/games/${gameId}/predictions?agentId=${agentId}`
        : `/api/nfl/competitions/${competitionId}/games/${gameId}/predictions`;
      const response = await this.axiosInstance.get(url);
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "get game predictions");
    }
  }

  /**
   * Admin: Add bonus boosts to users
   * Requires admin authentication
   */
  async addBonusBoosts(data: {
    boosts: Array<{
      wallet: string;
      amount: string;
      expiresAt: string;
      meta?: Record<string, string | number | boolean>;
    }>;
  }): Promise<AddBonusBoostsResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        "/api/admin/boost-bonus",
        data,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "add bonus boosts");
    }
  }

  /**
   * Admin: Revoke bonus boosts
   * Requires admin authentication
   */
  async revokeBonusBoosts(data: {
    boostIds: string[];
  }): Promise<RevokeBonusBoostsResponse | ErrorResponse> {
    try {
      const response = await this.axiosInstance.post(
        "/api/admin/boost-bonus/revoke",
        data,
      );
      return response.data;
    } catch (error) {
      return this.handleApiError(error, "revoke bonus boosts");
    }
  }
}
