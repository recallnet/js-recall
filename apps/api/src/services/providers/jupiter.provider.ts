import axios from "axios";

import { serviceLogger } from "@/lib/logger.js";
import { PriceSource } from "@/types/index.js";
import { BlockchainType, PriceReport } from "@/types/index.js";

/**
 * Jupiter price provider implementation
 * Uses Jupiter's API to get token prices
 */
export class JupiterProvider implements PriceSource {
  private readonly API_BASE = "https://api.jup.ag/price/v2";
  private cache: Map<
    string,
    { price: number; timestamp: number; confidence: string }
  >;
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 100;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor() {
    this.cache = new Map();
  }

  getName(): string {
    return "Jupiter";
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

  private getCachedPrice(
    tokenAddress: string,
  ): { price: number; confidence: string } | null {
    const cached = this.cache.get(tokenAddress);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return { price: cached.price, confidence: cached.confidence };
    }
    return null;
  }

  private setCachedPrice(
    tokenAddress: string,
    price: number,
    confidence: string,
  ): void {
    this.cache.set(tokenAddress, {
      price,
      confidence,
      timestamp: Date.now(),
    });
  }

  async getPrice(
    tokenAddress: string,
    chain: BlockchainType = BlockchainType.SVM,
  ): Promise<PriceReport | null> {
    try {
      // Jupiter only supports Solana tokens
      if (chain !== BlockchainType.SVM) {
        return null;
      }

      // Check cache first
      const cachedPrice = this.getCachedPrice(tokenAddress);
      if (cachedPrice !== null && cachedPrice.confidence === "high") {
        serviceLogger.debug(
          `[JupiterProvider] Using cached price for ${tokenAddress}: $${cachedPrice.price}`,
        );
        return {
          token: tokenAddress,
          price: cachedPrice.price,
          timestamp: new Date(),
          chain: BlockchainType.SVM,
          specificChain: "svm",
          symbol: "",
        };
      }

      serviceLogger.debug(
        `[JupiterProvider] Getting price for ${tokenAddress}`,
      );

      for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
        try {
          await this.enforceRateLimit();

          const url = `${this.API_BASE}?ids=${tokenAddress}&showExtraInfo=true`;
          serviceLogger.debug(
            `[JupiterProvider] Debug: Full URL being used: ${url}`,
          );

          serviceLogger.debug(
            `[JupiterProvider] Attempt ${attempt}/${this.MAX_RETRIES} to fetch price for ${tokenAddress}`,
          );

          const response = await axios.get(url, {
            timeout: 5000,
            headers: {
              Accept: "application/json",
              "User-Agent": "TradingSimulator/1.0",
            },
          });

          serviceLogger.debug(
            `[JupiterProvider] Received response status: ${response.status}`,
          );

          if (!response.data?.data?.[tokenAddress]) {
            serviceLogger.debug(
              `[JupiterProvider] No price data found for token: ${tokenAddress}`,
            );
            if (attempt === this.MAX_RETRIES) return null;
            await this.delay(this.RETRY_DELAY * attempt);
            continue;
          }

          const tokenData = response.data.data[tokenAddress];
          const price = parseFloat(tokenData.price);
          if (isNaN(price)) {
            serviceLogger.debug(
              `[JupiterProvider] Invalid price format for token: ${tokenAddress}`,
            );
            return null;
          }

          let confidence = "low";
          if (tokenData.extraInfo?.confidenceLevel) {
            confidence = tokenData.extraInfo.confidenceLevel.toLowerCase();
          }

          this.setCachedPrice(tokenAddress, price, confidence);
          serviceLogger.debug(
            `[JupiterProvider] Successfully fetched price for ${tokenAddress}: $${price}`,
          );

          return {
            token: tokenAddress,
            price,
            timestamp: new Date(),
            chain: BlockchainType.SVM,
            specificChain: "svm",
            symbol: tokenData.symbol || "",
          };
        } catch (error) {
          if (attempt === this.MAX_RETRIES) {
            throw error;
          }
          serviceLogger.debug(
            `[JupiterProvider] Attempt ${attempt} failed, retrying after delay...`,
          );
          if (axios.isAxiosError(error)) {
            serviceLogger.error(`[JupiterProvider] Axios error details:`, {
              message: error.message,
              code: error.code,
              status: error.response?.status,
              data: error.response?.data,
            });
          }
          await this.delay(this.RETRY_DELAY * attempt);
        }
      }
      return null;
    } catch (error) {
      serviceLogger.error(
        `[JupiterProvider] Error fetching price for ${tokenAddress}:`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return null;
    }
  }
}
