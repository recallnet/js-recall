import { PriceReport, PriceSource } from '../../types';
import { BlockchainType, SpecificChain } from '../../types';
import axios from 'axios';
import config from '../../config';

/**
 * DexScreener price provider implementation
 * Uses DexScreener API to get token prices across multiple chains
 */
export class DexScreenerProvider implements PriceSource {
  private readonly API_BASE = 'https://api.dexscreener.com/tokens/v1';
  private cache: Map<string, PriceReport>;
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 100;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  // Mapping for DexScreener specific chain names
  private readonly chainMapping: Record<SpecificChain, string> = {
    eth: 'ethereum',
    polygon: 'polygon',
    bsc: 'bsc',
    arbitrum: 'arbitrum',
    optimism: 'optimism',
    avalanche: 'avalanche',
    base: 'base',
    linea: 'linea',
    zksync: 'zksync',
    scroll: 'scroll',
    mantle: 'mantle',
    svm: 'solana',
  };

  constructor() {
    this.cache = new Map();
  }

  getName(): string {
    return 'DexScreener';
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      await this.delay(this.MIN_REQUEST_INTERVAL - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();
  }

  private getCachedPrice(tokenAddress: string, chain: string): PriceReport | null {
    const cacheKey = `${chain}:${tokenAddress}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_DURATION) {
      return cached;
    }
    return null;
  }

  private setCachedPrice(
    tokenAddress: string,
    chain: BlockchainType,
    price: number,
    specificChain: SpecificChain,
  ): void {
    const cacheKey = `${chain}:${tokenAddress}`;
    this.cache.set(cacheKey, {
      token: tokenAddress,
      price,
      timestamp: new Date(),
      chain,
      specificChain,
    });
  }

  determineChain(tokenAddress: string): BlockchainType {
    // Simple heuristic: Solana tokens don't start with '0x'
    if (!tokenAddress.startsWith('0x')) {
      return BlockchainType.SVM;
    }
    return BlockchainType.EVM;
  }

  /**
   * Convert a BlockchainType and SpecificChain to the correct chain identifier for DexScreener API
   */
  private getDexScreenerChain(
    tokenAddress: string,
    chain: BlockchainType,
    specificChain: SpecificChain,
  ): string {
    return this.chainMapping[specificChain];
  }

  /**
   * Determine if a token is a stablecoin (USDC, USDT, etc.)
   */
  private isStablecoin(tokenAddress: string, specificChain: SpecificChain): boolean {
    // Check if this specific chain exists in our config
    if (!(specificChain in config.specificChainTokens)) return false;

    const chainTokens =
      config.specificChainTokens[specificChain as keyof typeof config.specificChainTokens];

    const normalizedAddress = tokenAddress.toLowerCase();
    return (
      normalizedAddress === chainTokens.usdc?.toLowerCase() ||
      normalizedAddress === chainTokens.usdt?.toLowerCase()
    );
  }

  /**
   * Get the best trading pair for price fetching based on the token and chain
   */
  private getBestPairForPrice(tokenAddress: string, specificChain: SpecificChain): string | null {
    // Check if this specific chain exists in our config
    if (!(specificChain in config.specificChainTokens)) return null;

    const chainTokens =
      config.specificChainTokens[specificChain as keyof typeof config.specificChainTokens];

    const normalizedAddress = tokenAddress.toLowerCase();

    // If token is USDC, pair it with USDT
    if (normalizedAddress === chainTokens.usdc?.toLowerCase() && chainTokens.usdt) {
      return `${chainTokens.usdc},${chainTokens.usdt}`;
    }

    // If token is USDT, pair it with USDC
    if (normalizedAddress === chainTokens.usdt?.toLowerCase() && chainTokens.usdc) {
      return `${chainTokens.usdt},${chainTokens.usdc}`;
    }

    // For other tokens, pair with USDC
    return `${tokenAddress},${chainTokens.usdc}`;
  }

  /**
   * Fetch token price from DexScreener API
   */
  private async fetchPrice(
    tokenAddress: string,
    dexScreenerChain: string,
    specificChain: SpecificChain,
  ): Promise<number | null> {
    // Try to get a better pairing for the token
    const pairTokens = this.getBestPairForPrice(tokenAddress, specificChain);

    if (!pairTokens) {
      console.log(
        `[DexScreenerProvider] Could not determine a suitable token pair for ${tokenAddress} on ${dexScreenerChain}`,
      );
      return null;
    }

    // Construct the URL with the token pair
    const url = `${this.API_BASE}/${dexScreenerChain}/${pairTokens}`;
    console.log(`[DexScreenerProvider] Fetching price from: ${url}`);

    let retries = 0;
    while (retries <= this.MAX_RETRIES) {
      try {
        // Enforce rate limiting
        await this.enforceRateLimit();

        // Make the API request
        const response = await axios.get(url);

        // Check if response has data
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          const normalizedAddress = tokenAddress.toLowerCase();
          const tokenIsStablecoin = this.isStablecoin(tokenAddress, specificChain);

          // For regular tokens, find a pair where our token is the base token
          if (!tokenIsStablecoin) {
            const tokenAsPair = response.data.find(
              (pair) =>
                pair.baseToken?.address?.toLowerCase() === normalizedAddress &&
                pair.priceUsd &&
                !isNaN(parseFloat(pair.priceUsd)),
            );

            if (tokenAsPair) {
              console.log(
                `[DexScreenerProvider] Found price for ${tokenAddress} as base token: $${tokenAsPair.priceUsd}`,
              );
              return parseFloat(tokenAsPair.priceUsd);
            }
          } else {
            // For stablecoins, we need more careful handling
            const chainTokens =
              config.specificChainTokens[specificChain as keyof typeof config.specificChainTokens];

            // Find the best pair for stablecoin pricing
            const stablecoinPair = response.data.find((pair) => {
              // First, ensure our token appears in the pair
              const ourTokenIsBase = pair.baseToken?.address?.toLowerCase() === normalizedAddress;
              const ourTokenIsQuote = pair.quoteToken?.address?.toLowerCase() === normalizedAddress;

              // If our token doesn't appear in this pair, skip it
              if (!ourTokenIsBase && !ourTokenIsQuote) return false;

              // Check if it has a valid price
              if (!pair.priceUsd || isNaN(parseFloat(pair.priceUsd))) return false;

              // Our token is the base token - this is ideal
              if (ourTokenIsBase) return true;

              // If our token is the quote token, it should be paired with a known stablecoin
              // to ensure accurate pricing
              if (ourTokenIsQuote) {
                const pairedWithUsdc =
                  pair.baseToken?.address?.toLowerCase() === chainTokens.usdc?.toLowerCase();
                const pairedWithUsdt =
                  pair.baseToken?.address?.toLowerCase() === chainTokens.usdt?.toLowerCase();
                return pairedWithUsdc || pairedWithUsdt;
              }

              return false;
            });

            if (stablecoinPair) {
              // Determine the correct price based on whether our token is base or quote
              const ourTokenIsBase =
                stablecoinPair.baseToken?.address?.toLowerCase() === normalizedAddress;

              if (ourTokenIsBase) {
                // If our token is the base token, use the price directly
                console.log(
                  `[DexScreenerProvider] Found stablecoin ${tokenAddress} as base token: $${stablecoinPair.priceUsd}`,
                );
                return parseFloat(stablecoinPair.priceUsd);
              } else {
                // For stablecoins that are quote tokens, we need to calculate the inverse price
                // Most stablecoin/stablecoin pairs are approximately 1:1
                console.log(
                  `[DexScreenerProvider] Found stablecoin ${tokenAddress} as quote token paired with another stablecoin`,
                );

                // For USDT/USDC pairs, price is usually very close to 1
                // But to be more accurate, we could calculate the inverse: 1 / priceNative
                if (stablecoinPair.priceNative) {
                  const inversePrice = 1 / parseFloat(stablecoinPair.priceNative);
                  console.log(
                    `[DexScreenerProvider] Calculated inverse price for stablecoin as quote token: $${inversePrice}`,
                  );
                  return inversePrice;
                }

                // Fallback to approximate price if we can't calculate the inverse
                return 1.0;
              }
            }
          }

          // If we couldn't find a suitable pair, log and return null
          console.log(
            `[DexScreenerProvider] No suitable pairs found for ${tokenAddress} on ${dexScreenerChain}`,
          );
        }

        // If no valid price found in response
        console.log(`[DexScreenerProvider] No valid price found for ${tokenAddress}`);
        return null;
      } catch (error) {
        console.error(
          `Error fetching price from DexScreener for ${tokenAddress} on ${dexScreenerChain}:`,
          error,
        );
        retries++;

        // If we haven't reached the max retries, delay and try again
        if (retries <= this.MAX_RETRIES) {
          await this.delay(this.RETRY_DELAY);
        }
      }
    }

    // If all retries failed
    console.log(
      `[DexScreenerProvider] No reliable price found for ${tokenAddress} after ${this.MAX_RETRIES} retries`,
    );
    return null;
  }

  /**
   * Get the price of a token
   */
  async getPrice(
    tokenAddress: string,
    chain: BlockchainType,
    specificChain: SpecificChain,
  ): Promise<PriceReport | null> {
    // Determine chain if not provided
    if (!chain) {
      chain = this.determineChain(tokenAddress);
    }

    // Get the DexScreener chain identifier
    const dexScreenerChain = this.getDexScreenerChain(tokenAddress, chain, specificChain);

    // Check cache first
    const cachedPrice = this.getCachedPrice(tokenAddress, dexScreenerChain);
    if (cachedPrice !== null) {
      return cachedPrice;
    }

    // Fetch the price
    const price = await this.fetchPrice(tokenAddress, dexScreenerChain, specificChain);

    // Cache the result if we got a valid price
    if (price !== null) {
      this.setCachedPrice(tokenAddress, chain, price, specificChain);
      return {
        price,
        token: tokenAddress,
        timestamp: new Date(),
        chain,
        specificChain,
      };
    }
    return null;
  }

  /**
   * Check if the provider supports this token
   */
  async supports(tokenAddress: string, specificChain: SpecificChain): Promise<boolean> {
    const chain = this.determineChain(tokenAddress);

    // Try to get a price - if successful, we support it
    const price = await this.getPrice(tokenAddress, chain, specificChain);
    return price !== null;
  }
}
