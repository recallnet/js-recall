import { ClientOptions, Coingecko } from "@coingecko/coingecko-typescript";
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
  mode: "pro" | "demo";
  specificChainTokens: SpecificChainTokens;
  logger: Logger;
}

export class CoinGeckoProvider implements PriceSource {
  private readonly API_KEY: string;
  private readonly mode: "pro" | "demo";
  private readonly client: Coingecko;
  private readonly MAX_RETRIES = 3; // Overrides default of 2
  private readonly MAX_TIMEOUT = 30_000; // Overrides default of 60 seconds
  private readonly BATCH_SIZE = 100; // CoinGecko supports up to 100 tokens per batch

  // See the following API for a list of the possible values: https://docs.coingecko.com/reference/asset-platforms-list
  // Note: an "asset platform" is the name of the chain. In CoinGecko's DEX APIs, there is a
  // similar field called "network", but it uses different values. We don't use this DEX API, but
  // it's important to note this distinction in case we ever need to in the future.
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
    this.mode = config.mode;
    this.specificChainTokens = config.specificChainTokens;
    this.logger = config.logger;

    // Non-production environments use a highly rate limited "demo" API key (30 req/min)
    const opts: ClientOptions = {
      environment: config.mode,
      maxRetries: this.MAX_RETRIES,
      fetchOptions: {
        timeout: this.MAX_TIMEOUT,
      },
      // Note: enable CoinGecko's native SDK logger with the environment variable `COINGECKO_LOG`
      logger: this.logger,
    };
    if (this.mode === "pro") {
      opts.proAPIKey = config.apiKey;
    } else {
      opts.demoAPIKey = config.apiKey;
    }
    this.client = new Coingecko(opts);
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
  ): Promise<DexScreenerTokenInfo | null> {
    try {
      const data = await this.client.coins.contract.get(
        tokenAddress.toLowerCase(),
        { id: platform },
      );

      if (data && data.market_data) {
        const price = data.market_data.current_price?.usd;
        if (!price || price === 0 || isNaN(price)) {
          this.logger.debug(
            {
              price,
              tokenAddress,
              platform,
            },
            `Invalid price for ${tokenAddress}`,
          );
          return null;
        }
        this.logger.debug(
          {
            price,
            tokenAddress,
            platform,
          },
          `Found price for ${tokenAddress}`,
        );
        return {
          price,
          symbol: data.symbol?.toUpperCase() || "N/A",
          volume: { h24: data.market_data.total_volume?.usd },
          liquidity: undefined,
          fdv: data.market_data.fully_diluted_valuation?.usd,
          pairCreatedAt: data.genesis_date
            ? new Date(data.genesis_date).getTime()
            : undefined,
        };
      }
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        `Error fetching price for ${tokenAddress} on ${platform}:`,
      );
    }
    this.logger.debug(
      {
        tokenAddress,
        platform,
      },
      `No valid price found for ${tokenAddress}`,
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
        `Burn address detected: ${tokenAddress}, returning price of 0`,
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
    const priceData = await this.fetchPriceDirect(tokenAddress, platform);
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
      this.logger.error(`Unsupported chain: ${specificChain}`);
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
    this.logger.debug(
      `Fetching batch prices for ${tokenAddresses.length} tokens on ${platform}`,
    );

    // Fetch prices for each token individually
    const promises = tokenAddresses.map(async (tokenAddress) => {
      const result = await this.fetchPriceDirect(tokenAddress, platform);
      return { tokenAddress, result };
    });

    const responses = await Promise.all(promises);

    // Populate results map
    for (const { tokenAddress, result } of responses) {
      results.set(tokenAddress, result);
    }

    return results;
  }
}
