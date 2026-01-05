/**
 * Perps Provider Types
 * Generic types for perpetual futures data providers
 */
import type {
  InsertPerpetualPosition,
  InsertPerpsAccountSummary,
  SelectPerpetualPosition,
  SelectPerpsAccountSummary,
} from "@recallnet/db/schema/trading/types";

// =============================================================================
// PERPS SYNC & PROCESSING TYPES
// =============================================================================

/**
 * Data for reviewing a perps self-funding alert
 */
export interface PerpsSelfFundingAlertReview {
  reviewed: boolean;
  reviewedAt: Date;
  reviewedBy: string;
  actionTaken?: string;
  reviewNote?: string;
}

/**
 * Data for syncing a single agent's perps data
 */
export interface AgentPerpsSyncData {
  agentId: string;
  competitionId: string;
  positions: InsertPerpetualPosition[];
  accountSummary: InsertPerpsAccountSummary;
}

/**
 * Result of syncing agent perps data
 */
export interface AgentPerpsSyncResult {
  positions: SelectPerpetualPosition[];
  summary: SelectPerpsAccountSummary;
}

/**
 * Successfully synced agent data
 */
export interface SuccessfulAgentSync {
  agentId: string;
  positions: SelectPerpetualPosition[];
  summary: SelectPerpsAccountSummary;
}

/**
 * Failed agent sync
 */
export interface FailedAgentSync {
  agentId: string;
  error: Error;
}

/**
 * Result of batch syncing multiple agents
 */
export interface BatchPerpsSyncResult {
  successful: SuccessfulAgentSync[];
  failed: FailedAgentSync[];
}

/**
 * Statistics for a perps competition
 */
export interface PerpsCompetitionStats {
  totalAgents: number;
  totalPositions: number;
  totalVolume: number;
  averageEquity: number;
}

// =============================================================================
// PERPS PROVIDER TYPES
// =============================================================================

/**
 * Generic perps account summary
 * Provider-agnostic format for account data
 */
export interface PerpsAccountSummary {
  // Core equity metrics
  totalEquity: number;
  initialCapital?: number;
  availableBalance?: number;
  marginUsed?: number;

  // PnL metrics
  totalPnl?: number;
  totalRealizedPnl?: number;
  totalUnrealizedPnl?: number;

  // Trading statistics
  totalVolume?: number;
  totalTrades?: number;
  totalFeesPaid?: number;

  // Position counts
  openPositionsCount?: number;
  closedPositionsCount?: number;
  liquidatedPositionsCount?: number;
  liquidationsCount?: number;

  // Performance metrics
  roi?: number;
  roiPercent?: number;
  averageTradeSize?: number;

  // Account status
  accountStatus: string;

  // Raw provider data for debugging
  rawData?: unknown;
}

/**
 * Generic perpetual position
 * Provider-agnostic format for position data
 */
export interface PerpsPosition {
  // Position identifiers
  providerPositionId?: string;
  providerTradeId?: string;

  // Position details
  symbol: string;
  side: "long" | "short";
  positionSizeUsd: number;
  leverage?: number;
  collateralAmount?: number;

  // Prices
  entryPrice?: number;
  currentPrice?: number;
  liquidationPrice?: number;

  // PnL
  pnlUsdValue?: number;
  pnlPercentage?: number;

  // Status
  status: "Open" | "Closed" | "Liquidated";

  // Timestamps
  openedAt?: Date; // Optional - some providers don't provide position open time
  lastUpdatedAt?: Date;
  closedAt?: Date;
}

/**
 * USDC transfer record for violation detection and audit
 */
export interface Transfer {
  type: "deposit" | "withdraw";
  amount: number;
  asset: string;
  from: string;
  to: string;
  timestamp: Date;
  txHash?: string;
  chainId?: number;
}

/**
 * Closed position fill recovered from provider's fill history
 * Contains data available from fills when a position closed between syncs
 */
export interface ClosedPositionFill {
  /** Unique fill identifier from provider (e.g., hash + tid for Hyperliquid) */
  providerFillId: string;
  /** Asset symbol (e.g., "BTC", "ETH") */
  symbol: string;
  /** Position direction */
  side: "long" | "short";
  /** Position size in USD (native size * close price) */
  positionSizeUsd: number;
  /** Close price (NOT entry price - fills only provide close price) */
  closePrice: number;
  /** Realized PnL in USD from the fill */
  closedPnl: number;
  /** Timestamp when the position was closed */
  closedAt: Date;
  /** Fee paid for this fill */
  fee?: number;
}

