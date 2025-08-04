import axios from "axios";

import config from "@/config/index.js";
import { serviceLogger } from "@/lib/logger.js";
import { PriceReport, PriceSource } from "@/types/index.js";
import { BlockchainType, SpecificChain } from "@/types/index.js";
import { DexScreenerResponse, DexScreenerTokenInfo } from "@/types/index.js";

/**
 * DexScreener price provider implementation
 * Uses DexScreener API to get token prices across multiple chains
 */
export class DexScreenerProvider implements PriceSource {
  private readonly API_BASE = "https://api.dexscreener.com/tokens/v1";
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 100;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  // Add cache for token prices with composite key (tokenAddress:specificChain)
  private readonly tokenPriceCache: Map<
    string,
    DexScreenerTokenInfo & {
      timestamp: number;
      chain: BlockchainType;
      specificChain: SpecificChain;
    }
  > = new Map();
  private readonly CACHE_DURATION = 3600000; // 1 hour in milliseconds

  // Mapping for DexScreener specific chain names
  private readonly chainMapping: Record<SpecificChain, string> = {
    eth: "ethereum",
    polygon: "polygon",
    bsc: "bsc",
    arbitrum: "arbitrum",
    optimism: "optimism",
    avalanche: "avalanche",
    base: "base",
    linea: "linea",
    zksync: "zksync",
    scroll: "scroll",
    mantle: "mantle",
    svm: "solana",
  };

