import { ClientOptions, Coingecko } from "@coingecko/coingecko-typescript";
import { TokenGetAddressResponse } from "@coingecko/coingecko-typescript/resources/onchain/networks/tokens/tokens.mjs";
import { Logger } from "pino";
import { z } from "zod";

import {
  BlockchainType,
  CoinGeckoMode,
  DexScreenerTokenInfo,
  PriceReport,
  PriceSource,
  SpecificChain,
  SpecificChainTokens,
} from "../../types/index.js";

/**
 * Configuration for different provider types
 */
export interface CoinGeckoProviderConfig {
  apiKey: string;
  mode: CoinGeckoMode;
  specificChainTokens: SpecificChainTokens;
}

/**
 * Subset of the CoinGecko onchain response used in the price provider
 */
export const OnchainResponseSchema = z.object({
  data: z.object({
    attributes: z.object({
      symbol: z.string(),
      price_usd: z.string(),
      volume_usd: z.object({
        h24: z.string(),
      }),
      total_reserve_in_usd: z.string(),
      fdv_usd: z.string(),
    }),
  }),
  included: z.array(
    z.object({
      attributes: z.object({
        pool_created_at: z.string(),
      }),
    }),
  ),
});

/**
 * CoinGecko onchain response type (subset of the full response)
 */
export type OnchainResponse = z.infer<typeof OnchainResponseSchema>;

/**
 * CoinGecko price provider implementation
 * Provides cryptocurrency price data using the CoinGecko API
 */
export class CoinGeckoProvider implements PriceSource {
  private readonly client: Coingecko;
  private readonly MAX_RETRIES = 3; // Overrides default of 2
  private readonly MAX_TIMEOUT = 30_000; // Overrides default of 60 seconds
  private readonly BATCH_SIZE = 100; // CoinGecko supports up to 100 tokens per batch
  private specificChainTokens: SpecificChainTokens;
  private logger: Logger;

  // See the following API for a list of the possible values: https://docs.coingecko.com/reference/networks-list
  private readonly networkMapping: Record<SpecificChain, string> = {
    eth: "eth",
    polygon: "polygon_pos",
    bsc: "bsc",
    arbitrum: "arbitrum", // Arbitrum One
    optimism: "optimism",
    avalanche: "avax",
    base: "base",
    linea: "linea",
    zksync: "zksync",
    scroll: "scroll",
    mantle: "mantle",
    svm: "solana",
  };

  /**
   * Creates a new CoinGecko provider instance
   * Initializes the CoinGecko client with appropriate configuration based on environment
   */
  constructor(config: CoinGeckoProviderConfig, logger: Logger) {
    this.specificChainTokens = config.specificChainTokens;
    this.logger = logger;

    const { apiKey, mode } = config;
    const opts: ClientOptions = {
      environment: mode,
      maxRetries: this.MAX_RETRIES,
      timeout: this.MAX_TIMEOUT,
    };
    // Note: CoinGecko has different endpoints, depending on the mode (free vs. paid)
    if (mode === "pro") {
      opts.proAPIKey = apiKey;
    } else {
      opts.demoAPIKey = apiKey;
    }
    this.client = new Coingecko(opts);
  }

  /**
   * Gets the name of this price provider
   * @returns The provider name "CoinGecko"
   */
  getName(): string {
    return "CoinGecko";
  }

  /**
   * Determines the blockchain type based on token address format
   * @param tokenAddress - The token contract address
   * @returns The blockchain type (EVM or SVM)
   */
  determineChain(tokenAddress: string): BlockchainType {
    if (!tokenAddress.startsWith("0x")) {
      return BlockchainType.SVM;
    }
    return BlockchainType.EVM;
  }

  /**
   * Checks if a token is a stablecoin (USDC or USDT) on the specified chain
   * @param tokenAddress - The token contract address
   * @param specificChain - The specific blockchain identifier
   * @returns True if the token is a known stablecoin, false otherwise
   */
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