/**
 * Provider interface that all perps data sources must implement
 * This abstraction allows us to support different data sources:
 * - All-in-one providers (Symphony, Hyperliquid) that provide complete data
 * - Composable providers (Envio + PriceTracker) that combine multiple sources
 */
export interface IPerpsDataProvider {
  /**
   * Get account summary with total equity and metrics
   * @param walletAddress Wallet address to query
   * @param initialCapital Optional initial capital for providers that don't track it (e.g., Hyperliquid)
   * @returns Account summary with equity, PnL, and stats
   */
  getAccountSummary(
    walletAddress: string,
    initialCapital?: number,
  ): Promise<PerpsAccountSummary>;

  /**
   * Get all positions (open, closed, liquidated) for a wallet
   * @param walletAddress Wallet address to query
   * @returns Array of positions with current prices and PnL
   */
  getPositions(walletAddress: string): Promise<PerpsPosition[]>;

  /**
   * Get USDC transfer history for self-funding detection
   * Optional - not all providers support this
   * @param walletAddress Wallet address to query
   * @param since Start date for transfer history
   * @returns Array of USDC transfers
   */
  getTransferHistory?(walletAddress: string, since: Date): Promise<Transfer[]>;

  /**
   * Get closed position fills within a time range
   * Used to recover positions that opened and closed between sync cycles
   * @param walletAddress Wallet address to query
   * @param since Start of time range (inclusive)
   * @param until End of time range (inclusive)
   * @returns Array of closed position fills (empty if provider doesn't support this)
   */
  getClosedPositionFills?(
    walletAddress: string,
    since: Date,
    until: Date,
  ): Promise<ClosedPositionFill[]>;

  /**
   * Get provider name for logging and debugging
   * @returns Provider name
   */
  getName(): string;

  /**
   * Check if provider is healthy and responsive
   * @returns True if provider is operational
   */
  isHealthy?(): Promise<boolean>;

  /**
   * Batch fetch account summary and positions with a single API call (when supported)
   * @param walletAddress Wallet address to query
   * @param initialCapital Optional initial capital for providers that don't track it
   * @returns Both account summary and positions
   */
  getAccountDataBatch?(
    walletAddress: string,
    initialCapital?: number,
  ): Promise<{
    accountSummary: PerpsAccountSummary;
    positions: PerpsPosition[];
  }>;
}

/**
 * Configuration for different provider types
 */
export interface PerpsProviderConfig {
  // Common fields
  type: "external_api" | "onchain_indexing" | "hybrid";

  // For external APIs
  provider?: string;
  apiUrl?: string;
  apiKey?: string;

  // For on-chain indexing
  protocol?: string;
  chains?: string[];
  indexerUrl?: string;
  contracts?: string[];

  // For hybrid approaches
  primary?: PerpsProviderConfig;
  fallback?: PerpsProviderConfig;
  priceSource?: string;

  // Rate limiting
  maxRequestsPerSecond?: number;
  requestTimeout?: number;
}

/**
 * Result of processing agent perps data
 */
export interface PerpsProcessingResult {
  agentId: string;
  competitionId: string;
  totalEquity: number;
  positionsProcessed: number;
  summaryCreated: boolean;
  error?: string;
}

/**
 * Result of Calmar Ratio calculations
 */
export interface CalmarRatioCalculationResult {
  successful: number;
  failed: number;
  errors?: string[];
}

/**
 * Result of monitoring self-funding violations
 */
export interface PerpsMonitoringResult {
  successful: number;
  failed: number;
  alertsCreated: number;
}

/**
 * Combined result of processing a perps competition
 */
export interface PerpsCompetitionProcessingResult {
  syncResult: BatchPerpsSyncResult;
  monitoringResult?: PerpsMonitoringResult;
  calmarRatioResult?: CalmarRatioCalculationResult;
  error?: string;
}

/**
 * Extended batch sync result with account summaries
 */
export interface BatchPerpsSyncWithSummaries extends BatchPerpsSyncResult {
  accountSummaries: Map<string, PerpsAccountSummary>;
  agents: Array<{ agentId: string; walletAddress: string }>;
}
