import { PriceReport, PriceSource } from '../../types';
import { BlockchainType, SpecificChain, getBlockchainType } from '../../types';
import axios from 'axios';
import config from '../../config';
import { DexScreenerProvider } from './dexscreener.provider';

// Export the supported EVM chains list for use in tests
export const supportedEvmChains: SpecificChain[] = config.evmChains;

/**
 * MultiChainProvider implementation
 * Uses DexScreener API to get token prices across multiple chains
 * For EVM chains, it will try each chain until a valid price is found.
 * For Solana, it will delegate directly to the DexScreenerProvider.
 */
export class MultiChainProvider implements PriceSource {
  private readonly chainToTokenCache: Map<string, SpecificChain> = new Map();
  private readonly CACHE_DURATION = 3600000; // 1 hour in milliseconds
  private readonly tokenPriceCache: Map<
    string,
    {
      price: number;
      timestamp: number;
      chain: BlockchainType;
      specificChain: SpecificChain;
    }
  > = new Map();

  // Use DexScreenerProvider for common functionality
  private dexScreenerProvider: DexScreenerProvider;

  constructor(private defaultChains: SpecificChain[] = config.evmChains) {
    // Initialize the DexScreenerProvider for delegation
    this.dexScreenerProvider = new DexScreenerProvider();

    console.log(`[MultiChainProvider] Initialized with chains: ${this.defaultChains.join(', ')}`);
  }

  getName(): string {
    return 'DexScreener MultiChain';
  }

  /**
   * Determines which blockchain a token address belongs to based on address format
   * Using DexScreenerProvider's implementation
   */
  determineChain(tokenAddress: string): BlockchainType {
    return this.dexScreenerProvider.determineChain(tokenAddress);
  }

  /**
   * Get cached token price if available
   */
  private getCachedPrice(tokenAddress: string): {
    price: number;
    chain: BlockchainType;
    specificChain: SpecificChain;
  } | null {
    const cached = this.tokenPriceCache.get(tokenAddress.toLowerCase());
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return {
        price: cached.price,
        chain: cached.chain,
        specificChain: cached.specificChain,
      };
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
  ): void {
    this.tokenPriceCache.set(tokenAddress.toLowerCase(), {
      price,
      chain,
      specificChain,
      timestamp: Date.now(),
    });

    // Also cache the token-to-chain mapping for future lookups
    if (chain === BlockchainType.EVM) {
      this.chainToTokenCache.set(tokenAddress.toLowerCase(), specificChain);
    }
  }

  /**
   * Get the cached chain for a token if available
   */
  private getCachedChain(tokenAddress: string): SpecificChain | null {
    return this.chainToTokenCache.get(tokenAddress.toLowerCase()) || null;
  }

