/**
 * API response types and base interfaces
 */
import type { AgentPublic, User } from "@recallnet/services/types";

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

// Competition type values
export const COMPETITION_TYPE = {
  TRADING: "trading",
  PERPETUAL_FUTURES: "perpetual_futures",
} as const;

// Competition type
export type CompetitionType =
  (typeof COMPETITION_TYPE)[keyof typeof COMPETITION_TYPE];

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

// Agent trophy structure (from ended competitions)
export interface AgentTrophy {
  competitionId: string;
  name: string;
  rank: number;
  imageUrl: string;
  createdAt: string;
}

// Extended Agent type for API responses with computed fields
export interface AgentResponse {
  // Base fields from database schema
  id: string;
  ownerId: string;
  name: string;
  handle: string;
  walletAddress?: string;
  email?: string;
  description?: string;
  imageUrl?: string;
  apiKey: string;
  metadata?: AgentMetadata;
  status: ActorStatus;
  deactivationReason?: string;
  deactivationDate?: string;
  createdAt: string;
  updatedAt: string;

  // Computed/derived fields for API responses
  isVerified: boolean;
  stats?: {
    completedCompetitions: number;
    totalTrades: number;
    totalPositions?: number; // For perps competitions
    bestPlacement?: {
      competitionId: string;
      rank: number;
      score: number;
      totalAgents: number;
    };
    bestPnl?: number;
    totalRoi?: number;
    ranks?: Array<{
      type: string;
      rank: number;
      score: number;
    }>;
  };
  skills?: string[];
  hasUnclaimedRewards?: boolean;
  trophies?: AgentTrophy[];
}

export interface PublicAgentResponse {
  success: true;
  agent: AgentResponse;
}

export interface AgentsGetResponse {
  success: true;
  agents: AgentResponse[];
  pagination: unknown;
}

// User registration response
export interface UserRegistrationResponse extends ApiResponse {
  success: true;
  user: User;
  agent?: AgentResponse;
}

// User profile response
export interface UserProfileResponse extends ApiResponse {
  user: User;
}

// Agent profile response
export interface AgentProfileResponse extends ApiResponse {
  agent: AgentResponse;
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
  agents: AgentResponse[];
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
  agent: AgentResponse & { apiKey: string }; // Include API key for admin responses
}

