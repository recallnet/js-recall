import { PriceSource, BlockchainType, SpecificChain, PriceReport } from '../types';
import { MultiChainProvider } from './providers/multi-chain.provider';
import { config } from '../config';
import { repositories } from '../database';
import { PriceRecord } from '../database/types';

/**
 * Price Tracker Service
 * Fetches and caches token prices from multiple providers
 */
export class PriceTracker {
  private providers: PriceSource[];
  // private novesProvider: NovesProvider | null = null;
  private multiChainProvider: MultiChainProvider | null = null;
  private priceCache: Map<string, PriceReport>;
  private readonly CACHE_DURATION = config.priceCacheDuration; // 30 seconds

  constructor() {
    // Initialize only the MultiChainProvider
    this.multiChainProvider = new MultiChainProvider();
    console.log('[PriceTracker] Initialized MultiChainProvider for all token price fetching');

    // Set up providers (now just MultiChainProvider)
    this.providers = [];

    // Add MultiChainProvider as the only provider
    if (this.multiChainProvider) {
      this.providers.push(this.multiChainProvider);
    }

    this.priceCache = new Map();

    console.log(`[PriceTracker] Initialized with ${this.providers.length} providers`);
    this.providers.forEach((p) => console.log(`[PriceTracker] Loaded provider: ${p.getName()}`));
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
    return this.providers.find((p) => p.getName().toLowerCase() === name.toLowerCase()) || null;
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
    console.log(`[PriceTracker] Getting price for token: ${tokenAddress}`);

    // Determine which chain this token belongs to if not provided
    const tokenChain = blockchainType || this.determineChain(tokenAddress);
    console.log(
      `[PriceTracker] ${blockchainType ? 'Using provided' : 'Detected'} token ${tokenAddress} on chain: ${tokenChain}`,
    );

    // Check cache first
    const cacheKey = `${tokenChain}:${tokenAddress}`;
    const cached = this.priceCache.get(cacheKey);
    if (cached && Date.now() - new Date(cached.timestamp).getTime() < this.CACHE_DURATION) {
      console.log(
        `[PriceTracker] Using cached price for ${tokenAddress} on ${tokenChain}: $${cached.price}`,
      );
      return cached;
    }

    // If no cache hit, use MultiChainProvider
    if (this.multiChainProvider) {
      try {
        console.log(`[PriceTracker] Using MultiChainProvider for token ${tokenAddress}`);

        // Get price from MultiChainProvider
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

          console.log(`[PriceTracker] Got price $${price} from MultiChainProvider`);

          // Store price in cache
          this.priceCache.set(cacheKey, priceResult);

          // Store price in database for historical record
          await this.storePrice(tokenAddress, price, chain, tokenSpecificChain);

          return priceResult;
        } else {
          console.log(
            `[PriceTracker] No price available from MultiChainProvider for ${tokenAddress}`,
          );
        }
      } catch (error) {
        console.error(
          `[PriceTracker] Error fetching price from MultiChainProvider:`,
          error instanceof Error ? error.message : 'Unknown error',
        );
      }
    }

    console.log(`[PriceTracker] No price available for ${tokenAddress}`);

    // As a last resort, try to get the most recent price from the database
    try {
      const lastPrice = await repositories.priceRepository.getLatestPrice(tokenAddress);
      if (lastPrice) {
        console.log(
          `[PriceTracker] Using last stored price for ${tokenAddress}: $${lastPrice.price} (WARNING: not real-time price)`,
        );
        return {
          price: lastPrice.price,
          token: lastPrice.token,
          chain: lastPrice.chain,
          timestamp: lastPrice.timestamp,
          specificChain: lastPrice.specificChain,
        };
      }
    } catch (error) {
      console.error(`[PriceTracker] Error fetching last price from database:`, error);
    }

