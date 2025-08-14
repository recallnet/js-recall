import config from "@/config/index.js";
import { serviceLogger } from "@/lib/logger.js";
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
  // Use DexScreenerProvider for common functionality
  private dexScreenerProvider: DexScreenerProvider;

  constructor(private defaultChains: SpecificChain[] = config.evmChains) {
    // Initialize the DexScreenerProvider for delegation
    this.dexScreenerProvider = new DexScreenerProvider();

    serviceLogger.debug(
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
      const detectedChainType =
        blockchainType || this.determineChain(normalizedAddress);

      // For Solana tokens, the chain is fixed
      if (detectedChainType === BlockchainType.SVM) {
        specificChain = "svm";
      }

      // If a specific chain was provided, use it directly instead of trying multiple chains
      if (specificChain) {
        try {
          serviceLogger.debug(
            `[MultiChainProvider] Getting price for token ${normalizedAddress} on specific chain ${specificChain} with type ${detectedChainType}`,
          );

          // Use DexScreenerProvider to get price for a specific chain
          const price = await this.dexScreenerProvider.getPrice(
            normalizedAddress,
            detectedChainType,
            specificChain,
          );

          if (price !== null) {
            serviceLogger.debug(
              `[MultiChainProvider] Successfully found price for ${normalizedAddress} on ${specificChain} chain: $${price.price}`,
            );
            return {
              ...price,
              token: tokenAddress, // Override with original case token address
            };
          }

          serviceLogger.debug(
            `[MultiChainProvider] No price found for ${normalizedAddress} on specified chain ${specificChain}`,
          );
          // Important: Return null here without falling back to other chains
          return null;
        } catch (error) {
          serviceLogger.debug(
            `[MultiChainProvider] Error fetching price for ${normalizedAddress} on specified chain ${specificChain}:`,
            error instanceof Error ? error.message : "Unknown error",
          );
          // Important: Return null here without falling back to other chains
          return null;
        }
      }

      // No specific chain provided, try each chain in order until we get a price
      for (const chain of this.defaultChains) {
        try {
          serviceLogger.debug(
            `[MultiChainProvider] Attempting to fetch price for ${normalizedAddress} on ${chain} chain`,
          );

          // Get price for a specific chain using DexScreener
          const price = await this.dexScreenerProvider.getPrice(
            normalizedAddress,
            detectedChainType,
            chain,
          );

          if (price !== null) {
            serviceLogger.debug(
              `[MultiChainProvider] Successfully found price for ${normalizedAddress} on ${chain} chain: $${price.price}`,
            );
            return {
              ...price,
              token: tokenAddress, // Override with original case token address
            };
          }
        } catch (error) {
          serviceLogger.debug(
            `[MultiChainProvider] Error fetching price for ${normalizedAddress} on ${chain} chain:`,
            error instanceof Error ? error.message : "Unknown error",
          );

          // Continue to next chain
          continue;
        }
      }

      serviceLogger.debug(
        `[MultiChainProvider] Could not find price for ${normalizedAddress} on any chain`,
      );
      return null;
    } catch (error) {
      serviceLogger.error(
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
      serviceLogger.debug(
        `[MultiChainProvider] Error checking support for ${tokenAddress}:`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return false;
    }
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

    if (tokenAddresses.length === 0) {
      return results;
    }

    const firstAddress = tokenAddresses[0];
    if (!firstAddress) {
      return results;
    }

    const detectedChainType =
      blockchainType || this.determineChain(firstAddress);

    // For Solana tokens, delegate to DexScreenerProvider
    if (detectedChainType === BlockchainType.SVM) {
      serviceLogger.debug(
        `[MultiChainProvider] Getting batch prices for ${tokenAddresses.length} Solana tokens`,
      );
      try {
        const batchResults = await this.dexScreenerProvider.getBatchPrices(
          tokenAddresses,
          BlockchainType.SVM,
          "svm",
        );

        batchResults.forEach((result, tokenAddress) => {
          if (result) {
            results.set(tokenAddress, {
              ...result,
              token: tokenAddress,
              timestamp: new Date(),
              chain: BlockchainType.SVM,
              specificChain: "svm",
            });
          } else {
            results.set(tokenAddress, null);
          }
        });
      } catch (error) {
        serviceLogger.debug(
          `[MultiChainProvider] Error fetching batch prices for Solana tokens:`,
          error instanceof Error ? error.message : "Unknown error",
        );
        // Set all tokens to null on error
        tokenAddresses.forEach((addr) => {
          results.set(addr, null);
        });
      }
      return results;
    }

    // For EVM tokens, handle batch processing
    serviceLogger.debug(
      `[MultiChainProvider] Getting batch prices for ${tokenAddresses.length} EVM tokens`,
    );

    // If a specific chain was provided, use it directly
    if (specificChain) {
      serviceLogger.debug(
        `[MultiChainProvider] Using provided specific chain: ${specificChain}`,
      );

      try {
        const batchResults = await this.dexScreenerProvider.getBatchPrices(
          tokenAddresses,
          BlockchainType.EVM,
          specificChain,
        );

        batchResults.forEach((result, tokenAddress) => {
          if (result) {
            results.set(tokenAddress, {
              ...result,
              token: tokenAddress,
              timestamp: new Date(),
              chain: BlockchainType.EVM,
              specificChain,
            });
          } else {
            results.set(tokenAddress, null);
          }
        });
      } catch (error) {
        serviceLogger.debug(
          `[MultiChainProvider] Error fetching batch prices for EVM tokens on ${specificChain}:`,
          error instanceof Error ? error.message : "Unknown error",
        );
        // Set all tokens to null on error
        tokenAddresses.forEach((addr) => {
          results.set(addr, null);
        });
      }
      return results;
    }

    // No specific chain provided, try each chain in order
    const chainsToTry = [...this.defaultChains];

    // Try each chain until we get prices for all tokens
    const remainingTokens = new Set(tokenAddresses);

    for (const chain of chainsToTry) {
      if (remainingTokens.size === 0) break;

      try {
        serviceLogger.debug(
          `[MultiChainProvider] Attempting to fetch batch prices for ${remainingTokens.size} tokens on ${chain} chain`,
        );

        const batchResults = await this.dexScreenerProvider.getBatchPrices(
          Array.from(remainingTokens),
          BlockchainType.EVM,
          chain,
        );

        batchResults.forEach((result, tokenAddress) => {
          if (result) {
            results.set(tokenAddress, {
              ...result,
              token: tokenAddress,
              timestamp: new Date(),
              chain: BlockchainType.EVM,
              specificChain: chain,
            });

            // Remove from remaining tokens
            remainingTokens.delete(tokenAddress);
          }
        });
      } catch (error) {
        serviceLogger.debug(
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

    serviceLogger.debug(
      `[MultiChainProvider] Batch processing complete. Found prices for ${results.size - remainingTokens.size} out of ${tokenAddresses.length} tokens`,
    );

    return results;
  }
}
