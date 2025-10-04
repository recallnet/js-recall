import { ClientOptions, Coingecko } from "@coingecko/coingecko-typescript";
import { TokenGetAddressResponse } from "@coingecko/coingecko-typescript/resources/onchain/networks";
import { PublicKey } from "@solana/web3.js";
import { Logger } from "pino";
import { checksumAddress } from "viem";
import { z } from "zod";

import {
  BlockchainType,
  CoinGeckoMode,
  PriceReport,
  PriceSource,
  SpecificChain,
  SpecificChainTokens,
  TokenInfo,
} from "../../types/index.js";

/**
 * Configuration for the CoinGecko provider
 */
export interface CoinGeckoProviderConfig {
  apiKey: string;
  mode: CoinGeckoMode;
  specificChainTokens: SpecificChainTokens;
}

/**
 * CoinGecko network identifiers
 */
type CoinGeckoNetwork =
  | "eth"
  | "polygon_pos"
  | "bsc"
  | "arbitrum"
  | "optimism"
  | "avax"
  | "base"
  | "linea"
  | "zksync"
  | "scroll"
  | "mantle"
  | "solana";

/**
 * CoinGecko network mapping from `SpecificChain` to CoinGecko network identifier
 */
const COINGECKO_NETWORKS = {
  eth: "eth",
  polygon: "polygon_pos",
  bsc: "bsc",
  arbitrum: "arbitrum",
  optimism: "optimism",
  avalanche: "avax",
  base: "base",
  linea: "linea",
  zksync: "zksync",
  scroll: "scroll",
  mantle: "mantle",
  svm: "solana",
} as const satisfies Record<SpecificChain, CoinGeckoNetwork>;

/**
 * Subset of the CoinGecko onchain response used in the price provider
 */
