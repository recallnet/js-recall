import { Coingecko } from "@coingecko/coingecko-typescript";
import { Logger } from "pino";

import {
  BlockchainType,
  DexScreenerTokenInfo,
  PriceReport,
  PriceSource,
  SpecificChain,
  SpecificChainTokens,
} from "../types/index.js";

/**
 * Configuration for different provider types
 */
export interface CoinGeckoProviderConfig {
  apiKey: string;
  specificChainTokens: SpecificChainTokens;
  logger: Logger;
}

export class CoinGeckoProvider implements PriceSource {
  private readonly API_KEY: string;
  private readonly client: Coingecko;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  private readonly BATCH_SIZE = 100; // CoinGecko supports up to 100 tokens per batch
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 100; // Rate limiting

  private readonly chainMapping: Record<SpecificChain, string> = {
    eth: "ethereum",
    polygon: "polygon-pos",
    bsc: "binance-smart-chain",
    arbitrum: "arbitrum-one",
    optimism: "optimistic-ethereum",
    avalanche: "avalanche",
    base: "base",
    linea: "linea",
    zksync: "zksync",
    scroll: "scroll",
    mantle: "mantle",
    svm: "solana",
  };
  private specificChainTokens: SpecificChainTokens;
  private logger: Logger;

  constructor(config: CoinGeckoProviderConfig) {
    this.API_KEY = config.apiKey;
    this.specificChainTokens = config.specificChainTokens;
    this.logger = config.logger;
    // Initialize CoinGecko client with Pro API key
    this.client = new Coingecko({
      // TODO: handle demo vs pro mode
      // proAPIKey: config.api.coingecko.apiKey || "",
      // environment: "pro",
      demoAPIKey: config.apiKey,
      environment: "demo",
      maxRetries: 0, // We handle retries manually
    });
  }

  getName(): string {
    return "CoinGecko";
  }

  determineChain(tokenAddress: string): BlockchainType {
    if (!tokenAddress.startsWith("0x")) {
      return BlockchainType.SVM;
    }
    return BlockchainType.EVM;
  }

