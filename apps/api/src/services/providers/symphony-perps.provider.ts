import axios, { AxiosInstance } from "axios";

import { serviceLogger } from "@/lib/logger.js";
import {
  IPerpsDataProvider,
  PerpsAccountSummary,
  PerpsPosition,
  Transfer,
} from "@/types/perps.js";

/**
 * Symphony API response types
 */
export interface SymphonyPositionResponse {
  success: boolean;
  data: {
    userAddress: string;
    accountSummary: {
      totalEquity: number;
      initialCapital: number;
      totalUnrealizedPnl: number;
      totalRealizedPnl: number;
      totalPnl: number;
      totalFeesPaid: number;
      availableBalance: number;
      marginUsed: number;
      totalVolume: number;
      totalTrades: number;
      accountStatus: string;
      openPositionsCount: number;
      closedPositionsCount: number;
      liquidatedPositionsCount: number;
      performance?: {
        roi: number;
        roiPercent: number;
        totalTrades: number;
        averageTradeSize: number;
        winRate?: number;
        bestTrade?: number;
        worstTrade?: number;
      };
    };
    openPositions: SymphonyPosition[];
    // Note: Symphony only returns openPositions, not closed or liquidated
    lastUpdated: string;
    cacheExpiresAt: string;
  };
  processingTime: number;
}

export interface SymphonyPosition {
  protocolPositionHash: string;
  symphonyPositionHash: string;
  userAddress: string;
  isLong: boolean;
  leverage: number;
  positionSize: number;
  entryPrice: number;
  tpPrice?: number | null;
  slPrice?: number | null;
  currentPrice: number;
  liquidationPrice?: number | null;
  collateralAmount: number;
  pnlPercentage: number;
  pnlUSDValue: number;
  asset: string;
  createdTimeStamp: string;
  lastUpdatedTimestamp?: string;
  closedAt?: string;
  status: string;
}

export interface SymphonyTransferResponse {
  success: boolean;
  count: number;
  successful: number[];
  failed: number[];
  transfers: SymphonyTransfer[];
}

export interface SymphonyTransfer {
  type: "deposit" | "withdraw";
  amount: number;
  asset: string;
  from: string;
  to: string;
  timestamp: string;
  txHash: string;
  chainId: number;
}

/**
 * Symphony implementation of the perps data provider interface
 * This is an "all-in-one" provider that supplies complete data including:
 * - Position details with current prices
 * - Pre-calculated PnL
 * - Account equity calculations
 *
 * Note: Symphony API endpoints do not require authentication
 */
export class SymphonyPerpsProvider implements IPerpsDataProvider {
  private readonly baseUrl: string;
  private readonly axiosInstance: AxiosInstance;
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 100; // 100ms between requests
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds

