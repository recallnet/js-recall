import * as Sentry from "@sentry/node";
import axios, { AxiosInstance } from "axios";
import { Decimal } from "decimal.js";
import { Logger } from "pino";

import {
  IPerpsDataProvider,
  PerpsAccountSummary,
  PerpsPosition,
  Transfer,
} from "../../types/perps.js";

/**
 * Hyperliquid API response types
 */
interface HyperliquidClearinghouseState {
  assetPositions: Array<{
    position: {
      coin: string;
      szi: string;
      entryPx: string;
      leverage: {
        type: "isolated" | "cross";
        value: number;
      };
      marginUsed: string;
      maxLeverage: number;
      liquidationPx: string | null;
      positionValue: string;
      returnOnEquity: string;
      unrealizedPnl: string;
      cumFunding: {
        allTime: string;
        sinceOpen: string;
        sinceChange: string;
      };
    };
    type: "oneWay";
  }>;
  marginSummary: {
    accountValue: string;
    totalMarginUsed: string;
    totalNtlPos: string;
    totalRawUsd: string;
  };
  crossMarginSummary: {
    accountValue: string;
    totalMarginUsed: string;
    totalNtlPos: string;
    totalRawUsd: string;
  };
  crossMaintenanceMarginUsed: string;
  withdrawable: string;
  time: number;
}

interface HyperliquidUserFill {
  coin: string;
  px: string;
  sz: string;
  side: "B" | "A";
  time: number;
  startPosition: string;
  dir: string;
  closedPnl: string;
  hash: string;
  oid: number;
  crossed: boolean;
  fee: string;
  tid: number;
  feeToken: string;
  cloid?: string;
  twapId?: string | null;
}

interface HyperliquidLedgerUpdate {
  time: number;
  hash: string;
  delta: {
    type:
      | "deposit"
      | "withdraw"
      | "subAccountTransfer"
      | "liquidation"
      | "vaultCreate"
      | "vaultDisbursement";
    usdc: string;
    user?: string;
    destination?: string;
    fee?: string;
  };
}

/**
 * API request types for Hyperliquid
 */
interface HyperliquidApiRequest {
  type: string;
  user?: string;
  startTime?: number;
  endTime?: number;
}

interface AllMidsResponse {
  [coin: string]: string;
}

/**
 * Hyperliquid implementation of the perps data provider interface
 *
 * Key characteristics:
 * - DEX (decentralized exchange) running on custom L1 blockchain
 * - All data is on-chain with sub-second finality
 * - Requires calculation of some metrics from raw data
 * - Uses POST requests to single /info endpoint
 * - No authentication required for read operations
 */
export class HyperliquidPerpsProvider implements IPerpsDataProvider {
  private readonly baseUrl: string;
  private readonly axiosInstance: AxiosInstance;
  private readonly logger: Logger;
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor(logger: Logger, apiUrl?: string) {
    this.logger = logger;
    this.baseUrl = apiUrl || "https://api.hyperliquid.xyz";

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: this.REQUEST_TIMEOUT,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.logger.debug(
      `[HyperliquidProvider] Initialized with base URL: ${this.baseUrl}`,
    );
  }

  /**
   * Get provider name for logging
   */
  getName(): string {
    return "Hyperliquid";
  }

