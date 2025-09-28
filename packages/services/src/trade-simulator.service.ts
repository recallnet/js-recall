import { randomUUID } from "crypto";
import { Logger } from "pino";

import { TradeRepository } from "@recallnet/db/repositories/trade";
import { TradingConstraintsRepository } from "@recallnet/db/repositories/trading-constraints";
import { InsertTrade, SelectTrade } from "@recallnet/db/schema/trading/types";

import { BalanceService } from "./balance.service.js";
import { EXEMPT_TOKENS, calculateSlippage } from "./lib/trade-utils.js";
import { PortfolioSnapshotterService } from "./portfolio-snapshotter.service.js";
import { PriceTrackerService } from "./price-tracker.service.js";
import { DexScreenerProvider } from "./providers/price/dexscreener.provider.js";
import {
  ApiError,
  BlockchainType,
  CrossChainTradingType,
  PriceReport,
  SpecificChain,
} from "./types/index.js";

const MIN_TRADE_AMOUNT = 0.000001;

// Interface for trading constraints
interface TradingConstraints {
  minimumPairAgeHours: number;
  minimum24hVolumeUsd: number;
  minimumLiquidityUsd: number;
  minimumFdvUsd: number;
}

// Define an interface for chain options
interface ChainOptions {
  fromChain?: BlockchainType;
  fromSpecificChain?: SpecificChain;
  toChain?: BlockchainType;
  toSpecificChain?: SpecificChain;
}

/**
 * Trade Simulator Service
 * Executes simulated trades between tokens
 */
export class TradeSimulatorService {
  private balanceService: BalanceService;
  private priceTrackerService: PriceTrackerService;
  private tradeRepo: TradeRepository;
  private tradingConstraintsRepo: TradingConstraintsRepository;
  // Cache of recent trades for performance (agentId -> trades)
  private tradeCache: Map<string, SelectTrade[]>;
  // Maximum trade percentage of portfolio value
  private maxTradePercentage: number;
  private defaultMinimumPairAgeHours: number;
  private defaultMinimum24hVolumeUsd: number;
  private defaultMinimumLiquidityUsd: number;
  private defaultMinimumFdvUsd: number;
  private crossChainTradingType: CrossChainTradingType;
  private dexScreenerProvider: DexScreenerProvider;
  // Cache of trading constraints per competition
  private constraintsCache: Map<string, TradingConstraints>;
  private logger: Logger;

  constructor(
    balanceService: BalanceService,
    priceTrackerService: PriceTrackerService,
    tradeRepo: TradeRepository,
    tradingConstraintsRepo: TradingConstraintsRepository,
    maxTradePercentage: number,
    defaultMinimumPairAgeHours: number,
    defaultMinimum24hVolumeUsd: number,
    defaultMinimumLiquidityUsd: number,
    defaultMinimumFdvUsd: number,
    crossChainTradingType: CrossChainTradingType,
    logger: Logger,
  ) {
    this.balanceService = balanceService;
    this.priceTrackerService = priceTrackerService;
    this.tradeRepo = tradeRepo;
    this.tradingConstraintsRepo = tradingConstraintsRepo;
    this.maxTradePercentage = maxTradePercentage;
    this.defaultMinimumPairAgeHours = defaultMinimumPairAgeHours;
    this.defaultMinimum24hVolumeUsd = defaultMinimum24hVolumeUsd;
    this.defaultMinimumLiquidityUsd = defaultMinimumLiquidityUsd;
    this.defaultMinimumFdvUsd = defaultMinimumFdvUsd;
    this.crossChainTradingType = crossChainTradingType;
    this.logger = logger;
    this.dexScreenerProvider = new DexScreenerProvider();
    this.tradeCache = new Map();
    this.constraintsCache = new Map();
  }