  /**
   * Checks if a token address is a known burn address
   * @param tokenAddress - The token contract address to check
   * @returns True if the address is a burn address, false otherwise
   */
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
   * Get the created at timestamp from the token's oldest pool:
   * - There are multiple pools for a token, and we want to use the oldest one since this is part
   *   of how we enforce trading constraints.
   * - The timestamp is natively in ISO 8601 format and must be converted to unix.
   * @param pools - The token pools for the token
   * @returns The created at timestamp
   */
  private getCreatedAtFromPools(
    pools: TokenGetAddressResponse.Included[],
  ): number | undefined {
    const poolsWithTimestamps = pools.filter(
      (p) => p.attributes?.pool_created_at,
    );
    if (poolsWithTimestamps.length === 0) {
      return undefined;
    }
    // Note: the timestamps are guaranteed to be non-null because we filtered above
    const sorted = poolsWithTimestamps.sort((a, b) => {
      const aTime = new Date(a.attributes!.pool_created_at!).getTime();
      const bTime = new Date(b.attributes!.pool_created_at!).getTime();
      return aTime - bTime;
    });
    return new Date(sorted[0]!.attributes!.pool_created_at!).getTime();
  }

  /**
   * Validate the onchain response for a token
   * @param data - The token data
   * @param pools - The token pools
   * @returns The token info
   */
  private parseOnchainResponse(
    response: TokenGetAddressResponse,
  ): DexScreenerTokenInfo {
    const {
      success,
      error,
      data: parsedData,
    } = OnchainResponseSchema.safeParse(response);
    if (!success) {
      throw new Error(
        `Invalid CoinGecko response for ${response.data?.attributes?.address || "token"}: ${error}`,
      );
    }
    const { data, included: pools } = parsedData;
    const { symbol, price_usd, volume_usd, total_reserve_in_usd, fdv_usd } =
      data.attributes;
    return {
      price: parseFloat(price_usd),
      symbol: symbol.toUpperCase(),
      pairCreatedAt: this.getCreatedAtFromPools(pools),
      volume: { h24: parseFloat(volume_usd.h24) },
      liquidity: { usd: parseFloat(total_reserve_in_usd) },
      fdv: parseFloat(fdv_usd),
    };
  }

  /**
   * Fetch price data from CoinGecko onchain API
   * @param tokenAddress - The token contract address
   * @param network - The CoinGecko network identifier (e.g., "ethereum", "solana")
   * @returns The token info
   */
  private async fetchPrice(
    tokenAddress: string,
    network: string,
  ): Promise<DexScreenerTokenInfo | null> {
    try {
      const response = await this.client.onchain.networks.tokens.getAddress(
        tokenAddress,
        {
          network,
          include_composition: true,
          // Note: we need the information below in order to get the `pool_created_at` timestamp.
          // There is also information like base vs. quote token, volume, etc., which could open
          // up other trading flows (e.g., only allow explicitly paired addresses).
          include: "top_pools",
        },
      );
      return this.parseOnchainResponse(response);
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          tokenAddress,
          network,
        },
        `Error fetching price`,
      );
      return null;
    }
  }

  /**
   * Gets the current price and market data for a single token
   * @param tokenAddress - The token contract address
   * @param chain - The blockchain type (EVM or SVM)
   * @param specificChain - The specific blockchain identifier
   * @returns A price report with token information, or null if not found
   */
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
    const platform = this.networkMapping[specificChain] || "ethereum";
    const priceData = await this.fetchPrice(tokenAddress, platform);
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
   * @param tokenAddresses - Array of token addresses to fetch prices for
   * @param chain - Blockchain type (EVM or SVM)
   * @param specificChain - Specific chain identifier
   * @returns Map of token addresses to their price information (null if not found)
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

    const platform = this.networkMapping[specificChain];
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
   * @param tokenAddresses - Array of token addresses (max 100 per batch)
   * @param platform - CoinGecko platform identifier (e.g., "ethereum", "polygon-pos")
   * @returns Map of token addresses to their price information (null if not found)
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
      const result = await this.fetchPrice(tokenAddress, platform);
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
