import { LRUCache } from "lru-cache";
import { Logger } from "pino";

import { MultiChainProvider } from "./providers/multi-chain.provider.js";
import {
  BlockchainType,
  PriceReport,
  PriceSource,
  SpecificChain,
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
   * Get detailed token and price information for multiple tokens in bulk
   * @param tokenAddresses Array of token addresses to get info for
   * @returns Map of token address to token info (null if not available)
   */
  async getBulkPrices(
    tokenAddresses: string[],
  ): Promise<Map<string, PriceReport | null>> {
    this.logger.debug(
      `[PriceTracker] Getting bulk prices for ${tokenAddresses.length} tokens`,
    );

    const resultMap = new Map<string, PriceReport | null>();

    if (tokenAddresses.length === 0) {
      return resultMap;
    }

    // Check in-memory cache for all tokens
    const tokensNeedingAPI: string[] = [];
    let cacheHits = 0;

    for (const tokenAddress of tokenAddresses) {
      // Determine the specific chain for proper cache lookup
      const tokenChain = this.determineChain(tokenAddress);
      let specificChain: SpecificChain | undefined;
      if (tokenChain === BlockchainType.SVM) {
        specificChain = "svm";
      }

      const cachedPrice = this.getCachedPrice(tokenAddress, specificChain);
      if (cachedPrice) {
        resultMap.set(tokenAddress, cachedPrice);
        cacheHits++;
      } else {
        tokensNeedingAPI.push(tokenAddress);
      }
    }

    // Try cached chains first for tokens with known chain mappings (optimization)
    const remainingTokensForBatch = await this.tryBatchPricesWithCachedChains(
      tokensNeedingAPI,
      resultMap,
    );

    // Use batch API for remaining tokens (preserving batching efficiency)
    await this.fetchRemainingTokensViaBatch(remainingTokensForBatch, resultMap);

    const successfulPrices = Array.from(resultMap.values()).filter(
      (v) => v !== null,
    ).length;

    this.logger.debug(
      `[PriceTracker] Bulk price retrieval complete: ${successfulPrices}/${tokenAddresses.length} tokens ` +
        `(${cacheHits} cache hits, ${tokensNeedingAPI.length} API requests)`,
    );

    return resultMap;
  }

  /**
   * Process batch results from MultiChainProvider and cache them
   * @param batchResults Results from getBatchPrices
   * @param resultMap Map to store the final results
   */
  private async processBatchResults(
    batchResults: Map<string, PriceReport | null>,
    resultMap: Map<string, PriceReport | null>,
  ): Promise<void> {
    for (const [tokenAddress, priceReport] of batchResults) {
      if (priceReport) {
        // Cache in memory
        this.setCachedPrice(priceReport);

        this.logger.debug(
          `[PriceTracker] Got price from batch API for ${tokenAddress}: $${priceReport.price}`,
        );
      }

      resultMap.set(tokenAddress, priceReport);
    }
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
        tokensByCachedChain.get(cachedChain)?.push(addr);
      }
    }

    if (tokensByCachedChain.size === 0) {
      return tokenAddresses; // No tokens with cached chains
    }

    const successfulTokens = new Set<string>();

    // Try each cached chain group
    for (const [cachedChain, tokens] of tokensByCachedChain) {
      try {
        const firstToken = tokens[0];
        if (!firstToken) {
          continue;
        }

        const chainType = this.determineChain(firstToken);
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
            successfulTokens.add(tokenAddr);
          }
        }

        this.logger.debug(
          `[PriceTracker] Cached chain ${cachedChain}: ${successfulTokens.size} hits from ${tokens.length} tokens`,
        );
      } catch (error) {
        this.logger.debug(
          { error },
          `[PriceTracker] Error with cached chain ${cachedChain}, tokens will fallback to multi-chain search:`,
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
      this.logger.debug(
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
        await this.processBatchResults(evmResults, resultMap);
      }

      // Process SVM tokens in batch
      if (svmTokens.length > 0) {
        const svmResults = await this.multiChainProvider.getBatchPrices(
          svmTokens,
          BlockchainType.SVM,
          "svm", // For SVM tokens, specificChain is always "svm"
        );
        await this.processBatchResults(svmResults, resultMap);
      }
    } catch (error) {
      this.logger.error(
        { error },
        `[PriceTracker] Error in batch API processing:`,
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
}