  /**
   * Execute a trade between two tokens
   * @param agentId The agent ID
   * @param competitionId The competition ID
   * @param fromToken The source token address
   * @param toToken The destination token address
   * @param fromAmount The amount to trade
   * @param reason The reason for the trade
   * @param slippageTolerance Optional slippage tolerance percentage
   * @param chainOptions Optional chain specification for performance optimization
   * @returns Trade object on success, throws ApiError on failure
   */
  async executeTrade(
    agentId: string,
    competitionId: string,
    fromToken: string,
    toToken: string,
    fromAmount: number,
    reason: string,
    slippageTolerance?: number,
    chainOptions?: ChainOptions,
  ): Promise<SelectTrade> {
    try {
      this.logger.debug(`\n[TradeSimulator] Starting trade execution:
                Agent: ${agentId}
                Competition: ${competitionId}
                From Token: ${fromToken}
                To Token: ${toToken}
                Amount: ${fromAmount}
                Reason: ${reason}
                Slippage Tolerance: ${slippageTolerance || "default"}
                Chain Options: ${chainOptions ? JSON.stringify(chainOptions) : "none"}
            `);

      // Validate basic trade inputs
      this.validateTradeInputs(fromToken, toToken, fromAmount, reason);

      // Resolve chain variables
      const chainInfo = this.resolveChainVariables(
        fromToken,
        toToken,
        chainOptions,
      );

      // Validate cross-chain trading rules
      this.validateCrossChainTrading(chainInfo);

      // Fetch and validate prices
      const { fromPrice, toPrice } = await this.fetchAndValidatePrices(
        fromToken,
        toToken,
        chainInfo,
        competitionId,
      );

      // Calculate the trade using USD values
      const fromValueUSD = fromAmount * fromPrice.price;

      // Get current balance for validation
      const currentBalance = await this.balanceService.getBalance(
        agentId,
        fromToken,
      );

      // Validate balances and portfolio limits
      await this.validateBalancesAndPortfolio(
        agentId,
        fromToken,
        fromAmount,
        fromValueUSD,
        currentBalance,
      );

      // Calculate trade amounts and exchange rates
      const { toAmount, exchangeRate } = this.calculateTradeAmounts(
        fromAmount,
        fromValueUSD,
        toPrice.price,
        fromToken,
        toToken,
      );

      // Execute the trade and update database
      const result = await this.executeTradeAndUpdateDatabase(
        agentId,
        competitionId,
        fromToken,
        toToken,
        fromAmount,
        toAmount,
        exchangeRate,
        fromValueUSD,
        fromPrice,
        toPrice,
        chainInfo,
        reason,
      );

      // Log trade summary
      this.logger.debug(`[TradeSimulator] Trade executed successfully:
                Trade ID: ${result.trade.id}
                Agent: ${agentId}
                Competition: ${competitionId}
                Reason: ${reason}
                From Token: ${fromToken} (${fromPrice.symbol}) @ $${fromPrice.price.toFixed(6)}
                To Token: ${toToken} (${toPrice.symbol}) @ $${toPrice.price.toFixed(6)}
                Trade Amount: ${fromAmount} ${fromPrice.symbol} → ${toAmount} ${toPrice.symbol}
                Exchange Rate: 1 ${fromPrice.symbol} = ${exchangeRate.toFixed(6)} ${toPrice.symbol}
                USD Value: $${fromValueUSD.toFixed(2)}
                Chains: ${chainInfo.fromChain || "N/A"} → ${chainInfo.toChain || "N/A"}
                Initial ${fromToken} Balance: ${currentBalance}
                New ${fromToken} Balance: ${result.updatedBalances.fromTokenBalance}
                New ${toToken} Balance: ${result.updatedBalances.toTokenBalance ?? "N/A (burn)"}
            `);

      return result.trade;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error during trade";
      this.logger.error(
        `[TradeSimulator] Trade execution failed:`,
        errorMessage,
      );

      // If it's already an ApiError, re-throw it
      if (error instanceof ApiError) {
        throw error;
      }

      // Otherwise, wrap it in an ApiError
      throw new ApiError(400, errorMessage);
    }
  }

  /**
   * Validates basic trade input parameters
   * @param fromToken The source token address
   * @param toToken The destination token address
   * @param fromAmount The amount to trade
   * @param reason The reason for the trade
   * @throws ApiError if validation fails
   */
  private validateTradeInputs(
    fromToken: string,
    toToken: string,
    fromAmount: number,
    reason: string,
  ): void {
    // Validate minimum trade amount
    if (fromAmount < MIN_TRADE_AMOUNT) {
      this.logger.debug(
        `[TradeSimulator] Trade amount too small: ${fromAmount}`,
      );
      throw new ApiError(400, "Trade amount too small (minimum: 0.000001)");
    }

    // Validate reason is provided
    if (!reason) {
      this.logger.debug(`[TradeSimulator] Trade reason is required`);
      throw new ApiError(400, "Trade reason is required");
    }

    // Prevent trading between identical tokens
    if (fromToken === toToken) {
      this.logger.debug(
        `[TradeSimulator] Cannot trade between identical tokens: ${fromToken}`,
      );
      throw new ApiError(400, "Cannot trade between identical tokens");
    }
  }

