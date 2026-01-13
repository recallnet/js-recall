import { ClientOptions, Coingecko } from "@coingecko/coingecko-typescript";
import { Tokens } from "@coingecko/coingecko-typescript/resources/onchain/networks/tokens/tokens";
import { PublicKey } from "@solana/web3.js";
import { Logger } from "pino";
import { z } from "zod";

import { withRetry } from "../../lib/retry-helper.js";
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
 * Subset of the CoinGecko onchain response that includes token attributes (volume, FDV, etc.)
 */
const OnchainResponseDataSchema = z.object({
  attributes: z.object({
    address: z.string(),
    symbol: z.string(),
    price_usd: z.string().nullable(),
    volume_usd: z
      .object({
        h24: z.string(),
      })
      .nullable(),
    total_reserve_in_usd: z.string().nullable(),
    fdv_usd: z.string().nullable(),
    // Note: These fields can be null in the API response when CoinGecko doesn't have price data
    // for a token (e.g., newly deployed tokens, low liquidity, or API issues). Downstream clients
    // should handle this through token "whitelists" or by skipping unpriceable tokens.
    market_cap_usd: z.string().nullable(),
  }),
  relationships: z.object({
    top_pools: z.object({
      data: z.array(
        z.object({
          id: z.string(),
        }),
      ),
    }),
  }),
});

/**
 * Subset of the CoinGecko onchain response with pool information (created at, etc.)
 */
const OnchainResponseIncludedSchema = z.object({
  id: z.string(),
  attributes: z.object({
    pool_created_at: z.string(),
  }),
});

/**
 * Subset of the CoinGecko onchain response for a single onchain token request
 */
const OnchainResponseSchema = z.object({
  data: OnchainResponseDataSchema,
  included: z.array(OnchainResponseIncludedSchema),
});

/**
 * Subset of the CoinGecko onchain response for batch onchain token requests
 */
const BatchOnchainResponseSchema = z.object({
  data: z.array(OnchainResponseDataSchema),
  included: z.array(OnchainResponseIncludedSchema),
});

/**
 * CoinGecko price provider implementation
 * Provides cryptocurrency price data using the CoinGecko API
 */
export class CoinGeckoProvider implements PriceSource {
  private readonly client: Coingecko;
  private readonly MAX_RETRIES = 3; // Overrides default of 2
  private readonly MAX_TIMEOUT = 30_000; // Overrides default of 60 seconds
  private readonly MAX_BATCH_SIZE: number; // Number of tokens in batch calls (30 or 50, depending on mode)
  private specificChainTokens: SpecificChainTokens;
  private logger: Logger;
  private coingeckoLogger: Logger; // Native logger for the CoinGecko SDK (set log level via `COINGECKO_LOG`)

