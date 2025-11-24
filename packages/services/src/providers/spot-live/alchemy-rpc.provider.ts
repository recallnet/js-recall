import * as Sentry from "@sentry/node";
import {
  Alchemy,
  AssetTransfersCategory,
  AssetTransfersWithMetadataResponse,
  Log,
  Network,
} from "alchemy-sdk";
import { Logger } from "pino";

import {
  CircuitBreaker,
  CircuitOpenError,
  createCircuitBreaker,
} from "../../lib/circuit-breaker.js";
import { withRetry } from "../../lib/retry-helper.js";
import { SpecificChain } from "../../types/index.js";
import {
  IRpcProvider,
  TokenBalance,
  TransactionData,
  TransactionReceipt,
} from "../../types/rpc.js";

/**
 * Alchemy Provider
 * Handles all blockchain RPC interactions using Alchemy SDK
 * Provides methods for scanning transactions, getting balances, and more
 *
 * Implements IRpcProvider interface for compatibility with RpcSpotProvider
 */
export class AlchemyRpcProvider implements IRpcProvider {
  private alchemyInstances: Partial<Record<SpecificChain, Alchemy>> = {};
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private logger: Logger;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly SAMPLING_RATE = 0.01; // 1% of requests for raw data storage

  // Map our chain names to Alchemy Network enum
  private readonly chainToNetwork: Record<SpecificChain, Network> = {
    eth: Network.ETH_MAINNET,
    base: Network.BASE_MAINNET,
    arbitrum: Network.ARB_MAINNET,
    optimism: Network.OPT_MAINNET,
    polygon: Network.MATIC_MAINNET,
    bsc: Network.BNB_MAINNET,
    avalanche: Network.AVAX_MAINNET,
    linea: Network.LINEA_MAINNET,
    zksync: Network.ZKSYNC_MAINNET,
    scroll: Network.SCROLL_MAINNET,
    mantle: Network.MANTLE_MAINNET,
    svm: Network.SOLANA_MAINNET,
  };

  constructor(
    apiKey: string,
    maxRetries: number = 3,
    retryDelayMs: number = 1000,
    logger: Logger,
  ) {
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
    this.logger = logger;

    // Initialize circuit breaker with rolling window for better resilience
    this.circuitBreaker = createCircuitBreaker("alchemy-rpc", {
      rollingWindowDuration: 30000, // 30 second window
      errorThresholdPercentage: 50, // Open if >50% requests fail in window
      failureThreshold: 5, // Also open after 5 consecutive failures
      resetTimeout: 15000, // Try again after 15 seconds
      successThreshold: 3, // Need 3 successful calls to close
      logger: this.logger,
      onStateChange: (from, to) => {
        this.logger.warn(
          { from, to },
          `[AlchemyRpcProvider] Circuit breaker state changed`,
        );

        // Track in Sentry when circuit opens
        if (to === "open") {
          Sentry.captureMessage(
            `Alchemy RPC circuit breaker opened`,
            "warning",
          );
        }
      },
    });

    // Initialize Alchemy instances for configured chains
    this.initializeProviders(apiKey);
  }

