import { config } from "@/config/index.js";
import {
  count as countPrices,
  create as createPrice,
  createBatch as createPriceBatch,
  getLatestPrice,
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

  // In-memory cache for token prices
  private readonly tokenPriceCache: Map<string, PriceReport> = new Map();

  // Track which chain a token belongs to for quicker lookups
  private readonly chainToTokenCache: Map<string, SpecificChain> = new Map();

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
  ): Promise<PriceReport | null> {
    serviceLogger.debug(
      `[PriceTracker] Getting price for token: ${tokenAddress}`,
    );

    // Determine which chain this token belongs to if not provided
    const tokenChain = blockchainType || this.determineChain(tokenAddress);
    serviceLogger.debug(
      `[PriceTracker] ${blockchainType ? "Using provided" : "Detected"} token ${tokenAddress} on chain: ${tokenChain}`,
    );

    // 1st: Check in-memory cache first (fastest)
    const cachedPrice = this.getCachedPrice(tokenAddress, specificChain);
    if (cachedPrice) {
      return cachedPrice;
    }

    // 2nd: Check database cache (slower, but persistent)
    const dbCachedPrice = await this.getDatabaseCachedPrice(
      tokenAddress,
      specificChain,
    );
    if (dbCachedPrice) {
      return dbCachedPrice;
    }

    // 3rd: Determine which specific chain to try (cached chain first, then fallback)
    const chainToTry = this.resolveSpecificChainToTry(
      tokenAddress,
      specificChain,
    );

    // 4th: Fetch from live API via MultiChainProvider (slowest, but always fresh)
    return await this.fetchAndCachePrice(tokenAddress, tokenChain, chainToTry);
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
      `[PriceTracker] Getting bulk prices for ${tokenAddresses.length} tokens`,
    );

    const resultMap = new Map<string, PriceReport | null>();

    if (tokenAddresses.length === 0) {
      return resultMap;
    }

    // Track cache performance
    let inMemoryCacheHits = 0;
    let databaseCacheHits = 0;

    // Step 1: Check PriceTracker's in-memory cache for all tokens
    const uncachedTokens: string[] = [];

    for (const tokenAddress of tokenAddresses) {
      const cachedPrice = this.getCachedPrice(tokenAddress);
      if (cachedPrice) {
        serviceLogger.debug(
          `[PriceTracker] Using cached price for ${tokenAddress}: $${cachedPrice.price}`,
        );
        resultMap.set(tokenAddress, cachedPrice);
        inMemoryCacheHits++;
      } else {
        uncachedTokens.push(tokenAddress);
      }
    }

    // Step 2: Check database cache for remaining tokens
    const tokensNeedingAPI: string[] = [];

    for (const tokenAddress of uncachedTokens) {
      const dbCachedPrice = await this.getDatabaseCachedPrice(tokenAddress);
      if (dbCachedPrice) {
        resultMap.set(tokenAddress, dbCachedPrice);
        databaseCacheHits++;
      } else {
        tokensNeedingAPI.push(tokenAddress);
      }
    }

    // Step 3: Try cached chains first for tokens with known chain mappings (optimization)
    const remainingTokensForBatch = await this.tryBatchPricesWithCachedChains(
      tokensNeedingAPI,
      resultMap,
    );

    // Track cached chain performance
    const cachedChainHits =
      tokensNeedingAPI.length - remainingTokensForBatch.length;

    // Step 4: Use batch API for remaining tokens (preserving batching efficiency)
    await this.fetchRemainingTokensViaBatch(remainingTokensForBatch, resultMap);

    const successfulPrices = Array.from(resultMap.values()).filter(
      (v) => v !== null,
    ).length;

    serviceLogger.debug(
      `[PriceTracker] Bulk price retrieval complete: ${successfulPrices}/${tokenAddresses.length} tokens ` +
        `(${inMemoryCacheHits} memory hits, ${databaseCacheHits} DB hits, ${cachedChainHits} cached chain hits, ${remainingTokensForBatch.length} multi-chain API requests)`,
    );

    return resultMap;
  }

  /**
   * Get price from database cache, including chain determination and memory cache update
   * @param tokenAddress The token address to look up
   * @param specificChain Optional specific chain - if provided, uses it; otherwise tries to determine it
   * @returns PriceReport from database if fresh, null otherwise
   */
  private async getDatabaseCachedPrice(
    tokenAddress: string,
    specificChain?: SpecificChain,
  ): Promise<PriceReport | null> {
    try {
      // Use provided chain or try to determine it
      const chainToUse = specificChain || this.getCachedChain(tokenAddress);
      if (!chainToUse) {
        // No known chain mapping, can't query database
        return null;
      }

      const dbPrice = await getLatestPrice(tokenAddress, chainToUse);
      if (
        dbPrice &&
        dbPrice.timestamp &&
        this.isPriceFresh(dbPrice.timestamp)
      ) {
        // Convert database record to PriceReport
        const priceReport: PriceReport = {
          token: dbPrice.token,
          price: dbPrice.price,
          symbol: dbPrice.symbol,
          timestamp: dbPrice.timestamp,
          chain: dbPrice.chain as BlockchainType,
          specificChain: dbPrice.specificChain as SpecificChain,
        };

        // Cache in memory for future requests
        this.setCachedPrice(priceReport);

        serviceLogger.debug(
          `[PriceTracker] Using fresh price from database for ${tokenAddress}: $${priceReport.price}`,
        );

        return priceReport;
      }

      return null;
    } catch (error) {
      serviceLogger.debug(
        `[PriceTracker] Error checking database cache for ${tokenAddress}:`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return null;
    }
  }

  /**
   * Process batch results from MultiChainProvider and cache them
   * @param batchResults Results from getBatchPrices
   * @param resultMap Map to store the final results
   */
  private processBatchResults(
    batchResults: Map<string, PriceReport | null>,
    resultMap: Map<string, PriceReport | null>,
  ): void {
    for (const [tokenAddress, priceReport] of batchResults) {
      if (priceReport) {
        // Cache in memory
        this.setCachedPrice(priceReport);

        // Store in database
        this.storePrice(priceReport).catch((error) => {
          serviceLogger.error(
            `[PriceTracker] Error storing price for ${tokenAddress}:`,
            error instanceof Error ? error.message : "Unknown error",
          );
        });

        serviceLogger.debug(
          `[PriceTracker] Got price from batch API for ${tokenAddress}: $${priceReport.price}`,
        );
      }

      resultMap.set(tokenAddress, priceReport);
    }
  }

  /**
   * Store a price in the database.  Note that the price report contains more fields than the
   * database table, so some of the fields get ignored.
   * @param priceReport The price report to store
   */
  private async storePrice(priceReport: PriceReport): Promise<void> {
    try {
      await createPrice({
        token: priceReport.token,
        price: priceReport.price,
        symbol: priceReport.symbol,
        timestamp: new Date(),
        chain: priceReport.chain,
        specificChain: priceReport.specificChain,
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
   * // TODO(stbrody): This is not used anywhere.  Remove?
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

  /**
   * Generates a cache key from token address and chain
   */
  private getCacheKey(
    tokenAddress: string,
    specificChain?: SpecificChain,
  ): string {
    return specificChain
      ? `${tokenAddress.toLowerCase()}:${specificChain}`
      : tokenAddress.toLowerCase();
  }

  /**
   * Get cached token price if available
   */
  private getCachedPrice(
    tokenAddress: string,
    specificChain?: SpecificChain,
  ): PriceReport | null {
    const normalizedAddress = tokenAddress.toLowerCase();

    // Determine which chain to look up: provided chain or known chain
    const chainToLookup =
      specificChain || this.getCachedChain(normalizedAddress);
    if (!chainToLookup) {
      return null;
    }

    const cacheKey = this.getCacheKey(normalizedAddress, chainToLookup);
    const cached = this.tokenPriceCache.get(cacheKey);

    if (cached && this.isPriceFresh(cached.timestamp)) {
      serviceLogger.debug(
        `[PriceTracker] Using cached price for ${normalizedAddress} on ${chainToLookup}: $${cached.price}`,
      );
      return cached;
    }

    return null;
  }

  /**
   * Cache token price and its chain
   */
  private setCachedPrice(priceReport: PriceReport): void {
    const normalizedAddress = priceReport.token.toLowerCase();
    const cacheKey = this.getCacheKey(
      normalizedAddress,
      priceReport.specificChain,
    );

    this.tokenPriceCache.set(cacheKey, priceReport);

    // Also cache the token-to-chain mapping for future lookups
    if (priceReport.chain === BlockchainType.EVM) {
      this.chainToTokenCache.set(normalizedAddress, priceReport.specificChain);
    }

    serviceLogger.debug(
      `[PriceTracker] Cached price for ${normalizedAddress} on ${priceReport.specificChain}: $${priceReport.price}`,
    );
  }

  /**
   * Resolve which specific chain to try for a token
   * @param tokenAddress The token address
   * @param providedSpecificChain The specific chain provided by caller (if any)
   * @returns The specific chain to try (provided, cached, or undefined for multi-chain search)
   */
  private resolveSpecificChainToTry(
    tokenAddress: string,
    providedSpecificChain?: SpecificChain,
  ): SpecificChain | undefined {
    // If a specific chain was provided, use it
    if (providedSpecificChain) {
      return providedSpecificChain;
    }

    // Try cached chain if available (optimization)
    const cachedChain = this.getCachedChain(tokenAddress);
    if (cachedChain) {
      serviceLogger.debug(
        `[PriceTracker] Using cached chain ${cachedChain} for token ${tokenAddress}`,
      );
      return cachedChain;
    }

    // No specific chain - let MultiChainProvider try all chains
    return undefined;
  }

  /**
   * Fetch price from MultiChainProvider and cache the result
   * @param tokenAddress The token address
   * @param blockchainType The blockchain type
   * @param specificChain The specific chain to try (or undefined for multi-chain search)
   * @returns The price result or null if not available
   */
  private async fetchAndCachePrice(
    tokenAddress: string,
    blockchainType: BlockchainType,
    specificChain?: SpecificChain,
  ): Promise<PriceReport | null> {
    if (!this.multiChainProvider) {
      serviceLogger.error(`[PriceTracker] No MultiChainProvider available`);
      return null;
    }

    try {
      const apiType = specificChain
        ? `specific chain ${specificChain}`
        : "multi-chain search";

      serviceLogger.debug(
        `[PriceTracker] Fetching live price from API for token ${tokenAddress} using ${apiType}`,
      );

      const priceResult = await this.multiChainProvider.getPrice(
        tokenAddress,
        blockchainType,
        specificChain,
      );

      if (!priceResult) {
        serviceLogger.debug(
          `[PriceTracker] No price available from API for ${tokenAddress}`,
        );
        return null;
      }

      serviceLogger.debug(
        `[PriceTracker] Got price $${priceResult.price} from live API (chain: ${priceResult.specificChain})`,
      );

      // Cache in both memory and database
      this.setCachedPrice(priceResult);
      await this.storePrice(priceResult);

      return priceResult;
    } catch (error) {
      serviceLogger.error(
        `[PriceTracker] Error fetching price from API:`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return null;
    }
  }

  /**
   * Try to get batch prices using cached chains first
   * @param tokenAddresses Array of token addresses to try
   * @param resultMap Map to store successful results
   * @returns Array of token addresses that still need multi-chain search
   */
  private async tryBatchPricesWithCachedChains(
    tokenAddresses: string[],
    resultMap: Map<string, PriceReport | null>,
  ): Promise<string[]> {
    if (!this.multiChainProvider || tokenAddresses.length === 0) {
      return tokenAddresses;
    }

    // Group tokens by cached chain in a single pass
    const tokensByCachedChain = new Map<SpecificChain, string[]>();
    for (const addr of tokenAddresses) {
      const cachedChain = this.getCachedChain(addr);
      if (cachedChain) {
        if (!tokensByCachedChain.has(cachedChain)) {
          tokensByCachedChain.set(cachedChain, []);
        }
        tokensByCachedChain.get(cachedChain)!.push(addr);
      }
    }

    if (tokensByCachedChain.size === 0) {
      return tokenAddresses; // No tokens with cached chains
    }

    const successfulTokens = new Set<string>();

    // Try each cached chain group
    for (const [cachedChain, tokens] of tokensByCachedChain) {
      try {
        const chainType = this.determineChain(tokens[0]!);
        const cachedChainResults = await this.multiChainProvider.getBatchPrices(
          tokens,
          chainType,
          cachedChain,
        );

        // Process successful results
        for (const [tokenAddr, priceResult] of cachedChainResults) {
          if (priceResult) {
            resultMap.set(tokenAddr, priceResult);
            this.setCachedPrice(priceResult);
            await this.storePrice(priceResult);
            successfulTokens.add(tokenAddr);
          }
        }

        serviceLogger.debug(
          `[PriceTracker] Cached chain ${cachedChain}: ${successfulTokens.size} hits from ${tokens.length} tokens`,
        );
      } catch (error) {
        serviceLogger.debug(
          `[PriceTracker] Error with cached chain ${cachedChain}, tokens will fallback to multi-chain search:`,
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    }

    // Return tokens that still need multi-chain search
    return tokenAddresses.filter((addr) => !successfulTokens.has(addr));
  }

  /**
   * Fetch remaining tokens via multi-chain batch API as final fallback
   * @param remainingTokens Array of tokens that still need pricing
   * @param resultMap Map to store the results
   */
  private async fetchRemainingTokensViaBatch(
    remainingTokens: string[],
    resultMap: Map<string, PriceReport | null>,
  ): Promise<void> {
    if (remainingTokens.length === 0 || !this.multiChainProvider) {
      return;
    }

    try {
      serviceLogger.debug(
        `[PriceTracker] Fetching ${remainingTokens.length} tokens via batch API`,
      );

      // Group tokens by chain type for efficient batch processing
      const evmTokens = remainingTokens.filter(
        (addr) => this.determineChain(addr) === BlockchainType.EVM,
      );
      const svmTokens = remainingTokens.filter(
        (addr) => this.determineChain(addr) === BlockchainType.SVM,
      );

      // Process EVM tokens in batch
      if (evmTokens.length > 0) {
        const evmResults = await this.multiChainProvider.getBatchPrices(
          evmTokens,
          BlockchainType.EVM,
        );
        this.processBatchResults(evmResults, resultMap);
      }

      // Process SVM tokens in batch
      if (svmTokens.length > 0) {
        const svmResults = await this.multiChainProvider.getBatchPrices(
          svmTokens,
          BlockchainType.SVM,
        );
        this.processBatchResults(svmResults, resultMap);
      }
    } catch (error) {
      serviceLogger.error(
        `[PriceTracker] Error in batch API processing:`,
        error instanceof Error ? error.message : "Unknown error",
      );

      // Fallback: set remaining tokens to null
      for (const tokenAddress of remainingTokens) {
        if (!resultMap.has(tokenAddress)) {
          resultMap.set(tokenAddress, null);
        }
      }
    }
  }

  /**
   * Get the cached chain for a token if available
   */
  private getCachedChain(tokenAddress: string): SpecificChain | null {
    return this.chainToTokenCache.get(tokenAddress.toLowerCase()) || null;
  }

  /**
   * Check if a cached price is still fresh enough to use
   */
  private isPriceFresh(timestamp: Date): boolean {
    const priceAge = Date.now() - timestamp.getTime();
    return priceAge < config.portfolio.priceFreshnessMs;
  }
}