  /**
   * Get all trades for an agent
   * @param agentId The agent ID
   * @param limit Optional number of trades to return
   * @param offset Optional offset for pagination
   * @returns Array of Trade objects
   */
  async getAgentTrades(agentId: string, limit?: number, offset?: number) {
    try {
      // If limit is small and we have cache, use it
      if (
        limit &&
        limit <= 100 &&
        offset === undefined &&
        this.tradeCache.has(agentId)
      ) {
        const cachedTrades = this.tradeCache.get(agentId) || [];
        if (cachedTrades.length >= limit) {
          return cachedTrades.slice(0, limit);
        }
      }

      // Get from database
      const trades = await this.tradeRepo.getAgentTrades(
        agentId,
        limit,
        offset,
      );

      // Update cache if fetching recent trades
      if (!offset && (!limit || limit <= 100)) {
        this.tradeCache.set(agentId, [...trades]);
      }

      return trades;
    } catch (error) {
      this.logger.error(`[TradeSimulator] Error getting agent trades:`, error);
      return [];
    }
  }

  /**
   * Get all trades for a competition
   * @param competitionId The competition ID
   * @param limit Optional number of trades to return
   * @param offset Optional offset for pagination
   * @returns Array of Trade objects
   */
  async getCompetitionTrades(
    competitionId: string,
    limit?: number,
    offset?: number,
  ) {
    try {
      return await this.tradeRepo.getCompetitionTrades(
        competitionId,
        limit,
        offset,
      );
    } catch (error) {
      this.logger.error(
        `[TradeSimulator] Error getting competition trades:`,
        error,
      );
      return { trades: [], total: 0 };
    }
  }

  /**
   * Get trade metrics for a competition
   * @param competitionId Competition ID
   * @returns Count of trades, total volume, and number of unique tokens
   */
  async getCompetitionTradeMetrics(competitionId: string): Promise<{
    totalTrades: number;
    totalVolume: number;
    uniqueTokens: number;
  }> {
    try {
      return await this.tradeRepo.getCompetitionTradeMetrics(competitionId);
    } catch (error) {
      this.logger.error(
        `[TradeSimulator] Error getting competition trade metrics:`,
        error,
      );
      return { totalTrades: 0, totalVolume: 0, uniqueTokens: 0 };
    }
  }

  /**
   * Get all trades for an agent in a competition
   * @param competitionId The competition ID
   * @param agentId The agent ID
   * @param limit Optional number of trades to return
   * @param offset Optional offset for pagination
   * @returns Array of Trade objects
   */
  async getAgentTradesInCompetition(
    competitionId: string,
    agentId: string,
    limit?: number,
    offset?: number,
  ) {
    try {
      return await this.tradeRepo.getAgentTradesInCompetition(
        competitionId,
        agentId,
        limit,
        offset,
      );
    } catch (error) {
      this.logger.error(
        `[TradeSimulator] Error getting agent trades in competition:`,
        error,
      );
      return { trades: [], total: 0 };
    }
  }

  /**
   * Calculate an agent's portfolio value in USD
   * @param agentId The agent ID
   * @returns Total portfolio value in USD
   */
  async calculatePortfolioValue(agentId: string) {
    let totalValue = 0;
    const balances = await this.balanceService.getAllBalances(agentId);

    for (const balance of balances) {
      const price = await this.priceTrackerService.getPrice(
        balance.tokenAddress,
      );
      if (price) {
        totalValue += balance.amount * price.price;
      }
    }

    return totalValue;
  }

  /**
   * Calculate portfolio values for multiple agents in bulk
   * @param agentIds Array of agent IDs
   * @returns Map of agent ID to portfolio value in USD
   */
  async calculateBulkPortfolioValues(
    agentIds: string[],
  ): Promise<Map<string, number>> {
    this.logger.debug(
      `[TradeSimulator] Calculating bulk portfolio values for ${agentIds.length} agents`,
    );

    const portfolioValues = new Map<string, number>();

    if (agentIds.length === 0) {
      return portfolioValues;
    }

    try {
      // Step 1: Get all balances for all agents in one query
      const allBalances = await this.balanceService.getBulkBalances(agentIds);

      // Step 2: Get unique token addresses
      const uniqueTokens = [
        ...new Set(allBalances.map((balance) => balance.tokenAddress)),
      ];

      // Step 3: Get all token prices USD in bulk
      const priceMap =
        await this.priceTrackerService.getBulkPrices(uniqueTokens);

      // Step 4: Initialize portfolio values for all agents
      agentIds.forEach((agentId) => {
        portfolioValues.set(agentId, 0);
      });

      // Step 5: Calculate portfolio values efficiently
      allBalances.forEach((balance) => {
        const priceReport = priceMap.get(balance.tokenAddress);
        if (priceReport && priceReport.price) {
          const currentValue = portfolioValues.get(balance.agentId) || 0;
          const tokenValue = balance.amount * priceReport.price;
          portfolioValues.set(balance.agentId, currentValue + tokenValue);
        }
      });

      this.logger.debug(
        `[TradeSimulator] Successfully calculated ${portfolioValues.size} portfolio values using ${uniqueTokens.length} unique tokens`,
      );

      return portfolioValues;
    } catch (error) {
      this.logger.error(
        `[TradeSimulator] Error calculating bulk portfolio values:`,
        error,
      );

      // Fallback to individual calculations
      this.logger.debug(
        `[TradeSimulator] Falling back to individual portfolio calculations`,
      );
      for (const agentId of agentIds) {
        try {
          const value = await this.calculatePortfolioValue(agentId);
          portfolioValues.set(agentId, value);
        } catch (agentError) {
          this.logger.error(
            `[TradeSimulator] Error calculating portfolio for agent ${agentId}:`,
            agentError,
          );
          portfolioValues.set(agentId, 0);
        }
      }

      return portfolioValues;
    }
  }

