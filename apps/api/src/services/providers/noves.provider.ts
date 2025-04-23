import { PriceSource } from '../../types';
import { BlockchainType, SpecificChain, PriceReport } from '../../types';
import axios from 'axios';
import config from '../../config';

/**
 * Noves price provider implementation
 * Uses Noves API to get token prices across multiple chains
 */
export class NovesProvider implements PriceSource {
  private readonly API_BASE = 'https://pricing.noves.fi';
  private cache: Map<
    string,
    { price: number; timestamp: number; chain: string; specificChain?: SpecificChain }
  >;
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 100;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  private readonly supportedChains: SpecificChain[] = config.evmChains;

  constructor(private apiKey: string) {
    this.cache = new Map();
  }

  getName(): string {
    return 'Noves';
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

  private getCachedPrice(
    tokenAddress: string,
    chain: BlockchainType,
  ): { price: number; specificChain?: SpecificChain } | null {
    const cacheKey = `${chain}:${tokenAddress}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return { price: cached.price, specificChain: cached.specificChain as SpecificChain };
    }
    return null;
  }

  private setCachedPrice(
    tokenAddress: string,
    chain: BlockchainType,
    price: number,
    specificChain?: SpecificChain,
  ): void {
    const cacheKey = `${chain}:${tokenAddress}`;
    this.cache.set(cacheKey, {
      price,
      chain,
      specificChain,
      timestamp: Date.now(),
    });
  }

  /**
   * Determines which blockchain a token address belongs to based on address format
   * @param tokenAddress The token address to check
   * @returns The blockchain type (SVM or EVM)
   */
  determineChain(tokenAddress: string): BlockchainType {
    // Ethereum addresses are hexadecimal and start with 0x, typically 42 chars total (0x + 40 hex chars)
    if (/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return BlockchainType.EVM;
    }

    // Solana addresses are base58 encoded and typically 32-44 characters long
    // Most don't start with 0x and contain alphanumeric characters
    return BlockchainType.SVM;
  }

  /**
   * Determines which specific EVM chain a token exists on
   * @param tokenAddress Token address
   * @returns The specific chain the token exists on, or null if not found
   */
  async determineSpecificEVMChain(
    tokenAddress: string,
  ): Promise<{ specificChain: SpecificChain; price: number } | null> {
    console.log(`[NovesProvider] Determining specific chain for EVM token: ${tokenAddress}`);

    // Try each supported chain until we find one that returns a price
    for (const chain of this.supportedChains) {
      try {
        await this.enforceRateLimit();

        const url = `${this.API_BASE}/evm/${chain}/price/${tokenAddress}`;
        console.log(`[NovesProvider] Trying to find token on chain: ${chain}, URL: ${url}`);

        const response = await axios.get(url, {
          headers: {
            apiKey: this.apiKey,
            accept: 'application/json',
          },
          timeout: 10000,
        });

        console.log(`[NovesProvider] Response for ${chain}: ${JSON.stringify(response.data)}`);

        // Check if the response has a valid structure
        if (response.status === 200 && response.data) {
          // Check if the price is completed (not in progress)
          if (
            response.data.priceStatus !== 'inProgress' &&
            response.data.price &&
            response.data.price.amount
          ) {
            const price = parseFloat(response.data.price.amount);
            if (!isNaN(price)) {
              console.log(`[NovesProvider] Found token on chain ${chain} with price: $${price}`);
              return { specificChain: chain, price };
            } else {
              console.log(
                `[NovesProvider] Invalid price amount for token on chain ${chain}: ${response.data.price.amount}`,
              );
            }
          } else if (response.data.priceStatus === 'inProgress') {
            console.log(`[NovesProvider] Price calculation in progress for ${chain}`);
          } else {
            console.log(
              `[NovesProvider] Invalid or missing price data for ${chain}: ${JSON.stringify(response.data.price)}`,
            );
          }
        } else {
          console.log(`[NovesProvider] Unexpected response format for ${chain}`);
        }
      } catch (error) {
        // 401/404 errors are expected when the token is not on this chain
        if (
          axios.isAxiosError(error) &&
          error.response &&
          (error.response.status === 401 || error.response.status === 404)
        ) {
          console.log(
            `[NovesProvider] Token not found on ${chain} chain (${error.response.status})`,
          );
        } else {
          console.error(
            `[NovesProvider] Error checking chain ${chain}:`,
            error instanceof Error ? error.message : 'Unknown error',
          );
        }
      }
    }

    console.log(`[NovesProvider] Could not find token ${tokenAddress} on any supported EVM chain`);
    return null;
  }

  /**
   * Fetches token price from Noves API
   * @param tokenAddress Token address
   * @param chain Optional blockchain type, will be auto-detected if not provided
   * @param specificChain Optional specific chain to try first, if known
   * @returns PriceReport object or null if not found
   */
  async getPrice(
    tokenAddress: string,
    chain: BlockchainType = BlockchainType.EVM,
    specificChain: SpecificChain,
  ): Promise<PriceReport | null> {
    try {
      // Normalize the token address to lowercase
      const normalizedAddress = tokenAddress.toLowerCase();

      // Determine chain if provided as default
      const tokenChain = chain || this.determineChain(normalizedAddress);
      const finalSpecificChain = tokenChain === BlockchainType.SVM ? 'svm' : specificChain;

      // Check cache first
      const cachedResult = this.getCachedPrice(normalizedAddress, tokenChain);
      if (cachedResult !== null) {
        console.log(
          `[NovesProvider] Using cached price for ${normalizedAddress} on ${tokenChain} (${cachedResult.specificChain || 'unknown'}): $${cachedResult.price}`,
        );
        return {
          token: normalizedAddress,
          price: cachedResult.price,
          timestamp: new Date(),
          chain: tokenChain,
          specificChain: cachedResult.specificChain || finalSpecificChain,
        };
      }

      console.log(`[NovesProvider] Getting price for ${normalizedAddress} on ${tokenChain}`);

      // For Solana tokens
      if (tokenChain === BlockchainType.SVM) {
        const price = await this.getPriceSolana(normalizedAddress);
        if (price !== null) {
          return {
            token: normalizedAddress,
            price,
            timestamp: new Date(),
            chain: BlockchainType.SVM,
            specificChain: 'svm',
          };
        }
        return null;
      }

      // For EVM tokens
      // If specificChain is provided, try that first
      if (specificChain) {
        const price = await this.getPriceForSpecificEVMChain(normalizedAddress, specificChain);
        if (price !== null) {
          this.setCachedPrice(normalizedAddress, tokenChain, price, specificChain);
          return {
            token: normalizedAddress,
            price,
            timestamp: new Date(),
            chain: tokenChain,
            specificChain,
          };
        }
      }

      // Otherwise, we need to determine which specific chain the token is on
      const chainResult = await this.determineSpecificEVMChain(normalizedAddress);
      if (chainResult !== null) {
        this.setCachedPrice(
          normalizedAddress,
          tokenChain,
          chainResult.price,
          chainResult.specificChain,
        );
        return {
          token: normalizedAddress,
          price: chainResult.price,
          timestamp: new Date(),
          chain: tokenChain,
          specificChain: chainResult.specificChain,
        };
      }

      // If we couldn't find the token on any chain, return null
      return null;
    } catch (error) {
      console.error(
        `[NovesProvider] Error fetching price for ${tokenAddress}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      return null;
    }
  }