  /**
   * Creates a new CoinGecko provider instance
   * Initializes the CoinGecko client with appropriate configuration based on environment
   * @param config - Provider configuration including API key, mode, and chain tokens
   * @param logger - Logger instance for error and debug logging
   */
  constructor(config: CoinGeckoProviderConfig, logger: Logger) {
    this.specificChainTokens = config.specificChainTokens;
    this.logger = logger;
    this.coingeckoLogger = logger.child({ context: "CoinGeckoSDK" });
    const { apiKey, mode } = config;
    const opts: ClientOptions = {
      environment: mode,
      maxRetries: this.MAX_RETRIES,
      timeout: this.MAX_TIMEOUT,
      logger: this.coingeckoLogger,
    };
    // Note: CoinGecko has different endpoints, depending on the mode (free vs. paid)
    if (mode === "pro") {
      opts.proAPIKey = apiKey;
      this.MAX_BATCH_SIZE = 50;
    } else {
      opts.demoAPIKey = apiKey;
      this.MAX_BATCH_SIZE = 30;
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
   * Converts all EVM addresses to lowercase, also checking that the address is valid
   * @param addr - The EVM address to convert
   * @returns The normalized EVM hex address
   * @throws If the address is invalid (wrong length, alphabet, or incorrect case)
   */
  private toNormalizedEvmAddress(addr: string): string {
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      throw new Error(`Invalid EVM address: ${addr}`);
    }
    return addr.toLowerCase();
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
   * Note: the CoinGecko response lowercases EVM addresses but requires Solana addresses to be the
   * canonical base58 representation.
   * @param tokenAddress - The token address to normalize
   * @returns Normalized token address
   * @throws If the token address is invalid
   */
  private normalizeAddress(tokenAddress: string): string {
    try {
      return tokenAddress.startsWith("0x")
        ? this.toNormalizedEvmAddress(tokenAddress)
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
      tokenAddress === "0x000000000000000000000000000000000000dead" ||
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
    pools: Tokens.TokenGetAddressResponse.Included[],
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
  private parseOnchainResponse(
    response: Tokens.TokenGetAddressResponse,
  ): TokenInfo | null {
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

    // Return null if price data is missing
    if (price_usd === null) {
      return null;
    }

    return {
      price: parseFloat(price_usd),
      symbol: symbol.toUpperCase(),
      pairCreatedAt: this.getCreatedAtTimestampFromPools(pools),
      volume: volume_usd ? { h24: parseFloat(volume_usd.h24) } : undefined,
      liquidity: total_reserve_in_usd
        ? { usd: parseFloat(total_reserve_in_usd) }
        : undefined,
      fdv: fdv_usd ? parseFloat(fdv_usd) : undefined,
    };
  }

  /**
   * Validate the onchain response for a token
   * @param data - The token data
   * @param pools - The token pools
   * @returns The token info
   */
  private parseBatchOnchainResponse(
    response: Tokens.MultiGetAddressesResponse,
  ): Map<string, TokenInfo> {
    const {
      success,
      error,
      data: parsedData,
    } = BatchOnchainResponseSchema.safeParse(response);
    if (!success) {
      throw new Error(`Invalid CoinGecko response for batch: ${error}`);
    }
    const { data, included: pools } = parsedData;
    const results = new Map<string, TokenInfo>();
    for (const token of data) {
      const {
        address,
        symbol,
        price_usd,
        volume_usd,
        total_reserve_in_usd,
        fdv_usd,
      } = token.attributes;

      // Skip tokens with null prices - they cannot be priced
      if (price_usd === null) {
        this.logger.debug(
          `[CoinGecko] Skipping token ${address} - price_usd is null`,
        );
        continue;
      }

      // The batch response includes a `data` array and `included` array. Each includes all of
      // the respective tokens and pools, which means we need to find the matching pool relative
      // to the token. The `tokens` response includes a pool ID value, and this matches with the
      // `included` array's `id` value. The only datapoint we use is the created at timestamp.
      const poolId = token.relationships?.top_pools?.data?.[0]?.id;
      results.set(address, {
        price: parseFloat(price_usd),
        symbol: symbol.toUpperCase(),
        pairCreatedAt: this.getCreatedAtTimestampFromPools(
          pools.filter((p) => p.id === poolId),
        ),
        volume: volume_usd ? { h24: parseFloat(volume_usd.h24) } : undefined,
        liquidity: total_reserve_in_usd
          ? { usd: parseFloat(total_reserve_in_usd) }
          : undefined,
        fdv: fdv_usd ? parseFloat(fdv_usd) : undefined,
      });
    }

    return results;
  }

  /**
   * Fetch price data from CoinGecko onchain API with retry logic
   * @param tokenAddress - The token contract address (expected to be normalized as canonical base58 or checksummed)
   * @param network - The CoinGecko network identifier (e.g., "eth", "solana")
   * @returns The token info
   */
  private async fetchPrice(
    tokenAddress: string,
    network: CoinGeckoNetwork,
  ): Promise<TokenInfo | null> {
    try {
      // Note: the CoinGecko SDK natively handles retries upon internal network failures. However,
      // in case of 429 errors, `withRetry` will catch and retry manually with exponential backoff.
      const getTokenInfo = () =>
        this.client.onchain.networks.tokens.getAddress(tokenAddress, {
          network,
          include_composition: true,
          include: "top_pools",
        });
      const response = await withRetry(getTokenInfo, {
        onRetry: ({ attempt, nextDelayMs, error }) => {
          this.logger.warn(
            {
              error: error instanceof Error ? error.message : String(error),
              attempt,
              nextDelayMs,
              tokenAddress,
              network,
            },
            "Retrying CoinGecko API call",
          );
        },
      });
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
   * Fetch batch price data from CoinGecko onchain API with retry logic
   * @param tokenAddresses - Array of token addresses (already normalized)
   * @param network - The CoinGecko network identifier
   * @returns Map of token addresses to their price information
   */
  private async fetchBatchPrices(
    tokenAddresses: string[],
    network: CoinGeckoNetwork,
  ): Promise<Map<string, TokenInfo | null>> {
    const results = new Map<string, TokenInfo | null>();
    try {
      const addresses = tokenAddresses.join(",");
      const getBatchTokenInfo = () =>
        this.client.onchain.networks.tokens.multi.getAddresses(addresses, {
          network,
          include_composition: true,
          include: "top_pools",
        });
      const response = await withRetry(getBatchTokenInfo, {
        onRetry: ({ attempt, nextDelayMs, error }) => {
          this.logger.warn(
            {
              error: error instanceof Error ? error.message : String(error),
              attempt,
              nextDelayMs,
              tokenCount: tokenAddresses.length,
              network,
            },
            "Retrying CoinGecko batch API call",
          );
        },
      });

      const batchResults = this.parseBatchOnchainResponse(response);
      batchResults.forEach((tokenInfo: TokenInfo | null, address: string) => {
        results.set(address, tokenInfo);
      });
      for (const addr of tokenAddresses) {
        if (!results.has(addr)) {
          results.set(addr, null);
        }
      }
    } catch (error) {
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : JSON.stringify(error),
          tokenCount: tokenAddresses.length,
          network,
        },
        `Batch price fetch failed, falling back to individual requests`,
      );

      // Fallback to individual requests when batch fails
      const individualResults = await Promise.allSettled(
        tokenAddresses.map((address) => this.fetchPrice(address, network)),
      );

      individualResults.forEach((result, index) => {
        const address = tokenAddresses[index];
        if (address !== undefined) {
          if (result.status === "fulfilled") {
            results.set(address, result.value);
          } else {
            results.set(address, null);
          }
        }
      });
    }
    return results;
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
      // Note: although we handle normalization internally, we return the original token address to
      // the caller to ensure they can easily identify the token with the original request.
      const normalizedAddress = this.normalizeAddress(tokenAddress);
      if (this.isBurnAddress(normalizedAddress)) {
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
      const priceData = await this.fetchPrice(normalizedAddress, network);
      if (priceData) {
        return {
          price: priceData.price,
          symbol: priceData.symbol,
          token: tokenAddress,
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
    _: BlockchainType,
    specificChain: SpecificChain,
  ): Promise<Map<string, TokenInfo | null>> {
    const results = new Map<string, TokenInfo | null>();
    if (tokenAddresses.length === 0) {
      return results;
    }

    const network = COINGECKO_NETWORKS[specificChain];
    if (!network) {
      this.logger.error(`Unsupported chain: ${specificChain}`);
      for (const addr of tokenAddresses) {
        results.set(addr, null);
      }
      return results;
    }

    // Build a mapping from original -> normalized addresses, handling invalid addresses. This
    // helps ensure the caller's token addresses are preserved while meeting the expected
    // CoinGecko API requirements.
    const originalToNormalizedAddresses = new Map<string, string>();
    const normalizedToOriginalAddresses = new Map<string, string>();
    for (const original of tokenAddresses) {
      try {
        const normalized = this.normalizeAddress(original);
        originalToNormalizedAddresses.set(original, normalized);
        normalizedToOriginalAddresses.set(normalized, original);
      } catch {
        results.set(original, null);
      }
    }

    const addressesToFetch: string[] = [];
    for (const [original, normalized] of originalToNormalizedAddresses) {
      if (this.isBurnAddress(normalized)) {
        results.set(original, {
          price: 0,
          symbol: "BURN",
          pairCreatedAt: undefined,
          volume: undefined,
          liquidity: undefined,
          fdv: undefined,
        });
      } else {
        addressesToFetch.push(normalized);
      }
    }
    if (addressesToFetch.length === 0) {
      return results;
    }

    // Process in chunks to respect CoinGecko batch API limits
    for (let i = 0; i < addressesToFetch.length; i += this.MAX_BATCH_SIZE) {
      const chunk = addressesToFetch.slice(i, i + this.MAX_BATCH_SIZE);
      const batchResults = await this.fetchBatchPrices(chunk, network);
      batchResults.forEach(
        (tokenInfo: TokenInfo | null, normalized: string) => {
          const original = normalizedToOriginalAddresses.get(normalized);
          if (original) {
            results.set(original, tokenInfo);
          }
        },
      );
    }

    return results;
  }
}
