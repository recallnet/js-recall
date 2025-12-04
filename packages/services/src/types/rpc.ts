import { AssetTransfersWithMetadataResponse, Log } from "alchemy-sdk";

import { SpecificChain } from "./index.js";

/**
 * Transaction receipt from blockchain
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
 * Transaction data for router checks
 */
export interface TransactionData {
  to: string | null;
  from: string;
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
 * RPC provider interface for blockchain interactions
 * Implementations: AlchemyRpcProvider, QuickNodeRpcProvider (future)
 *
 * This interface abstracts low-level blockchain RPC operations
 * enabling different RPC providers (Alchemy, QuickNode, Infura) to be swapped
 * without changing higher-level spot trading logic
 */
export interface IRpcProvider {
  /**
   * Get all asset transfers (ETH and token transfers) for a wallet
   * Automatically handles pagination internally to return complete results
   * @param walletAddress Wallet address to monitor
   * @param chain Chain to query
   * @param fromBlock Starting block number or tag
   * @param toBlock Ending block number or tag
   * @returns All asset transfers with metadata (pageKey always undefined - all pages fetched)
   */
  getAssetTransfers(
    walletAddress: string,
    chain: SpecificChain,
    fromBlock: number | string,
    toBlock: number | string,
  ): Promise<AssetTransfersWithMetadataResponse>;

  /**
   * Get transaction data for router address checks
   * @param txHash Transaction hash
   * @param chain Chain where transaction occurred
   * @returns Transaction data with to/from addresses or null if not found
   */
  getTransaction(
    txHash: string,
    chain: SpecificChain,
  ): Promise<TransactionData | null>;

  /**
   * Get transaction receipt for gas cost calculation and event parsing
   * @param txHash Transaction hash
   * @param chain Chain where transaction occurred
   * @returns Transaction receipt or null if not found
   */
  getTransactionReceipt(
    txHash: string,
    chain: SpecificChain,
  ): Promise<TransactionReceipt | null>;

  /**
   * Get current block number for a chain
   * @param chain Chain to query
   * @returns Current block number
   */
  getBlockNumber(chain: SpecificChain): Promise<number>;

  /**
   * Get all token balances for a wallet
   * @param walletAddress Wallet address to query
   * @param chain Chain to query
   * @returns Array of token balances
   */
  getTokenBalances(
    walletAddress: string,
    chain: SpecificChain,
  ): Promise<TokenBalance[]>;

  /**
   * Get ETH balance for a wallet
   * @param walletAddress Wallet address to query
   * @param chain Chain to query
   * @returns Balance in wei as string
   */
  getBalance(walletAddress: string, chain: SpecificChain): Promise<string>;

  /**
   * Get token decimals for an ERC20 token
   * @param tokenAddress Token contract address
   * @param chain Chain where token is deployed
   * @returns Number of decimals
   */
  getTokenDecimals(tokenAddress: string, chain: SpecificChain): Promise<number>;

  /**
   * Get provider name for logging and debugging
   * @returns Provider name
   */
  getName(): string;

  /**
   * Check if provider is healthy and responsive
   * @returns True if provider is operational
   */
  isHealthy(): Promise<boolean>;
}