    return null;
  }

  /**
   * Get detailed token information including which chain it's on and its price
   * @param tokenAddress The token address to get info for
   * @param blockchainType Optional blockchain type override (EVM or SVM)
   * @param specificChain Optional specific chain override (eth, polygon, etc.)
   * @returns Object containing token price and chain information or null
   */
  async getTokenInfo(
    tokenAddress: string,
    blockchainType?: BlockchainType,
    specificChain?: SpecificChain,
  ): Promise<{
    price: number;
    chain: BlockchainType;
    specificChain: SpecificChain;
  } | null> {
    console.log(`[PriceTracker] Getting detailed token info for: ${tokenAddress}`);

    // Use provided chain type or detect it
    const chainType = blockchainType || this.determineChain(tokenAddress);

    // For Solana tokens, return basic info
    if (chainType === BlockchainType.SVM) {
      const price = await this.getPrice(tokenAddress, chainType, specificChain);
      // Make sure we store the specificChain for SVM tokens
      if (price !== null) {
        // Store the SVM chain info explicitly (getPrice may already do this, but we ensure it here)
        await this.storePrice(tokenAddress, price.price, BlockchainType.SVM, 'svm');
        return {
          price: price.price,
          chain: BlockchainType.SVM,
          specificChain: 'svm',
        };
      }
      return null;
    }

    // Use MultiChainProvider for EVM tokens
    if (this.multiChainProvider && chainType === BlockchainType.EVM) {
      try {
        // Pass specificChain to getTokenInfo if provided
        const tokenInfo = await this.multiChainProvider.getTokenInfo(
          tokenAddress,
          chainType,
          specificChain,
        );

        if (tokenInfo) {
          // Store the chain info in our database to avoid future API calls
          if (tokenInfo.price !== null) {
            await this.storePrice(
              tokenAddress,
              tokenInfo.price,
              tokenInfo.chain,
              tokenInfo.specificChain,
            );
          }

          return {
            price: tokenInfo.price,
            chain: tokenInfo.chain,
            specificChain: tokenInfo.specificChain,
          };
        }
      } catch (error) {
        console.log(`[PriceTracker] Failed to get token info from MultiChainProvider: ${error}`);
      }
    }

    // If MultiChainProvider failed or returned null, try to get just the price
    console.log(
      `[PriceTracker] Falling back to just getting price for token info: ${tokenAddress}`,
    );
    const price = await this.getPrice(tokenAddress, chainType, specificChain);

    if (price !== null) {
      // Return combined token info
      return {
        price: price.price,
        chain: price.chain,
        specificChain: price.specificChain,
      };
    }
    return null;
  }

  /**
   * Store price data in the database
   * @param tokenAddress The token address
   * @param price The price in USD
   * @param chain The blockchain type (optional)
   * @param specificChain The specific chain (optional)
   */
  private async storePrice(
    tokenAddress: string,
    price: number,
    chain: BlockchainType,
    specificChain: SpecificChain,
  ): Promise<void> {
    try {
      await repositories.priceRepository.create({
        token: tokenAddress,
        price,
        timestamp: new Date(),
        chain,
        specificChain,
      });
    } catch (error) {
      console.error(`[PriceTracker] Error storing price in database:`, error);
    }
  }

  /**
   * Check if a token is supported by the provider
   * @param tokenAddress The token address to check
   * @returns True if the provider supports the token
   */
  async isTokenSupported(tokenAddress: string, specificChain: SpecificChain): Promise<boolean> {
    if (!this.multiChainProvider) {
      return false;
    }

    try {
      return await this.multiChainProvider.supports(tokenAddress, specificChain);
    } catch (error) {
      console.log(
        `[PriceTracker] Error checking support for ${tokenAddress}:`,
        error instanceof Error ? error.message : 'Unknown error',
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
    console.log(`[PriceTracker] Getting price history for ${tokenAddress} (${timeframe})`);

    try {
      // Convert timeframe to hours for database query
      let hours = 24; // Default to 24 hours

      if (timeframe === '7d') hours = 24 * 7;
      else if (timeframe === '30d') hours = 24 * 30;
      else if (timeframe === '1h') hours = 1;
      else if (timeframe === '6h') hours = 6;

      // Get historical data from database
      const history = await repositories.priceRepository.getPriceHistory(tokenAddress, hours);

      if (history && history.length > 0) {
        console.log(
          `[PriceTracker] Retrieved ${history.length} historical price points from database`,
        );
        return history.map((point: PriceRecord) => ({
          timestamp: point.timestamp.toISOString(),
          price: point.price,
        }));
      }
    } catch (error) {
      console.error(`[PriceTracker] Error fetching price history:`, error);
    }

    // If we don't have enough historical data in the database or an error occurred,
    // generate mock data based on current price, but only if allowed
    if (!allowMockData) {
      console.log(
        `[PriceTracker] No historical data available and mock data generation is disabled`,
      );
      return null;
    }

    console.log(
      `[PriceTracker] WARNING: Generating SIMULATED price history data (not real market data)`,
    );
    const currentPrice = await this.getPrice(tokenAddress);
    if (!currentPrice) return null;

    // Convert timeframe to number of data points
    let dataPoints = 24; // Default for 24h
    let intervalMs = 3600 * 1000; // 1 hour in milliseconds

    if (timeframe === '7d') {
      dataPoints = 7 * 24;
      intervalMs = 3600 * 1000; // 1 hour
    } else if (timeframe === '30d') {
      dataPoints = 30;
      intervalMs = 24 * 3600 * 1000; // 1 day
    } else if (timeframe === '1h') {
      dataPoints = 12;
      intervalMs = 5 * 60 * 1000; // 5 minutes
    } else if (timeframe === '6h') {
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

    console.log(
      `[PriceTracker] Generated ${dataPoints} simulated data points for ${timeframe} timeframe`,
    );
    return history.reverse(); // Return in chronological order
  }

  /**
   * Clear the price cache
   */
  clearCache(): void {
    console.log(`[PriceTracker] Clearing price cache`);
    this.priceCache.clear();
  }

  /**
   * Check if price tracker is healthy
   * For system health check use
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Check if database is accessible
      await repositories.priceRepository.count();

      // Check if provider is responsive
      if (this.multiChainProvider) {
        try {
          // Try to get a price as a simple test - use ETH since it's widely available
          const price = await this.multiChainProvider.getPrice(
            '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          );
          return price !== null;
        } catch (error) {
          console.error('[PriceTracker] Health check failed on price fetch:', error);
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error('[PriceTracker] Health check failed:', error);
      return false;
    }
  }
}