// Admin agents list response
export interface AdminAgentsListResponse extends ApiResponse {
  success: true;
  agents: AgentResponse[];
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
 * ARENA TYPES
 */

// Arena details
export interface Arena {
  id: string;
  name: string;
  createdBy: string;
  category: string;
  skill: string;
  venues: string[] | null;
  chains: string[] | null;
  kind: string;
  createdAt: string;
  updatedAt: string;
}

// Create arena response
export interface CreateArenaResponse extends ApiResponse {
  success: true;
  arena: Arena;
}

// Get arena response
export interface GetArenaResponse extends ApiResponse {
  success: true;
  arena: Arena;
}

// List arenas response
export interface ListArenasResponse extends ApiResponse {
  success: true;
  arenas: Arena[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Update arena response
export interface UpdateArenaResponse extends ApiResponse {
  success: true;
  arena: Arena;
}

// Delete arena response
export interface DeleteArenaResponse extends ApiResponse {
  success: true;
  message: string;
}

/**
 * PARTNER TYPES
 */

// Partner details
export interface Partner {
  id: string;
  name: string;
  url: string | null;
  logoUrl: string | null;
  details: string | null;
  createdAt: string;
  updatedAt: string;
}

// Create partner response
export interface CreatePartnerResponse extends ApiResponse {
  success: true;
  partner: Partner;
}

// Get partner response
export interface GetPartnerResponse extends ApiResponse {
  success: true;
  partner: Partner;
}

// List partners response
export interface ListPartnersResponse extends ApiResponse {
  success: true;
  partners: Partner[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Update partner response
export interface UpdatePartnerResponse extends ApiResponse {
  success: true;
  partner: Partner;
}

// Delete partner response
export interface DeletePartnerResponse extends ApiResponse {
  success: true;
  message: string;
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
  price: number;
  value: number;
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
  type?: CompetitionType; // Competition type (trading or perpetual_futures)
  crossChainTradingType: CrossChainTradingType;
  sandboxMode: boolean; // Controls automatic joining of newly registered agents
  createdAt: string;
  updatedAt: string;
  agentIds?: string[];
  stats?: {
    totalTrades?: number; // Optional - only for paper trading
    totalPositions?: number; // Optional - only for perps
    totalAgents: number;
    totalVolume?: number; // Optional - may not be present for all competition types
    uniqueTokens?: number; // Optional - only for paper trading
    averageEquity?: number; // Optional - only for perps
    competitionType?: string; // Type indicator for clients
  };
  boostStartDate: string | null;
  boostEndDate: string | null;
  // Join date constraint fields
  joinStartDate: string | null;
  joinEndDate: string | null;
  // Participant limit field
  maxParticipants: number | null;
  registeredParticipants: number;
  minimumStake?: string | null; // Minimum stake required to join competition (in atto units as string)
  evaluationMetric?:
    | "calmar_ratio"
    | "sortino_ratio"
    | "simple_return"
    | "max_drawdown"
    | "total_pnl"; // Primary evaluation metric for perps competitions
  tradingConstraints?: TradingConstraints;
  rewards?: {
    rank: number;
    reward: number;
    agentId?: string;
  }[];
}

// Leaderboard entry (per-competition leaderboard)
export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  agentName: string;
  portfolioValue: number;
  active: boolean;
  deactivationReason?: string;
  // Risk-adjusted metrics (primarily for perps competitions)
  calmarRatio?: number | null;
  sortinoRatio?: number | null;
  simpleReturn?: number | null;
  maxDrawdown?: number | null;
  downsideDeviation?: number | null;
  hasRiskMetrics?: boolean;
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

// Admin response for updating a competition
export interface UpdateCompetitionResponse extends ApiResponse {
  success: true;
  competition: Competition;
  rewards?: Array<{
    rank: number;
    reward: number;
  }>;
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
  agents: (AgentResponse & { rank: number })[];
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
    tradingConstraints?: {
      minimumPairAgeHours: number;
      minimum24hVolumeUsd: number;
      minimumLiquidityUsd: number;
      minimumFdvUsd: number;
      minTradesPerDay?: number;
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
  rank: number;
  portfolioValue: number;
  active: boolean;
  deactivationReason?: string | null;
  pnl: number; // Total profit/loss from competition start (USD)
  pnlPercent: number; // PnL as percentage of starting value
  change24h: number; // Portfolio value change in last 24 hours (USD)
  change24hPercent: number; // 24h change as percentage
  // Risk-adjusted metrics (primarily for perps competitions)
  calmarRatio?: number | null;
  sortinoRatio?: number | null;
  simpleReturn?: number | null;
  maxDrawdown?: number | null;
  downsideDeviation?: number | null;
  hasRiskMetrics?: boolean;
}

// Competition constraints
export interface TradingConstraints {
  minimumPairAgeHours?: number;
  minimum24hVolumeUsd?: number;
  minimumLiquidityUsd?: number;
  minimumFdvUsd?: number;
  minTradesPerDay?: number | null;
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
 * AUTHENTICATION TYPES
 */

/**
 * Response from the agent nonce endpoint
 */
export interface AgentNonceResponse {
  nonce: string;
}

/**
 * Response from the login endpoint
 */
export interface LoginResponse extends ApiResponse {
  success: true;
  userId: string;
  wallet: string;
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

export interface AdminSearchUsersAndAgentsResponse {
  success: boolean;
  join: boolean;
  results: {
    users: User[];
    agents: AgentPublic[];
  };
}

export interface AdminSearchResults {
  users: User[];
  agents: AgentPublic[];
}

export interface AdminSearchParams {
  user?: {
    email?: string;
    name?: string;
    walletAddress?: string;
    status?: ActorStatus;
  };
  agent?: {
    name?: string;
    ownerId?: string;
    walletAddress?: string;
    status?: ActorStatus;
  };
  join?: boolean;
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
  type: CompetitionType;
  numCompetitions: number;
}

// Global leaderboard response
export interface GlobalLeaderboardResponse extends ApiResponse {
  success: true;
  agents: LeaderboardAgent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Competition timeline response
export interface CompetitionTimelineResponse extends ApiResponse {
  competitionId: string;
  timeline: Array<{
    agentId: string;
    agentName: string;
    timeline: Array<{
      timestamp: string;
      totalValue: number;
      // Risk metrics (only for perps competitions)
      calmarRatio?: number | null;
      sortinoRatio?: number | null;
      maxDrawdown?: number | null;
      downsideDeviation?: number | null;
      simpleReturn?: number | null;
      annualizedReturn?: number | null;
    }>;
  }>;
}

/**
 * Enhanced competition with agent-specific metrics
 */
export interface EnhancedCompetition extends Competition {
  portfolioValue: number;
  pnl: number;
  pnlPercent: number;
  totalTrades?: number; // Optional - only for paper trading
  totalPositions?: number; // Optional - only for perps
  competitionType?: string; // Type indicator for clients
  bestPlacement?: {
    rank: number;
    totalAgents: number;
  };
  // Risk-adjusted metrics (primarily for perps competitions)
  calmarRatio?: number | null;
  sortinoRatio?: number | null;
  simpleReturn?: number | null;
  maxDrawdown?: number | null;
  downsideDeviation?: number | null;
  hasRiskMetrics?: boolean;
}

/**
 * Agent competitions response with enhanced metrics
 */
export interface AgentCompetitionsResponse extends ApiResponse {
  success: true;
  competitions: EnhancedCompetition[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Admin per-competition agent management response types
 */

// Remove agent from competition response
export interface AdminRemoveAgentFromCompetitionResponse extends ApiResponse {
  success: true;
  message: string;
  agent: {
    id: string;
    name: string;
  };
  competition: {
    id: string;
    name: string;
  };
  reason: string;
}

// Reactivate agent in competition response
export interface AdminReactivateAgentInCompetitionResponse extends ApiResponse {
  success: true;
  message: string;
  agent: {
    id: string;
    name: string;
  };
  competition: {
    id: string;
    name: string;
  };
}

// Admin add agent to competition response
export interface AdminAddAgentToCompetitionResponse extends ApiResponse {
  success: true;
  message: string;
  agent: {
    id: string;
    name: string;
    ownerId: string;
  };
  competition: {
    id: string;
    name: string;
    status: string;
  };
}

/**
 * Response type for linking a wallet to a user
 */
export interface LinkUserWalletResponse extends ApiResponse {
  success: true;
  user: User;
}

/**
 * Admin response for competition transfer violations
 */
export interface AdminCompetitionTransferViolationsResponse
  extends ApiResponse {
  success: true;
  violations: Array<{
    agentId: string;
    agentName: string;
    transferCount: number;
  }>;
}

/**
 * PERPETUAL FUTURES TYPES
 */

// Perps position
export interface PerpsPosition {
  id: string;
  agentId: string;
  competitionId: string;
  positionId: string | null;
  marketId: string | null;
  marketSymbol: string | null;
  asset: string;
  isLong: boolean;
  leverage: number;
  size: number;
  collateral: number;
  averagePrice: number;
  markPrice: number;
  liquidationPrice: number | null;
  unrealizedPnl: number;
  pnlPercentage: number;
  realizedPnl: number;
  status: string;
  openedAt: string;
  closedAt: string | null;
  timestamp: string;
}

// Perps account summary
export interface PerpsAccountSummary {
  id: string;
  agentId: string;
  competitionId: string;
  accountId: string;
  totalEquity: string;
  availableBalance: string;
  marginUsed: string;
  totalPnl: string;
  totalVolume: string;
  openPositions: number;
  timestamp: string;
}

// Perps positions response
export interface PerpsPositionsResponse extends ApiResponse {
  success: true;
  agentId: string;
  positions: PerpsPosition[];
}

// Perps account response
export interface PerpsAccountResponse extends ApiResponse {
  success: true;
  agentId: string;
  account: PerpsAccountSummary;
}

// Perps position with embedded agent info (for competition-wide endpoints)
export interface PerpsPositionWithAgent extends PerpsPosition {
  agent: {
    id: string;
    name: string;
    imageUrl: string | null;
    description: string | null;
  };
}

// Competition perps positions response (old endpoint - agent-specific)
export interface CompetitionPerpsPositionsResponse extends ApiResponse {
  success: true;
  competitionId: string;
  positions: PerpsPosition[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Competition all perps positions response (new endpoint - all agents)
export interface CompetitionAllPerpsPositionsResponse extends ApiResponse {
  success: true;
  positions: PerpsPositionWithAgent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface AgentPerpsPositionsResponse extends ApiResponse {
  success: true;
  competitionId: string;
  agentId: string;
  positions: PerpsPosition[];
}

/*
 * Response type for getting user subscription status
 */
export interface UserSubscriptionResponse extends ApiResponse {
  success: true;
  userId: string;
  isSubscribed: boolean;
}

// Rewards API response types
export interface RewardsTotalResponse {
  success: true;
  address: string;
  totalClaimableRewards: string;
}

export interface RewardProof {
  merkleRoot: string;
  amount: string;
  proof: string[];
}

export interface RewardsProofsResponse {
  success: true;
  address: string;
  rewards: RewardProof[];
}