  /**
   * Get price for an EVM token on a specific chain
   * Public so that it can be used by MultiChainProvider
   */
  public async getPriceForSpecificEVMChain(
    tokenAddress: string,
    chain: SpecificChain,
  ): Promise<number | null> {
    const url = `${this.API_BASE}/evm/${chain}/price/${tokenAddress}`;

    try {
      await this.enforceRateLimit();

      console.log(`[NovesProvider] Trying specific chain endpoint: ${url}`);

      const response = await axios.get(url, {
        headers: {
          apiKey: this.apiKey,
          accept: 'application/json',
        },
        timeout: 10000,
      });

      console.log(
        `[NovesProvider] Specific chain response for ${chain}: ${JSON.stringify(response.data)}`,
      );

      // Check if the response has a valid structure
      if (response.status === 200 && response.data) {
        // Check if the price is completed (not in progress)
        if (
          response.data.priceStatus !== 'inProgress' &&
          response.data.price &&
          response.data.price.amount
        ) {
          const price = parseFloat(response.data.price.amount);
          if (!isNaN(price)) {
            console.log(`[NovesProvider] Found price on specific chain ${chain}: $${price}`);
            return price;
          } else {
            console.log(
              `[NovesProvider] Invalid price amount on specific chain ${chain}: ${response.data.price.amount}`,
            );
            return null;
          }
        } else if (response.data.priceStatus === 'inProgress') {
          console.log(`[NovesProvider] Price calculation in progress for specific chain ${chain}`);
          return null;
        } else {
          console.log(
            `[NovesProvider] Invalid or missing price data for specific chain ${chain}: ${JSON.stringify(response.data.price)}`,
          );
          return null;
        }
      } else {
        console.log(`[NovesProvider] Unexpected response format for specific chain ${chain}`);
        return null;
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response && error.response.status >= 400) {
        console.log(
          `[NovesProvider] Token ${tokenAddress} not found on ${chain} chain: ${error.response.status}`,
        );
        return null;
      }
      console.log(
        `[NovesProvider] Error querying ${chain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return null;
  }

  /**
   * Get price for a Solana token
   */
  private async getPriceSolana(tokenAddress: string): Promise<number | null> {
    const url = `${this.API_BASE}/svm/solana/price/${tokenAddress}`;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await this.enforceRateLimit();

        console.log(`[NovesProvider] Debug: Requesting from ${url}`);
        console.log(
          `[NovesProvider] Attempt ${attempt}/${this.MAX_RETRIES} to fetch Solana token price`,
        );

        const response = await axios.get(url, {
          headers: {
            apiKey: this.apiKey,
            accept: 'application/json',
          },
          timeout: 10000, // Increase timeout to 10 seconds
        });

        console.log(`[NovesProvider] Solana response: ${JSON.stringify(response.data)}`);

        // Check if the response has a valid structure
        if (response.status === 200 && response.data) {
          // Check if the price is completed (not in progress)
          if (
            response.data.priceStatus !== 'inProgress' &&
            response.data.price &&
            response.data.price.amount
          ) {
            const price = parseFloat(response.data.price.amount);
            if (!isNaN(price)) {
              console.log(
                `[NovesProvider] Successfully fetched price for Solana token ${tokenAddress}: $${price}`,
              );
              return price;
            } else {
              console.log(
                `[NovesProvider] Invalid price amount for Solana token ${tokenAddress}: ${response.data.price.amount}`,
              );
              if (attempt === this.MAX_RETRIES) return null;
              await this.delay(this.RETRY_DELAY * attempt);
              continue;
            }
          } else if (response.data.priceStatus === 'inProgress') {
            console.log(
              `[NovesProvider] Price calculation in progress for Solana token ${tokenAddress}`,
            );
            if (attempt === this.MAX_RETRIES) return null;
            await this.delay(this.RETRY_DELAY * attempt);
            continue;
          } else {
            console.log(
              `[NovesProvider] Invalid or missing price data for Solana token ${tokenAddress}: ${JSON.stringify(response.data.price)}`,
            );
            if (attempt === this.MAX_RETRIES) return null;
            await this.delay(this.RETRY_DELAY * attempt);
            continue;
          }
        } else {
          console.log(
            `[NovesProvider] Unexpected response format for Solana token ${tokenAddress}`,
          );
          if (attempt === this.MAX_RETRIES) return null;
          await this.delay(this.RETRY_DELAY * attempt);
          continue;
        }
      } catch (error) {
        if (attempt === this.MAX_RETRIES) {
          if (axios.isAxiosError(error) && error.response && error.response.status >= 400) {
            console.log(
              `[NovesProvider] API error for Solana token ${tokenAddress}: ${error.response.status}`,
            );
            return null;
          }
          throw error;
        }
        console.log(`[NovesProvider] Attempt ${attempt} failed, retrying after delay...`);
        if (axios.isAxiosError(error)) {
          console.error(`[NovesProvider] Axios error details:`, {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            data: error.response?.data,
          });
        }
        await this.delay(this.RETRY_DELAY * attempt);
      }
    }
    return null;
  }

  /**
   * Checks if a token is supported by the Noves API
   * @param tokenAddress Token address to check
   * @param specificChain Optional specific chain to check
   * @returns True if token is supported, false otherwise
   */
  async supports(tokenAddress: string, specificChain: SpecificChain): Promise<boolean> {
    try {
      console.log(`[NovesProvider] Checking support for token: ${tokenAddress}`);
      // First determine the chain
      const tokenChain = this.determineChain(tokenAddress);

      // Check cache
      if (this.getCachedPrice(tokenAddress, tokenChain) !== null) {
        return true;
      }

      // Try to get the price - if we get a value back, it's supported
      const price = await this.getPrice(tokenAddress, tokenChain, specificChain);
      return price !== null;
    } catch (error) {
      console.error(
        `[NovesProvider] Error checking token support:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      return false;
    }
  }
}