  getName(): string {
    return "DexScreener";
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

  determineChain(tokenAddress: string): BlockchainType {
    // Simple heuristic: Solana tokens don't start with '0x'
    if (!tokenAddress.startsWith("0x")) {
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
  public isStablecoin(
    tokenAddress: string,
    specificChain: SpecificChain,
  ): boolean {
    // Check if this specific chain exists in our config
    if (!(specificChain in config.specificChainTokens)) return false;

    const chainTokens =
      config.specificChainTokens[
        specificChain as keyof typeof config.specificChainTokens
      ];

    const normalizedAddress = tokenAddress.toLowerCase();
    return (
      normalizedAddress === chainTokens.usdc?.toLowerCase() ||
      normalizedAddress === chainTokens.usdt?.toLowerCase()
    );
  }

  /**
   * Get the best trading pair for price fetching based on the token and chain
   */
  private getBestPairForPrice(
    tokenAddress: string,
    specificChain: SpecificChain,
  ): string | null {
    // Check if this specific chain exists in our config
    if (!(specificChain in config.specificChainTokens)) return null;

    const chainTokens =
      config.specificChainTokens[
        specificChain as keyof typeof config.specificChainTokens
      ];

    const normalizedAddress = tokenAddress.toLowerCase();

    // If token is USDC, pair it with USDT
    if (
      normalizedAddress === chainTokens.usdc?.toLowerCase() &&
      chainTokens.usdt
    ) {
      return `${chainTokens.usdc},${chainTokens.usdt}`;
    }

    // If token is USDT, pair it with USDC
    if (
      normalizedAddress === chainTokens.usdt?.toLowerCase() &&
      chainTokens.usdc
    ) {
      return `${chainTokens.usdt},${chainTokens.usdc}`;
    }

    // For other tokens, pair with USDC
    return `${tokenAddress},${chainTokens.usdc}`;
  }

  /**
   * Fetch token price from DexScreener API
   * @param tokenAddress The token address to fetch price for
   * @param dexScreenerChain The DexScreener chain identifier
   * @param specificChain The specific chain identifier
   * @returns Object containing price and symbol information, or null if not found
   */
  private async fetchPrice(
    tokenAddress: string,
    dexScreenerChain: string,
    specificChain: SpecificChain,
  ): Promise<DexScreenerTokenInfo | null> {
    // Try to get a better pairing for the token
    const pairTokens = this.getBestPairForPrice(tokenAddress, specificChain);

    if (!pairTokens) {
      serviceLogger.debug(
        `[DexScreenerProvider] Could not determine a suitable token pair for ${tokenAddress} on ${dexScreenerChain}`,
      );
      return null;
    }

    // Construct the URL with the token pair
    const url = `${this.API_BASE}/${dexScreenerChain}/${pairTokens}`;
    serviceLogger.debug(`[DexScreenerProvider] Fetching price from: ${url}`);

    let retries = 0;
    while (retries <= this.MAX_RETRIES) {
      try {
        // Enforce rate limiting
        await this.enforceRateLimit();

        // Make the API request
        const response = await axios.get(url);

        // Check if response has data
        if (
          response.data &&
          Array.isArray(response.data) &&
          response.data.length > 0
        ) {
          const normalizedAddress = tokenAddress.toLowerCase();
          const tokenIsStablecoin = this.isStablecoin(
            tokenAddress,
            specificChain,
          );

          // For regular tokens, find a pair where our token is the base token
          if (!tokenIsStablecoin) {
            const tokenAsPair = response.data.find(
              (pair) =>
                pair.baseToken?.address?.toLowerCase() === normalizedAddress &&
                pair.priceUsd &&
                !isNaN(parseFloat(pair.priceUsd)),
            );

            if (tokenAsPair) {
              serviceLogger.debug(
                `[DexScreenerProvider] Found price for ${tokenAddress} as base token: $${tokenAsPair.priceUsd}`,
              );
              return {
                price: parseFloat(tokenAsPair.priceUsd),
                symbol: tokenAsPair.baseToken?.symbol || "",
                pairCreatedAt: tokenAsPair.pairCreatedAt,
                volume: tokenAsPair.volume
                  ? { h24: tokenAsPair.volume.h24 }
                  : undefined,
                liquidity: tokenAsPair.liquidity
                  ? { usd: tokenAsPair.liquidity.usd }
                  : undefined,
                fdv: tokenAsPair.fdv,
              };
            }
          } else {
            // For stablecoins, we need more careful handling
            const chainTokens =
              config.specificChainTokens[
                specificChain as keyof typeof config.specificChainTokens
              ];

            // Find the best pair for stablecoin pricing
            const stablecoinPairs = response.data
              .filter((pair) => {
                // First, ensure our token appears in the pair
                const ourTokenIsBase =
                  pair.baseToken?.address?.toLowerCase() === normalizedAddress;
                const ourTokenIsQuote =
                  pair.quoteToken?.address?.toLowerCase() === normalizedAddress;

                // If our token doesn't appear in this pair, skip it
                if (!ourTokenIsBase && !ourTokenIsQuote) return false;

                // Check if it has a valid price
                if (!pair.priceUsd || isNaN(parseFloat(pair.priceUsd)))
                  return false;

                // Our token is the base token - this is ideal
                if (ourTokenIsBase) return true;

                // If our token is the quote token, it should be paired with a known stablecoin
                // to ensure accurate pricing
                if (ourTokenIsQuote) {
                  const pairedWithUsdc =
                    pair.baseToken?.address?.toLowerCase() ===
                    chainTokens.usdc?.toLowerCase();
                  const pairedWithUsdt =
                    pair.baseToken?.address?.toLowerCase() ===
                    chainTokens.usdt?.toLowerCase();
                  return pairedWithUsdc || pairedWithUsdt;
                }

                return false;
              })
              // And get max price
              .sort((a, b) => Number(b.priceNative) - Number(a.priceNative));

            const stablecoinPair = stablecoinPairs[0];

            if (stablecoinPair) {
              // Determine the correct price based on whether our token is base or quote
              const ourTokenIsBase =
                stablecoinPair.baseToken?.address?.toLowerCase() ===
                normalizedAddress;

              if (ourTokenIsBase) {
                // If our token is the base token, use the price directly
                serviceLogger.debug(
                  `[DexScreenerProvider] Found stablecoin ${tokenAddress} as base token: $${stablecoinPair.priceUsd}`,
                );
                return {
                  price: parseFloat(stablecoinPair.priceUsd),
                  symbol: stablecoinPair.baseToken?.symbol || "",
                  pairCreatedAt: stablecoinPair.pairCreatedAt,
                  volume: stablecoinPair.volume
                    ? { h24: stablecoinPair.volume.h24 }
                    : undefined,
                  liquidity: stablecoinPair.liquidity
                    ? { usd: stablecoinPair.liquidity.usd }
                    : undefined,
                  fdv: stablecoinPair.fdv,
                };
              } else {
                // For stablecoins that are quote tokens, we need to calculate the inverse price
                // Most stablecoin/stablecoin pairs are approximately 1:1
                serviceLogger.debug(
                  `[DexScreenerProvider] Found stablecoin ${tokenAddress} as quote token paired with another stablecoin`,
                );

                // For USDT/USDC pairs, price is usually very close to 1
                // But to be more accurate, we could calculate the inverse: 1 / priceNative
                if (stablecoinPair.priceNative) {
                  const inversePrice =
                    1 / parseFloat(stablecoinPair.priceNative);
                  serviceLogger.debug(
                    `[DexScreenerProvider] Calculated inverse price for stablecoin as quote token: $${inversePrice}`,
                  );
                  return {
                    price: inversePrice,
                    symbol: stablecoinPair.quoteToken?.symbol || "",
                    pairCreatedAt: stablecoinPair.pairCreatedAt,
                    volume: stablecoinPair.volume
                      ? { h24: stablecoinPair.volume.h24 }
                      : undefined,
                    liquidity: stablecoinPair.liquidity
                      ? { usd: stablecoinPair.liquidity.usd }
                      : undefined,
                    fdv: stablecoinPair.fdv,
                  };
                }

                // Fallback to approximate price if we can't calculate the inverse
                return {
                  price: 1.0,
                  symbol: stablecoinPair.quoteToken?.symbol || "",
                  pairCreatedAt: stablecoinPair.pairCreatedAt,
                  volume: stablecoinPair.volume
                    ? { h24: stablecoinPair.volume.h24 }
                    : undefined,
                  liquidity: stablecoinPair.liquidity
                    ? { usd: stablecoinPair.liquidity.usd }
                    : undefined,
                  fdv: stablecoinPair.fdv,
                };
              }
            }
          }

          // If we couldn't find a suitable pair, log and return null
          serviceLogger.debug(
            `[DexScreenerProvider] No suitable pairs found for ${tokenAddress} on ${dexScreenerChain}`,
          );
        }

        // If no valid price found in response
        serviceLogger.debug(
          `[DexScreenerProvider] No valid price found for ${tokenAddress}`,
        );
        return null;
      } catch (error) {
        serviceLogger.error(
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
    serviceLogger.debug(
      `[DexScreenerProvider] No reliable price found for ${tokenAddress} after ${this.MAX_RETRIES} retries`,
    );
    return null;
  }

  /**
   * Generates a cache key from token address and chain
   */
  private getCacheKey(
    tokenAddress: string,
    specificChain: SpecificChain,
  ): string {
    return `${tokenAddress.toLowerCase()}:${specificChain}`;
  }

  /**
   * Get cached token price if available
   */
  private getCachedPrice(
    tokenAddress: string,
    specificChain: SpecificChain,
  ):
    | (DexScreenerTokenInfo & {
        chain: BlockchainType;
        specificChain: SpecificChain;
      })
    | null {
    const cacheKey = this.getCacheKey(tokenAddress, specificChain);
    const cached = this.tokenPriceCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      serviceLogger.debug(
        `[DexScreenerProvider] Using cached price for ${tokenAddress} on ${specificChain}: $${cached.price}`,
      );
      return {
        price: cached.price,
        symbol: cached.symbol,
        chain: cached.chain,
        specificChain: cached.specificChain,
        pairCreatedAt: cached.pairCreatedAt,
        volume: cached.volume,
        liquidity: cached.liquidity,
        fdv: cached.fdv,
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
    symbol: string,
    pairCreatedAt?: number,
    volume?: { h24?: number },
    liquidity?: { usd?: number },
    fdv?: number,
  ): void {
    const cacheKey = this.getCacheKey(tokenAddress, specificChain);
    this.tokenPriceCache.set(cacheKey, {
      price,
      symbol,
      timestamp: Date.now(),
      chain,
      specificChain,
      pairCreatedAt,
      volume,
      liquidity,
      fdv,
    });

    serviceLogger.debug(
      `[DexScreenerProvider] Cached price for ${tokenAddress} on ${specificChain}: $${price}`,
    );
  }

  /**
   * Check if a token address is a burn address (dead address)
   */
  private isBurnAddress(tokenAddress: string): boolean {
    const normalizedAddress = tokenAddress.toLowerCase();

    // EVM dead address
    if (normalizedAddress === "0x000000000000000000000000000000000000dead") {
      return true;
    }

    // Solana dead address (incinerator)
    if (normalizedAddress === "1nc1nerator11111111111111111111111111111111") {
      return true;
    }

    return false;
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

    // Handle burn addresses - always return price of 0
    if (this.isBurnAddress(tokenAddress)) {
      serviceLogger.debug(
        `[DexScreenerProvider] Burn address detected: ${tokenAddress}, returning price of 0`,
      );

      return {
        price: 0,
        symbol: "BURN",
        token: tokenAddress,
        timestamp: new Date(),
        chain,
        specificChain,
        pairCreatedAt: undefined,
        volume: undefined,
        liquidity: undefined,
        fdv: undefined,
      };
    }

    // Check cache first
    const cachedPrice = this.getCachedPrice(tokenAddress, specificChain);
    if (cachedPrice !== null) {
      return {
        price: cachedPrice.price,
        symbol: cachedPrice.symbol,
        token: tokenAddress,
        timestamp: new Date(),
        chain: cachedPrice.chain,
        specificChain: cachedPrice.specificChain,
        pairCreatedAt: cachedPrice.pairCreatedAt,
        volume: cachedPrice.volume,
        liquidity: cachedPrice.liquidity,
        fdv: cachedPrice.fdv,
      };
    }

    // Get the DexScreener chain identifier
    const dexScreenerChain = this.getDexScreenerChain(
      tokenAddress,
      chain,
      specificChain,
    );

    // Fetch the price
    const price = await this.fetchPrice(
      tokenAddress,
      dexScreenerChain,
      specificChain,
    );

    if (price !== null) {
      // Cache the price
      this.setCachedPrice(
        tokenAddress,
        chain,
        specificChain,
        price.price,
        price.symbol,
        price.pairCreatedAt,
        price.volume,
        price.liquidity,
        price.fdv,
      );

      return {
        price: price.price,
        symbol: price.symbol,
        token: tokenAddress,
        timestamp: new Date(),
        chain,
        specificChain,
        pairCreatedAt: price.pairCreatedAt,
        volume: price.volume,
        liquidity: price.liquidity,
        fdv: price.fdv,
      };
    }
    return null;
  }

  /**
   * Check if the provider supports this token
   */
  async supports(
    tokenAddress: string,
    specificChain: SpecificChain,
  ): Promise<boolean> {
    // Always support burn addresses
    if (this.isBurnAddress(tokenAddress)) {
      return true;
    }

    // Check cache first
    if (this.getCachedPrice(tokenAddress, specificChain) !== null) {
      return true;
    }

    const chain = this.determineChain(tokenAddress);

    // Try to get a price - if successful, we support it
    const price = await this.getPrice(tokenAddress, chain, specificChain);
    return price !== null;
  }

  /**
   * Get prices for multiple tokens in batches
   * @param tokenAddresses Array of token addresses
   * @param chain Blockchain type
   * @param specificChain Specific chain identifier
   * @returns Map of token addresses to their price information
   */
  async getBatchPrices(
    tokenAddresses: string[],
    chain: BlockchainType,
    specificChain: SpecificChain,
  ): Promise<Map<string, DexScreenerTokenInfo | null>> {
    // Ensure we don't exceed the 30 token limit
    const MAX_BATCH_SIZE = 30;
    const results = new Map<string, DexScreenerTokenInfo | null>();

    // Process tokens in batches of up to 30
    for (let i = 0; i < tokenAddresses.length; i += MAX_BATCH_SIZE) {
      const chunk = tokenAddresses.slice(i, i + MAX_BATCH_SIZE);
      const batchResults = await this.fetchBatchPrices(
        chunk,
        chain,
        specificChain,
      );

      // Merge results
      batchResults.forEach((result, address) => {
        results.set(address, result);
      });
    }

    // After batch processing, retry null values individually. This is needed
    // in case the dexscreener api returns the wrong quote token and
    // miscalculates priceUsd
    const nullTokens: string[] = [];
    results.forEach((result, address) => {
      if (result === null) {
        nullTokens.push(address);
      }
    });

    if (nullTokens.length > 0) {
      serviceLogger.debug(
        `[DexScreenerProvider] Retrying ${nullTokens.length} tokens individually after batch processing`,
      );

      // Retry each null token individually
      for (const tokenAddress of nullTokens) {
        try {
          const individualResult = await this.getPrice(
            tokenAddress,
            chain,
            specificChain,
          );

          if (individualResult) {
            results.set(tokenAddress, {
              price: individualResult.price,
              symbol: individualResult.symbol,
              pairCreatedAt: individualResult.pairCreatedAt,
              volume: individualResult.volume,
              liquidity: individualResult.liquidity,
              fdv: individualResult.fdv,
            });
            serviceLogger.debug(
              `[DexScreenerProvider] Individual retry successful for ${tokenAddress}: $${individualResult.price} (${individualResult.symbol})`,
            );
          } else {
            serviceLogger.debug(
              `[DexScreenerProvider] Individual retry failed for ${tokenAddress}`,
            );
          }
        } catch (error) {
          serviceLogger.error(
            `[DexScreenerProvider] Error during individual retry for ${tokenAddress}:`,
            error instanceof Error ? error.message : "Unknown error",
          );
        }
      }
    }

    return results;
  }

  /**
   * Fetch prices for a batch of tokens using DexScreener API
   * @param tokenAddresses Array of token addresses (max 30)
   * @param chain Blockchain type
   * @param specificChain Specific chain identifier
   * @returns Map of token addresses to their price information
   */
  private async fetchBatchPrices(
    tokenAddresses: string[],
    chain: BlockchainType,
    specificChain: SpecificChain,
  ): Promise<Map<string, DexScreenerTokenInfo | null>> {
    const results = new Map<string, DexScreenerTokenInfo | null>();

    // Normalize addresses and check cache first
    const normalizedAddresses = tokenAddresses.map((addr) =>
      addr.toLowerCase(),
    );
    const uncachedAddresses: string[] = [];

    for (const normalizedAddr of normalizedAddresses) {
      const originalAddr = tokenAddresses.find(
        (addr) => addr.toLowerCase() === normalizedAddr,
      );
      if (!originalAddr) continue;

      // Check for burn addresses
      if (this.isBurnAddress(normalizedAddr)) {
        results.set(originalAddr, {
          price: 0,
          symbol: "BURN",
          pairCreatedAt: undefined,
          volume: undefined,
          liquidity: undefined,
          fdv: undefined,
        });
        continue;
      }

      // Check cache
      const cachedPrice = this.getCachedPrice(normalizedAddr, specificChain);
      if (cachedPrice !== null) {
        results.set(originalAddr, {
          price: cachedPrice.price,
          symbol: cachedPrice.symbol,
          pairCreatedAt: cachedPrice.pairCreatedAt,
          volume: cachedPrice.volume,
          liquidity: cachedPrice.liquidity,
          fdv: cachedPrice.fdv,
        });
      } else {
        uncachedAddresses.push(originalAddr);
      }
    }

    // If all tokens were cached or burn addresses, return early
    if (
      uncachedAddresses.length === 0 ||
      typeof uncachedAddresses[0] === "undefined"
    ) {
      return results;
    }

    const firstAddress = uncachedAddresses[0];

    const dexScreenerChain = this.getDexScreenerChain(
      firstAddress,
      chain,
      specificChain,
    );

    // Join addresses with comma for batch request
    const addressesParam = uncachedAddresses
      .map((addr) => addr.toLowerCase())
      .join(",");
    const url = `${this.API_BASE}/${dexScreenerChain}/${addressesParam}`;

    serviceLogger.debug(
      `[DexScreenerProvider] Fetching batch prices from: ${url}`,
    );
    serviceLogger.debug(
      `[DexScreenerProvider] Batch size: ${uncachedAddresses.length} tokens`,
    );

    let retries = 0;
    while (retries <= this.MAX_RETRIES) {
      try {
        // Enforce rate limiting
        await this.enforceRateLimit();

        // Make the API request
        const response = await axios.get(url);

        // Check if response has data
        if (
          response.data &&
          Array.isArray(response.data) &&
          response.data.length > 0
        ) {
          // Process each token in the batch
          for (const originalAddr of uncachedAddresses) {
            const normalizedAddr = originalAddr.toLowerCase();
            const tokenPrice = this.extractPriceUsd(
              normalizedAddr,
              response.data,
              specificChain,
            );

            if (tokenPrice) {
              // Cache the price
              this.setCachedPrice(
                normalizedAddr,
                chain,
                specificChain,
                tokenPrice.price,
                tokenPrice.symbol,
                tokenPrice.pairCreatedAt,
                tokenPrice.volume,
                tokenPrice.liquidity,
                tokenPrice.fdv,
              );

              results.set(originalAddr, tokenPrice);
              serviceLogger.debug(
                `[DexScreenerProvider] Found batch price for ${originalAddr}: $${tokenPrice.price} (${tokenPrice.symbol})`,
              );
            } else {
              results.set(originalAddr, null);
              serviceLogger.debug(
                `[DexScreenerProvider] No price found for ${originalAddr} in batch response`,
              );
            }
          }
        } else {
          serviceLogger.debug(
            `[DexScreenerProvider] No data returned for batch request: ${url}`,
          );
          // Set all uncached tokens to null
          uncachedAddresses.forEach((addr) => {
            results.set(addr, null);
          });
        }

        return results;
      } catch (error) {
        serviceLogger.error(
          `[DexScreenerProvider] Error fetching batch prices (attempt ${retries + 1}):`,
          error instanceof Error ? error.message : "Unknown error",
        );

        retries++;
        if (retries <= this.MAX_RETRIES) {
          await this.delay(this.RETRY_DELAY * retries);
        }
      }
    }

    serviceLogger.error(
      `[DexScreenerProvider] Failed to fetch batch prices after ${this.MAX_RETRIES} retries`,
    );

    // Set all uncached tokens to null on failure
    uncachedAddresses.forEach((addr) => {
      results.set(addr, null);
    });

    return results;
  }

  private extractPriceUsd(
    addr: string,
    data: DexScreenerResponse,
    specificChain: SpecificChain,
  ): DexScreenerTokenInfo | null {
    // Find the pair where our token is the base token
    const result = data.find(
      (pair) => pair.baseToken?.address?.toLowerCase() === addr.toLowerCase(),
    );

    if (
      result?.quoteToken &&
      !this.isStablecoin(result.quoteToken.address, specificChain)
    ) {
      // TODO: if the quote token isn't a stable coin then it seems the DexScreener
      //  api returns an invalid value for the priceUsd...

      return null;
    }

    if (!result || !result.priceUsd || isNaN(parseFloat(result.priceUsd))) {
      return null;
    }

    return {
      price: parseFloat(result.priceUsd),
      symbol: result.baseToken.symbol || "",
      pairCreatedAt: result.pairCreatedAt,
      volume: result.volume ? { h24: result.volume.h24 } : undefined,
      liquidity: result.liquidity ? { usd: result.liquidity.usd } : undefined,
      fdv: result.fdv,
    };
  }
}
