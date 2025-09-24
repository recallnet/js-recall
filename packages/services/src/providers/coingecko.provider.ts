import axios from "axios";
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
interface CoinGeckoProviderConfig {
  apiKey: string;
  specificChainTokens: SpecificChainTokens;
  logger: Logger;
}

export class CoinGeckoProvider implements PriceSource {
  private readonly API_BASE = "https://pro-api.coingecko.com/api/v3";
  private readonly API_KEY: string;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
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

  constructor(
    config: CoinGeckoProviderConfig,
    logger: Logger,
    specificChainTokens: SpecificChainTokens,
  ) {
    this.API_KEY = config.apiKey || "";
    this.specificChainTokens = specificChainTokens;
    this.logger = logger;
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
    const url = `${this.API_BASE}/coins/${platform}/contract/${tokenAddress}`;
    this.logger.debug(`[CoinGeckoProvider] Fetching price from: ${url}`);
    let retries = 0;
    while (retries <= this.MAX_RETRIES) {
      try {
        const response = await axios.get(url, {
          params: {
            localization: false,
            tickers: false,
            market_data: true,
            community_data: false,
            developer_data: false,
            sparkline: false,
            x_cg_pro_api_key: this.API_KEY,
          },
        });
        const data = response.data;
        if (data && data.market_data) {
          const price = parseFloat(data.market_data.current_price?.usd || "0");
          if (isNaN(price)) {
            this.logger.debug(
              `[CoinGeckoProvider] Invalid price for ${tokenAddress} on ${platform}`,
            );
            return null;
          }
          const symbol = this.isStablecoin(tokenAddress, specificChain)
            ? data.symbol.toUpperCase() === "USDC" ||
              data.market_data.current_price.usd.toString().startsWith("1")
              ? "USDC"
              : "USDT"
            : data.symbol?.toUpperCase() || "";
          this.logger.debug(
            `[CoinGeckoProvider] Found price for ${tokenAddress}: $${price}`,
          );
          return {
            price,
            symbol,
            volume: data.market_data.total_volume?.usd
              ? { h24: data.market_data.total_volume.usd }
              : undefined,
            liquidity: undefined,
            fdv: data.market_data.fully_diluted_valuation?.usd || undefined,
            pairCreatedAt: undefined,
          };
        }
        this.logger.debug(
          `[CoinGeckoProvider] No valid price found for ${tokenAddress} on ${platform}`,
        );
        return null;
      } catch (error) {
        this.logger.error(
          `Error fetching price from CoinGecko for ${tokenAddress} on ${platform}:`,
          error instanceof Error ? error.message : "Unknown error",
        );
        retries++;
        if (retries <= this.MAX_RETRIES) {
          await this.delay(this.RETRY_DELAY);
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

  // Not implemented for now
  async getBatchPrices() {
    return new Map<string, DexScreenerTokenInfo | null>();
  }
}
