import config from "@/config/index.js";
import { DexScreenerProvider } from "@/services/providers/dexscreener.provider.js";
import { PriceReport, PriceSource } from "@/types/index.js";
import { BlockchainType, SpecificChain } from "@/types/index.js";

// Export the supported EVM chains list for use in tests
export const supportedEvmChains: SpecificChain[] = config.evmChains;

/**
 * MultiChainProvider implementation
 * Uses DexScreener API to get token prices across multiple chains
 * For EVM chains, it will try each chain until a valid price is found.
 * For Solana, it will delegate directly to the DexScreenerProvider.
 */
export class MultiChainProvider implements PriceSource {
  // Add cache for token prices with composite key (tokenAddress:specificChain)
  private readonly tokenPriceCache: Map<
    string,
    {
      price: number;
      symbol: string;
      timestamp: number;
      chain: BlockchainType;
      specificChain: SpecificChain;
    }
  > = new Map();

  // Track which chain a token belongs to for quicker lookups
  private readonly chainToTokenCache: Map<string, SpecificChain> = new Map();

  private readonly CACHE_DURATION = 3600000; // 1 hour in milliseconds

  // Use DexScreenerProvider for common functionality
  private dexScreenerProvider: DexScreenerProvider;

  constructor(private defaultChains: SpecificChain[] = config.evmChains) {
    // Initialize the DexScreenerProvider for delegation
    this.dexScreenerProvider = new DexScreenerProvider();

    console.log(
      `[MultiChainProvider] Initialized with chains: ${this.defaultChains.join(", ")}`,
    );
  }

  getName(): string {
    return "DexScreener MultiChain";
  }

  /**
   * Determines which blockchain a token address belongs to based on address format
   * Using DexScreenerProvider's implementation
   */
  determineChain(tokenAddress: string): BlockchainType {
    return this.dexScreenerProvider.determineChain(tokenAddress);
  }

