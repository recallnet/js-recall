/**
 * Blockchain-related type definitions for live trading
 */
import { Log } from "alchemy-sdk";

import { liveTradingChains } from "@/database/schema/trading/defs.js";

/**
 * Type for supported live trading chains
 * Extracted from the Drizzle enum
 */
export type LiveTradingChain = (typeof liveTradingChains.enumValues)[number];

/**
 * Transaction receipt from blockchain
 * Contains gas cost information critical for reconciliation
 */
export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  effectiveGasPrice: string;
  status: boolean;
  from: string;
  to?: string;
  logs: Log[];
}

/**
 * Raw blockchain transaction
 */
export interface BlockchainTransaction {
  hash: string;
  blockNumber: number;
  timestamp: number;
  from: string;
  to: string | null;
  value: string; // In wei for ETH transfers
  gasPrice: string;
  gasUsed: string;
  chain: LiveTradingChain;
}

/**
 * Token balance information
 */
export interface TokenBalance {
  contractAddress: string;
  balance: string; // Hex string
  decimals?: number;
  symbol?: string;
  name?: string;
}

/**
 * Asset transfer from Alchemy
 * Represents a token or ETH transfer
 */
export interface AssetTransfer {
  blockNum: string;
  hash: string;
  from: string;
  to: string;
  value: number | null;
  asset: string | null;
  category: "external" | "erc20";
  rawContract: {
    address: string | null;
    decimal: string | null;
    value: string | null;
  };
}

/**
 * Balance change for chain exit detection
 */
export interface BalanceChange {
  tokenAddress: string;
  chain: LiveTradingChain;
  previousBalance: number;
  currentBalance: number;
  changeAmount: number;
  changeUsd: number;
  timestamp: Date;
}

/**
 * Chain exit alert
 */
export interface ChainExitAlert {
  agentId: string;
  timestamp: Date;
  unaccountedValueUsd: number;
  totalDecreaseUsd: number;
  totalIncreaseUsd: number;
  gasCostsUsd: number;
  chains: LiveTradingChain[];
}

/**
 * Self-funding detection result
 */
export interface SelfFundingDetection {
  tokenAddress: string;
  chain: LiveTradingChain;
  amountIncreased: number;
  valueUsd: number;
  txHash?: string;
}

/**
 * On-chain transaction info for processing
 */
export interface OnChainTransaction {
  hash: string;
  blockNumber: number;
  timestamp: number;
  from: string;
  to: string | null;
  value: string;
  tokenTransfers: {
    from: string;
    to: string;
    tokenAddress: string;
    amount: string;
    decimals: number;
  }[];
  gasUsed: string;
  gasPrice: string;
  chain: LiveTradingChain;
}

/**
 * Trade info extracted from transaction
 */
export interface TradeInfo {
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  dexProtocol?: string;
}
