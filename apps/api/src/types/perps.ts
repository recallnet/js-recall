/**
 * Perps Provider Types
 * Generic types for perpetual futures data providers
 */

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
  entryPrice: number;
  currentPrice?: number;
  liquidationPrice?: number;

  // PnL
  pnlUsdValue?: number;
  pnlPercentage?: number;

  // Status
  status: "Open" | "Closed" | "Liquidated";

  // Timestamps
  openedAt: Date;
  lastUpdatedAt?: Date;
  closedAt?: Date;
}

/**
 * USDC transfer record for self-funding detection
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
 * Provider interface that all perps data sources must implement
 * This abstraction allows us to support different data sources:
 * - All-in-one providers (Symphony, Hyperliquid) that provide complete data
 * - Composable providers (Envio + PriceTracker) that combine multiple sources
 */
export interface IPerpsDataProvider {
  /**
   * Get account summary with total equity and metrics
   * @param walletAddress Wallet address to query
   * @returns Account summary with equity, PnL, and stats
   */
  getAccountSummary(walletAddress: string): Promise<PerpsAccountSummary>;

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
   * Get provider name for logging and debugging
   * @returns Provider name
   */
  getName(): string;

  /**
   * Check if provider is healthy and responsive
   * @returns True if provider is operational
   */
  isHealthy?(): Promise<boolean>;
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
 * Self-funding detection result
 */
export interface SelfFundingDetection {
  detected: boolean;
  method: "transfer_history" | "balance_reconciliation";
  unexplainedAmount?: number;
  violations?: Transfer[];
  expectedEquity?: number;
  actualEquity?: number;
}