  /**
   * Check if trade simulator is healthy
   * For system health check use
   */
  async isHealthy() {
    try {
      // Simple check to see if we can connect to the database
      await this.tradeRepo.count();
      return true;
    } catch (error) {
      this.logger.error("[TradeSimulator] Health check failed:", error);
      return false;
    }
  }

  /**
   * Gets trading constraints for a competition, using cache when possible
   * @param competitionId The competition ID
   * @returns Trading constraints for the competition
   */
  private async getTradingConstraints(
    competitionId: string,
  ): Promise<TradingConstraints> {
    // Check cache first
    if (this.constraintsCache.has(competitionId)) {
      return this.constraintsCache.get(competitionId)!;
    }

    // Try to get from database
    const dbConstraints =
      await this.tradingConstraintsRepo.findByCompetitionId(competitionId);

    let constraints: TradingConstraints;
    if (dbConstraints) {
      constraints = {
        minimumPairAgeHours: dbConstraints.minimumPairAgeHours,
        minimum24hVolumeUsd: dbConstraints.minimum24hVolumeUsd,
        minimumLiquidityUsd: dbConstraints.minimumLiquidityUsd,
        minimumFdvUsd: dbConstraints.minimumFdvUsd,
      };
    } else {
      // Fall back to default values
      constraints = {
        minimumPairAgeHours: this.defaultMinimumPairAgeHours,
        minimum24hVolumeUsd: this.defaultMinimum24hVolumeUsd,
        minimumLiquidityUsd: this.defaultMinimumLiquidityUsd,
        minimumFdvUsd: this.defaultMinimumFdvUsd,
      };
    }

    // Cache the result
    this.constraintsCache.set(competitionId, constraints);
    return constraints;
  }

  /**
   * Clears the trading constraints cache for a specific competition or all competitions
   * @param competitionId Optional competition ID to clear, if not provided clears all
   */
  public clearConstraintsCache(competitionId?: string): void {
    if (competitionId) {
      this.constraintsCache.delete(competitionId);
    } else {
      this.constraintsCache.clear();
    }
  }

  /**
   * Validates trading constraints for a token based on DexScreener data
   * @param priceData The price data containing DexScreener metadata
   * @param tokenAddress The token address being validated
   * @param constraints The trading constraints to validate against
   * @throws ApiError if validation fails
   */
  private validateTradingConstraints(
    priceData: PriceReport,
    tokenAddress: string,
    constraints: TradingConstraints,
  ): void {
    // Check if token is a stablecoin - exempt from all constraints
    const isStablecoin = this.dexScreenerProvider.isStablecoin(
      tokenAddress,
      priceData.specificChain,
    );

    if (isStablecoin) {
      this.logger.debug(
        `[TradeSimulator] All trading constraints exempted for stablecoin: ${tokenAddress}`,
      );
      return;
    }

    const isExemptToken = EXEMPT_TOKENS.has(priceData.token);
    if (isExemptToken) {
      this.logger.debug(
        `[TradeSimulator] Constraint check exempted for major token: ${tokenAddress} (${priceData.specificChain})`,
      );
      return;
    }

    // Check pairCreatedAt constraint
    this.validatePairAgeConstraint(priceData, constraints);

    // Check 24h volume constraint
    this.validateVolumeConstraint(priceData, constraints);

    // Check liquidity constraint
    this.validateLiquidConstraint(priceData, constraints);

    // Check FDV constraint - exempt major tokens
    this.validateFdvConstraint(priceData, constraints);

    const isExemptFromFdvLogging = EXEMPT_TOKENS.has(priceData.token);
    this.logger
      .debug(`[TradeSimulator] Trading constraints validated for ${tokenAddress}:
      Pair Age: ${priceData.pairCreatedAt ? ((Date.now() - priceData.pairCreatedAt) / (1000 * 60 * 60)).toFixed(2) : "N/A"} hours
      24h Volume: $${priceData.volume?.h24?.toLocaleString() || "N/A"}
      Liquidity: $${priceData.liquidity?.usd?.toLocaleString() || "N/A"}
      FDV: ${isExemptFromFdvLogging ? "EXEMPTED (major token)" : `$${priceData.fdv?.toLocaleString() || "N/A"}`}
    `);
  }