  /**
   * Check if provider is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Test with a simple allMids request
      const response = await this.makeRequest<AllMidsResponse>({
        type: "allMids",
      });

      return (
        response !== null &&
        response !== undefined &&
        Object.keys(response).length > 0
      );
    } catch (error) {
      this.logger.warn("[HyperliquidProvider] Health check failed:", error);
      return false;
    }
  }

  /**
   * Get account summary - transforms Hyperliquid clearinghouse state to generic format
   * @param walletAddress Wallet address to query
   * @param initialCapital Optional initial capital (used since Hyperliquid doesn't track it)
   */
  async getAccountSummary(
    walletAddress: string,
    initialCapital?: number,
  ): Promise<PerpsAccountSummary> {
    const startTime = Date.now();
    const maskedAddress = this.maskWalletAddress(walletAddress);

    try {
      this.logger.debug(
        `[HyperliquidProvider] Fetching account summary for ${maskedAddress}`,
      );

      // Fetch clearinghouse state
      const clearinghouseState =
        await this.getClearinghouseState(walletAddress);

      // Fetch recent fills to calculate volume and trade counts
      const recentFills = await this.getRecentFills(walletAddress);

      // Calculate metrics from raw data
      const accountValue = new Decimal(
        clearinghouseState.marginSummary.accountValue,
      );
      const totalMarginUsed = new Decimal(
        clearinghouseState.marginSummary.totalMarginUsed,
      );
      const totalRawUsd = new Decimal(
        clearinghouseState.marginSummary.totalRawUsd,
      );

      // Calculate PnL from positions
      let totalUnrealizedPnl = new Decimal(0);
      let totalPositionValue = new Decimal(0);
      let openPositionsCount = 0;

      for (const asset of clearinghouseState.assetPositions) {
        if (asset.position && asset.position.szi !== "0") {
          openPositionsCount++;
          totalUnrealizedPnl = totalUnrealizedPnl.plus(
            asset.position.unrealizedPnl || 0,
          );
          totalPositionValue = totalPositionValue.plus(
            asset.position.positionValue || 0,
          );
        }
      }

      // Calculate volume and fees from recent fills
      const { totalVolume, totalFees, tradeCount, closedPnl } =
        this.calculateTradingStats(recentFills);

      // Use provided initial capital or default to current equity
      // Hyperliquid doesn't track initial capital, so we rely on the caller to provide it
      const totalEquityValue = accountValue.toNumber();
      const effectiveInitialCapital = initialCapital ?? totalEquityValue;

      const summary: PerpsAccountSummary = {
        // Core metrics
        totalEquity: totalEquityValue,
        initialCapital: effectiveInitialCapital,
        availableBalance: totalRawUsd.toNumber(),
        marginUsed: totalMarginUsed.toNumber(),

        // PnL metrics
        totalPnl: totalUnrealizedPnl.plus(closedPnl).toNumber(),
        totalRealizedPnl: closedPnl.toNumber(),
        totalUnrealizedPnl: totalUnrealizedPnl.toNumber(),

        // Trading statistics
        totalVolume: totalVolume.toNumber(),
        totalTrades: tradeCount,
        totalFeesPaid: totalFees.toNumber(),

        // Position counts
        openPositionsCount,
        closedPositionsCount: 0, // Would need historical data
        liquidatedPositionsCount: 0, // Would need to track liquidation events

        // Performance metrics
        // Calculate ROI based on provided initial capital
        roi:
          effectiveInitialCapital > 0
            ? ((totalEquityValue - effectiveInitialCapital) /
                effectiveInitialCapital) *
              100
            : 0,
        roiPercent:
          effectiveInitialCapital > 0
            ? ((totalEquityValue - effectiveInitialCapital) /
                effectiveInitialCapital) *
              100
            : 0,
        averageTradeSize:
          tradeCount > 0 ? totalVolume.dividedBy(tradeCount).toNumber() : 0,

        // Status
        accountStatus: openPositionsCount > 0 ? "active" : "inactive",

        // Store raw data for debugging (only in dev/sampling)
        rawData: undefined,
      };

      this.logger.debug(
        `[HyperliquidProvider] Fetched account summary for ${maskedAddress} in ${Date.now() - startTime}ms`,
      );

      return summary;
    } catch (error) {
      Sentry.captureException(error, {
        extra: {
          walletAddress: maskedAddress,
          method: "getAccountSummary",
          processingTime: Date.now() - startTime,
        },
      });

      this.logger.error(
        `[HyperliquidProvider] Error fetching account summary for ${maskedAddress}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get positions - transforms Hyperliquid positions to generic format
   */
  async getPositions(walletAddress: string): Promise<PerpsPosition[]> {
    const startTime = Date.now();
    const maskedAddress = this.maskWalletAddress(walletAddress);

    try {
      this.logger.debug(
        `[HyperliquidProvider] Fetching positions for ${maskedAddress}`,
      );

      const clearinghouseState =
        await this.getClearinghouseState(walletAddress);

      // Fetch current market prices for all assets
      const marketPrices = await this.getMarketPrices();

      const positions: PerpsPosition[] = [];

      for (const asset of clearinghouseState.assetPositions) {
        const pos = asset.position;

        // Skip if no position (size is 0)
        if (!pos || pos.szi === "0") {
          continue;
        }

        const size = new Decimal(pos.szi);
        const isLong = size.isPositive();

        // Get current price from market data or calculate from position data
        const currentPrice = this.getCurrentPrice(pos, marketPrices);

        positions.push({
          // Identifiers (Hyperliquid doesn't provide position IDs)
          providerPositionId: `${walletAddress}-${pos.coin}-${Date.now()}`,
          providerTradeId: undefined,

          // Position details
          symbol: pos.coin,
          side: isLong ? "long" : "short",
          positionSizeUsd: new Decimal(pos.positionValue).abs().toNumber(),
          leverage: pos.leverage.value,
          collateralAmount: new Decimal(pos.marginUsed).toNumber(),

          // Prices
          entryPrice: new Decimal(pos.entryPx).toNumber(),
          currentPrice,
          liquidationPrice: pos.liquidationPx
            ? new Decimal(pos.liquidationPx).toNumber()
            : undefined,

          // PnL
          pnlUsdValue: new Decimal(pos.unrealizedPnl).toNumber(),
          pnlPercentage: new Decimal(pos.returnOnEquity).times(100).toNumber(),

          // Status (Hyperliquid only returns open positions in clearinghouse state)
          status: "Open",

          // Timestamps
          // WARNING: Hyperliquid clearinghouseState does NOT provide position open timestamps
          // We'd need to track this ourselves or query trade history
          openedAt: new Date(), // PLACEHOLDER - actual open time not available from API
          lastUpdatedAt: new Date(),
          closedAt: undefined,
        });
      }

      this.logger.debug(
        `[HyperliquidProvider] Fetched ${positions.length} positions for ${maskedAddress} in ${Date.now() - startTime}ms`,
      );

      return positions;
    } catch (error) {
      Sentry.captureException(error, {
        extra: {
          walletAddress: maskedAddress,
          method: "getPositions",
          processingTime: Date.now() - startTime,
        },
      });

      this.logger.error(
        `[HyperliquidProvider] Error fetching positions for ${maskedAddress}:`,
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
    const maskedAddress = this.maskWalletAddress(walletAddress);

    try {
      this.logger.debug(
        `[HyperliquidProvider] Fetching transfers for ${maskedAddress} since ${since.toISOString()}`,
      );

      const response = await this.makeRequest<HyperliquidLedgerUpdate[]>({
        type: "userNonFundingLedgerUpdates",
        user: walletAddress,
        startTime: since.getTime(),
        endTime: Date.now(),
      });

      if (!response || !Array.isArray(response)) {
        return [];
      }

      // Transform to generic transfer format
      const transfers: Transfer[] = [];

      for (const update of response) {
        const { type } = update.delta;

        // Track only deposits and withdrawals (skip subAccountTransfers as they're internal)
        if (type === "deposit" || type === "withdraw") {
          transfers.push({
            type: type,
            amount: Math.abs(new Decimal(update.delta.usdc).toNumber()),
            asset: "USDC",
            from: type === "deposit" ? "external" : walletAddress,
            to: type === "withdraw" ? "external" : walletAddress,
            timestamp: new Date(update.time),
            txHash: update.hash,
            chainId: 1, // Hyperliquid L1
          });
        }
        // Note: We skip subAccountTransfer as they are internal transfers
        // between sub-accounts and not relevant for self-funding detection
      }

      this.logger.debug(
        `[HyperliquidProvider] Fetched ${transfers.length} transfers for ${maskedAddress} in ${Date.now() - startTime}ms`,
      );

      return transfers;
    } catch (error) {
      Sentry.captureException(error, {
        extra: {
          walletAddress: maskedAddress,
          method: "getTransferHistory",
          since: since.toISOString(),
          processingTime: Date.now() - startTime,
        },
      });

      this.logger.error(
        `[HyperliquidProvider] Error fetching transfers for ${maskedAddress}:`,
        error,
      );
      // Don't throw - transfer history is optional for self-funding detection
      return [];
    }
  }

  /**
   * Fetch clearinghouse state from Hyperliquid API
   */
  private async getClearinghouseState(
    walletAddress: string,
  ): Promise<HyperliquidClearinghouseState> {
    return this.makeRequest<HyperliquidClearinghouseState>({
      type: "clearinghouseState",
      user: walletAddress,
    });
  }

  /**
   * Fetch current market prices for all assets
   */
  private async getMarketPrices(): Promise<Map<string, number>> {
    try {
      const response = await this.makeRequest<Record<string, string>>({
        type: "allMids",
      });

      const priceMap = new Map<string, number>();

      if (response) {
        for (const [coin, price] of Object.entries(response)) {
          priceMap.set(coin, new Decimal(price).toNumber());
        }
      }

      return priceMap;
    } catch (error) {
      this.logger.warn(
        "[HyperliquidProvider] Failed to fetch market prices:",
        error,
      );
      return new Map();
    }
  }

  /**
   * Get current price for a position
   * Uses market data if available, otherwise calculates from position data
   */
  private getCurrentPrice(
    position: HyperliquidClearinghouseState["assetPositions"][0]["position"],
    marketPrices: Map<string, number>,
  ): number {
    // First try to get from market data (allMids endpoint)
    const marketPrice = marketPrices.get(position.coin);
    if (marketPrice) {
      return marketPrice;
    }

    // Fallback: Estimate from position data
    const entryPrice = new Decimal(position.entryPx);
    const unrealizedPnl = new Decimal(position.unrealizedPnl || 0);
    const size = new Decimal(position.szi).abs();

    if (size.isZero()) {
      return entryPrice.toNumber();
    }

    // Calculate implied current price from P&L
    // For long: currentPrice = entryPrice + (pnl / size)
    // For short: currentPrice = entryPrice - (pnl / size)
    const isLong = new Decimal(position.szi).isPositive();
    const pnlPerUnit = unrealizedPnl.dividedBy(size);

    const currentPrice = isLong
      ? entryPrice.plus(pnlPerUnit)
      : entryPrice.minus(pnlPerUnit);

    this.logger.warn(
      `[HyperliquidProvider] Using estimated price for ${position.coin}: ${currentPrice.toFixed(2)}`,
    );

    return currentPrice.toNumber();
  }

  /**
   * Fetch recent fills for volume calculation
   */
  private async getRecentFills(
    walletAddress: string,
  ): Promise<HyperliquidUserFill[]> {
    // Get fills from last 7 days for volume calculation
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const response = await this.makeRequest<HyperliquidUserFill[]>({
      type: "userFillsByTime",
      user: walletAddress,
      startTime: sevenDaysAgo,
    });

    return response || [];
  }

  /**
   * Calculate trading statistics from fills
   */
  private calculateTradingStats(fills: HyperliquidUserFill[]): {
    totalVolume: Decimal;
    totalFees: Decimal;
    tradeCount: number;
    closedPnl: Decimal;
  } {
    let totalVolume = new Decimal(0);
    let totalFees = new Decimal(0);
    let closedPnl = new Decimal(0);

    for (const fill of fills) {
      const price = new Decimal(fill.px);
      const size = new Decimal(fill.sz);
      const volume = price.times(size);

      totalVolume = totalVolume.plus(volume);
      totalFees = totalFees.plus(fill.fee || 0);
      closedPnl = closedPnl.plus(fill.closedPnl || 0);
    }

    return {
      totalVolume,
      totalFees,
      tradeCount: fills.length,
      closedPnl,
    };
  }

  /**
   * Make HTTP request to Hyperliquid API
   */
  private async makeRequest<T>(body: HyperliquidApiRequest): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await this.axiosInstance.post<T>("/info", body);
        return response.data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (axios.isAxiosError(error)) {
          const status = error.response?.status;

          // Don't retry on client errors (4xx)
          if (status && status >= 400 && status < 500) {
            this.logger.error(
              `[HyperliquidProvider] Client error (${status}):`,
              error.response?.data,
            );
            throw error;
          }

          this.logger.warn(
            `[HyperliquidProvider] Request failed (attempt ${attempt}/${this.MAX_RETRIES}):`,
            error.message,
          );
        }

        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY * attempt;
          this.logger.debug(
            `[HyperliquidProvider] Retrying after ${delay}ms...`,
          );
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error("Request failed after retries");
  }

  /**
   * Mask wallet address for privacy in logs
   */
  private maskWalletAddress(address: string): string {
    if (!address || address.length < 10) {
      return address;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Delay helper for retries
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