  public isStablecoin(
    tokenAddress: string,
    specificChain: SpecificChain,
  ): boolean {
    if (!(specificChain in this.specificChainTokens)) return false;
    const chainTokens =
      this.specificChainTokens[
        specificChain as keyof typeof this.specificChainTokens
      ];
    const normalizedAddress = tokenAddress.toLowerCase();
    return (
      normalizedAddress === chainTokens?.usdc?.toLowerCase() ||
      normalizedAddress === chainTokens?.usdt?.toLowerCase()
    );
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

  private isBurnAddress(tokenAddress: string): boolean {
    const normalizedAddress = tokenAddress.toLowerCase();
    if (normalizedAddress === "0x000000000000000000000000000000000000dead") {
      return true;
    }
    if (normalizedAddress === "1nc1nerator11111111111111111111111111111111") {
      return true;
    }
    return false;
  }

  /**
   * Fetch coin data directly using contract address and platform
   */
  private async fetchPriceDirect(
    tokenAddress: string,
    platform: string,
    specificChain: SpecificChain,
  ): Promise<DexScreenerTokenInfo | null> {
    this.logger.debug(
      `[CoinGeckoProvider] Fetching price for ${tokenAddress} on ${platform}`,
    );

    let retries = 0;
    while (retries <= this.MAX_RETRIES) {
      try {
        // Enforce rate limiting
        await this.enforceRateLimit();

        // Use the SDK to fetch coin data by contract address
        const data = await this.client.coins.contract.get(
          tokenAddress.toLowerCase(),
          { id: platform },
        );

        if (data && data.market_data) {
          const price = data.market_data.current_price?.usd || 0;

          if (price === 0 || isNaN(price)) {
            this.logger.debug(
              `[CoinGeckoProvider] Invalid price for ${tokenAddress} on ${platform}`,
            );
            return null;
          }

          // Handle symbol for stablecoins
          let symbol = data.symbol?.toUpperCase() || "";
          if (this.isStablecoin(tokenAddress, specificChain)) {
            // For stablecoins, ensure we use the correct symbol
            symbol =
              symbol === "USDC" || price.toString().startsWith("1")
                ? "USDC"
                : "USDT";
          }

          this.logger.debug(
            `[CoinGeckoProvider] Found price for ${tokenAddress}: $${price}`,
          );

          return {
            price,
            symbol,
            volume: data.market_data.total_volume?.usd
              ? { h24: data.market_data.total_volume.usd }
              : undefined,
            liquidity: undefined, // CoinGecko doesn't provide direct liquidity data
            fdv: data.market_data.fully_diluted_valuation?.usd || undefined,
            pairCreatedAt: undefined, // Not available from CoinGecko
          };
        }

        this.logger.debug(
          `[CoinGeckoProvider] No valid price found for ${tokenAddress} on ${platform}`,
        );
        return null;
      } catch (error) {
        this.logger.error(
          error instanceof Error ? error.message : "Unknown error",
          `Error fetching price from CoinGecko for ${tokenAddress} on ${platform}:`,
        );

        retries++;
        if (retries <= this.MAX_RETRIES) {
          await this.delay(this.RETRY_DELAY * retries); // Exponential backoff
        }
      }
    }

    this.logger.debug(
      `[CoinGeckoProvider] No reliable price found for ${tokenAddress} on ${platform} after ${this.MAX_RETRIES} retries`,
    );
    return null;
  }

  async getPrice(
    tokenAddress: string,
    chain: BlockchainType,
    specificChain: SpecificChain,
  ): Promise<PriceReport | null> {
    if (this.isBurnAddress(tokenAddress)) {
      this.logger.debug(
        `[CoinGeckoProvider] Burn address detected: ${tokenAddress}, returning price of 0`,
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
    const platform = this.chainMapping[specificChain] || "ethereum";
    const priceData = await this.fetchPriceDirect(
      tokenAddress,
      platform,
      specificChain,
    );
    if (priceData !== null) {
      return {
        price: priceData.price,
        symbol: priceData.symbol,
        token: tokenAddress,
        timestamp: new Date(),
        chain,
        specificChain,
        pairCreatedAt: undefined,
        volume: priceData.volume,
        liquidity: undefined,
        fdv: priceData.fdv,
      };
    }
    return null;
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
    const results = new Map<string, DexScreenerTokenInfo | null>();

    if (tokenAddresses.length === 0) {
      return results;
    }

    const platform = this.chainMapping[specificChain];
    if (!platform) {
      this.logger.error(
        `[CoinGeckoProvider] Unsupported chain: ${specificChain}`,
      );
      tokenAddresses.forEach((addr) => {
        results.set(addr, null);
      });
      return results;
    }

    // Handle burn addresses
    const addressesToFetch: string[] = [];
    for (const tokenAddress of tokenAddresses) {
      if (this.isBurnAddress(tokenAddress)) {
        results.set(tokenAddress, {
          price: 0,
          symbol: "BURN",
          pairCreatedAt: undefined,
          volume: undefined,
          liquidity: undefined,
          fdv: undefined,
        });
      } else {
        addressesToFetch.push(tokenAddress);
      }
    }

    // Process tokens in batches
    for (let i = 0; i < addressesToFetch.length; i += this.BATCH_SIZE) {
      const batch = addressesToFetch.slice(i, i + this.BATCH_SIZE);
      const batchResults = await this.fetchBatchPrices(batch, platform);

      // Merge batch results
      batchResults.forEach((value, key) => {
        results.set(key, value);
      });
    }

    return results;
  }

  /**
   * Fetch prices for a batch of tokens using CoinGecko API
   * @param tokenAddresses Array of token addresses (max 100)
   * @param platform CoinGecko platform identifier
   * @returns Map of token addresses to their price information
   */
  private async fetchBatchPrices(
    tokenAddresses: string[],
    platform: string,
  ): Promise<Map<string, DexScreenerTokenInfo | null>> {
    const results = new Map<string, DexScreenerTokenInfo | null>();

    // Normalize addresses to lowercase for the API
    const contractAddresses = tokenAddresses
      .map((addr) => addr.toLowerCase())
      .join(",");

    this.logger.debug(
      `[CoinGeckoProvider] Fetching batch prices for ${tokenAddresses.length} tokens on ${platform}`,
    );

    let retries = 0;
    while (retries <= this.MAX_RETRIES) {
      try {
        // Enforce rate limiting
        await this.enforceRateLimit();

        // Use the SDK to fetch batch token prices
        const data = await this.client.simple.tokenPrice.getID(platform, {
          contract_addresses: contractAddresses,
          vs_currencies: "usd",
          include_market_cap: true,
          include_24hr_vol: true,
          include_24hr_change: false,
          include_last_updated_at: false,
        });

        // Process the response
        // The response is a map where keys are contract addresses
        interface TokenPriceData {
          usd?: number;
          usd_24h_vol?: number;
          usd_market_cap?: number;
        }
        const responseData = data as Record<string, TokenPriceData>;

        for (const tokenAddress of tokenAddresses) {
          const normalizedAddr = tokenAddress.toLowerCase();
          const tokenData = responseData[normalizedAddr];

          if (tokenData && tokenData.usd !== undefined) {
            // For batch endpoint, we only get basic price data
            // Symbol would need to be fetched separately or cached
            results.set(tokenAddress, {
              price: tokenData.usd,
              symbol: "", // Not available in batch response
              volume: tokenData.usd_24h_vol
                ? { h24: tokenData.usd_24h_vol }
                : undefined,
              liquidity: undefined,
              fdv: tokenData.usd_market_cap || undefined,
              pairCreatedAt: undefined,
            });

            this.logger.debug(
              `[CoinGeckoProvider] Found batch price for ${tokenAddress}: $${tokenData.usd}`,
            );
          } else {
            results.set(tokenAddress, null);
            this.logger.debug(
              `[CoinGeckoProvider] No price found for ${tokenAddress} in batch response`,
            );
          }
        }

        return results;
      } catch (error) {
        this.logger.error(
          error instanceof Error ? error.message : "Unknown error",
          `[CoinGeckoProvider] Error fetching batch prices (attempt ${retries + 1}):`,
        );

        retries++;
        if (retries <= this.MAX_RETRIES) {
          await this.delay(this.RETRY_DELAY * retries);
        }
      }
    }

    this.logger.error(
      `[CoinGeckoProvider] Failed to fetch batch prices after ${this.MAX_RETRIES} retries`,
    );

    // Set all addresses to null on failure
    tokenAddresses.forEach((addr) => {
      results.set(addr, null);
    });

    return results;
  }
}