  /**
   * Validates FDV (Fully Diluted Valuation) constraint for a token
   * @param priceData - Price data containing FDV information
   * @param constraints - Trading constraints to validate against
   * @throws ApiError if validation fails
   */
  private validateFdvConstraint(
    priceData: PriceReport,
    constraints: TradingConstraints,
  ): void {
    if (constraints.minimumFdvUsd === 0) {
      return;
    }
    if (!priceData.fdv && priceData.fdv !== 0) {
      throw new ApiError(400, `Cannot get token FDV`);
    }
    if (priceData.fdv < constraints.minimumFdvUsd) {
      this.logger.debug(
        `[TradeSimulator] Insufficient FDV: $${priceData.fdv.toLocaleString()} (minimum: $${constraints.minimumFdvUsd.toLocaleString()})`,
      );
      throw new ApiError(
        400,
        `Token has insufficient FDV ($${priceData.fdv.toLocaleString()}, minimum: $${constraints.minimumFdvUsd.toLocaleString()})`,
      );
    }
  }

  /**
   * Validates pair age constraint for a token
   * @param priceData - Price data containing pair creation time
   * @param constraints - Trading constraints to validate against
   * @throws ApiError if validation fails
   */
  private validatePairAgeConstraint(
    priceData: PriceReport,
    constraints: TradingConstraints,
  ): void {
    // Setting to zero enables ignoring this constraint for this comp
    if (constraints.minimumPairAgeHours === 0) {
      return;
    }
    if (!priceData.pairCreatedAt) {
      throw new ApiError(
        400,
        `Cannot get token pair creation time, minimum age is: ${constraints.minimumPairAgeHours} hours`,
      );
    }
    const currentTime = Date.now();
    const pairAgeHours =
      (currentTime - priceData.pairCreatedAt) / (1000 * 60 * 60);
    if (pairAgeHours < constraints.minimumPairAgeHours) {
      this.logger.debug(
        `[TradeSimulator] Pair too young: ${pairAgeHours.toFixed(2)} hours (minimum: ${constraints.minimumPairAgeHours} hours)`,
      );
      throw new ApiError(
        400,
        `Token pair is too young (${pairAgeHours.toFixed(2)} hours old, minimum: ${constraints.minimumPairAgeHours} hours)`,
      );
    }
  }

  /**
   * Validates 24h volume constraint for a token
   * @param priceData - Price data containing volume information
   * @param constraints - Trading constraints to validate against
   * @throws ApiError if validation fails
   */
  private validateVolumeConstraint(
    priceData: PriceReport,
    constraints: TradingConstraints,
  ): void {
    if (constraints.minimum24hVolumeUsd === 0) {
      return;
    }
    if (!priceData.volume?.h24 && priceData.volume?.h24 !== 0) {
      throw new ApiError(400, `Cannot get token 24h volume data`);
    }
    if (priceData.volume.h24 < constraints.minimum24hVolumeUsd) {
      this.logger.debug(
        `[TradeSimulator] Insufficient 24h volume: $${priceData.volume.h24.toLocaleString()} (minimum: $${constraints.minimum24hVolumeUsd.toLocaleString()})`,
      );
      throw new ApiError(
        400,
        `Token has insufficient 24h volume ($${priceData.volume.h24.toLocaleString()}, minimum: $${constraints.minimum24hVolumeUsd.toLocaleString()})`,
      );
    }
  }

