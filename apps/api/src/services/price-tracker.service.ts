import { config } from "@/config/index.js";
import {
  count as countPrices,
  create as createPrice,
  createBatch as createPriceBatch,
  getPriceHistory,
} from "@/database/repositories/price-repository.js";
import { serviceLogger } from "@/lib/logger.js";
import { MultiChainProvider } from "@/services/providers/multi-chain.provider.js";
import {
  BlockchainType,
  PriceReport,
  PriceSource,
  SpecificChain,
} from "@/types/index.js";

/**
 * Price Tracker Service
 * Fetches and caches token prices from multiple providers
 */
export class PriceTracker {
  providers: PriceSource[];
  // private novesProvider: NovesProvider | null = null;
  private multiChainProvider: MultiChainProvider;

  constructor() {
    // Initialize only the MultiChainProvider
    this.multiChainProvider = new MultiChainProvider();
    serviceLogger.debug(
      "[PriceTracker] Initialized MultiChainProvider for all token price fetching",
    );

    // Set up providers (now just MultiChainProvider)
    this.providers = [];

    // Add MultiChainProvider as the only provider
    if (this.multiChainProvider) {
      this.providers.push(this.multiChainProvider);
    }

    serviceLogger.debug(
      `[PriceTracker] Initialized with ${this.providers.length} providers`,
    );
    this.providers.forEach((p) =>
      serviceLogger.debug(`[PriceTracker] Loaded provider: ${p.getName()}`),
    );
  }

  /**
   * Determines which blockchain a token address belongs to based on address format
   * @param tokenAddress The token address to check
   * @returns The blockchain type (SVM or EVM)
   */
  determineChain(tokenAddress: string): BlockchainType {
    // Use MultiChainProvider for chain detection
    if (this.multiChainProvider) {
      return this.multiChainProvider.determineChain(tokenAddress);
    }

    // Fallback detection if MultiChainProvider is not available
    // Ethereum addresses are hexadecimal and start with 0x, typically 42 chars total (0x + 40 hex chars)
    if (/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return BlockchainType.EVM;
    }

    // Solana addresses are base58 encoded and typically 32-44 characters long
    return BlockchainType.SVM;
  }

  /**
   * Get a provider by name
   * @param name The name of the provider to get
   * @returns The provider instance or null if not found
   */
  getProviderByName(name: string): PriceSource | null {
    return (
      this.providers.find(
        (p) => p.getName().toLowerCase() === name.toLowerCase(),
      ) || null
    );
  }

