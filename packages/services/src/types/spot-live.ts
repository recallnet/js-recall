import { SpecificChain } from "./index.js";

/**
 * Types and interfaces for spot live trading competitions
 * Mirrors perps.ts structure for consistency
 */

/**
 * On-chain trade detected from blockchain activity
 */
export interface OnChainTrade {
  txHash: string;
  blockNumber: number;
  timestamp: Date;
  chain: SpecificChain;
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  protocol: string;
  gasUsed: number;
  gasPrice: number;
  gasCostUsd?: number;
}

/**
 * Transfer (deposit/withdrawal) detected during competition
 * Used for self-funding violation detection
 */
export interface SpotTransfer {
  type: "deposit" | "withdraw" | "transfer";
  tokenAddress: string;
  amount: number;
  from: string;
  to: string;
  timestamp: Date;
  txHash: string;
  blockNumber: number;
  chain: SpecificChain;
}

/**
 * Protocol filter configuration for partnership competitions
 * Chain-specific - same protocol has different addresses per chain
 */
export interface ProtocolFilter {
  protocol: string;
  chain: SpecificChain;
  routerAddress: string;
  swapEventSignature: string;
  factoryAddress: string | null;
}

/**
 * Provider interface for spot live trading data sources
 * Mirrors IPerpsDataProvider structure
 *
 * Implementations:
 * - RpcSpotProvider: Direct RPC scanning via Alchemy
 * - EnvioSpotProvider: Pre-indexed data via Envio (future)
 */
export interface ISpotLiveDataProvider {
  /**
   * Get all trades for a wallet since a given time
   * @param walletAddress Wallet address to monitor
   * @param since Start time or block number for scanning
   * @param chains Array of chains to scan
   * @returns Array of detected on-chain trades
   */
  getTradesSince(
    walletAddress: string,
    since: Date | number,
    chains: SpecificChain[],
  ): Promise<OnChainTrade[]>;

  /**
   * Get transfer history for self-funding detection
   * Optional - not all providers may support this
   * @param walletAddress Wallet address to monitor
   * @param since Start time or block number for scanning
   * @param chains Array of chains to scan
   * @param toBlock Optional end block number for scanning (defaults to "latest")
   * @returns Array of deposits/withdrawals
   */
  getTransferHistory?(
    walletAddress: string,
    since: Date | number,
    chains: SpecificChain[],
    toBlock?: number,
  ): Promise<SpotTransfer[]>;

  /**
   * Get current token balances for a wallet on a chain
   * Used during initial sync to establish starting balances
   * @param walletAddress Wallet address to query
   * @param chain Chain to query
   * @returns Array of token balances with contract address and amount
   */
  getTokenBalances?(
    walletAddress: string,
    chain: SpecificChain,
  ): Promise<Array<{ contractAddress: string; balance: string }>>;

  /**
   * Get token decimals for proper balance parsing
   * @param tokenAddress Token contract address
   * @param chain Chain where token exists
   * @returns Number of decimals for the token
   */
  getTokenDecimals?(
    tokenAddress: string,
    chain: SpecificChain,
  ): Promise<number>;

  /**
   * Get current block number for a chain
   * Used for sync state tracking when no trades found
   * @param chain Specific chain
   * @returns Current block number
   */
  getCurrentBlock(chain: SpecificChain): Promise<number>;

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
 * Configuration for spot live data providers
 * Stored in trading_comps.spot_live_competition_config.data_source_config as JSONB
 *
 * For Alchemy: Only `type`, `provider`, and `chains` are required.
 * The API key is read from ALCHEMY_API_KEY env var, and URLs are constructed automatically.
 *
 * @example
 * // Minimal Alchemy config:
 * {
 *   type: "rpc_direct",
 *   provider: "alchemy",
 *   chains: ["base", "arbitrum"]
 * }
 */
export interface SpotLiveProviderConfig {
  /** Data source type */
  type: "rpc_direct" | "envio_indexing" | "hybrid";
  /** RPC provider name (required for rpc_direct) - API key read from environment */
  provider?: "alchemy" | "quicknode";
  /** Custom RPC URLs by chain (optional for Alchemy - auto-constructed; required for QuickNode and Infura) */
  rpcUrls?: Record<string, string>;
  /** GraphQL endpoint URL (for envio_indexing) */
  graphqlUrl?: string;
  /** Chains to monitor for trades */
  chains: string[];
}

/**
 * Result from processing a single agent's spot live data
 */
export interface AgentSpotSyncResult {
  agentId: string;
  tradesProcessed: number;
  balancesUpdated: number;
  violationsDetected?: number;
}

/**
 * Failed agent sync details for spot live processing
 */
export interface FailedSpotAgentSync {
  agentId: string;
  error: string;
}

/**
 * Batch sync result for spot live competition
 */
export interface BatchSpotSyncResult {
  successful: AgentSpotSyncResult[];
  failed: FailedSpotAgentSync[];
}

/**
 * Complete processing result for a spot live competition
 */
export interface SpotCompetitionProcessingResult {
  syncResult: BatchSpotSyncResult;
  monitoringResult?: {
    alertsCreated: number;
    agentsMonitored: number;
  };
}

/**
 * Rejected trade information (for logging/monitoring)
 */
export interface RejectedTrade {
  trade: OnChainTrade;
  reason: string;
}
