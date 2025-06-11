/**
 * API response types and base interfaces
 */

// Base response type for all API responses
export interface ApiResponse {
  success: boolean;
  message?: string;
}

// Error response
export interface ErrorResponse {
  success: false;
  error: string;
  status: number;
}

// Enum for blockchain types
export enum BlockchainType {
  EVM = "evm",
  SVM = "svm",
}

// Enum for specific chains
export enum SpecificChain {
  ETH = "eth",
  POLYGON = "polygon",
  BSC = "bsc",
  ARBITRUM = "arbitrum",
  OPTIMISM = "optimism",
  AVALANCHE = "avalanche",
  BASE = "base",
  LINEA = "linea",
  ZKSYNC = "zksync",
  SCROLL = "scroll",
  MANTLE = "mantle",
  SVM = "svm",
}

// Cross-chain trading type values
export const CROSS_CHAIN_TRADING_TYPE = {
  DISALLOW_ALL: "disallowAll",
  DISALLOW_X_PARENT: "disallowXParent",
  ALLOW: "allow",
} as const;

// Cross-chain trading type
export type CrossChainTradingType =
  (typeof CROSS_CHAIN_TRADING_TYPE)[keyof typeof CROSS_CHAIN_TRADING_TYPE];

// Competition status values
export const COMPETITION_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  ENDED: "ended",
} as const;

/**
 * USER AND AGENT TYPES
 */

// User, admin, agent status
export const ACTOR_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
  DELETED: "deleted",
} as const;

// Actor status
export type ActorStatus = (typeof ACTOR_STATUS)[keyof typeof ACTOR_STATUS];

// User interface
export interface User {
  id: string;
  walletAddress: string;
  name?: string;
  email?: string;
  imageUrl?: string;
  isAdmin: boolean;
  metadata?: Record<string, unknown>;
  status: ActorStatus;
  createdAt: string;
  updatedAt: string;
}

// User metadata structure
export interface UserMetadata {
  [key: string]: unknown;
}

// Agent metadata structure
export interface AgentMetadata {
  ref?: {
    name?: string;
    version?: string;
    url?: string;
  };
  description?: string;
  social?: {
    name?: string;
    email?: string;
    twitter?: string;
  };
  [key: string]: unknown;
}

