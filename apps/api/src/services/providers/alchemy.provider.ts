import {
  Alchemy,
  AssetTransfersCategory,
  AssetTransfersWithMetadataResponse,
  Log,
  Network,
} from "alchemy-sdk";

import { config } from "@/config/index.js";
import { serviceLogger } from "@/lib/logger.js";
import type {
  TransactionReceipt as BlockchainTransactionReceipt,
  LiveTradingChain,
  TokenBalance,
} from "@/types/index.js";

/**
 * Alchemy Provider
 * Handles all blockchain RPC interactions using Alchemy SDK
 * Provides methods for scanning transactions, getting balances, and more
 */
export class AlchemyProvider {
  private alchemyInstances: Partial<Record<LiveTradingChain, Alchemy>> = {};
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  // Map our chain names to Alchemy Network enum
  private readonly chainToNetwork: Record<LiveTradingChain, Network> = {
    eth: Network.ETH_MAINNET,
    base: Network.BASE_MAINNET,
    arbitrum: Network.ARB_MAINNET,
    optimism: Network.OPT_MAINNET,
    polygon: Network.MATIC_MAINNET,
    // Note: These chains might not be supported by Alchemy SDK yet
    bsc: Network.BNB_MAINNET,
    avalanche: Network.AVAX_MAINNET,
    linea: Network.LINEA_MAINNET,
    zksync: Network.ZKSYNC_MAINNET,
    scroll: Network.SCROLL_MAINNET,
    mantle: Network.MANTLE_MAINNET,
    svm: Network.ETH_MAINNET, // Placeholder - Solana not supported
  };

  constructor() {
    this.maxRetries = config.rpc.maxRetries || 3;
    this.retryDelayMs = config.rpc.retryDelayMs || 1000;

    // Initialize Alchemy instances for configured chains
    this.initializeProviders();
  }