  constructor(apiUrl?: string) {
    // Use provided URL or fall back to config/environment
    this.baseUrl = apiUrl || "https://api.symphony.finance";

    // Create axios instance with defaults
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: this.REQUEST_TIMEOUT,
      headers: {
        "Content-Type": "application/json",
      },
    });

    serviceLogger.debug(
      `[SymphonyProvider] Initialized with base URL: ${this.baseUrl}`,
    );
  }

  /**
   * Get provider name for logging
   */
  getName(): string {
    return "Symphony";
  }

  /**
   * Check if provider is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Since Symphony only provides data for registered addresses,
      // we check API availability by testing the endpoint exists
      // A 404 for an unknown address still indicates the API is healthy
      const response = await this.axiosInstance.get("/agent/all-positions", {
        params: { userAddress: "0x0000000000000000000000000000000000000001" },
        timeout: 5000,
        validateStatus: (status) => {
          // Accept any status that indicates the server is responding
          // 404 = address not found (expected for unregistered address)
          // 200 = success (unlikely for test address)
          // 400 = bad request (API is still working)
          return status < 500;
        },
      });

      // If we get any response from the server (not 5xx), it's healthy
      return response.status < 500;
    } catch (error) {
      serviceLogger.warn("[SymphonyProvider] Health check failed:", error);
      return false;
    }
  }

  /**
   * Rate limiting helper
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const delay = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await this.delay(delay);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Delay helper for retries
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get account summary - transforms Symphony response to generic format
   */
  async getAccountSummary(walletAddress: string): Promise<PerpsAccountSummary> {
    const startTime = Date.now();

    try {
      await this.enforceRateLimit();

      serviceLogger.debug(
        `[SymphonyProvider] Fetching account summary for ${walletAddress}`,
      );

      const data = await this.fetchPositionData(walletAddress);

      const summary: PerpsAccountSummary = {
        // Core metrics
        totalEquity: data.accountSummary.totalEquity,
        initialCapital: data.accountSummary.initialCapital,
        availableBalance: data.accountSummary.availableBalance,
        marginUsed: data.accountSummary.marginUsed,

        // PnL metrics
        totalPnl: data.accountSummary.totalPnl,
        totalRealizedPnl: data.accountSummary.totalRealizedPnl,
        totalUnrealizedPnl: data.accountSummary.totalUnrealizedPnl,

        // Trading statistics
        totalVolume: data.accountSummary.totalVolume,
        totalTrades: data.accountSummary.totalTrades,
        totalFeesPaid: data.accountSummary.totalFeesPaid,
        winRate: data.accountSummary.performance?.winRate,

        // Position counts
        openPositionsCount: data.accountSummary.openPositionsCount,
        closedPositionsCount: data.accountSummary.closedPositionsCount,
        liquidatedPositionsCount: data.accountSummary.liquidatedPositionsCount,

        // Performance metrics
        roi: data.accountSummary.performance?.roi,
        roiPercent: data.accountSummary.performance?.roiPercent,
        bestTrade: data.accountSummary.performance?.bestTrade,
        worstTrade: data.accountSummary.performance?.worstTrade,
        averageTradeSize: data.accountSummary.performance?.averageTradeSize,

        // Status
        accountStatus: data.accountSummary.accountStatus,

        // Store raw data for debugging
        rawData: data,
      };

      serviceLogger.debug(
        `[SymphonyProvider] Fetched account summary for ${walletAddress} in ${Date.now() - startTime}ms`,
      );

      return summary;
    } catch (error) {
      serviceLogger.error(
        `[SymphonyProvider] Error fetching account summary for ${walletAddress}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get positions - transforms Symphony positions to generic format
   */
  async getPositions(walletAddress: string): Promise<PerpsPosition[]> {
    const startTime = Date.now();

    try {
      await this.enforceRateLimit();

      serviceLogger.debug(
        `[SymphonyProvider] Fetching positions for ${walletAddress}`,
      );

      const data = await this.fetchPositionData(walletAddress);

      // Symphony only returns open positions in this endpoint
      // To get closed/liquidated positions, we'd need a different endpoint or historical data
      const positions = this.transformPositions(data.openPositions, "Open");

      serviceLogger.debug(
        `[SymphonyProvider] Fetched ${positions.length} open positions for ${walletAddress} in ${Date.now() - startTime}ms`,
      );

      return positions;
    } catch (error) {
      serviceLogger.error(
        `[SymphonyProvider] Error fetching positions for ${walletAddress}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get transfer history for self-funding detection
   */
  async getTransferHistory(
    walletAddress: string,
    since: Date,
  ): Promise<Transfer[]> {
    const startTime = Date.now();

    try {
      await this.enforceRateLimit();

      serviceLogger.debug(
        `[SymphonyProvider] Fetching transfers for ${walletAddress} since ${since.toISOString()}`,
      );

      const response = await this.makeRequest<SymphonyTransferResponse>(
        "/utils/transfers",
        {
          walletAddress,
          since: since.toISOString(),
        },
      );

      if (!response.success) {
        serviceLogger.warn(
          `[SymphonyProvider] Transfer fetch unsuccessful for ${walletAddress}`,
        );
        return [];
      }

      // Transform to generic transfer format
      const transfers: Transfer[] = response.transfers.map((t) => ({
        type: t.type,
        amount: t.amount,
        asset: t.asset,
        from: t.from,
        to: t.to,
        timestamp: new Date(t.timestamp),
        txHash: t.txHash,
        chainId: t.chainId,
      }));

      serviceLogger.debug(
        `[SymphonyProvider] Fetched ${transfers.length} transfers for ${walletAddress} in ${Date.now() - startTime}ms`,
      );

      return transfers;
    } catch (error) {
      serviceLogger.error(
        `[SymphonyProvider] Error fetching transfers for ${walletAddress}:`,
        error,
      );
      // Don't throw - transfer history is optional for self-funding detection
      return [];
    }
  }

  /**
   * Fetch position data from Symphony API with retries
   */
  private async fetchPositionData(
    walletAddress: string,
  ): Promise<SymphonyPositionResponse["data"]> {
    const response = await this.makeRequest<SymphonyPositionResponse>(
      "/agent/all-positions",
      { userAddress: walletAddress },
    );

    if (!response.success) {
      throw new Error(
        `Symphony API returned unsuccessful response for ${walletAddress}`,
      );
    }

    return response.data;
  }

  /**
   * Make HTTP request with retries and error handling
   */
  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await this.axiosInstance.get<T>(endpoint, {
          params,
        });

        return response.data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (axios.isAxiosError(error)) {
          const status = error.response?.status;

          // Don't retry on client errors (4xx)
          if (status && status >= 400 && status < 500) {
            serviceLogger.error(
              `[SymphonyProvider] Client error (${status}):`,
              error.response?.data,
            );
            throw error;
          }

          serviceLogger.warn(
            `[SymphonyProvider] Request failed (attempt ${attempt}/${this.MAX_RETRIES}):`,
            {
              message: error.message,
              status: error.response?.status,
              data: error.response?.data,
            },
          );
        }

        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY * attempt;
          serviceLogger.debug(
            `[SymphonyProvider] Retrying after ${delay}ms...`,
          );
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error("Request failed after retries");
  }

  /**
   * Transform Symphony positions to generic format
   */
  private transformPositions(
    positions: SymphonyPosition[],
    status: "Open" | "Closed" | "Liquidated",
  ): PerpsPosition[] {
    return positions.map((pos) => ({
      // Identifiers
      providerPositionId: pos.symphonyPositionHash,
      providerTradeId: pos.protocolPositionHash,

      // Position details
      symbol: pos.asset,
      side: pos.isLong ? ("long" as const) : ("short" as const),
      positionSizeUsd: pos.positionSize,
      leverage: pos.leverage,
      collateralAmount: pos.collateralAmount,

      // Prices
      entryPrice: pos.entryPrice,
      currentPrice: pos.currentPrice,
      liquidationPrice: pos.liquidationPrice || undefined,

      // PnL
      pnlUsdValue: pos.pnlUSDValue,
      pnlPercentage: pos.pnlPercentage,

      // Status
      status,

      // Timestamps
      openedAt: new Date(pos.createdTimeStamp),
      lastUpdatedAt: pos.lastUpdatedTimestamp
        ? new Date(pos.lastUpdatedTimestamp)
        : undefined,
      closedAt: pos.closedAt ? new Date(pos.closedAt) : undefined,
    }));
  }
}