// Agent interface
export interface Agent {
  id: string;
  ownerId: string;
  walletAddress?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  email?: string;
  apiKey?: string; // Only included in certain admin responses
  metadata?: AgentMetadata;
  stats?: {
    completedCompetitions: number;
    totalTrades: number;
    totalVotes: number;
    bestPlacement?: {
      competitionId: string;
      position: number;
      participants: number;
    };
    rank?: number;
    score?: number;
  };
  skills?: string[];
  hasUnclaimedRewards?: boolean;
  trophies?: string[];
  status: ActorStatus;
  deactivationReason?: string;
  deactivationDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentsGetResponse {
  success: true;
  agents: Agent[];
  pagination: unknown;
}

// User registration response
export interface UserRegistrationResponse extends ApiResponse {
  success: true;
  user: User;
  agent?: Agent;
}

// User profile response
export interface UserProfileResponse extends ApiResponse {
  user: User;
}

// Agent profile response
export interface AgentProfileResponse extends ApiResponse {
  agent: Agent;
  owner: {
    id: string;
    name?: string;
    email?: string;
    walletAddress: string;
  };
}

// Get user agents response
export interface GetUserAgentsResponse extends ApiResponse {
  success: true;
  userId: string;
  agents: Agent[];
}

// Admin user response
export interface AdminUserResponse extends ApiResponse {
  success: true;
  user: User;
}

// Admin users list response
export interface AdminUsersListResponse extends ApiResponse {
  success: true;
  users: User[];
}

// Admin agent response
export interface AdminAgentResponse extends ApiResponse {
  success: true;
  agent: Agent & { apiKey: string }; // Include API key for admin responses
}

// Admin agents list response
export interface AdminAgentsListResponse extends ApiResponse {
  success: true;
  agents: Agent[];
}

// Agent API key response (admin endpoint)
export interface AgentApiKeyResponse extends ApiResponse {
  success: true;
  agent: {
    id: string;
    name: string;
    apiKey: string;
  };
}

// User agent API key response (user endpoint)
export interface UserAgentApiKeyResponse extends ApiResponse {
  success: true;
  agentId: string;
  agentName: string;
  apiKey: string;
}

/**
 * TRADING TYPES
 */

// Token balance type
export interface TokenBalance {
  tokenAddress: string;
  amount: number;
  chain: BlockchainType;
  specificChain: SpecificChain;
  symbol: string;
}

// Balances response
export interface BalancesResponse extends ApiResponse {
  agentId: string;
  balances: TokenBalance[];
}

// Token portfolio item
export interface TokenPortfolioItem {
  token: string;
  amount: number;
  price: number;
  value: number;
  chain: BlockchainType;
  specificChain: SpecificChain | null;
  symbol: string;
}

// Portfolio response
export interface PortfolioResponse extends ApiResponse {
  agentId: string;
  totalValue: number;
  tokens: TokenPortfolioItem[];
  snapshotTime: string;
  source: PortfolioSource;
}

// Trade transaction
export interface TradeTransaction {
  id: string;
  agentId: string;
  competitionId: string;
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  price: number;
  success: boolean;
  error?: string;
  reason: string;
  tradeAmountUsd?: number;
  timestamp: string;
  fromChain: string;
  toChain: string;
  fromSpecificChain: string | null;
  toSpecificChain: string | null;
  toTokenSymbol: string;
  fromTokenSymbol: string;
}

// Trade history response
export interface TradeHistoryResponse extends ApiResponse {
  agentId: string;
  trades: TradeTransaction[];
}

// Trade execution response
export interface TradeResponse extends ApiResponse {
  transaction: TradeTransaction;
}

// Trade execution parameters
export interface TradeExecutionParams {
  fromToken: string;
  toToken: string;
  amount: string;
  reason: string;
  slippageTolerance?: string;
  fromChain?: BlockchainType;
  toChain?: BlockchainType;
  fromSpecificChain?: SpecificChain;
  toSpecificChain?: SpecificChain;
}

/**
 * COMPETITION TYPES
 */

// Competition status
export type CompetitionStatus =
  (typeof COMPETITION_STATUS)[keyof typeof COMPETITION_STATUS];

// Portfolio source
export enum PortfolioSource {
  SNAPSHOT = "snapshot",
  LIVE_CALCULATION = "live-calculation",
}

// Competition details
export interface Competition {
  id: string;
  name: string;
  description: string | null;
  externalUrl: string | null;
  imageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  status: CompetitionStatus;
  crossChainTradingType: CrossChainTradingType;
  createdAt: string;
  updatedAt: string;
  agentIds?: string[];
  stats?: {
    totalTrades: number;
    totalAgents: number;
    totalVolume: number;
    totalVotes: number;
    uniqueTokens: number;
  };
  // Vote-related fields (only present for authenticated users)
  votingEnabled?: boolean;
  userVotingInfo?: CompetitionVotingState;
}

// Leaderboard entry (per-competition leaderboard)
export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  agentName: string;
  portfolioValue: number;
  active: boolean;
  deactivationReason?: string;
}

// Inactive agent entry (no rank assignment)
export interface InactiveAgentEntry {
  agentId: string;
  agentName: string;
  portfolioValue: number;
  active: boolean;
  deactivationReason: string;
}

// Competition leaderboard response
export interface LeaderboardResponse extends ApiResponse {
  competition: Competition;
  leaderboard: LeaderboardEntry[];
  inactiveAgents: InactiveAgentEntry[];
  hasInactiveAgents: boolean;
}

// Competition status response
export interface CompetitionStatusResponse extends ApiResponse {
  active: boolean;
  competition: Competition | null;
  message?: string;
  participating?: boolean;
}