  /**
   * Validates liquidity constraint for a token
   * @param priceData - Price data containing liquidity information
   * @param constraints - Trading constraints to validate against
   * @throws ApiError if validation fails
   */
  private validateLiquidConstraint(
    priceData: PriceReport,
    constraints: TradingConstraints,
  ): void {
    if (constraints.minimumLiquidityUsd === 0) {
      return;
    }
    if (!priceData.liquidity?.usd && priceData.liquidity?.usd !== 0) {
      throw new ApiError(400, `Cannot get token liquidity`);
    }
    if (priceData.liquidity.usd < constraints.minimumLiquidityUsd) {
      this.logger.debug(
        `[TradeSimulator] Insufficient liquidity: $${priceData.liquidity.usd.toLocaleString()} (minimum: $${constraints.minimumLiquidityUsd.toLocaleString()})`,
      );
      throw new ApiError(
        400,
        `Token has insufficient liquidity ($${priceData.liquidity.usd.toLocaleString()}, minimum: $${constraints.minimumLiquidityUsd.toLocaleString()})`,
      );
    }
  }

  /**
   * Validates cross-chain trading rules.
   * @param chainInfo The resolved chain and specific chain information.
   * @throws ApiError if cross-chain trading is not allowed.
   */
  private validateCrossChainTrading(chainInfo: ChainOptions): void {
    if (
      this.crossChainTradingType === "disallowXParent" &&
      chainInfo.fromChain !== chainInfo.toChain
    ) {
      this.logger.debug(
        `[TradeSimulator] Cross-parent chain trading is disabled. Cannot trade between ${chainInfo.fromChain} and ${chainInfo.toChain}`,
      );
      throw new ApiError(
        400,
        "Cross-parent chain trading is disabled. Both tokens must be on the same parent blockchain.",
      );
    }

    if (
      this.crossChainTradingType === "disallowAll" &&
      (chainInfo.fromChain !== chainInfo.toChain ||
        (chainInfo.fromSpecificChain &&
          chainInfo.toSpecificChain &&
          chainInfo.fromSpecificChain !== chainInfo.toSpecificChain))
    ) {
      this.logger.debug(
        `[TradeSimulator] Cross-chain trading is disabled. Cannot trade between ${chainInfo.fromChain}(${chainInfo.fromSpecificChain || "none"}) and ${chainInfo.toChain}(${chainInfo.toSpecificChain || "none"})`,
      );
      throw new ApiError(
        400,
        "Cross-chain trading is disabled. Both tokens must be on the same blockchain.",
      );
    }
  }

  /**
   * Resolves chain variables for price fetching.
   * Handles default chain detection and specific chain overrides.
   * @param fromToken The source token address
   * @param toToken The destination token address
   * @param chainOptions Optional chain specification for performance optimization
   * @returns An object containing resolved chain and specific chain variables.
   */
  private resolveChainVariables(
    fromToken: string,
    toToken: string,
    chainOptions?: ChainOptions,
  ): ChainOptions {
    let fromChain: BlockchainType, toChain: BlockchainType;
    let fromSpecificChain: SpecificChain | undefined,
      toSpecificChain: SpecificChain | undefined;

    // For the source token
    if (chainOptions?.fromChain) {
      fromChain = chainOptions.fromChain;
      fromSpecificChain = chainOptions.fromSpecificChain;
      this.logger.debug(
        `[TradeSimulator] Using provided chain for fromToken: ${fromChain}, specificChain: ${fromSpecificChain || "none"}`,
      );
    } else {
      fromChain = this.priceTrackerService.determineChain(fromToken);
      this.logger.debug(
        `[TradeSimulator] Detected chain for fromToken: ${fromChain}`,
      );
    }

    // assign the specific chain if provided
    if (chainOptions?.fromSpecificChain) {
      fromSpecificChain = chainOptions.fromSpecificChain;
      this.logger.debug(
        `[TradeSimulator] Using provided specific chain for fromToken: ${fromSpecificChain}`,
      );
    }

    // For the destination token
    if (chainOptions?.toChain) {
      toChain = chainOptions.toChain;
      toSpecificChain = chainOptions.toSpecificChain;
      this.logger.debug(
        `[TradeSimulator] Using provided chain for toToken: ${toChain}, specificChain: ${toSpecificChain || "none"}`,
      );
    } else {
      toChain = this.priceTrackerService.determineChain(toToken);
      this.logger.debug(
        `[TradeSimulator] Detected chain for toToken: ${toChain}`,
      );
    }

    // assign the specific chain if provided
    if (chainOptions?.toSpecificChain) {
      toSpecificChain = chainOptions.toSpecificChain;
      this.logger.debug(
        `[TradeSimulator] Using provided specific chain for toToken: ${toSpecificChain}`,
      );
    }

    return {
      fromChain,
      toChain,
      fromSpecificChain,
      toSpecificChain,
    };
  }