  /**
   * Initialize Alchemy instances for each supported chain
   */
  private initializeProviders(): void {
    const apiKey = config.api.alchemy.apiKey;

    if (!apiKey) {
      serviceLogger.warn("[AlchemyProvider] No Alchemy API key configured");
      return;
    }

    // Initialize providers for supported chains
    const supportedChains: LiveTradingChain[] = [
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
          serviceLogger.debug(
            `[AlchemyProvider] Initialized provider for ${chain}`,
          );
        }
      } catch {
        serviceLogger.error(
          `[AlchemyProvider] Failed to initialize ${chain} provider`,
        );
      }
    }

    serviceLogger.info(
      `[AlchemyProvider] Initialized ${Object.keys(this.alchemyInstances).length} chain providers`,
    );
  }

  /**
   * Get the Alchemy instance for a specific chain
   */
  private getProvider(chain: LiveTradingChain): Alchemy {
    const provider = this.alchemyInstances[chain];
    if (!provider) {
      throw new Error(`No Alchemy provider configured for chain: ${chain}`);
    }
    return provider;
  }

  /**
   * Get the current block number for a chain
   */
  async getBlockNumber(chain: LiveTradingChain): Promise<number> {
    const provider = this.getProvider(chain);

    try {
      const blockNumber = await provider.core.getBlockNumber();
      serviceLogger.debug(
        `[AlchemyProvider] Got block number for ${chain}: ${blockNumber}`,
      );
      return blockNumber;
    } catch (error) {
      serviceLogger.error(
        `[AlchemyProvider] Error getting block number for ${chain}`,
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
    chain: LiveTradingChain,
    fromBlock: number | string,
    toBlock: number | string = "latest",
  ): Promise<AssetTransfersWithMetadataResponse> {
    const provider = this.getProvider(chain);

    try {
      serviceLogger.debug(
        `[AlchemyProvider] Getting asset transfers for ${walletAddress} on ${chain} from block ${fromBlock} to ${toBlock}`,
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

      serviceLogger.debug(
        `[AlchemyProvider] Found ${fromTransfers.transfers.length} outgoing and ${toTransfers.transfers.length} incoming transfers`,
      );

      // Combine and return all transfers
      return {
        transfers: [...fromTransfers.transfers, ...toTransfers.transfers],
        pageKey: fromTransfers.pageKey || toTransfers.pageKey,
      };
    } catch (error) {
      serviceLogger.error(
        `[AlchemyProvider] Error getting asset transfers for ${walletAddress} on ${chain}`,
      );
      throw error;
    }
  }

  /**
   * Get transaction receipt for gas cost calculation
   */
  async getTransactionReceipt(
    txHash: string,
    chain: LiveTradingChain,
  ): Promise<BlockchainTransactionReceipt | null> {
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
      serviceLogger.error(
        `[AlchemyProvider] Error getting transaction receipt for ${txHash} on ${chain}`,
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
    chain: LiveTradingChain,
  ): Promise<TokenBalance[]> {
    const provider = this.getProvider(chain);

    try {
      serviceLogger.debug(
        `[AlchemyProvider] Getting token balances for ${walletAddress} on ${chain}`,
      );

      // Get all token balances
      const balances = await provider.core.getTokenBalances(walletAddress);

      // Filter out zero balances and format
      const nonZeroBalances = balances.tokenBalances
        .filter((balance) => balance.tokenBalance !== "0x0")
        .map((balance) => ({
          contractAddress: balance.contractAddress,
          balance: balance.tokenBalance || "0x0",
          // Note: We'll need to fetch token metadata separately if needed
        }));

      serviceLogger.debug(
        `[AlchemyProvider] Found ${nonZeroBalances.length} non-zero token balances`,
      );

      return nonZeroBalances;
    } catch (error) {
      serviceLogger.error(
        `[AlchemyProvider] Error getting token balances for ${walletAddress} on ${chain}`,
      );
      throw error;
    }
  }

  /**
   * Get ETH balance for a wallet
   */
  async getBalance(
    walletAddress: string,
    chain: LiveTradingChain,
  ): Promise<string> {
    const provider = this.getProvider(chain);

    try {
      const balance = await provider.core.getBalance(walletAddress, "latest");
      return balance.toString();
    } catch (error) {
      serviceLogger.error(
        `[AlchemyProvider] Error getting ETH balance for ${walletAddress} on ${chain}`,
      );
      throw error;
    }
  }

  /**
   * Get logs for custom event filtering if needed
   */
  async getLogs(
    chain: LiveTradingChain,
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
      serviceLogger.error(`[AlchemyProvider] Error getting logs for ${chain}`);
      throw error;
    }
  }

  /**
   * Batch get transaction receipts for efficiency
   */
  async batchGetTransactionReceipts(
    txHashes: string[],
    chain: LiveTradingChain,
  ): Promise<(BlockchainTransactionReceipt | null)[]> {
    if (txHashes.length === 0) {
      return [];
    }

    try {
      // Alchemy SDK doesn't have a native batch method, so we'll use Promise.all
      // but limit concurrency to avoid rate limits
      const batchSize = 10;
      const results: (BlockchainTransactionReceipt | null)[] = [];

      for (let i = 0; i < txHashes.length; i += batchSize) {
        const batch = txHashes.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map((hash) => this.getTransactionReceipt(hash, chain)),
        );
        results.push(...batchResults);
      }

      return results;
    } catch (error) {
      serviceLogger.error(
        `[AlchemyProvider] Error batch getting transaction receipts on ${chain}`,
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
      ) as LiveTradingChain[];
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
    } catch {
      serviceLogger.error("[AlchemyProvider] Health check failed");
      return false;
    }
  }

  /**
   * Get token decimals for an ERC20 token
   * @param tokenAddress - The token contract address
   * @param chain - The blockchain where the token exists
   * @returns Number of decimals for the token
   */
  async getTokenDecimals(
    tokenAddress: string,
    chain: LiveTradingChain,
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
    } catch {
      serviceLogger.warn(
        `[AlchemyProvider] Failed to fetch decimals for token ${tokenAddress} on ${chain}, defaulting to 18`,
      );
      return 18;
    }
  }
}