const OnchainResponseSchema = z.object({
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
 * CoinGecko price provider implementation
 * Provides cryptocurrency price data using the CoinGecko API
 */
export class CoinGeckoProvider implements PriceSource {
  private readonly client: Coingecko;
  private readonly MAX_RETRIES = 3; // Overrides default of 2
  private readonly MAX_TIMEOUT = 30_000; // Overrides default of 60 seconds
  private specificChainTokens: SpecificChainTokens;
  private logger: Logger;

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
    return tokenAddress.startsWith("0x")
      ? BlockchainType.EVM
      : BlockchainType.SVM;
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
    const chainTokens = this.specificChainTokens[specificChain];
    if (!chainTokens || !chainTokens.usdc || !chainTokens.usdt) return false;
    const normalizedAddress = this.normalizeAddress(tokenAddress);
    const normalizedUsdc = this.normalizeAddress(chainTokens.usdc);
    const normalizedUsdt = this.normalizeAddress(chainTokens.usdt);
    return (
      normalizedAddress === normalizedUsdc ||
      normalizedAddress === normalizedUsdt
    );
  }

  /**
   * Converts a Solana address to its canonical base58 encoded representation
   * @param addr - The Solana address to convert
   * @returns The canonical base58 representation of the address
   * @throws If the address is invalid (wrong length, alphabet, or incorrect case)
   */
  private toCanonicalSolanaAddress(addr: string): string {
    const pk = new PublicKey(addr);
    return pk.toBase58();
  }

  /**
   * Normalizes a token address for proper API calls and comparisons
   * @param tokenAddress - The token address to normalize
   * @returns Normalized token address
   * @throws If the token address is invalid
   */
  private normalizeAddress(tokenAddress: string): string {
    try {
      return tokenAddress.startsWith("0x")
        ? checksumAddress(tokenAddress as `0x${string}`)
        : this.toCanonicalSolanaAddress(tokenAddress);
    } catch {
      throw new Error(`Invalid token address: ${tokenAddress}`);
    }
  }

  /**
   * Checks if a token address is a known burn address
   * @param tokenAddress - The token contract address to check. Expected to be checksummed.
   * @returns True if the address is a burn address, false otherwise
   */
  private isBurnAddress(tokenAddress: string): boolean {
    if (
      tokenAddress === "0x000000000000000000000000000000000000dEaD" ||
      tokenAddress === "1nc1nerator11111111111111111111111111111111"
    ) {
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
  private getCreatedAtTimestampFromPools(
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
    const oldestPool = sorted[0];
    if (
      oldestPool &&
      oldestPool.attributes &&
      oldestPool.attributes.pool_created_at
    ) {
      return new Date(oldestPool.attributes.pool_created_at).getTime();
    }
    return undefined;
  }

  /**
   * Validate the onchain response for a token
   * @param data - The token data
   * @param pools - The token pools
   * @returns The token info
   */
  private parseOnchainResponse(response: TokenGetAddressResponse): TokenInfo {
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
      pairCreatedAt: this.getCreatedAtTimestampFromPools(pools),
      volume: { h24: parseFloat(volume_usd.h24) },
      liquidity: { usd: parseFloat(total_reserve_in_usd) },
      fdv: parseFloat(fdv_usd),
    };
  }

  /**
   * Fetch price data from CoinGecko onchain API
   * @param tokenAddress - The token contract address (expected to be normalized as canonical base58 or checksummed)
   * @param network - The CoinGecko network identifier (e.g., "ethereum", "solana")
   * @returns The token info
   */
  private async fetchPrice(
    tokenAddress: string,
    network: CoinGeckoNetwork,
  ): Promise<TokenInfo | null> {
    try {
      const response = await this.client.onchain.networks.tokens.getAddress(
        tokenAddress,
        {
          network,
          include_composition: true,
          // Note: we need the information below in order to get the `pool_created_at` timestamp.
          // There is also information like base vs. quote token, volume, etc., which could open
          // opportunities for other trading flows (e.g., only allow explicitly paired addresses).
          include: "top_pools",
        },
      );
      return this.parseOnchainResponse(response);
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : JSON.stringify(error),
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
    try {
      const network = COINGECKO_NETWORKS[specificChain];
      if (!network) {
        this.logger.error(`Unsupported chain: ${specificChain}`);
        return null;
      }
      const address = this.normalizeAddress(tokenAddress);
      if (this.isBurnAddress(address)) {
        return {
          price: 0,
          symbol: "BURN",
          token: address,
          timestamp: new Date(),
          chain,
          specificChain,
          pairCreatedAt: undefined,
          volume: undefined,
          liquidity: undefined,
          fdv: undefined,
        };
      }
      const priceData = await this.fetchPrice(address, network);
      if (priceData) {
        return {
          price: priceData.price,
          symbol: priceData.symbol,
          token: address,
          timestamp: new Date(),
          chain,
          specificChain,
          pairCreatedAt: priceData.pairCreatedAt,
          volume: priceData.volume,
          liquidity: priceData.liquidity,
          fdv: priceData.fdv,
        };
      }
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : JSON.stringify(error),
          tokenAddress,
          chain,
          specificChain,
        },
        `Error fetching price`,
      );
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
  ): Promise<Map<string, TokenInfo | null>> {
    const results = new Map<string, TokenInfo | null>();
    if (tokenAddresses.length === 0) {
      return results;
    }

    const promises = tokenAddresses.map(async (tokenAddress) => {
      const priceReport = await this.getPrice(
        tokenAddress,
        chain,
        specificChain,
      );
      return { tokenAddress, priceReport };
    });

    const responses = await Promise.all(promises);
    for (const { tokenAddress, priceReport } of responses) {
      if (priceReport) {
        results.set(tokenAddress, {
          price: priceReport.price,
          symbol: priceReport.symbol,
          pairCreatedAt: priceReport.pairCreatedAt,
          volume: priceReport.volume,
          liquidity: priceReport.liquidity,
          fdv: priceReport.fdv,
        });
      } else {
        results.set(tokenAddress, null);
      }
    }

    return results;
  }
}