  /**
   * Fetches prices for both tokens and validates constraints.
   * @param fromToken The source token address
   * @param toToken The destination token address
   * @param chainInfo The resolved chain and specific chain information
   * @param competitionId The competition ID
   * @returns An object containing fromPrice and toPrice.
   * @throws ApiError if prices are missing or constraints are violated.
   */
  private async fetchAndValidatePrices(
    fromToken: string,
    toToken: string,
    chainInfo: ChainOptions,
    competitionId: string,
  ): Promise<{ fromPrice: PriceReport; toPrice: PriceReport }> {
    // Get prices with chain information for better performance
    const fromPrice = await this.priceTrackerService.getPrice(
      fromToken,
      chainInfo.fromChain,
      chainInfo.fromSpecificChain,
    );

    const toPrice = await this.priceTrackerService.getPrice(
      toToken,
      chainInfo.toChain,
      chainInfo.toSpecificChain,
    );

    this.logger.debug("[TradeSimulator] Got prices:");
    this.logger.debug(
      `  From Token (${fromToken}): ${JSON.stringify(fromPrice, null, 4)} (${chainInfo.fromChain})`,
    );
    this.logger.debug(
      `  To Token (${toToken}): ${JSON.stringify(toPrice, null, 4)} (${chainInfo.toChain})`,
    );

    if (
      !fromPrice ||
      !toPrice ||
      fromPrice.price == null ||
      toPrice.price == null
    ) {
      this.logger.debug(`[TradeSimulator] Missing price data:
            From Token Price: ${fromPrice ? fromPrice.price : "null"}
            To Token Price: ${toPrice ? toPrice.price : "null"}
        `);
      throw new ApiError(400, "Unable to determine price for tokens");
    }

    // Validate trading constraints for non-burn tokens
    // Trading constraints validation (only for 'to' token)
    if (toPrice.price > 0) {
      const constraints = await this.getTradingConstraints(competitionId);
      this.validateTradingConstraints(toPrice, toToken, constraints);
    }

    if (!(fromPrice.specificChain !== null && toPrice.specificChain !== null)) {
      this.logger.debug(`[TradeSimulator] Missing specific chain data:
            From Token Specific Chain: ${fromPrice.specificChain}
            To Token Specific Chain: ${toPrice.specificChain}
        `);
      throw new ApiError(400, "Unable to determine specific chain for tokens");
    }

    return { fromPrice, toPrice };
  }

  /**
   * Validates balances and portfolio limits for a trade.
   * @param agentId The agent ID
   * @param fromToken The source token address
   * @param fromAmount The amount to trade
   * @param fromValueUSD The USD value of the trade
   * @param currentBalance The current balance of the agent's fromToken
   * @throws ApiError if validation fails
   */
  private async validateBalancesAndPortfolio(
    agentId: string,
    fromToken: string,
    fromAmount: number,
    fromValueUSD: number,
    currentBalance: number,
  ): Promise<void> {
    // Validate balances
    this.logger.debug(
      `[TradeSimulator] Current balance of ${fromToken}: ${currentBalance}`,
    );

    if (currentBalance < fromAmount) {
      this.logger.debug(
        `[TradeSimulator] Insufficient balance: ${currentBalance} < ${fromAmount}`,
      );
      throw new ApiError(400, "Insufficient balance");
    }

    // Calculate portfolio value to check maximum trade size (configurable percentage of portfolio)
    const portfolioValue = await this.calculatePortfolioValue(agentId);
    // TODO: maxTradePercentage should probably be a setting per comp.
    const maxTradeValue = portfolioValue * (this.maxTradePercentage / 100);
    this.logger.debug(
      `[TradeSimulator] Portfolio value: $${portfolioValue}, Max trade value: $${maxTradeValue}, Attempted trade value: $${fromValueUSD}`,
    );

    if (fromValueUSD > maxTradeValue) {
      this.logger.debug(
        `[TradeSimulator] Trade exceeds maximum size: $${fromValueUSD} > $${maxTradeValue} (${this.maxTradePercentage}% of portfolio)`,
      );
      throw new ApiError(
        400,
        `Trade exceeds maximum size (${this.maxTradePercentage}% of portfolio value)`,
      );
    }
  }

