import { PriceSource } from '../../types';
import axios from 'axios';
import { BlockchainType, PriceReport, SpecificChain } from '../../types';

interface RaydiumPool {
  liquidity: number;
  price: number;
  mint1: string;
}

interface RaydiumTokenPrice {
  symbol: string;
  price: string;
}

interface RaydiumPool {
  liquidity: number;
  price: number;
  mint1: string;
}

interface RaydiumTokenPrice {
  symbol: string;
  price: string;
}

/**
 * Raydium price provider implementation
 * Uses Raydium's API to get token prices
 */
export class RaydiumProvider implements PriceSource {
  private readonly API_BASE = 'https://api-v3.raydium.io';
  private cache: Map<string, { price: number; timestamp: number }>;
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  private readonly KNOWN_TOKENS: { [key: string]: { symbol: string } } = {
    So11111111111111111111111111111111111111112: { symbol: 'SOL' },
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC' },
    Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT' },
  };

  constructor() {
    this.cache = new Map();
  }

  getName(): string {
    return 'Raydium';
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getCachedPrice(tokenAddress: string): number | null {
    const cached = this.cache.get(tokenAddress);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.price;
    }
    return null;
  }

  private setCachedPrice(tokenAddress: string, price: number): void {
    this.cache.set(tokenAddress, {
      price,
      timestamp: Date.now(),
    });
  }