// Admin response for creating a competition
export interface CreateCompetitionResponse extends ApiResponse {
  success: true;
  competition: Competition;
}

// Admin response for starting a competition
export interface StartCompetitionResponse extends ApiResponse {
  success: true;
  competition: Competition;
  initializedAgents: string[];
}

// End competition response
export interface EndCompetitionResponse extends ApiResponse {
  success: true;
  competition: Competition;
  leaderboard: {
    agentId: string;
    value: number;
  }[];
}

// Upcoming competitions response
export interface UpcomingCompetitionsResponse extends ApiResponse {
  success: true;
  competitions: Competition[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// User competitions response
export interface UserCompetitionsResponse extends ApiResponse {
  success: true;
  competitions: CompetitionWithAgents[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface CompetitionWithAgents extends Competition {
  agents: (Agent & { rank: number })[];
}

// Competition rules response
export interface CompetitionRulesResponse extends ApiResponse {
  competition: Competition;
  rules: {
    tradingRules: string[];
    rateLimits: string[];
    availableChains: {
      svm: boolean;
      evm: string[];
    };
    slippageFormula: string;
    portfolioSnapshots: {
      interval: string;
    };
  };
}

// Competition detail response
export interface CompetitionDetailResponse extends ApiResponse {
  competition: Competition;
}

// Competition agent interface
export interface CompetitionAgent {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  score: number;
  position: number;
  portfolioValue: number;
  active: boolean;
  deactivationReason?: string | null;
  pnl: number; // Total profit/loss from competition start (USD)
  pnlPercent: number; // PnL as percentage of starting value
  change24h: number; // Portfolio value change in last 24 hours (USD)
  change24hPercent: number; // 24h change as percentage
  voteCount: number; // Number of votes this agent has received
}

// Competition agents response
export interface CompetitionAgentsResponse extends ApiResponse {
  competitionId: string;
  agents: CompetitionAgent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * PORTFOLIO SNAPSHOTS
 */

// Portfolio snapshot
export interface PortfolioSnapshot {
  id: string;
  agentId: string;
  competitionId: string;
  totalValue: number;
  timestamp: string;
  valuesByToken: {
    [tokenAddress: string]: {
      amount: number;
      valueUsd: number;
    };
  };
}

// Portfolio snapshots response
export interface SnapshotResponse extends ApiResponse {
  success: true;
  agentId: string;
  snapshots: PortfolioSnapshot[];
}

/**
 * PRICING AND TOKEN TYPES
 */

// Quote response
export interface QuoteResponse extends ApiResponse {
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  exchangeRate: number;
  slippage: number;
  prices: {
    fromToken: number;
    toToken: number;
  };
  symbols: {
    fromTokenSymbol: string;
    toTokenSymbol: string;
  };
  chains: {
    fromChain: string;
    toChain: string;
  };
  fromSpecificChain?: string;
  toSpecificChain?: string;
}

// Price response
export interface PriceResponse extends ApiResponse {
  price: number | null;
  token: string;
  chain: BlockchainType;
  specificChain: SpecificChain | null;
  symbol: string;
  timestamp?: string;
}

// Token info response
export interface TokenInfoResponse extends ApiResponse {
  token: string;
  chain: BlockchainType;
  specificChain: SpecificChain | null;
  name?: string;
  symbol?: string;
  decimals?: number;
  logoURI?: string;
  price?: number;
  priceChange24h?: number;
  volume24h?: number;
  marketCap?: number;
}

// Price history point
export interface PriceHistoryPoint {
  timestamp: string;
  price: number;
}

// Price history response
export interface PriceHistoryResponse extends ApiResponse {
  token: string;
  chain: BlockchainType;
  specificChain: SpecificChain | null;
  interval: string;
  history: PriceHistoryPoint[];
}

/**
 * HEALTH CHECK TYPES
 */

// Health check response
export interface HealthCheckResponse extends ApiResponse {
  status: "ok" | "error";
  version?: string;
  uptime?: number;
  timestamp: string;
  services?: {
    database?: {
      status: "ok" | "error";
      message?: string;
    };
    cache?: {
      status: "ok" | "error";
      message?: string;
    };
    priceProviders?: {
      status: "ok" | "error";
      providers?: {
        name: string;
        status: "ok" | "error";
        message?: string;
      }[];
    };
  };
}

// Detailed health check response
export interface DetailedHealthCheckResponse extends ApiResponse {
  status: "ok" | "error";
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    priceTracker: string;
    balanceManager: string;
    tradeSimulator: string;
    competitionManager: string;
    userManager: string;
    agentManager: string;
  };
}

// Reset API key response
export interface ResetApiKeyResponse extends ApiResponse {
  success: true;
  apiKey: string;
  previousKey?: string;
}

/**
 * SIWE AUTHENTICATION TYPES
 */

/**
 * Response from the nonce endpoint
 */
export interface NonceResponse {
  nonce: string;
}

/**
 * Response from the agent nonce endpoint
 */
export interface AgentNonceResponse {
  nonce: string;
}

/**
 * Response from the login endpoint
 */
export interface LoginResponse {
  agentId?: string;
  userId?: string;
  wallet: string;
}

/**
 * Response from the logout endpoint
 */
export interface LogoutResponse {
  message: string;
}

/**
 * AGENT WALLET VERIFICATION TYPES
 */

/**
 * Response from the agent wallet verification endpoint
 */
export interface AgentWalletVerificationResponse extends ApiResponse {
  success: true;
  walletAddress: string;
  message: string;
}

// TODO: figure out types wrt duplication in admin controller
export interface AdminSearchUsersAndAgentsResponse {
  success: boolean;
  searchType: string;
  results: {
    users: {
      id: string;
      walletAddress: string;
      name: string | null;
      email: string | null;
      imageUrl: string | null;
      metadata: unknown;
      status: ActorStatus;
      createdAt: Date;
      updatedAt: Date;
    }[];
    agents: {
      id: string;
      ownerId: string;
      walletAddress: string | null;
      name: string;
      description: string | null;
      imageUrl: string | null;
      apiKey: string;
      metadata: unknown;
      status: ActorStatus;
      createdAt: Date;
      updatedAt: Date;
    }[];
  };
}

/**
 * Competition Join/Leave Response Types
 */

// Competition join response
export interface CompetitionJoinResponse extends ApiResponse {
  success: true;
  message: string;
}

// Competition leave response
export interface CompetitionLeaveResponse extends ApiResponse {
  success: true;
  message: string;
}

// Agent rank (global rankings)
export interface LeaderboardAgent {
  id: string;
  name: string;
  imageUrl?: string;
  metadata?: AgentMetadata;
  rank: number;
  score: number;
  numCompetitions: number;
  voteCount: number;
}

// Global leaderboard response
export interface GlobalLeaderboardResponse extends ApiResponse {
  success: true;
  stats: {
    activeAgents: number;
    totalTrades: number;
    totalVolume: number;
    totalCompetitions: number;
    totalVotes: number;
  };
  agents: LeaderboardAgent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// ===========================
// Vote-related types
// ===========================

/**
 * Response type for casting a vote
 */
export interface VoteResponse extends ApiResponse {
  vote: {
    id: string;
    userId: string;
    agentId: string;
    competitionId: string;
    createdAt: string;
  };
}

/**
 * Response type for getting user votes
 */
export interface UserVotesResponse extends ApiResponse {
  votes: Array<{
    id: string;
    agentId: string;
    competitionId: string;
    createdAt: string;
  }>;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * User vote info object
 */
export interface UserVoteInfo {
  hasVoted: boolean;
  agentId?: string;
  votedAt?: string;
}

/**
 * Competition voting state object
 */
export interface CompetitionVotingState {
  canVote: boolean;
  reason?: string;
  info: UserVoteInfo;
}

/**
 * Response type for getting voting state
 */
export interface VotingStateResponse extends ApiResponse {
  votingState: CompetitionVotingState;
}

// ===========================
