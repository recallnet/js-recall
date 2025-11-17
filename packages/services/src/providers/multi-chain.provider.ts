import { Logger } from "pino";

import {
  BlockchainType,
  CoinGeckoMode,
  PriceProvider,
  PriceReport,
  PriceSource,
  SpecificChain,
  SpecificChainTokens,
} from "../types/index.js";
import { CoinGeckoProvider } from "./price/coingecko.provider.js";
import { DexScreenerProvider } from "./price/dexscreener.provider.js";

export interface MultiChainProviderConfig {
  priceProvider: {
    type: PriceProvider;
    coingecko?: {
      apiKey: string;
      mode: CoinGeckoMode;
    };
  };
  evmChains: SpecificChain[];
  specificChainTokens: SpecificChainTokens;
}

/**
 * MultiChainProvider implementation
 * Uses configurable price provider (CoinGecko or DexScreener) to get token prices across multiple chains
 * For EVM chains, it will try each chain until a valid price is found.
 * For Solana, it will delegate directly to the configured provider.
 */
export class MultiChainProvider implements PriceSource {
  private priceProvider: PriceSource;
  private defaultChains: SpecificChain[];
  private logger: Logger;

  constructor(config: MultiChainProviderConfig, logger: Logger) {
    this.defaultChains = config.evmChains;
    this.logger = logger;

    switch (config.priceProvider.type) {
      case "coingecko":
        if (!config.priceProvider.coingecko?.apiKey) {
          throw new Error("CoinGecko API key is required");
        }
        this.priceProvider = new CoinGeckoProvider(
          {
            ...config.priceProvider.coingecko,
            specificChainTokens: config.specificChainTokens,
          },
          logger,
        );
        break;
      case "dexscreener":
      default:
        this.priceProvider = new DexScreenerProvider(
          config.specificChainTokens,
          logger,
        );
        break;
    }
  }

  /**
   * Gets the name of the provider
   * @returns The name of the provider
   */
  getName(): string {
    return `${this.priceProvider.getName()} MultiChain`;
  }

  /**
   * Determines which blockchain a token address belongs to based on address format
   * using the configured provider's implementation
   * @param tokenAddress The token address
   * @returns The blockchain type
   */
  determineChain(tokenAddress: string): BlockchainType {
    return this.priceProvider.determineChain(tokenAddress);
  }

  /**
   * Fetches token price from the configured provider across multiple chains
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
      // Determine blockchain type if not provided
      const detectedChainType =
        blockchainType || this.determineChain(tokenAddress);

      // For Solana tokens, the chain is fixed
      if (detectedChainType === BlockchainType.SVM) {
        specificChain = "svm";
      }

      // If a specific chain was provided, use it directly instead of trying multiple chains
      if (specificChain) {
        try {
          this.logger.debug(
            `[MultiChainProvider] Getting price for token ${tokenAddress} on specific chain ${specificChain} with type ${detectedChainType}`,
          );

          // Use the configured provider to get price for a specific chain
          const price = await this.priceProvider.getPrice(
            tokenAddress,
            detectedChainType,
            specificChain,
          );

          if (price !== null) {
            this.logger.debug(
              `[MultiChainProvider] Successfully found price for ${tokenAddress} on ${specificChain} chain: $${price.price}`,
            );
            return {
              ...price,
              token: tokenAddress, // Override with original case token address
            };
          }

          this.logger.debug(
            `[MultiChainProvider] No price found for ${tokenAddress} on specified chain ${specificChain}`,
          );
          // Important: Return null here without falling back to other chains
          return null;
        } catch (error) {
          this.logger.debug(
            { error },
            `[MultiChainProvider] Error fetching price for ${tokenAddress} on specified chain ${specificChain}`,
          );
          // Important: Return null here without falling back to other chains
          return null;
        }
      }

      // No specific chain provided, try each chain in order until we get a price
      for (const chain of this.defaultChains) {
        try {
          this.logger.debug(
            `[MultiChainProvider] Attempting to fetch price for ${tokenAddress} on ${chain} chain`,
          );

          // Get price for a specific chain using the configured provider
          const price = await this.priceProvider.getPrice(
            tokenAddress,
            detectedChainType,
            chain,
          );

          if (price !== null) {
            this.logger.debug(
              `[MultiChainProvider] Successfully found price for ${tokenAddress} on ${chain} chain: $${price.price}`,
            );
            return {
              ...price,
              token: tokenAddress, // Override with original case token address
            };
          }
        } catch (error) {
          this.logger.error(
            { error },
            `[MultiChainProvider] Error fetching price for ${tokenAddress} on ${chain} chain`,
          );

          // Continue to next chain
          continue;
        }
      }

      this.logger.debug(
        `[MultiChainProvider] Could not find price for ${tokenAddress} on any chain`,
      );
      return null;
    } catch (error) {
      this.logger.error(
        { error },
        `[MultiChainProvider] Unexpected error fetching price for ${tokenAddress}`,
      );
      return null;
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

    // For Solana tokens, delegate to the configured provider
    if (detectedChainType === BlockchainType.SVM) {
      this.logger.debug(
        `[MultiChainProvider] Getting batch prices for ${tokenAddresses.length} Solana tokens`,
      );
      try {
        const batchResults = await this.priceProvider.getBatchPrices(
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
        this.logger.debug(
          {
            error,
          },
          `[MultiChainProvider] Error fetching batch prices for Solana tokens:`,
        );
        // Set all tokens to null on error
        tokenAddresses.forEach((addr) => {
          results.set(addr, null);
        });
      }
      return results;
    }

    // For EVM tokens, handle batch processing
    this.logger.debug(
      `[MultiChainProvider] Getting batch prices for ${tokenAddresses.length} EVM tokens`,
    );

    // If a specific chain was provided, use it directly
    if (specificChain) {
      this.logger.debug(
        `[MultiChainProvider] Using provided specific chain: ${specificChain}`,
      );

      try {
        const batchResults = await this.priceProvider.getBatchPrices(
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
        this.logger.error(
          { error },
          `[MultiChainProvider] Error fetching batch prices for EVM tokens on ${specificChain}`,
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
        this.logger.debug(
          `[MultiChainProvider] Attempting to fetch batch prices for ${remainingTokens.size} tokens on ${chain} chain`,
        );

        const batchResults = await this.priceProvider.getBatchPrices(
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
        this.logger.debug(
          {
            error,
          },
          `[MultiChainProvider] Error fetching batch prices on ${chain} chain:`,
        );
        // Continue to next chain
        continue;
      }
    }

    // Set any remaining tokens to null
    remainingTokens.forEach((addr) => {
      results.set(addr, null);
    });

    this.logger.debug(
      `[MultiChainProvider] Batch processing complete. Found prices for ${results.size - remainingTokens.size} out of ${tokenAddresses.length} tokens`,
    );

    return results;
  }
}