  async getPrice(
    tokenAddress: string,
    chain: BlockchainType = BlockchainType.SVM,
    specificChain: SpecificChain = 'svm',
  ): Promise<PriceReport | null> {
    try {
      // Check cache first
      const cachedPrice = this.getCachedPrice(tokenAddress);
      if (cachedPrice !== null) {
        console.log(`[RaydiumProvider] Using cached price for ${tokenAddress}: $${cachedPrice}`);
        return {
          token: tokenAddress,
          price: cachedPrice,
          timestamp: new Date(),
          chain,
          specificChain,
        };
      }

      console.log(`[RaydiumProvider] Fetching price for token: ${tokenAddress}`);

      if (tokenAddress === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
        // USDC should be ~$1
        try {
          const price = await this.fetchPriceFromAPI(tokenAddress);
          if (price !== null) {
            return {
              token: tokenAddress,
              price,
              timestamp: new Date(),
              chain,
              specificChain,
            };
          }

          // Fallback for USDC
          console.log('[RaydiumProvider] Using fallback price for USDC');
          const fallbackPrice = 0.99 + Math.random() * 0.02; // ~$0.99-1.01 range
          this.setCachedPrice(tokenAddress, fallbackPrice);
          return {
            token: tokenAddress,
            price: fallbackPrice,
            timestamp: new Date(),
            chain,
            specificChain,
          };
        } catch (error) {
          console.error('[RaydiumProvider] Error fetching USDC price, using fallback:', error);
          const fallbackPrice = 0.99 + Math.random() * 0.02; // ~$0.99-1.01 range
          this.setCachedPrice(tokenAddress, fallbackPrice);
          return {
            token: tokenAddress,
            price: fallbackPrice,
            timestamp: new Date(),
            chain,
            specificChain,
          };
        }
      }

      // For other tokens, try fetching from API
      const price = await this.fetchPriceFromAPI(tokenAddress);
      if (price === null) {
        return null;
      }
      return {
        token: tokenAddress,
        price,
        timestamp: new Date(),
        chain,
        specificChain,
      };
    } catch (error) {
      console.error(
        `[RaydiumProvider] Error fetching price for ${tokenAddress}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      return null;
    }
  }

  private async fetchPriceFromAPI(tokenAddress: string): Promise<number | null> {
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const url = `${this.API_BASE}/pools/info/mint?mint1=${tokenAddress}&poolType=all&sortField=tvl&sortType=desc&pageSize=10&page=1`;
        console.log(`[RaydiumProvider] Making API request to: ${url}`);

        const response = await axios.get(url, {
          timeout: 5000,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'TradingSimulator/1.0',
          },
        });

        if (!response.data?.data || response.data.data.length === 0) {
          if (attempt === this.MAX_RETRIES) {
            // Try alternative endpoint if we couldn't find pools
            return await this.fetchFromPriceAPI(tokenAddress);
          }
          console.log(`[RaydiumProvider] No pool data found for token, retrying...`);
          await this.delay(this.RETRY_DELAY * attempt);
          continue;
        }

        // Find the pool with highest liquidity
        const pools = response.data.data as RaydiumPool[];
        const bestPool = pools.sort(
          (a: RaydiumPool, b: RaydiumPool) => b.liquidity - a.liquidity,
        )[0];

        if (!bestPool || !bestPool.price) {
          if (attempt === this.MAX_RETRIES) {
            // Try alternative endpoint if we couldn't find a price
            return await this.fetchFromPriceAPI(tokenAddress);
          }
          console.log(`[RaydiumProvider] No price data found in pool, retrying...`);
          await this.delay(this.RETRY_DELAY * attempt);
          continue;
        }

        let price = 0;
        if (bestPool.mint1 === tokenAddress) {
          price = bestPool.price;
        } else {
          price = 1 / bestPool.price;
        }

        if (isNaN(price) || price <= 0) {
          console.log(`[RaydiumProvider] Invalid price format`);
          return null;
        }

        console.log(`[RaydiumProvider] Found price for ${tokenAddress}: $${price}`);
        this.setCachedPrice(tokenAddress, price);
        return price;
      } catch (error) {
        console.log(`[RaydiumProvider] Attempt ${attempt} failed, retrying...`);
        if (attempt === this.MAX_RETRIES) {
          // Try alternative endpoint as last resort
          return await this.fetchFromPriceAPI(tokenAddress);
        }
        await this.delay(this.RETRY_DELAY * attempt);
      }
    }
    return null;
  }

  // Alternative method to fetch from price API for known tokens
  private async fetchFromPriceAPI(tokenAddress: string): Promise<number | null> {
    // If this isn't a known token, don't try this method
    if (!this.KNOWN_TOKENS[tokenAddress]) {
      return null;
    }

    const symbol = this.KNOWN_TOKENS[tokenAddress].symbol;
    console.log(`[RaydiumProvider] Trying alternative price API for ${symbol}`);

    try {
      const url = `${this.API_BASE}/price`;
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'TradingSimulator/1.0',
        },
      });

      if (!response.data || !response.data.data) {
        console.log(`[RaydiumProvider] No data from price API`);
        return null;
      }

      // Find by symbol
      const tokenData = response.data.data.find((t: RaydiumTokenPrice) => t.symbol === symbol);
      if (!tokenData) {
        console.log(`[RaydiumProvider] Token ${symbol} not found in price API`);
        return null;
      }

      const price = parseFloat(tokenData.price);
      if (isNaN(price) || price <= 0) {
        console.log(`[RaydiumProvider] Invalid price format from price API`);
        return null;
      }

      console.log(`[RaydiumProvider] Found price for ${symbol} from price API: $${price}`);
      this.setCachedPrice(tokenAddress, price);
      return price;
    } catch (error) {
      console.error(
        `[RaydiumProvider] Error fetching from price API:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      return null;
    }
  }

  async supports(tokenAddress: string, specificChain: SpecificChain = 'svm'): Promise<boolean> {
    try {
      console.log(`[RaydiumProvider] Checking support for token: ${tokenAddress}`);
      // We only support SVM tokens
      if (specificChain !== 'svm') {
        return false;
      }

      if (this.getCachedPrice(tokenAddress) !== null) {
        return true;
      }

      // For known tokens, we'll always report support
      if (this.KNOWN_TOKENS[tokenAddress]) {
        return true;
      }

      const price = await this.getPrice(tokenAddress, BlockchainType.SVM, 'svm');
      return price !== null;
    } catch (error) {
      console.error(
        `[RaydiumProvider] Error checking token support:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      return false;
    }
  }
}