  /**
   * Calculates the amount of tokens to receive and the exchange rate for a trade.
   * Handles slippage and burn address scenarios.
   * @param fromAmount The amount of tokens to send
   * @param fromValueUSD The USD value of the trade
   * @param toPrice The price of the token to receive
   * @param fromToken The source token address
   * @param toToken The destination token address
   * @returns An object containing toAmount and exchangeRate.
   */
  private calculateTradeAmounts(
    fromAmount: number,
    fromValueUSD: number,
    toPrice: number,
    fromToken: string,
    toToken: string,
  ): { toAmount: number; exchangeRate: number } {
    let toAmount: number;
    let exchangeRate: number;
    let effectiveFromValueUSD: number;

    if (toPrice === 0) {
      // Burning tokens - toAmount is 0, no slippage calculation needed
      toAmount = 0;
      exchangeRate = 0;
      effectiveFromValueUSD = fromValueUSD; // For accounting purposes, record the full USD value burned
      this.logger
        .debug(`[TradeSimulator] Burn transaction detected - tokens will be burned (toAmount = 0):
          From Token (${fromToken}):
          - Amount: ${fromAmount}
          - USD Value: $${fromValueUSD.toFixed(6)}

          Burn Details:
          - To Token (${toToken}): BURN ADDRESS
          - Price: $${toPrice}
          - Amount Burned: ${toAmount}
          - USD Value Burned: $${effectiveFromValueUSD.toFixed(6)}

          Exchange Rate: 1 ${fromToken} = ${exchangeRate} ${toToken} (BURN)
      `);
    } else {
      // Normal trade with slippage
      const { effectiveFromValueUSD: calculatedEffectiveValue } =
        calculateSlippage(fromValueUSD);
      effectiveFromValueUSD = calculatedEffectiveValue;
      toAmount = effectiveFromValueUSD / toPrice;
      exchangeRate = toAmount / fromAmount;
      this.logger.debug(`[TradeSimulator] Trade calculation details:
          From Token (${fromToken}):
          - Amount: ${fromAmount}
          - USD Value: $${fromValueUSD.toFixed(6)}

          To Token (${toToken}):
          - Price: $${toPrice}
          - Calculated Amount: ${toAmount.toFixed(6)}

          Exchange Rate: 1 ${fromToken} = ${exchangeRate.toFixed(6)} ${toToken}
      `);
    }

    return { toAmount, exchangeRate };
  }

  /**
   * Executes a trade and updates the database atomically.
   * @param agentId The agent ID
   * @param competitionId The competition ID
   * @param fromToken The source token address
   * @param toToken The destination token address
   * @param fromAmount The amount to trade
   * @param toAmount The amount to receive
   * @param exchangeRate The exchange rate
   * @param fromValueUSD The USD value of the trade
   * @param fromPrice The price data for the source token
   * @param toPrice The price data for the destination token
   * @param chainInfo The resolved chain and specific chain information
   * @param reason The reason for the trade
   * @returns Object containing the created trade record and updated balances
   */
  private async executeTradeAndUpdateDatabase(
    agentId: string,
    competitionId: string,
    fromToken: string,
    toToken: string,
    fromAmount: number,
    toAmount: number,
    exchangeRate: number,
    fromValueUSD: number,
    fromPrice: PriceReport,
    toPrice: PriceReport,
    chainInfo: ChainOptions,
    reason: string,
  ): Promise<{
    trade: SelectTrade;
    updatedBalances: {
      fromTokenBalance: number;
      toTokenBalance?: number;
    };
  }> {
    // Create trade record with atomic balance updates
    const trade: InsertTrade = {
      id: randomUUID(),
      timestamp: new Date(),
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      price: exchangeRate, // Exchange rate (0 for burns)
      toTokenSymbol: toPrice.symbol,
      fromTokenSymbol: fromPrice.symbol,
      tradeAmountUsd: fromValueUSD, // Store the USD value of the trade
      success: true,
      agentId,
      competitionId,
      reason,
      // Add chain information to the trade record
      fromChain: chainInfo.fromChain,
      toChain: chainInfo.toChain,
      fromSpecificChain: fromPrice.specificChain,
      toSpecificChain: toPrice.specificChain,
    };

    // Execute the trade atomically (updates balances and creates trade record in one transaction)
    const result = await this.tradeRepo.createTradeWithBalances(trade);

    // Update balance cache with absolute values from the database
    this.balanceService.setBalanceCache(
      agentId,
      fromToken,
      result.updatedBalances.fromTokenBalance,
    );
    if (result.updatedBalances.toTokenBalance !== undefined) {
      this.balanceService.setBalanceCache(
        agentId,
        toToken,
        result.updatedBalances.toTokenBalance,
      );
    }

    // Update trade cache
    const cachedTrades = this.tradeCache.get(agentId) || [];
    cachedTrades.unshift(result.trade); // Add to beginning of array (newest first)
    // Limit cache size to 100 trades per agent
    if (cachedTrades.length > 100) {
      cachedTrades.pop();
    }
    this.tradeCache.set(agentId, cachedTrades);

    return result;
  }
}