  /**
   * Get price for a specific EVM chain using DexScreener
   * @param tokenAddress The token address to get price for
   * @param specificChain The specific EVM chain to query
   * @returns Object containing price and symbol information, or null if not found
   */
  async getPriceForSpecificEVMChain(
    tokenAddress: string,
    specificChain: SpecificChain,
  ): Promise<{
    price: number;
    symbol: string;
  } | null> {
    try {
      const price = await this.dexScreenerProvider.getPrice(
        tokenAddress,
        BlockchainType.EVM,
        specificChain,
      );
      return price !== null
        ? {
            price: price.price,
            symbol: price.symbol,
          }
        : null;
    } catch (error) {
      console.log(
        `[MultiChainProvider] Error fetching price for ${tokenAddress} on ${specificChain}:`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return null;
    }
  }

  /**
   * Fetches token price from DexScreener API across multiple chains
   * @param tokenAddress Token address
   * @param blockchainType Optional blockchain type (EVM or SVM)
   * @param specificChain Optional specific chain to check directly (bypasses chain detection)
   * @returns PriceReport
   */
  async getPrice(
    tokenAddress: string,
    blockchainType?: BlockchainType,
    specificChain?: SpecificChain,
  ): Promise<PriceReport | null> {
    try {
      // Normalize token address to lowercase
      const normalizedAddress = tokenAddress.toLowerCase();

      // Check cache first
      const cachedPrice = this.getCachedPrice(normalizedAddress, specificChain);
      if (cachedPrice !== null) {
        return {
          token: tokenAddress,
          price: cachedPrice.price,
          symbol: cachedPrice.symbol,
          timestamp: new Date(),
          chain: cachedPrice.chain,
          specificChain: cachedPrice.specificChain,
        };
      }

      // Determine blockchain type if not provided
      const detectedChainType =
        blockchainType || this.determineChain(normalizedAddress);

      // For Solana tokens, delegate directly to DexScreenerProvider
      if (detectedChainType === BlockchainType.SVM) {
        console.log(
          `[MultiChainProvider] Getting price for Solana token ${normalizedAddress}`,
        );
        try {
          const price = await this.dexScreenerProvider.getPrice(
            normalizedAddress,
            BlockchainType.SVM,
            "svm",
          );
          if (price !== null) {
            // Cache the price
            this.setCachedPrice(
              normalizedAddress,
              BlockchainType.SVM,
              "svm",
              price.price,
              price.symbol,
            );

            console.log(
              `[MultiChainProvider] Successfully found price for Solana token ${normalizedAddress}: $${price.price}`,
            );
            return {
              token: tokenAddress,
              price: price.price,
              symbol: price.symbol,
              timestamp: new Date(),
              chain: BlockchainType.SVM,
              specificChain: "svm",
            };
          }

          console.log(
            `[MultiChainProvider] No price found for Solana token ${normalizedAddress}`,
          );
          return null;
        } catch (error) {
          console.log(
            `[MultiChainProvider] Error fetching price for Solana token ${normalizedAddress}:`,
            error instanceof Error ? error.message : "Unknown error",
          );
          return null;
        }
      }

      // For EVM tokens, continue with the existing logic
      console.log(
        `[MultiChainProvider] Getting price for EVM token ${normalizedAddress}`,
      );

      // If a specific chain was provided, use it directly instead of trying multiple chains
      if (specificChain) {
        console.log(
          `[MultiChainProvider] Using provided specific chain: ${specificChain}`,
        );

        try {
          console.log(
            `[MultiChainProvider] Attempting to fetch price for ${normalizedAddress} on ${specificChain} chain directly`,
          );

          // Use DexScreenerProvider to get price for a specific chain
          const price = await this.getPriceForSpecificEVMChain(
            normalizedAddress,
            specificChain,
          );

          if (price !== null) {
            // Cache the price
            this.setCachedPrice(
              normalizedAddress,
              BlockchainType.EVM,
              specificChain,
              price.price,
              price.symbol,
            );

            console.log(
              `[MultiChainProvider] Successfully found price for ${normalizedAddress} on ${specificChain} chain: $${price.price}`,
            );
            return {
              token: tokenAddress,
              price: price.price,
              symbol: price.symbol,
              timestamp: new Date(),
              chain: BlockchainType.EVM,
              specificChain,
            };
          }

          console.log(
            `[MultiChainProvider] No price found for ${normalizedAddress} on specified chain ${specificChain}`,
          );
          // Important: Return null here without falling back to other chains
          return null;
        } catch (error) {
          console.log(
            `[MultiChainProvider] Error fetching price for ${normalizedAddress} on specified chain ${specificChain}:`,
            error instanceof Error ? error.message : "Unknown error",
          );
          // Important: Return null here without falling back to other chains
          return null;
        }
      }

      // No specific chain provided, try each chain in order until we get a price
      // Check if we have a cached chain for this token
      let chainsToTry = [...this.defaultChains];
      const cachedChain = this.getCachedChain(normalizedAddress);

      // If we have a cached chain, try that first
      if (cachedChain) {
        console.log(
          `[MultiChainProvider] Found cached chain ${cachedChain} for ${normalizedAddress}, trying it first`,
        );
        chainsToTry = [
          cachedChain,
          ...chainsToTry.filter((c) => c !== cachedChain),
        ];
      }

      // Try each chain until we get a price
      for (const chain of chainsToTry) {
        try {
          console.log(
            `[MultiChainProvider] Attempting to fetch price for ${normalizedAddress} on ${chain} chain`,
          );

          // Get price for a specific chain using DexScreener
          const price = await this.getPriceForSpecificEVMChain(
            normalizedAddress,
            chain,
          );

          if (price !== null) {
            // Cache the price
            this.setCachedPrice(
              normalizedAddress,
              BlockchainType.EVM,
              chain,
              price.price,
              price.symbol,
            );

            console.log(
              `[MultiChainProvider] Successfully found price for ${normalizedAddress} on ${chain} chain: $${price.price}`,
            );
            return {
              token: tokenAddress,
              price: price.price,
              symbol: price.symbol,
              timestamp: new Date(),
              chain: BlockchainType.EVM,
              specificChain: chain,
            };
          }
        } catch (error) {
          console.log(
            `[MultiChainProvider] Error fetching price for ${normalizedAddress} on ${chain} chain:`,
            error instanceof Error ? error.message : "Unknown error",
          );

          // Continue to next chain
          continue;
        }
      }

      console.log(
        `[MultiChainProvider] Could not find price for ${normalizedAddress} on any chain`,
      );
      return null;
    } catch (error) {
      console.error(
        `[MultiChainProvider] Unexpected error fetching price for ${tokenAddress}:`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return null;
    }
  }

  /**
   * Checks if a token is supported by trying to fetch its price
   * @param tokenAddress Token address to check
   * @returns True if token is supported, false otherwise
   */
  async supports(
    tokenAddress: string,
    specificChain: SpecificChain,
  ): Promise<boolean> {
    try {
      // Check if we already have a cached price
      if (this.getCachedPrice(tokenAddress, specificChain) !== null) {
        return true;
      }

      // Check the blockchain type
      const chainType = this.determineChain(tokenAddress);

      // For Solana tokens, delegate to DexScreenerProvider
      if (chainType === BlockchainType.SVM) {
        return this.dexScreenerProvider.supports(tokenAddress, specificChain);
      }

      // For EVM tokens, try to get the price - if we get a value back, it's supported
      const price = await this.getPrice(tokenAddress, undefined, specificChain);
      return price !== null;
    } catch (error) {
      console.log(
        `[MultiChainProvider] Error checking support for ${tokenAddress}:`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return false;
    }
  }

  /**
   * Get token information including current price and chain detection
   * @param tokenAddress Token address
   * @param blockchainType Optional blockchain type (EVM or SVM)
   * @param specificChain Optional specific chain to check directly (bypasses chain detection)
   * @returns Object containing price, symbol, and chain information or null if not found
   */
  async getTokenInfo(
    tokenAddress: string,
    blockchainType: BlockchainType,
    specificChain?: SpecificChain,
  ): Promise<{
    price: number;
    chain: BlockchainType;
    specificChain: SpecificChain;
    symbol: string;
  } | null> {
    try {
      // Normalize token address
      const normalizedAddress = tokenAddress.toLowerCase();

      // Check cache first
      const cachedPrice = this.getCachedPrice(normalizedAddress, specificChain);
      if (cachedPrice !== null) {
        // If the cached price is for a different specific chain, return null
        if (specificChain && cachedPrice.specificChain !== specificChain) {
          return null;
        }
        return cachedPrice;
      }

      // Determine blockchain type if not provided
      const generalChain =
        blockchainType || this.determineChain(normalizedAddress);

      // For Solana tokens, get price using DexScreenerProvider
      if (generalChain === BlockchainType.SVM) {
        try {
          const price = await this.dexScreenerProvider.getPrice(
            normalizedAddress,
            BlockchainType.SVM,
            "svm",
          );

          // Cache the price if it was found
          if (price !== null) {
            this.setCachedPrice(
              normalizedAddress,
              BlockchainType.SVM,
              "svm",
              price.price,
              price.symbol,
            );

            console.log(
              `[MultiChainProvider] Successfully found Solana token info for ${normalizedAddress}: $${price.price}`,
            );
            return {
              price: price.price,
              symbol: price.symbol,
              chain: BlockchainType.SVM,
              specificChain: "svm",
            };
          } else {
            return null;
          }
        } catch (error) {
          console.log(
            `[MultiChainProvider] Error fetching token info for Solana token ${normalizedAddress}:`,
            error instanceof Error ? error.message : "Unknown error",
          );

          return null;
        }
      }

      // If a specific chain was provided, use it directly
      if (specificChain) {
        console.log(
          `[MultiChainProvider] Using provided specific chain for getTokenInfo: ${specificChain}`,
        );

        try {
          console.log(
            `[MultiChainProvider] Attempting to fetch token info for ${normalizedAddress} on ${specificChain} chain directly`,
          );

          // Get price for specific chain using DexScreener
          const price = await this.getPriceForSpecificEVMChain(
            normalizedAddress,
            specificChain,
          );

          if (price !== null) {
            // Cache the price
            this.setCachedPrice(
              normalizedAddress,
              BlockchainType.EVM,
              specificChain,
              price.price,
              price.symbol,
            );

            console.log(
              `[MultiChainProvider] Successfully found token info for ${normalizedAddress} on ${specificChain} chain: $${price.price}`,
            );

            return {
              price: price.price,
              symbol: price.symbol,
              chain: generalChain,
              specificChain,
            };
          }

          console.log(
            `[MultiChainProvider] No price found for ${normalizedAddress} on specified chain ${specificChain}`,
          );

          // Return with the specific chain but null price
          return null;
        } catch (error) {
          console.log(
            `[MultiChainProvider] Error fetching token info for ${normalizedAddress} on specified chain ${specificChain}:`,
            error instanceof Error ? error.message : "Unknown error",
          );

          // Return with the specific chain but null price
          return null;
        }
      }

      // No specific chain was provided, try to get price, which will also update cache with chain info
      const price = await this.getPrice(normalizedAddress, generalChain);

      if (price !== null) {
        return {
          price: price.price,
          symbol: price.symbol,
          chain: price.chain,
          specificChain: price.specificChain,
        };
      }

      return null;
    } catch (error) {
      console.error(
        `[MultiChainProvider] Error getting token info for ${tokenAddress}:`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return null;
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
  ): {
    price: number;
    symbol: string;
    chain: BlockchainType;
    specificChain: SpecificChain;
  } | null {
    const normalizedAddress = tokenAddress.toLowerCase();

    // If specificChain is provided, use the composite key
    if (specificChain) {
      const cacheKey = this.getCacheKey(normalizedAddress, specificChain);
      const cached = this.tokenPriceCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        console.log(
          `[MultiChainProvider] Using cached price for ${normalizedAddress} on ${specificChain}: $${cached.price}`,
        );
        return {
          price: cached.price,
          symbol: cached.symbol,
          chain: cached.chain,
          specificChain: cached.specificChain,
        };
      }
      return null;
    }

    // Fallback: try to find any cache entry for this token
    // First check if we know which chain this token is on
    const knownChain = this.getCachedChain(normalizedAddress);
    if (knownChain) {
      const cacheKey = this.getCacheKey(normalizedAddress, knownChain);
      const cached = this.tokenPriceCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        console.log(
          `[MultiChainProvider] Using cached price for ${normalizedAddress} from known chain ${knownChain}: $${cached.price}`,
        );
        return {
          price: cached.price,
          symbol: cached.symbol,
          chain: cached.chain,
          specificChain: cached.specificChain,
        };
      }
    }

    return null;
  }

  /**
   * Cache token price and its chain
   */
  private setCachedPrice(
    tokenAddress: string,
    chain: BlockchainType,
    specificChain: SpecificChain,
    price: number,
    symbol: string,
  ): void {
    const normalizedAddress = tokenAddress.toLowerCase();
    const cacheKey = this.getCacheKey(normalizedAddress, specificChain);

    this.tokenPriceCache.set(cacheKey, {
      price,
      symbol,
      chain,
      specificChain,
      timestamp: Date.now(),
    });

    // Also cache the token-to-chain mapping for future lookups
    if (chain === BlockchainType.EVM) {
      this.chainToTokenCache.set(normalizedAddress, specificChain);
    }

    console.log(
      `[MultiChainProvider] Cached price for ${normalizedAddress} on ${specificChain}: $${price}`,
    );
  }

  /**
   * Get the cached chain for a token if available
   */
  private getCachedChain(tokenAddress: string): SpecificChain | null {
    return this.chainToTokenCache.get(tokenAddress.toLowerCase()) || null;
  }

  /**
   * Get prices for multiple tokens in a single batch request
   * @param tokenAddresses Array of token addresses to fetch prices for
   * @param blockchainType Blockchain type
   * @param specificChain Optional specific chain identifier
   * @returns Map of token addresses to their price information
   */
  async getBatchPrices(
    tokenAddresses: string[],
    blockchainType?: BlockchainType,
    specificChain?: SpecificChain,
  ): Promise<Map<string, PriceReport | null>> {
    const results = new Map<string, PriceReport | null>();

    // Normalize addresses
    const normalizedAddresses = tokenAddresses.map((addr) =>
      addr.toLowerCase(),
    );

    // Check cache first
    const uncachedAddresses: string[] = [];
    for (const normalizedAddr of normalizedAddresses) {
      const originalAddr = tokenAddresses.find(
        (addr) => addr.toLowerCase() === normalizedAddr,
      );
      if (!originalAddr) continue;

      const cachedPrice = this.getCachedPrice(normalizedAddr, specificChain);
      if (cachedPrice !== null) {
        results.set(originalAddr, {
          token: originalAddr,
          price: cachedPrice.price,
          symbol: cachedPrice.symbol,
          timestamp: new Date(),
          chain: cachedPrice.chain,
          specificChain: cachedPrice.specificChain,
        });
      } else {
        uncachedAddresses.push(originalAddr);
      }
    }

    // If all tokens were cached, return early
    if (
      uncachedAddresses.length === 0 ||
      typeof uncachedAddresses[0] === "undefined"
    ) {
      return results;
    }

    const firstAddress = uncachedAddresses[0];

    const detectedChainType =
      blockchainType || this.determineChain(firstAddress);

    // For Solana tokens, delegate to DexScreenerProvider
    if (detectedChainType === BlockchainType.SVM) {
      console.log(
        `[MultiChainProvider] Getting batch prices for ${uncachedAddresses.length} Solana tokens`,
      );
      try {
        const batchResults = await this.dexScreenerProvider.getBatchPrices(
          uncachedAddresses,
          BlockchainType.SVM,
          "svm",
        );

        batchResults.forEach((result, tokenAddress) => {
          if (result) {
            // Cache the price
            this.setCachedPrice(
              tokenAddress.toLowerCase(),
              BlockchainType.SVM,
              "svm",
              result.price,
              result.symbol,
            );

            results.set(tokenAddress, {
              token: tokenAddress,
              price: result.price,
              symbol: result.symbol,
              timestamp: new Date(),
              chain: BlockchainType.SVM,
              specificChain: "svm",
            });
          } else {
            results.set(tokenAddress, null);
          }
        });
      } catch (error) {
        console.log(
          `[MultiChainProvider] Error fetching batch prices for Solana tokens:`,
          error instanceof Error ? error.message : "Unknown error",
        );
        // Set all uncached tokens to null
        uncachedAddresses.forEach((addr) => {
          results.set(addr, null);
        });
      }
      return results;
    }

    // For EVM tokens, handle batch processing
    console.log(
      `[MultiChainProvider] Getting batch prices for ${uncachedAddresses.length} EVM tokens`,
    );

    // If a specific chain was provided, use it directly
    if (specificChain) {
      console.log(
        `[MultiChainProvider] Using provided specific chain: ${specificChain}`,
      );

      try {
        const batchResults = await this.dexScreenerProvider.getBatchPrices(
          uncachedAddresses,
          BlockchainType.EVM,
          specificChain,
        );

        batchResults.forEach((result, tokenAddress) => {
          if (result) {
            // Cache the price
            this.setCachedPrice(
              tokenAddress.toLowerCase(),
              BlockchainType.EVM,
              specificChain,
              result.price,
              result.symbol,
            );

            results.set(tokenAddress, {
              token: tokenAddress,
              price: result.price,
              symbol: result.symbol,
              timestamp: new Date(),
              chain: BlockchainType.EVM,
              specificChain,
            });
          } else {
            results.set(tokenAddress, null);
          }
        });
      } catch (error) {
        console.log(
          `[MultiChainProvider] Error fetching batch prices for EVM tokens on ${specificChain}:`,
          error instanceof Error ? error.message : "Unknown error",
        );
        // Set all uncached tokens to null
        uncachedAddresses.forEach((addr) => {
          results.set(addr, null);
        });
      }
      return results;
    }

    // No specific chain provided, try each chain in order
    let chainsToTry = [...this.defaultChains];
    const firstUncachedAddress = uncachedAddresses[0];
    const cachedChain = firstUncachedAddress
      ? this.getCachedChain(firstUncachedAddress)
      : null;

    // If we have a cached chain, try that first
    if (cachedChain) {
      console.log(
        `[MultiChainProvider] Found cached chain ${cachedChain} for batch, trying it first`,
      );
      chainsToTry = [
        cachedChain,
        ...chainsToTry.filter((c) => c !== cachedChain),
      ];
    }

    // Try each chain until we get prices for all tokens
    const remainingTokens = new Set(uncachedAddresses);

    for (const chain of chainsToTry) {
      if (remainingTokens.size === 0) break;

      try {
        console.log(
          `[MultiChainProvider] Attempting to fetch batch prices for ${remainingTokens.size} tokens on ${chain} chain`,
        );

        const batchResults = await this.dexScreenerProvider.getBatchPrices(
          Array.from(remainingTokens),
          BlockchainType.EVM,
          chain,
        );

        batchResults.forEach((result, tokenAddress) => {
          if (result) {
            // Cache the price
            this.setCachedPrice(
              tokenAddress.toLowerCase(),
              BlockchainType.EVM,
              chain,
              result.price,
              result.symbol,
            );

            results.set(tokenAddress, {
              token: tokenAddress,
              price: result.price,
              symbol: result.symbol,
              timestamp: new Date(),
              chain: BlockchainType.EVM,
              specificChain: chain,
            });

            // Remove from remaining tokens
            remainingTokens.delete(tokenAddress);
          }
        });
      } catch (error) {
        console.log(
          `[MultiChainProvider] Error fetching batch prices on ${chain} chain:`,
          error instanceof Error ? error.message : "Unknown error",
        );
        // Continue to next chain
        continue;
      }
    }

    // Set any remaining tokens to null
    remainingTokens.forEach((addr) => {
      results.set(addr, null);
    });

    console.log(
      `[MultiChainProvider] Batch processing complete. Found prices for ${results.size - remainingTokens.size} out of ${uncachedAddresses.length} tokens`,
    );

    return results;
  }

  /**
   * Get token info for multiple tokens in a single batch request
   * @param tokenAddresses Array of token addresses to fetch info for
   * @param blockchainType Blockchain type
   * @param specificChain Optional specific chain identifier
   * @returns Map of token addresses to their token info
   */
  async getBatchTokenInfo(
    tokenAddresses: string[],
    blockchainType: BlockchainType,
    specificChain?: SpecificChain,
  ): Promise<
    Map<
      string,
      {
        price: number;
        chain: BlockchainType;
        specificChain: SpecificChain;
        symbol: string;
      } | null
    >
  > {
    const results = new Map<
      string,
      {
        price: number;
        chain: BlockchainType;
        specificChain: SpecificChain;
        symbol: string;
      } | null
    >();

    // Get batch prices
    const batchPrices = await this.getBatchPrices(
      tokenAddresses,
      blockchainType,
      specificChain,
    );

    // Convert PriceReport to TokenInfo format
    batchPrices.forEach((priceReport, tokenAddress) => {
      if (priceReport) {
        results.set(tokenAddress, {
          price: priceReport.price,
          chain: priceReport.chain,
          specificChain: priceReport.specificChain,
          symbol: priceReport.symbol,
        });
      } else {
        results.set(tokenAddress, null);
      }
    });

    return results;
  }
}
