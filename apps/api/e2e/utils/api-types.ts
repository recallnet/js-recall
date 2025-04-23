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
  EVM = 'evm',
  SVM = 'svm',
}

// Enum for specific chains
export enum SpecificChain {
  ETH = 'eth',
  POLYGON = 'polygon',
  BSC = 'bsc',
  ARBITRUM = 'arbitrum',
  OPTIMISM = 'optimism',
  AVALANCHE = 'avalanche',
  BASE = 'base',
  LINEA = 'linea',
  ZKSYNC = 'zksync',
  SCROLL = 'scroll',
  MANTLE = 'mantle',
  SVM = 'svm',
}

// Competition status
export enum CompetitionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

// Portfolio source
export enum PortfolioSource {
  SNAPSHOT = 'snapshot',
  LIVE_CALCULATION = 'live-calculation',
}

// Team metadata structure
export interface TeamMetadata {
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
}

// Team profile response
export interface TeamProfileResponse extends ApiResponse {
  team: {
    id: string;
    name: string;
    email: string;
    contactPerson: string;
    metadata?: TeamMetadata;
    createdAt: string;
    updatedAt: string;
  };
}

// Token balance type
export interface TokenBalance {
  token: string;
  amount: number;
  chain: BlockchainType;
  specificChain: SpecificChain | null;
}

// Balances response
export interface BalancesResponse extends ApiResponse {
  teamId: string;
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
}

// Portfolio response
export interface PortfolioResponse extends ApiResponse {
  teamId: string;
  totalValue: number;
  tokens: TokenPortfolioItem[];
  snapshotTime: string;
  source: PortfolioSource;
}

// Trade transaction
export interface TradeTransaction {
  id: string;
  teamId: string;
  competitionId: string;
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  price: number;
  success: boolean;
  error?: string;
  reason: string;
  timestamp: string;
  fromChain: string;
  toChain: string;
  fromSpecificChain: string | null;
  toSpecificChain: string | null;
}

// Trade history response
export interface TradeHistoryResponse extends ApiResponse {
  teamId: string;
  trades: TradeTransaction[];
}

// Trade execution response
export interface TradeResponse extends ApiResponse {
  transaction: TradeTransaction;
}

// Competition details
export interface Competition {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  status: CompetitionStatus;
  createdAt: string;
  updatedAt: string;
  teamIds?: string[];
}

// Leaderboard entry
export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  portfolioValue: number;
  active: boolean;
  deactivationReason?: string;
}

// Competition leaderboard response
export interface LeaderboardResponse extends ApiResponse {
  competition: Competition;
  leaderboard: LeaderboardEntry[];
  hasInactiveTeams?: boolean;
}

// Competition status response
export interface CompetitionStatusResponse extends ApiResponse {
  active: boolean;
  competition: Competition | null;
  message?: string;
  participating?: boolean;
}

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

// Admin team response for team operations
export interface AdminTeamResponse extends ApiResponse {
  success: true;
  team: {
    id: string;
    name: string;
    email: string;
    contactPerson: string;
    apiKey?: string;
    walletAddress?: string;
    bucketAddress?: string[];
    isAdmin: boolean;
    active: boolean;
    deactivationReason?: string;
    deactivationDate?: string;
    createdAt: string;
    updatedAt: string;
  };
}

// Admin teams list response
export interface AdminTeamsListResponse extends ApiResponse {
  success: true;
  teams: {
    id: string;
    name: string;
    email: string;
    contactPerson: string;
    walletAddress?: string;
    isAdmin: boolean;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  }[];
}

// Admin team registration response
export interface TeamRegistrationResponse extends ApiResponse {
  success: true;
  team: {
    id: string;
    name: string;
    email: string;
    contactPerson: string;
    metadata?: TeamMetadata;
    apiKey: string;
    walletAddress: string;
    isAdmin: boolean;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  };
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
  initializedTeams: string[];
}

// Competition rules response
export interface CompetitionRulesResponse extends ApiResponse {
  success: true;
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

// Health check response
export interface HealthCheckResponse extends ApiResponse {
  status: 'ok' | 'error';
  version?: string;
  uptime?: number;
  timestamp: string;
  services?: {
    database?: {
      status: 'ok' | 'error';
      message?: string;
    };
    cache?: {
      status: 'ok' | 'error';
      message?: string;
    };
    priceProviders?: {
      status: 'ok' | 'error';
      providers?: {
        name: string;
        status: 'ok' | 'error';
        message?: string;
      }[];
    };
  };
}

// Detailed health check response
export interface DetailedHealthCheckResponse extends ApiResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    priceTracker: string;
    balanceManager: string;
    tradeSimulator: string;
    competitionManager: string;
    teamManager: string;
  };
}

// Portfolio snapshot
export interface PortfolioSnapshot {
  id: string;
  teamId: string;
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
  teamId: string;
  snapshots: PortfolioSnapshot[];
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

// End competition response
export interface EndCompetitionResponse extends ApiResponse {
  success: true;
  competition: Competition;
  leaderboard: {
    teamId: string;
    value: number;
  }[];
}

// Team API key response
export interface TeamApiKeyResponse extends ApiResponse {
  success: true;
  team: {
    id: string;
    name: string;
    apiKey: string;
  };
}