  /**
   * Get price for a specific EVM chain using DexScreener
   */
  async getPriceForSpecificEVMChain(
    tokenAddress: string,
    specificChain: SpecificChain,
  ): Promise<number | null> {
    try {
      const price = await this.dexScreenerProvider.getPrice(
        tokenAddress,
        BlockchainType.EVM,
        specificChain,
      );
      return price !== null ? price.price : null;
    } catch (error) {
      console.log(
        `[MultiChainProvider] Error fetching price for ${tokenAddress} on ${specificChain}:`,
        error instanceof Error ? error.message : 'Unknown error',
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

      // Determine blockchain type if not provided
      const detectedChainType = blockchainType || this.determineChain(normalizedAddress);

      // Check price cache first
      const cachedPrice = this.getCachedPrice(normalizedAddress);

      if (cachedPrice !== null) {
        console.log(
          `[MultiChainProvider] Using cached price for ${normalizedAddress} - Chain: ${cachedPrice.specificChain}, Price: $${cachedPrice.price}`,
        );
        return {
          token: tokenAddress,
          price: cachedPrice.price,
          timestamp: new Date(),
          chain: cachedPrice.chain,
          specificChain: cachedPrice.specificChain,
        };
      }

      // For Solana tokens, delegate directly to DexScreenerProvider
      if (detectedChainType === BlockchainType.SVM) {
        console.log(`[MultiChainProvider] Getting price for Solana token ${normalizedAddress}`);
        try {
          const price = await this.dexScreenerProvider.getPrice(
            normalizedAddress,
            BlockchainType.SVM,
            'svm',
          );
          if (price !== null) {
            // Cache the result
            this.setCachedPrice(normalizedAddress, BlockchainType.SVM, 'svm', price.price);

            console.log(
              `[MultiChainProvider] Successfully found price for Solana token ${normalizedAddress}: $${price}`,
            );
            return {
              token: tokenAddress,
              price: price.price,
              timestamp: new Date(),
              chain: BlockchainType.SVM,
              specificChain: 'svm',
            };
          }

          console.log(`[MultiChainProvider] No price found for Solana token ${normalizedAddress}`);
          return null;
        } catch (error) {
          console.log(
            `[MultiChainProvider] Error fetching price for Solana token ${normalizedAddress}:`,
            error instanceof Error ? error.message : 'Unknown error',
          );
          return null;
        }
      }

      // For EVM tokens, continue with the existing logic
      console.log(`[MultiChainProvider] Getting price for EVM token ${normalizedAddress}`);

      // If a specific chain was provided, use it directly instead of trying multiple chains
      if (specificChain) {
        console.log(`[MultiChainProvider] Using provided specific chain: ${specificChain}`);

        try {
          console.log(
            `[MultiChainProvider] Attempting to fetch price for ${normalizedAddress} on ${specificChain} chain directly`,
          );

          // Use DexScreenerProvider to get price for a specific chain
          const price = await this.getPriceForSpecificEVMChain(normalizedAddress, specificChain);

          if (price !== null) {
            // Cache the result with the specific chain
            this.setCachedPrice(normalizedAddress, BlockchainType.EVM, specificChain, price);

            console.log(
              `[MultiChainProvider] Successfully found price for ${normalizedAddress} on ${specificChain} chain: $${price}`,
            );
            return {
              token: tokenAddress,
              price,
              timestamp: new Date(),
              chain: BlockchainType.EVM,
              specificChain,
            };
          }

          console.log(
            `[MultiChainProvider] No price found for ${normalizedAddress} on specified chain ${specificChain}`,
          );
          return null; // If the specific chain didn't work, we don't try others as the user explicitly requested this chain
        } catch (error) {
          console.log(
            `[MultiChainProvider] Error fetching price for ${normalizedAddress} on specified chain ${specificChain}:`,
            error instanceof Error ? error.message : 'Unknown error',
          );
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
        chainsToTry = [cachedChain, ...chainsToTry.filter((c) => c !== cachedChain)];
      }

      // Try each chain until we get a price
      for (const chain of chainsToTry) {
        try {
          console.log(
            `[MultiChainProvider] Attempting to fetch price for ${normalizedAddress} on ${chain} chain`,
          );

          // Get price for a specific chain using DexScreener
          const price = await this.getPriceForSpecificEVMChain(normalizedAddress, chain);

          if (price !== null) {
            // Cache the result with the specific chain
            this.setCachedPrice(normalizedAddress, BlockchainType.EVM, chain, price);

            console.log(
              `[MultiChainProvider] Successfully found price for ${normalizedAddress} on ${chain} chain: $${price}`,
            );
            return {
              token: tokenAddress,
              price,
              timestamp: new Date(),
              chain: BlockchainType.EVM,
              specificChain: chain,
            };
          }
        } catch (error) {
          console.log(
            `[MultiChainProvider] Error fetching price for ${normalizedAddress} on ${chain} chain:`,
            error instanceof Error ? error.message : 'Unknown error',
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
        error instanceof Error ? error.message : 'Unknown error',
      );
      return null;
    }
  }

  /**
   * Checks if a token is supported by trying to fetch its price
   * @param tokenAddress Token address to check
   * @returns True if token is supported, false otherwise
   */
  async supports(tokenAddress: string, specificChain: SpecificChain): Promise<boolean> {
    try {
      // Check the blockchain type
      const chainType = this.determineChain(tokenAddress);

      // Check if we already have a cached price
      if (this.getCachedPrice(tokenAddress) !== null) {
        return true;
      }

      // For Solana tokens, delegate to DexScreenerProvider
      if (chainType === BlockchainType.SVM) {
        return this.dexScreenerProvider.supports(tokenAddress, specificChain);
      }

      // For EVM tokens, try to get the price - if we get a value back, it's supported
      const price = await this.getPrice(tokenAddress);
      return price !== null;
    } catch (error) {
      console.log(
        `[MultiChainProvider] Error checking support for ${tokenAddress}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      return false;
    }
  }

  /**
   * Get detailed information about a token including which chain it's on
   * @param tokenAddress Token address
   * @param blockchainType Optional blockchain type (EVM or SVM)
   * @param specificChain Optional specific chain to check directly (bypasses chain detection)
   * @returns Object containing price and chain information or null if not found
   */
  async getTokenInfo(
    tokenAddress: string,
    blockchainType: BlockchainType,
    specificChain?: SpecificChain,
  ): Promise<{
    price: number;
    chain: BlockchainType;
    specificChain: SpecificChain;
  } | null> {
    try {
      // Normalize token address
      const normalizedAddress = tokenAddress.toLowerCase();

      // Determine blockchain type if not provided
      const generalChain = blockchainType || this.determineChain(normalizedAddress);

      // Check cache first
      const cachedPrice = this.getCachedPrice(normalizedAddress);
      if (cachedPrice !== null) {
        return cachedPrice;
      }

      // For Solana tokens, get price using DexScreenerProvider
      if (generalChain === BlockchainType.SVM) {
        try {
          const price = await this.dexScreenerProvider.getPrice(
            normalizedAddress,
            BlockchainType.SVM,
            'svm',
          );

          // Cache the price if it was found
          if (price !== null) {
            this.setCachedPrice(normalizedAddress, BlockchainType.SVM, 'svm', price.price);

            console.log(
              `[MultiChainProvider] Successfully found Solana token info for ${normalizedAddress}: $${price}`,
            );
            return {
              price: price.price,
              chain: BlockchainType.SVM,
              specificChain: 'svm',
            };
          } else {
            return null;
          }
        } catch (error) {
          console.log(
            `[MultiChainProvider] Error fetching token info for Solana token ${normalizedAddress}:`,
            error instanceof Error ? error.message : 'Unknown error',
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
          const price = await this.getPriceForSpecificEVMChain(normalizedAddress, specificChain);

          if (price !== null) {
            // Cache the result with the specific chain
            this.setCachedPrice(normalizedAddress, BlockchainType.EVM, specificChain, price);

            console.log(
              `[MultiChainProvider] Successfully found token info for ${normalizedAddress} on ${specificChain} chain: $${price}`,
            );

            return {
              price,
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
            error instanceof Error ? error.message : 'Unknown error',
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
          chain: price.chain,
          specificChain: price.specificChain,
        };
      }

      return null;
    } catch (error) {
      console.error(
        `[MultiChainProvider] Error getting token info for ${tokenAddress}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      return null;
    }
  }
}