  /**
   * Get current price for a token
   * @param tokenAddress The token address to get price for
   * @param blockchainType Optional blockchain type override (EVM or SVM)
   * @param specificChain Optional specific chain override (eth, polygon, etc.)
   * @returns The token price in USD or null if not available
   */
  async getPrice(
    tokenAddress: string,
    blockchainType?: BlockchainType,
    specificChain?: SpecificChain,
  ) {
    serviceLogger.debug(
      `[PriceTracker] Getting price for token: ${tokenAddress}`,
    );

    // Determine which chain this token belongs to if not provided
    const tokenChain = blockchainType || this.determineChain(tokenAddress);
    serviceLogger.debug(
      `[PriceTracker] ${blockchainType ? "Using provided" : "Detected"} token ${tokenAddress} on chain: ${tokenChain}`,
    );

    if (!this.multiChainProvider) {
      serviceLogger.error(`[PriceTracker] No MultiChainProvider available`);

      return null;
    }

    try {
      serviceLogger.debug(
        `[PriceTracker] Using MultiChainProvider for token ${tokenAddress}`,
      );

      // Get price from MultiChainProvider (which has its own cache)
      const priceResult = await this.multiChainProvider.getPrice(
        tokenAddress,
        tokenChain,
        specificChain,
      );

      if (priceResult !== null) {
        // Handle both number and PriceReport return types
        const price = priceResult.price;
        const chain = priceResult.chain;

        // For number results, ensure we have a valid specificChain
        const tokenSpecificChain = priceResult.specificChain;

        // Get the symbol
        const symbol = priceResult.symbol;

        serviceLogger.debug(
          `[PriceTracker] Got price $${price} from MultiChainProvider`,
        );

        // Store price in database for historical record
        await this.storePrice(
          tokenAddress,
          price,
          symbol,
          chain,
          tokenSpecificChain,
        );

        return priceResult;
      } else {
        serviceLogger.debug(
          `[PriceTracker] No price available from MultiChainProvider for ${tokenAddress}`,
        );
      }
    } catch (error) {
      serviceLogger.error(
        `[PriceTracker] Error fetching price from MultiChainProvider:`,
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    serviceLogger.debug(
      `[PriceTracker] No price available for ${tokenAddress}`,
    );

    return null;
  }

  /**
   * Get detailed token and price information for multiple tokens in bulk
   * @param tokenAddresses Array of token addresses to get info for
   * @returns Map of token address to token info (null if not available)
   */
  async getBulkPrices(
    tokenAddresses: string[],
  ): Promise<Map<string, PriceReport | null>> {
    serviceLogger.debug(
      `[PriceTracker] Getting bulk token info for ${tokenAddresses.length} tokens`,
    );

    const resultMap = new Map<string, PriceReport | null>();

    if (tokenAddresses.length === 0) {
      return resultMap;
    }

    // Group tokens by chain type for efficient processing
    const evmTokens: string[] = [];
    const svmTokens: string[] = [];

    for (const tokenAddress of tokenAddresses) {
      const chainType = this.determineChain(tokenAddress);
      if (chainType === BlockchainType.EVM) {
        evmTokens.push(tokenAddress);
      } else {
        svmTokens.push(tokenAddress);
      }
    }

    // Process EVM tokens in bulk if MultiChainProvider supports it
    if (evmTokens.length > 0 && this.multiChainProvider) {
      try {
        // Use batch processing to reduce API calls
        const batchResults = await this.multiChainProvider.getBatchPrices(
          evmTokens,
          BlockchainType.EVM,
        );

        // Store prices and add to result map
        const pricesToStore = [];

        for (const [tokenAddress, priceReport] of batchResults) {
          if (priceReport && priceReport.price !== null) {
            pricesToStore.push({
              tokenAddress,
              price: priceReport.price,
              symbol: priceReport.symbol,
              chain: priceReport.chain,
              specificChain: priceReport.specificChain,
            });

            resultMap.set(tokenAddress, priceReport);
          } else {
            resultMap.set(tokenAddress, null);
          }
        }

        // Store all prices in a single batch operation
        await this.storePrices(pricesToStore);
      } catch (error) {
        serviceLogger.error(
          "[PriceTracker] Error in bulk EVM token processing:",
          error,
        );
        // Fallback to individual processing for EVM tokens
        for (const tokenAddress of evmTokens) {
          const priceReport = await this.getPrice(tokenAddress);
          resultMap.set(tokenAddress, priceReport);
        }
      }
    }

    // Process SVM tokens in bulk if MultiChainProvider supports it
    if (svmTokens.length > 0 && this.multiChainProvider) {
      try {
        // Use batch processing to reduce API calls
        const batchResults = await this.multiChainProvider.getBatchPrices(
          svmTokens,
          BlockchainType.SVM,
        );

        // Store prices and add to result map
        const pricesToStore = [];

        for (const [tokenAddress, priceReport] of batchResults) {
          if (priceReport && priceReport.price !== null) {
            pricesToStore.push({
              tokenAddress,
              price: priceReport.price,
              symbol: priceReport.symbol,
              chain: priceReport.chain,
              specificChain: priceReport.specificChain,
            });

            resultMap.set(tokenAddress, priceReport);
          } else {
            resultMap.set(tokenAddress, null);
          }
        }

        // Store all prices in a single batch operation
        await this.storePrices(pricesToStore);
      } catch (error) {
        serviceLogger.error(
          "[PriceTracker] Error in bulk SVM token processing:",
          error,
        );
        // Fallback to individual processing for SVM tokens
        for (const tokenAddress of svmTokens) {
          const priceReport = await this.getPrice(tokenAddress);
          resultMap.set(tokenAddress, priceReport);
        }
      }
    }

    serviceLogger.debug(
      `[PriceTracker] Successfully retrieved bulk token info for ${Array.from(resultMap.values()).filter((v) => v !== null).length}/${tokenAddresses.length} tokens`,
    );

    return resultMap;
  }

  /**
   * Store a price in the database
   * @param tokenAddress The token address
   * @param price The price to store
   * @param symbol The token symbol
   * @param chain The blockchain type
   * @param specificChain The specific chain (optional)
   */
  private async storePrice(
    tokenAddress: string,
    price: number,
    symbol: string,
    chain: BlockchainType,
    specificChain: SpecificChain,
  ): Promise<void> {
    try {
      await createPrice({
        token: tokenAddress,
        price,
        symbol,
        timestamp: new Date(),
        chain,
        specificChain,
      });
    } catch (error) {
      serviceLogger.error(
        `[PriceTracker] Error storing price in database:`,
        error,
      );
    }
  }

  /**
   * Store multiple prices in the database using batch operation
   * @param pricesData Array of price data to store
   */
  private async storePrices(
    pricesData: Array<{
      tokenAddress: string;
      price: number;
      symbol: string;
      chain: BlockchainType;
      specificChain: SpecificChain;
    }>,
  ): Promise<void> {
    if (pricesData.length === 0) {
      return;
    }

    try {
      const insertData = pricesData.map((data) => ({
        token: data.tokenAddress,
        price: data.price,
        symbol: data.symbol,
        timestamp: new Date(),
        chain: data.chain,
        specificChain: data.specificChain,
      }));

      await createPriceBatch(insertData);
    } catch (error) {
      serviceLogger.error(
        `[PriceTracker] Error storing prices in database:`,
        error,
      );
    }
  }

  /**
   * Check if a token is supported by the provider
   * @param tokenAddress The token address to check
   * @returns True if the provider supports the token
   */
  async isTokenSupported(
    tokenAddress: string,
    specificChain: SpecificChain,
  ): Promise<boolean> {
    if (!this.multiChainProvider) {
      return false;
    }

    try {
      return await this.multiChainProvider.supports(
        tokenAddress,
        specificChain,
      );
    } catch (error) {
      serviceLogger.debug(
        `[PriceTracker] Error checking support for ${tokenAddress}:`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return false;
    }
  }

  /**
   * Get historical price data for a token
   * @param tokenAddress The token address
   * @param timeframe The timeframe to get history for (e.g. '24h', '7d', '30d')
   * @param allowMockData Whether to generate mock data if real data is not available (defaults to config setting)
   * @returns An array of price points or null if not available
   */
  async getPriceHistory(
    tokenAddress: string,
    timeframe: string,
    allowMockData: boolean = config.allowMockPriceHistory,
  ): Promise<{ timestamp: string; price: number }[] | null> {
    serviceLogger.debug(
      `[PriceTracker] Getting price history for ${tokenAddress} (${timeframe})`,
    );

    try {
      // Convert timeframe to hours for database query
      let hours = 24; // Default to 24 hours

      if (timeframe === "7d") hours = 24 * 7;
      else if (timeframe === "30d") hours = 24 * 30;
      else if (timeframe === "1h") hours = 1;
      else if (timeframe === "6h") hours = 6;

      // Get historical data from database
      const history = await getPriceHistory(tokenAddress, hours);

      if (history && history.length > 0) {
        serviceLogger.debug(
          `[PriceTracker] Retrieved ${history.length} historical price points from database`,
        );
        return history.map((point) => ({
          timestamp: point.timestamp?.toISOString() ?? "",
          price: point.price,
        }));
      }
    } catch (error) {
      serviceLogger.error(
        `[PriceTracker] Error fetching price history:`,
        error,
      );
    }

    // If we don't have enough historical data in the database or an error occurred,
    // generate mock data based on current price, but only if allowed
    if (!allowMockData) {
      serviceLogger.debug(
        `[PriceTracker] No historical data available and mock data generation is disabled`,
      );
      return null;
    }

    serviceLogger.debug(
      `[PriceTracker] WARNING: Generating SIMULATED price history data (not real market data)`,
    );
    const currentPrice = await this.getPrice(tokenAddress);
    if (!currentPrice) return null;

    // Convert timeframe to number of data points
    let dataPoints = 24; // Default for 24h
    let intervalMs = 3600 * 1000; // 1 hour in milliseconds

    if (timeframe === "7d") {
      dataPoints = 7 * 24;
      intervalMs = 3600 * 1000; // 1 hour
    } else if (timeframe === "30d") {
      dataPoints = 30;
      intervalMs = 24 * 3600 * 1000; // 1 day
    } else if (timeframe === "1h") {
      dataPoints = 12;
      intervalMs = 5 * 60 * 1000; // 5 minutes
    } else if (timeframe === "6h") {
      dataPoints = 12;
      intervalMs = 30 * 60 * 1000; // 30 minutes
    }

    // Cap data points to a reasonable number
    dataPoints = Math.min(dataPoints, 180);

    // Generate some mock historical data based on current price
    const now = Date.now();
    const history = [];
    for (let i = 0; i < dataPoints; i++) {
      const time = now - i * intervalMs;
      // Create somewhat realistic price movements (±2%)
      const randomVariation = 0.98 + Math.random() * 0.04;
      history.push({
        timestamp: new Date(time).toISOString(),
        price: currentPrice.price * randomVariation,
        simulated: true, // Add a flag to indicate this is simulated data
      });
    }

    serviceLogger.debug(
      `[PriceTracker] Generated ${dataPoints} simulated data points for ${timeframe} timeframe`,
    );
    return history.reverse(); // Return in chronological order
  }

  /**
   * Check if price tracker is healthy
   * For system health check use
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Check if database is accessible
      await countPrices();

      // Check if provider is responsive
      if (this.multiChainProvider) {
        try {
          // Try to get a price as a simple test - use ETH since it's widely available
          const price = await this.multiChainProvider.getPrice(
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
          );
          return price !== null;
        } catch (error) {
          serviceLogger.error(
            "[PriceTracker] Health check failed on price fetch:",
            error,
          );
          return false;
        }
      }

      return false;
    } catch (error) {
      serviceLogger.error("[PriceTracker] Health check failed:", error);
      return false;
    }
  }
}