  /**
   * Initialize Alchemy instances for each supported chain
   */
  private initializeProviders(apiKey: string): void {
    if (!apiKey) {
      this.logger.warn("[AlchemyRpcProvider] No Alchemy API key provided");
      return;
    }

    // Initialize providers for supported chains
    const supportedChains: SpecificChain[] = [
      "eth",
      "base",
      "arbitrum",
      "optimism",
      "polygon",
      "bsc",
      "avalanche",
      "linea",
      "zksync",
      "scroll",
      "mantle",
      "svm",
    ];

    for (const chain of supportedChains) {
      try {
        const network = this.chainToNetwork[chain];
        if (network) {
          this.alchemyInstances[chain] = new Alchemy({
            apiKey,
            network,
            maxRetries: this.maxRetries,
          });
          this.logger.debug(
            `[AlchemyRpcProvider] Initialized provider for ${chain}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `[AlchemyRpcProvider] Failed to initialize ${chain} provider`,
        );
        if (error instanceof Error) {
          this.logger.debug(
            `[AlchemyRpcProvider] Initialization error for ${chain}: ${error.message}`,
          );
        }
      }
    }

    this.logger.info(
      `[AlchemyRpcProvider] Initialized ${Object.keys(this.alchemyInstances).length} chain providers`,
    );
  }

  /**
   * Get the Alchemy instance for a specific chain
   */
  private getProvider(chain: SpecificChain): Alchemy {
    const provider = this.alchemyInstances[chain];
    if (!provider) {
      throw new Error(`No Alchemy provider configured for chain: ${chain}`);
    }
    return provider;
  }

  /**
   * Get provider name for logging
   */
  getName(): string {
    return "Alchemy";
  }

  /**
   * Mask wallet address for privacy in logs
   */
  private maskWalletAddress(address: string): string {
    if (!address || address.length < 10) {
      return address;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Get the current block number for a chain
   */
  async getBlockNumber(chain: SpecificChain): Promise<number> {
    try {
      const result = await this.circuitBreaker.execute(async () => {
        return await withRetry(
          async () => {
            const provider = this.getProvider(chain);
            return await provider.core.getBlockNumber();
          },
          {
            maxRetries: this.maxRetries,
            initialDelay: this.retryDelayMs,
          },
        );
      });

      this.logger.debug(
        `[AlchemyRpcProvider] Got block number for ${chain}: ${result}`,
      );
      return result;
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        throw new Error(
          `Alchemy RPC temporarily unavailable due to multiple failures. ${error.message}`,
        );
      }

      this.logger.error(
        { error, chain },
        "[AlchemyRpcProvider] Error getting block number",
      );
      throw error;
    }
  }

  /**
   * Get all asset transfers (ETH and token transfers) for a wallet
   * This is the primary method for scanning wallet activity
   */
  async getAssetTransfers(
    walletAddress: string,
    chain: SpecificChain,
    fromBlock: number | string,
    toBlock: number | string = "latest",
    pageKey?: string,
  ): Promise<AssetTransfersWithMetadataResponse> {
    const startTime = Date.now();
    const maskedAddress = this.maskWalletAddress(walletAddress);

    // Add Sentry breadcrumb for debugging
    Sentry.addBreadcrumb({
      category: "alchemy.rpc",
      message: `Asset transfers request`,
      level: "info",
      data: {
        walletAddress: maskedAddress,
        chain,
        fromBlock: fromBlock.toString(),
        toBlock: toBlock.toString(),
      },
    });

    try {
      this.logger.debug(
        `[AlchemyRpcProvider] Getting asset transfers for ${maskedAddress} on ${chain} from block ${fromBlock} to ${toBlock}`,
      );

      const result = await this.circuitBreaker.execute(async () => {
        return await withRetry(
          async () => {
            const provider = this.getProvider(chain);

            // Convert block numbers to hex format if they're numbers
            const fromBlockHex =
              typeof fromBlock === "number"
                ? `0x${fromBlock.toString(16)}`
                : fromBlock;
            const toBlockHex =
              typeof toBlock === "number"
                ? `0x${toBlock.toString(16)}`
                : toBlock;

            // Get all transfers where the wallet is involved
            // Note: pageKey applies to both fromAddress and toAddress queries combined
            // We need to handle pagination differently for combined results
            const [fromTransfers, toTransfers] = await Promise.all([
              // Outgoing transfers (wallet is sender)
              provider.core.getAssetTransfers({
                fromBlock: fromBlockHex,
                toBlock: toBlockHex,
                fromAddress: walletAddress,
                category: [
                  AssetTransfersCategory.EXTERNAL, // ETH transfers
                  AssetTransfersCategory.ERC20, // Token transfers
                ],
                withMetadata: true,
                excludeZeroValue: false, // Include zero-value transfers for completeness
                maxCount: 1000, // Alchemy's max per request
                pageKey: pageKey, // Pass pagination cursor
              }),
              // Incoming transfers (wallet is receiver)
              provider.core.getAssetTransfers({
                fromBlock: fromBlockHex,
                toBlock: toBlockHex,
                toAddress: walletAddress,
                category: [
                  AssetTransfersCategory.EXTERNAL,
                  AssetTransfersCategory.ERC20,
                ],
                withMetadata: true,
                excludeZeroValue: false,
                maxCount: 1000,
                pageKey: pageKey, // Pass pagination cursor
              }),
            ]);

            return {
              transfers: [...fromTransfers.transfers, ...toTransfers.transfers],
              pageKey: fromTransfers.pageKey || toTransfers.pageKey,
            };
          },
          {
            maxRetries: this.maxRetries,
            initialDelay: this.retryDelayMs,
            onRetry: ({ attempt, nextDelayMs, error }) => {
              this.logger.warn(
                {
                  error: error instanceof Error ? error.message : String(error),
                  attempt,
                  nextDelayMs,
                  address: maskedAddress,
                  chain,
                },
                "[AlchemyRpcProvider] Retrying asset transfers request",
              );
            },
          },
        );
      });

      // Sampling for raw data storage (1% of requests)
      const shouldSample = Math.random() < this.SAMPLING_RATE;

      if (shouldSample) {
        // Send to Sentry for monitoring
        Sentry.captureMessage("Alchemy RPC Response Sample", {
          level: "debug",
          extra: {
            response: {
              transferCount: result.transfers.length,
              hasPageKey: !!result.pageKey,
              sampleTransfers: result.transfers.slice(0, 3), // First 3 transfers as sample
            },
            walletAddress: maskedAddress,
            chain,
            fromBlock: fromBlock.toString(),
            toBlock: toBlock.toString(),
            processingTime: Date.now() - startTime,
          },
        });

        this.logger.debug(
          `[AlchemyRpcProvider] Sampled request - sent to Sentry for ${maskedAddress} on ${chain}`,
        );
      }

      this.logger.debug(
        `[AlchemyRpcProvider] Found ${result.transfers.length} transfers for ${maskedAddress} on ${chain} in ${Date.now() - startTime}ms`,
      );

      return result;
    } catch (error) {
      const endTime = Date.now() - startTime;

      // Enhanced circuit breaker error message
      if (error instanceof CircuitOpenError) {
        this.logger.error(
          `[AlchemyRpcProvider] Circuit breaker is open - too many failures`,
        );
        throw new Error(
          `Alchemy RPC temporarily unavailable due to multiple failures. ${error.message}`,
        );
      }

      Sentry.captureException(error, {
        extra: {
          walletAddress: maskedAddress,
          chain,
          fromBlock: fromBlock.toString(),
          toBlock: toBlock.toString(),
          method: "getAssetTransfers",
          processingTime: endTime,
        },
      });

      this.logger.error(
        {
          error,
          address: maskedAddress,
          chain,
        },
        "[AlchemyRpcProvider] Error getting asset transfers",
      );
      throw error;
    }
  }

  /**
   * Get transaction receipt for gas cost calculation
   */
  async getTransactionReceipt(
    txHash: string,
    chain: SpecificChain,
  ): Promise<TransactionReceipt | null> {
    const startTime = Date.now();

    // Add Sentry breadcrumb for debugging
    Sentry.addBreadcrumb({
      category: "alchemy.rpc",
      message: `Transaction receipt request`,
      level: "info",
      data: {
        txHash,
        chain,
      },
    });

    try {
      const result = await this.circuitBreaker.execute(async () => {
        return await withRetry(
          async () => {
            const provider = this.getProvider(chain);
            const receipt = await provider.core.getTransactionReceipt(txHash);

            if (!receipt) {
              return null;
            }

            return {
              transactionHash: receipt.transactionHash,
              blockNumber: receipt.blockNumber,
              gasUsed: receipt.gasUsed.toString(),
              effectiveGasPrice: receipt.effectiveGasPrice?.toString() || "0",
              status: receipt.status === 1,
              from: receipt.from,
              to: receipt.to || undefined,
              logs: receipt.logs,
            };
          },
          {
            maxRetries: this.maxRetries,
            initialDelay: this.retryDelayMs,
            onRetry: ({ attempt, nextDelayMs, error }) => {
              this.logger.warn(
                {
                  error: error instanceof Error ? error.message : String(error),
                  attempt,
                  nextDelayMs,
                  txHash,
                  chain,
                },
                "[AlchemyRpcProvider] Retrying transaction receipt request",
              );
            },
          },
        );
      });

      this.logger.debug(
        `[AlchemyRpcProvider] Got transaction receipt for ${txHash} on ${chain} in ${Date.now() - startTime}ms`,
      );

      return result;
    } catch (error) {
      const endTime = Date.now() - startTime;

      if (error instanceof CircuitOpenError) {
        this.logger.error(
          `[AlchemyRpcProvider] Circuit breaker is open - too many failures`,
        );
        throw new Error(
          `Alchemy RPC temporarily unavailable due to multiple failures. ${error.message}`,
        );
      }

      Sentry.captureException(error, {
        extra: {
          txHash,
          chain,
          method: "getTransactionReceipt",
          processingTime: endTime,
        },
      });

      this.logger.error(
        {
          error,
          txHash,
          chain,
        },
        "[AlchemyRpcProvider] Error getting transaction receipt",
      );
      throw error;
    }
  }

  /**
   * Get all token balances for a wallet in a single call
   * Much more efficient than calling for each token individually
   */
  async getTokenBalances(
    walletAddress: string,
    chain: SpecificChain,
  ): Promise<TokenBalance[]> {
    const startTime = Date.now();
    const maskedAddress = this.maskWalletAddress(walletAddress);

    Sentry.addBreadcrumb({
      category: "alchemy.rpc",
      message: `Token balances request`,
      level: "info",
      data: {
        walletAddress: maskedAddress,
        chain,
      },
    });

    try {
      this.logger.debug(
        `[AlchemyRpcProvider] Getting token balances for ${maskedAddress} on ${chain}`,
      );

      const result = await this.circuitBreaker.execute(async () => {
        return await withRetry(
          async () => {
            const provider = this.getProvider(chain);
            const balances =
              await provider.core.getTokenBalances(walletAddress);

            // Filter out zero balances and null/undefined values
            return balances.tokenBalances
              .filter(
                (balance: { tokenBalance?: string | null }) =>
                  balance.tokenBalance &&
                  balance.tokenBalance !== "0x0" &&
                  balance.tokenBalance !== null,
              )
              .map(
                (balance: {
                  contractAddress: string;
                  tokenBalance?: string | null;
                }) => ({
                  contractAddress: balance.contractAddress,
                  balance: balance.tokenBalance!, // Safe to assert - filter guarantees non-null
                }),
              );
          },
          {
            maxRetries: this.maxRetries,
            initialDelay: this.retryDelayMs,
            onRetry: ({ attempt, nextDelayMs, error }) => {
              this.logger.warn(
                {
                  error: error instanceof Error ? error.message : String(error),
                  attempt,
                  nextDelayMs,
                  address: maskedAddress,
                  chain,
                },
                "[AlchemyRpcProvider] Retrying token balances request",
              );
            },
          },
        );
      });

      // Sampling for raw data storage (1% of requests)
      const shouldSample = Math.random() < this.SAMPLING_RATE;

      if (shouldSample) {
        // Send to Sentry for monitoring
        Sentry.captureMessage("Alchemy RPC Response Sample", {
          level: "debug",
          extra: {
            response: {
              balanceCount: result.length,
              sampleBalances: result.slice(0, 5).map((b) => ({
                address: b.contractAddress,
                balance: b.balance,
              })), // First 5 balances as sample
            },
            walletAddress: maskedAddress,
            chain,
            processingTime: Date.now() - startTime,
          },
        });

        this.logger.debug(
          `[AlchemyRpcProvider] Sampled request - sent to Sentry for ${maskedAddress} on ${chain}`,
        );
      }

      this.logger.debug(
        `[AlchemyRpcProvider] Found ${result.length} non-zero token balances for ${maskedAddress} on ${chain} in ${Date.now() - startTime}ms`,
      );

      return result;
    } catch (error) {
      const endTime = Date.now() - startTime;

      if (error instanceof CircuitOpenError) {
        this.logger.error(
          `[AlchemyRpcProvider] Circuit breaker is open - too many failures`,
        );
        throw new Error(
          `Alchemy RPC temporarily unavailable due to multiple failures. ${error.message}`,
        );
      }

      Sentry.captureException(error, {
        extra: {
          walletAddress: maskedAddress,
          chain,
          method: "getTokenBalances",
          processingTime: endTime,
        },
      });

      this.logger.error(
        {
          error,
          address: maskedAddress,
          chain,
        },
        "[AlchemyRpcProvider] Error getting token balances",
      );
      throw error;
    }
  }

  /**
   * Get ETH balance for a wallet
   */
  async getBalance(
    walletAddress: string,
    chain: SpecificChain,
  ): Promise<string> {
    const maskedAddress = this.maskWalletAddress(walletAddress);

    try {
      const result = await this.circuitBreaker.execute(async () => {
        return await withRetry(
          async () => {
            const provider = this.getProvider(chain);
            const balance = await provider.core.getBalance(
              walletAddress,
              "latest",
            );
            return balance.toString();
          },
          {
            maxRetries: this.maxRetries,
            initialDelay: this.retryDelayMs,
          },
        );
      });

      return result;
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        throw new Error(
          `Alchemy RPC temporarily unavailable due to multiple failures. ${error.message}`,
        );
      }

      this.logger.error(
        {
          error,
          address: maskedAddress,
          chain,
        },
        "[AlchemyRpcProvider] Error getting ETH balance",
      );
      throw error;
    }
  }

  /**
   * Get logs for custom event filtering if needed
   */
  async getLogs(
    chain: SpecificChain,
    params: {
      fromBlock: number | string;
      toBlock: number | string;
      address?: string | string[];
      topics?: string[];
    },
  ): Promise<Log[]> {
    try {
      const result = await this.circuitBreaker.execute(async () => {
        return await withRetry(
          async () => {
            const provider = this.getProvider(chain);
            return await provider.core.getLogs({
              fromBlock: params.fromBlock,
              toBlock: params.toBlock,
              address: params.address,
              topics: params.topics,
            });
          },
          {
            maxRetries: this.maxRetries,
            initialDelay: this.retryDelayMs,
          },
        );
      });

      return result;
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        throw new Error(
          `Alchemy RPC temporarily unavailable due to multiple failures. ${error.message}`,
        );
      }

      this.logger.error(
        { error, chain },
        "[AlchemyRpcProvider] Error getting logs",
      );
      throw error;
    }
  }

  /**
   * Batch get transaction receipts for efficiency
   * Each individual receipt call has circuit breaker and retry protection
   */
  async batchGetTransactionReceipts(
    txHashes: string[],
    chain: SpecificChain,
  ): Promise<(TransactionReceipt | null)[]> {
    if (txHashes.length === 0) {
      return [];
    }

    const startTime = Date.now();

    try {
      this.logger.debug(
        `[AlchemyRpcProvider] Batch fetching ${txHashes.length} transaction receipts on ${chain}`,
      );

      // Alchemy SDK doesn't have a native batch method, so we'll use Promise.all
      // but limit concurrency to avoid rate limits
      const batchSize = 10;
      const results: (TransactionReceipt | null)[] = [];

      for (let i = 0; i < txHashes.length; i += batchSize) {
        const batch = txHashes.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map((hash) => this.getTransactionReceipt(hash, chain)),
        );
        results.push(...batchResults);
      }

      this.logger.debug(
        `[AlchemyRpcProvider] Batch fetched ${results.length} receipts on ${chain} in ${Date.now() - startTime}ms`,
      );

      return results;
    } catch (error) {
      const endTime = Date.now() - startTime;

      Sentry.captureException(error, {
        extra: {
          txHashCount: txHashes.length,
          chain,
          method: "batchGetTransactionReceipts",
          processingTime: endTime,
        },
      });

      this.logger.error(
        { error, chain, count: txHashes.length },
        "[AlchemyRpcProvider] Error batch getting transaction receipts",
      );
      throw error;
    }
  }

  /**
   * Check if provider is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Check if we have at least one configured provider
      const configuredChains = Object.keys(
        this.alchemyInstances,
      ) as SpecificChain[];
      if (configuredChains.length === 0) {
        return false;
      }

      // Try to get block number from the first configured chain
      const testChain = configuredChains[0];
      if (testChain) {
        await this.getBlockNumber(testChain);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.warn({ error }, "[AlchemyRpcProvider] Health check failed");
      return false;
    }
  }

  /**
   * Get token decimals for an ERC20 token
   */
  async getTokenDecimals(
    tokenAddress: string,
    chain: SpecificChain,
  ): Promise<number> {
    try {
      const result = await this.circuitBreaker.execute(async () => {
        return await withRetry(
          async () => {
            const provider = this.getProvider(chain);

            // Call the decimals() function using its function selector
            // 0x313ce567 is the keccak256 hash of "decimals()"
            const result = await provider.core.call({
              to: tokenAddress,
              data: "0x313ce567",
            });

            // Convert hex result to number
            if (result && result !== "0x") {
              const parsed = parseInt(result, 16);
              if (!Number.isNaN(parsed)) {
                return parsed;
              }
            }

            // Default to 18 if call fails (common for ETH/WETH)
            return 18;
          },
          {
            maxRetries: this.maxRetries,
            initialDelay: this.retryDelayMs,
          },
        );
      });

      return result;
    } catch (error) {
      this.logger.warn(
        `[AlchemyRpcProvider] Failed to fetch decimals for token ${tokenAddress} on ${chain}, defaulting to 18`,
      );
      if (error instanceof Error) {
        this.logger.debug(
          `[AlchemyRpcProvider] Decimals fetch error: ${error.message}`,
        );
      }
      return 18;
    }
  }

  /**
   * Get transaction data (for router/to address check)
   */
  async getTransaction(
    txHash: string,
    chain: SpecificChain,
  ): Promise<TransactionData | null> {
    try {
      const result = await this.circuitBreaker.execute(async () => {
        return await withRetry(
          async () => {
            const provider = this.getProvider(chain);
            const tx = await provider.core.getTransaction(txHash);

            if (!tx) {
              return null;
            }

            return {
              to: tx.to || null,
              from: tx.from,
            };
          },
          {
            maxRetries: this.maxRetries,
            initialDelay: this.retryDelayMs,
          },
        );
      });

      return result;
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        throw new Error(
          `Alchemy RPC temporarily unavailable due to multiple failures. ${error.message}`,
        );
      }

      this.logger.error(
        { error, txHash, chain },
        "[AlchemyRpcProvider] Error getting transaction",
      );
      throw error;
    }
  }

  /**
   * Get circuit breaker health status
   */
  getHealthStatus() {
    const stats = this.circuitBreaker.getStats();
    return {
      provider: "Alchemy",
      circuitBreaker: stats,
    };
  }
}
