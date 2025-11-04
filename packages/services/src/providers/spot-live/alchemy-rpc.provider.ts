import {
  Alchemy,
  AssetTransfersCategory,
  AssetTransfersWithMetadataResponse,
  Log,
  Network,
} from "alchemy-sdk";
import { Logger } from "pino";

import { SpecificChain } from "../../types/index.js";

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
 * Alchemy Provider
 * Handles all blockchain RPC interactions using Alchemy SDK
 * Provides methods for scanning transactions, getting balances, and more
 */
export class AlchemyRpcProvider {
  private alchemyInstances: Partial<Record<SpecificChain, Alchemy>> = {};
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private logger: Logger;

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
   * Get the current block number for a chain
   */
  async getBlockNumber(chain: SpecificChain): Promise<number> {
    const provider = this.getProvider(chain);

    try {
      const blockNumber = await provider.core.getBlockNumber();
      this.logger.debug(
        `[AlchemyRpcProvider] Got block number for ${chain}: ${blockNumber}`,
      );
      return blockNumber;
    } catch (error) {
      this.logger.error(
        `[AlchemyRpcProvider] Error getting block number for ${chain}`,
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
  ): Promise<AssetTransfersWithMetadataResponse> {
    const provider = this.getProvider(chain);

    try {
      this.logger.debug(
        `[AlchemyRpcProvider] Getting asset transfers for ${walletAddress} on ${chain} from block ${fromBlock} to ${toBlock}`,
      );

      // Convert block numbers to hex format if they're numbers
      const fromBlockHex =
        typeof fromBlock === "number"
          ? `0x${fromBlock.toString(16)}`
          : fromBlock;
      const toBlockHex =
        typeof toBlock === "number" ? `0x${toBlock.toString(16)}` : toBlock;

      // Get all transfers where the wallet is involved
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
        }),
      ]);

      this.logger.debug(
        `[AlchemyRpcProvider] Found ${fromTransfers.transfers.length} outgoing and ${toTransfers.transfers.length} incoming transfers`,
      );

      // Combine and return all transfers
      return {
        transfers: [...fromTransfers.transfers, ...toTransfers.transfers],
        pageKey: fromTransfers.pageKey || toTransfers.pageKey,
      };
    } catch (error) {
      this.logger.error(
        `[AlchemyRpcProvider] Error getting asset transfers for ${walletAddress} on ${chain}`,
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
    const provider = this.getProvider(chain);

    try {
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
    } catch (error) {
      this.logger.error(
        `[AlchemyRpcProvider] Error getting transaction receipt for ${txHash} on ${chain}`,
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
    const provider = this.getProvider(chain);

    try {
      this.logger.debug(
        `[AlchemyRpcProvider] Getting token balances for ${walletAddress} on ${chain}`,
      );

      // Get all token balances
      const balances = await provider.core.getTokenBalances(walletAddress);

      // Filter out zero balances and format
      const nonZeroBalances = balances.tokenBalances
        .filter(
          (balance: { tokenBalance?: string | null }) =>
            balance.tokenBalance !== "0x0",
        )
        .map(
          (balance: {
            contractAddress: string;
            tokenBalance?: string | null;
          }) => ({
            contractAddress: balance.contractAddress,
            balance: balance.tokenBalance || "0x0",
          }),
        );

      this.logger.debug(
        `[AlchemyRpcProvider] Found ${nonZeroBalances.length} non-zero token balances`,
      );

      return nonZeroBalances;
    } catch (error) {
      this.logger.error(
        `[AlchemyRpcProvider] Error getting token balances for ${walletAddress} on ${chain}`,
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
    const provider = this.getProvider(chain);

    try {
      const balance = await provider.core.getBalance(walletAddress, "latest");
      return balance.toString();
    } catch (error) {
      this.logger.error(
        `[AlchemyRpcProvider] Error getting ETH balance for ${walletAddress} on ${chain}`,
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
    const provider = this.getProvider(chain);

    try {
      const logs = await provider.core.getLogs({
        fromBlock: params.fromBlock,
        toBlock: params.toBlock,
        address: params.address,
        topics: params.topics,
      });

      return logs;
    } catch (error) {
      this.logger.error(`[AlchemyRpcProvider] Error getting logs for ${chain}`);
      throw error;
    }
  }

  /**
   * Batch get transaction receipts for efficiency
   */
  async batchGetTransactionReceipts(
    txHashes: string[],
    chain: SpecificChain,
  ): Promise<(TransactionReceipt | null)[]> {
    if (txHashes.length === 0) {
      return [];
    }

    try {
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

      return results;
    } catch (error) {
      this.logger.error(
        `[AlchemyRpcProvider] Error batch getting transaction receipts on ${chain}`,
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
      this.logger.error("[AlchemyRpcProvider] Health check failed");
      if (error instanceof Error) {
        this.logger.debug(
          `[AlchemyRpcProvider] Health check error: ${error.message}`,
        );
      }
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
      const provider = this.getProvider(chain);

      // Call the decimals() function using its function selector
      // 0x313ce567 is the keccak256 hash of "decimals()"
      const result = await provider.core.call({
        to: tokenAddress,
        data: "0x313ce567",
      });

      // Convert hex result to number
      if (result && result !== "0x") {
        return parseInt(result, 16);
      }

      // Default to 18 if call fails (common for ETH/WETH)
      return 18;
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
  ): Promise<{ to: string | null; from: string } | null> {
    const provider = this.getProvider(chain);

    try {
      const tx = await provider.core.getTransaction(txHash);

      if (!tx) {
        return null;
      }

      return {
        to: tx.to || null,
        from: tx.from,
      };
    } catch (error) {
      this.logger.error(
        `[AlchemyRpcProvider] Error getting transaction for ${txHash} on ${chain}`,
      );
      throw error;
    }
  }
}
