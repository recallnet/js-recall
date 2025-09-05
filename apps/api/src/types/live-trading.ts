/**
 * Types for live trading and on-chain data synchronization
 */

/**
 * Raw on-chain trade data from indexer
 */
export interface IndexedTrade {
  id: string;
  sender: string;
  recipient: string;
  chain: string;
  transactionHash: string;
  blockNumber: string;
  timestamp: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  gasUsed: string;
  gasPrice: string;
  protocol: string;
}

/**
 * Raw on-chain transfer data from indexer
 */
export interface IndexedTransfer {
  id: string;
  from: string;
  to: string;
  chain: string;
  transactionHash: string;
  blockNumber: string;
  timestamp: string;
  token: string;
  value: string;
}

/**
 * GraphQL response wrapper for indexed data
 */
export interface IndexerGraphQLResponse<T> {
  data?: {
    [key: string]: T[];
  };
  errors?: Array<{
    message: string;
    extensions?: Record<string, unknown>;
  }>;
}

/**
 * Self-funding alert data for creating alerts
 */
export interface SelfFundingAlertData {
  competitionId: string;
  agentId: string;
  transactionHash: string;
  blockNumber: bigint;
  chain: string;
  tokenAddress: string;
  amount: string;
  valueUsd: number;
  fromAddress: string;
  timestamp: Date;
}

/**
 * Sync result for tracking sync operations
 */
export interface SyncResult {
  success: boolean;
  tradeCount?: number;
  alertCount?: number;
  error?: unknown;
}

/**
 * Batch sync result for multiple competitions
 */
export interface BatchSyncResult {
  synced: number;
  errors: number;
}
