import { LRUCache } from "lru-cache";
import { Logger } from "pino";

import { MultiChainProvider } from "./providers/multi-chain.provider.js";
import {
  BlockchainType,
  PriceReport,
  PriceSource,
  SpecificChain,
  TokenPriceRequest,
} from "./types/index.js";

export interface PriceTrackerServiceConfig {
  priceTracker: {
    maxCacheSize: number;
    priceTTLMs: number;
  };
}

/**
 * Price Tracker Service
 * Fetches and caches token prices from multiple providers
 */
export class PriceTrackerService {
  providers: PriceSource[];
  private multiChainProvider: MultiChainProvider;

  // In-memory LRU cache for token prices
  private readonly tokenPriceCache: LRUCache<string, PriceReport>;

  // Track which chain a token belongs to for quicker lookups
  private readonly chainToTokenCache: LRUCache<string, SpecificChain>;

  private logger: Logger;

  constructor(
    multiChainProvider: MultiChainProvider,
    config: PriceTrackerServiceConfig,
    logger: Logger,
  ) {
    // Initialize LRU caches
    this.tokenPriceCache = new LRUCache<string, PriceReport>({
      max: config.priceTracker.maxCacheSize,
      ttl: config.priceTracker.priceTTLMs,
    });

    this.chainToTokenCache = new LRUCache<string, SpecificChain>({
      max: config.priceTracker.maxCacheSize,
      // No TTL - chain mappings are permanent
    });

    // Initialize only the MultiChainProvider
    this.multiChainProvider = multiChainProvider;
    this.logger = logger;

    // Set up providers (now just MultiChainProvider)
    this.providers = [];

    // Add MultiChainProvider as the only provider
    if (this.multiChainProvider) {
      this.providers.push(this.multiChainProvider);
    }

    this.logger.debug(
      `[PriceTracker] Initialized with ${this.providers.length} providers`,
    );
    this.providers.forEach((p) =>
      this.logger.debug(`[PriceTracker] Loaded provider: ${p.getName()}`),
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
    this.logger.debug(
      `[PriceTracker] Getting price for token: ${tokenAddress}`,
    );

    // Determine which chain this token belongs to if not provided
    const tokenChain = blockchainType || this.determineChain(tokenAddress);

    // For Solana tokens, the specificChain is always "svm"
    if (tokenChain === BlockchainType.SVM && !specificChain) {
      specificChain = "svm";
    }

    this.logger.debug(
      `[PriceTracker] ${blockchainType ? "Using provided" : "Detected"} token ${tokenAddress} on chain: ${tokenChain}`,
    );

    // Check in-memory cache first
    const cachedPrice = this.getCachedPrice(tokenAddress, specificChain);
    if (cachedPrice) {
      return cachedPrice;
    }

    // Determine which specific chain to try (cached chain first, then fallback)
    const chainToTry = this.resolveSpecificChainToTry(
      tokenAddress,
      specificChain,
    );

    // Fetch from live API via MultiChainProvider
    return await this.fetchAndCachePrice(tokenAddress, tokenChain, chainToTry);
  }

  /**
   * Get detailed token and price information for multiple token+chain combinations in bulk
   * @param requests Array of token price requests with chain specificity
   * @returns Map of "${tokenAddress}:${chain}" to price info (null if not available)
   */
  async getBulkPrices(
    requests: TokenPriceRequest[],
  ): Promise<Map<string, PriceReport | null>> {
    this.logger.debug(
      `[PriceTracker] Getting bulk prices for ${requests.length} token+chain combinations`,
    );

    const resultMap = new Map<string, PriceReport | null>();

    if (requests.length === 0) {
      return resultMap;
    }

    // Check in-memory cache for all token+chain combinations
    const requestsNeedingAPI: TokenPriceRequest[] = [];
    let cacheHits = 0;

    for (const request of requests) {
      const cachedPrice = this.getCachedPrice(
        request.tokenAddress,
        request.specificChain,
      );

      const mapKey = this.getCacheKey(
        request.tokenAddress,
        request.specificChain,
      );

      if (cachedPrice) {
        resultMap.set(mapKey, cachedPrice);
        cacheHits++;
      } else {
        requestsNeedingAPI.push(request);
      }
    }

    // Fetch remaining prices from API in batches by chain
    await this.fetchRequestsViaBatch(requestsNeedingAPI, resultMap);

    const successfulPrices = Array.from(resultMap.values()).filter(
      (v) => v !== null,
    ).length;

    this.logger.debug(
      `[PriceTracker] Bulk price retrieval complete: ${successfulPrices}/${requests.length} token+chain combinations ` +
        `(${cacheHits} cache hits, ${requestsNeedingAPI.length} API requests)`,
    );

    return resultMap;
  }

  /**
   * Check if price tracker is healthy
   * For system health check use
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Check if provider is responsive
      if (this.multiChainProvider) {
        try {
          // Try to get a price as a simple test - use ETH since it's widely available
          const price = await this.multiChainProvider.getPrice(
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
          );
          return price !== null;
        } catch (error) {
          this.logger.error(
            { error },
            "[PriceTracker] Health check failed on price fetch:",
          );
          return false;
        }
      }

      return false;
    } catch (error) {
      this.logger.error({ error }, "[PriceTracker] Health check failed");
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
  getCachedPrice(
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

    if (cached) {
      this.logger.debug(
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

    this.logger.debug(
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
      this.logger.debug(
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
      this.logger.error(`[PriceTracker] No MultiChainProvider available`);
      return null;
    }

    try {
      const apiType = specificChain
        ? `specific chain ${specificChain}`
        : "multi-chain search";

      this.logger.debug(
        `[PriceTracker] Fetching live price from API for token ${tokenAddress} using ${apiType}`,
      );

      const priceResult = await this.multiChainProvider.getPrice(
        tokenAddress,
        blockchainType,
        specificChain,
      );

      if (!priceResult) {
        this.logger.debug(
          `[PriceTracker] No price available from API for ${tokenAddress}`,
        );
        return null;
      }

      this.logger.debug(
        `[PriceTracker] Got price $${priceResult.price} from live API (chain: ${priceResult.specificChain})`,
      );

      // Cache in memory
      this.setCachedPrice(priceResult);

      return priceResult;
    } catch (error) {
      this.logger.error(
        { error },
        `[PriceTracker] Error fetching price from API:`,
      );
      return null;
    }
  }

  /**
   * Fetch prices for token+chain requests via batch API grouped by chain
   * @param requests Array of token price requests to fetch
   * @param resultMap Map to store the results with chain-specific keys
   */
  private async fetchRequestsViaBatch(
    requests: TokenPriceRequest[],
    resultMap: Map<string, PriceReport | null>,
  ): Promise<void> {
    if (requests.length === 0 || !this.multiChainProvider) {
      return;
    }

    // Group requests by specificChain for efficient batch processing
    const requestsByChain = new Map<SpecificChain, TokenPriceRequest[]>();
    for (const request of requests) {
      if (!requestsByChain.has(request.specificChain)) {
        requestsByChain.set(request.specificChain, []);
      }
      requestsByChain.get(request.specificChain)!.push(request);
    }

    this.logger.debug(
      `[PriceTracker] Fetching ${requests.length} token+chain combinations across ${requestsByChain.size} chains`,
    );

    // Process each chain's requests in parallel
    const chainPromises = Array.from(requestsByChain.entries()).map(
      async ([chain, chainRequests]) => {
        try {
          const chainType = this.determineChain(chainRequests[0]!.tokenAddress);
          const tokenAddresses = chainRequests.map((r) => r.tokenAddress);

          const batchResults = await this.multiChainProvider.getBatchPrices(
            tokenAddresses,
            chainType,
            chain,
          );

          // Process results and cache with chain-specific keys
          for (const request of chainRequests) {
            const priceResult = batchResults.get(request.tokenAddress);
            const mapKey = this.getCacheKey(
              request.tokenAddress,
              request.specificChain,
            );

            if (priceResult) {
              // Cache in memory
              this.setCachedPrice(priceResult);
              resultMap.set(mapKey, priceResult);

              this.logger.debug(
                `[PriceTracker] Got price from batch API for ${request.tokenAddress} on ${chain}: $${priceResult.price}`,
              );
            } else {
              resultMap.set(mapKey, null);
            }
          }
        } catch (error) {
          this.logger.error(
            { error, chain },
            `[PriceTracker] Error fetching batch prices for chain:`,
          );

          // Set all requests for this chain to null on error
          for (const request of chainRequests) {
            const mapKey = this.getCacheKey(
              request.tokenAddress,
              request.specificChain,
            );
            if (!resultMap.has(mapKey)) {
              resultMap.set(mapKey, null);
            }
          }
        }
      },
    );

    await Promise.all(chainPromises);
  }

  /**
   * Get the cached chain for a token if available
   */
  private getCachedChain(tokenAddress: string): SpecificChain | null {
    return this.chainToTokenCache.get(tokenAddress.toLowerCase()) || null;
  }
}
