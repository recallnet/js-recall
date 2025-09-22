import { v4 as uuidv4 } from "uuid";

import { InsertTrade, SelectTrade } from "@recallnet/db/schema/trading/types";

import { config, features } from "@/config/index.js";
import { createTradeWithBalances } from "@/database/repositories/trade-repository.js";
import { findByCompetitionId } from "@/database/repositories/trading-constraints-repository.js";
import { serviceLogger } from "@/lib/logger.js";
import { EXEMPT_TOKENS, calculateSlippage } from "@/lib/trade-utils.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { BalanceService } from "@/services/balance.service.js";
import { CompetitionService } from "@/services/competition.service.js";
import { PortfolioSnapshotterService } from "@/services/portfolio-snapshotter.service.js";
import { PriceTrackerService } from "@/services/price-tracker.service.js";
import { DexScreenerProvider } from "@/services/providers/dexscreener.provider.js";
import { TradeSimulatorService } from "@/services/trade-simulator.service.js";
import { BlockchainType, PriceReport, SpecificChain } from "@/types/index.js";

const MIN_TRADE_AMOUNT = 0.000001;

// Trading constraints type (from trade-simulator.service.ts)
interface TradingConstraints {
  maxTradingVolumeUSD: number | null;
  minPairAgeHours: number | null;
  minLiquidityUSD: number | null;
  minFdvUSD: number | null;
}

// Define an interface for chain options
interface ChainOptions {
  fromChain?: BlockchainType;
  fromSpecificChain?: SpecificChain;
  toChain?: BlockchainType;
  toSpecificChain?: SpecificChain;
}

// Interface for getTradeQuote parameters
interface GetQuoteParams {
  fromToken: string;
  toToken: string;
  amount: number;
  fromChain?: BlockchainType;
  fromSpecificChain?: SpecificChain;
  toChain?: BlockchainType;
  toSpecificChain?: SpecificChain;
}

// Interface for trade quote result
interface TradeQuoteResult {
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  exchangeRate: number;
  slippage: number;
  tradeAmountUsd: number;
  prices: {
    fromToken: number;
    toToken: number;
  };
  symbols: {
    fromTokenSymbol: string;
    toTokenSymbol: string;
  };
  chains: {
    fromChain: string;
    toChain: string;
  };
}

/**
 * Trade Execution Service
 * Handles trade execution with competition validation and constraints
 */
export class TradeExecutionService {
  private competitionService: CompetitionService;
  private tradeSimulatorService: TradeSimulatorService;
  private balanceService: BalanceService;
  private priceTrackerService: PriceTrackerService;
  private portfolioSnapshotterService: PortfolioSnapshotterService;

  // Cache of trading constraints per competition
  private constraintsCache: Map<string, TradingConstraints>;
  // Maximum trade percentage of portfolio value
  private maxTradePercentage: number;

  constructor(
    competitionService: CompetitionService,
    tradeSimulatorService: TradeSimulatorService,
    balanceService: BalanceService,
    priceTrackerService: PriceTrackerService,
    portfolioSnapshotterService: PortfolioSnapshotterService,
  ) {
    this.competitionService = competitionService;
    this.tradeSimulatorService = tradeSimulatorService;
    this.balanceService = balanceService;
    this.priceTrackerService = priceTrackerService;
    this.portfolioSnapshotterService = portfolioSnapshotterService;
    this.constraintsCache = new Map();
    // Get the maximum trade percentage from config
    this.maxTradePercentage = config.maxTradePercentage;
  }

  /**
   * Execute a trade between two tokens with competition validation
   * @param agentId The agent ID
   * @param competitionId The competition ID
   * @param fromToken The source token address
   * @param toToken The destination token address
   * @param fromAmount The amount to trade
   * @param reason The reason for the trade
   * @param slippageTolerance Optional slippage tolerance
   * @param chainOptions Optional chain specification
   * @returns The executed trade details
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
      serviceLogger.debug(`\n[TradeExecution] Starting trade execution:
                Agent: ${agentId}
                Competition: ${competitionId}
                From Token: ${fromToken}
                To Token: ${toToken}
                Amount: ${fromAmount}
                Reason: ${reason}
                Slippage Tolerance: ${slippageTolerance || "default"}
                Chain Options: ${chainOptions ? JSON.stringify(chainOptions) : "none"}
            `);

      // Validate competition existence and status
      const competition =
        await this.competitionService.getCompetition(competitionId);
      if (!competition) {
        throw new ApiError(404, `Competition not found: ${competitionId}`);
      }

      // Check if competition has ended
      const now = new Date();
      if (competition.endDate !== null && now > competition.endDate) {
        throw new ApiError(
          400,
          `Competition has ended. Trading is no longer allowed for competition: ${competition.name}`,
        );
      }

      // Check if agent is registered and active
      const isAgentActive =
        await this.competitionService.isAgentActiveInCompetition(
          competitionId,
          agentId,
        );
      if (!isAgentActive) {
        throw new ApiError(
          403,
          `Agent ${agentId} is not registered for competition ${competitionId}. Trading is not allowed.`,
        );
      }

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
      serviceLogger.debug(`[TradeExecution] Trade executed successfully:
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
      serviceLogger.error(
        `[TradeExecution] Trade execution failed:`,
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
   * Validate basic trade inputs
   * @param fromToken The source token address
   * @param toToken The destination token address
   * @param fromAmount The amount to trade
   * @param reason The reason for the trade
   */
  private validateTradeInputs(
    fromToken: string,
    toToken: string,
    fromAmount: number,
    reason: string,
  ): void {
    // Validate minimum trade amount
    if (fromAmount < MIN_TRADE_AMOUNT) {
      serviceLogger.debug(
        `[TradeExecution] Trade amount too small: ${fromAmount}`,
      );
      throw new ApiError(400, "Trade amount too small (minimum: 0.000001)");
    }

    // Validate reason is provided
    if (!reason) {
      serviceLogger.debug(`[TradeExecution] Trade reason is required`);
      throw new ApiError(400, "Trade reason is required");
    }

    // Prevent trading between identical tokens
    if (fromToken === toToken) {
      serviceLogger.debug(
        `[TradeExecution] Cannot trade between identical tokens: ${fromToken}`,
      );
      throw new ApiError(400, "Cannot trade between identical tokens");
    }
  }

  /**
   * Resolve chain variables for trading
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
      serviceLogger.debug(
        `[TradeExecution] Using provided chain for fromToken: ${fromChain}, specificChain: ${fromSpecificChain || "none"}`,
      );
    } else {
      fromChain = this.priceTrackerService.determineChain(fromToken);
      serviceLogger.debug(
        `[TradeExecution] Detected chain for fromToken: ${fromChain}`,
      );
    }

    // assign the specific chain if provided
    if (chainOptions?.fromSpecificChain) {
      fromSpecificChain = chainOptions.fromSpecificChain;
      serviceLogger.debug(
        `[TradeExecution] Using provided specific chain for fromToken: ${fromSpecificChain}`,
      );
    }

    // For the destination token
    if (chainOptions?.toChain) {
      toChain = chainOptions.toChain;
      toSpecificChain = chainOptions.toSpecificChain;
      serviceLogger.debug(
        `[TradeExecution] Using provided chain for toToken: ${toChain}, specificChain: ${toSpecificChain || "none"}`,
      );
    } else {
      toChain = this.priceTrackerService.determineChain(toToken);
      serviceLogger.debug(
        `[TradeExecution] Detected chain for toToken: ${toChain}`,
      );
    }

    // assign the specific chain if provided
    if (chainOptions?.toSpecificChain) {
      toSpecificChain = chainOptions.toSpecificChain;
      serviceLogger.debug(
        `[TradeExecution] Using provided specific chain for toToken: ${toSpecificChain}`,
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
   * Validate cross-chain trading rules
   */
  private validateCrossChainTrading(chainInfo: ChainOptions): void {
    if (
      features.CROSS_CHAIN_TRADING_TYPE === "disallowXParent" &&
      chainInfo.fromChain !== chainInfo.toChain
    ) {
      serviceLogger.debug(
        `[TradeExecution] Cross-chain trading not allowed: ${chainInfo.fromChain} -> ${chainInfo.toChain}`,
      );
      throw new ApiError(
        400,
        `Cross-chain trading between ${chainInfo.fromChain} and ${chainInfo.toChain} is not allowed`,
      );
    }

    serviceLogger.debug(
      `[TradeExecution] Cross-chain validation passed: ${chainInfo.fromChain} -> ${chainInfo.toChain}`,
    );
  }

  /**
   * Fetches prices for both tokens and validates constraints
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

    serviceLogger.debug("[TradeExecution] Got prices:");
    serviceLogger.debug(
      `  From Token (${fromToken}): ${JSON.stringify(fromPrice, null, 4)} (${chainInfo.fromChain})`,
    );
    serviceLogger.debug(
      `  To Token (${toToken}): ${JSON.stringify(toPrice, null, 4)} (${chainInfo.toChain})`,
    );

    if (
      !fromPrice ||
      !toPrice ||
      fromPrice.price == null ||
      toPrice.price == null
    ) {
      serviceLogger.debug(`[TradeExecution] Missing price data:
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
      serviceLogger.debug(`[TradeExecution] Missing specific chain data:
            From Token Specific Chain: ${fromPrice.specificChain}
            To Token Specific Chain: ${toPrice.specificChain}
        `);
      throw new ApiError(400, "Unable to determine specific chain for tokens");
    }

    return { fromPrice, toPrice };
  }

  /**
   * Validates balances and portfolio limits for a trade
   */
  private async validateBalancesAndPortfolio(
    agentId: string,
    fromToken: string,
    fromAmount: number,
    fromValueUSD: number,
    currentBalance: number,
  ): Promise<void> {
    // Validate balances
    serviceLogger.debug(
      `[TradeExecution] Current balance of ${fromToken}: ${currentBalance}`,
    );

    if (currentBalance < fromAmount) {
      serviceLogger.debug(
        `[TradeExecution] Insufficient balance: ${currentBalance} < ${fromAmount}`,
      );
      throw new ApiError(400, "Insufficient balance");
    }

    // Calculate portfolio value to check maximum trade size (configurable percentage of portfolio)
    const portfolioValue =
      await this.tradeSimulatorService.calculatePortfolioValue(agentId);
    const maxTradeValue = portfolioValue * (this.maxTradePercentage / 100);
    serviceLogger.debug(
      `[TradeExecution] Portfolio value: $${portfolioValue}, Max trade value: $${maxTradeValue}, Attempted trade value: $${fromValueUSD}`,
    );

    if (fromValueUSD > maxTradeValue) {
      serviceLogger.debug(
        `[TradeExecution] Trade exceeds maximum size: $${fromValueUSD} > $${maxTradeValue} (${this.maxTradePercentage}% of portfolio)`,
      );
      throw new ApiError(
        400,
        `Trade exceeds maximum size (${this.maxTradePercentage}% of portfolio value)`,
      );
    }
  }

  /**
   * Calculates the amount of tokens to receive and the exchange rate for a trade
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
      serviceLogger.debug(`[TradeExecution] Burn transaction detected - tokens will be burned (toAmount = 0):
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
      serviceLogger.debug(`[TradeExecution] Trade calculation details:
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
   * Executes a trade and updates the database atomically
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
      toTokenBalance?: number | undefined;
    };
  }> {
    const tradeData: InsertTrade = {
      id: uuidv4(),
      agentId,
      competitionId,
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      price: exchangeRate,
      tradeAmountUsd: fromValueUSD,
      fromChain: chainInfo.fromChain || "unknown",
      toChain: chainInfo.toChain || "unknown",
      fromSpecificChain: fromPrice.specificChain || "unknown",
      toSpecificChain: toPrice.specificChain || "unknown",
      fromTokenSymbol: fromPrice.symbol,
      toTokenSymbol: toPrice.symbol,
      success: true,
      reason,
      timestamp: new Date(),
    };

    // Execute the trade and update balances atomically
    const result = await createTradeWithBalances(tradeData);

    // Take portfolio snapshot after successful trade
    await this.portfolioSnapshotterService.takePortfolioSnapshotForAgent(
      agentId,
      competitionId,
    );

    return result;
  }

  /**
   * Get trading constraints for a competition
   */
  private async getTradingConstraints(
    competitionId: string,
  ): Promise<TradingConstraints> {
    // Check cache first
    if (this.constraintsCache.has(competitionId)) {
      return this.constraintsCache.get(competitionId)!;
    }

    // Try to get from database
    const dbConstraints = await findByCompetitionId(competitionId);

    let constraints: TradingConstraints;
    if (dbConstraints) {
      constraints = {
        maxTradingVolumeUSD: dbConstraints.minimum24hVolumeUsd,
        minPairAgeHours: dbConstraints.minimumPairAgeHours,
        minLiquidityUSD: dbConstraints.minimumLiquidityUsd,
        minFdvUSD: dbConstraints.minimumFdvUsd,
      };
    } else {
      // Fall back to default values
      constraints = {
        maxTradingVolumeUSD:
          config.tradingConstraints.defaultMinimum24hVolumeUsd,
        minPairAgeHours: config.tradingConstraints.defaultMinimumPairAgeHours,
        minLiquidityUSD: config.tradingConstraints.defaultMinimumLiquidityUsd,
        minFdvUSD: config.tradingConstraints.defaultMinimumFdvUsd,
      };
    }

    // Cache the result
    this.constraintsCache.set(competitionId, constraints);
    return constraints;
  }

  /**
   * Validates trading constraints for a token based on DexScreener data
   */
  private validateTradingConstraints(
    priceData: PriceReport,
    tokenAddress: string,
    constraints: TradingConstraints,
  ): void {
    // Skip validation for burn tokens (price = 0) and exempt tokens
    if (priceData.price === 0 || EXEMPT_TOKENS.has(tokenAddress)) {
      serviceLogger.debug(
        `[TradeExecution] Skipping constraints validation for ${tokenAddress} (burn token or exempt)`,
      );
      return;
    }

    this.validateFdvConstraint(priceData, constraints);
    this.validatePairAgeConstraint(priceData, constraints);
    this.validateVolumeConstraint(priceData, constraints);
    this.validateLiquidConstraint(priceData, constraints);
  }

  /**
   * Validates FDV constraint
   */
  private validateFdvConstraint(
    priceData: PriceReport,
    constraints: TradingConstraints,
  ): void {
    if (
      constraints.minFdvUSD &&
      priceData.fdv !== null &&
      priceData.fdv !== undefined &&
      priceData.fdv < constraints.minFdvUSD
    ) {
      throw new ApiError(
        400,
        `Token FDV too low: $${priceData.fdv} < $${constraints.minFdvUSD}`,
      );
    }
  }

  /**
   * Validates pair age constraint
   */
  private validatePairAgeConstraint(
    priceData: PriceReport,
    constraints: TradingConstraints,
  ): void {
    if (constraints.minPairAgeHours && priceData.pairCreatedAt) {
      // pairCreatedAt is a number timestamp, not a Date object
      const pairAge = Date.now() - priceData.pairCreatedAt;
      const pairAgeHours = pairAge / (1000 * 60 * 60);

      if (pairAgeHours < constraints.minPairAgeHours) {
        throw new ApiError(400, "Token pair is too young");
      }
    }
  }

  /**
   * Validates volume constraint
   */
  private validateVolumeConstraint(
    priceData: PriceReport,
    constraints: TradingConstraints,
  ): void {
    if (
      constraints.maxTradingVolumeUSD &&
      priceData.volume !== null &&
      priceData.volume !== undefined &&
      priceData.volume.h24 !== undefined &&
      priceData.volume.h24 < constraints.maxTradingVolumeUSD
    ) {
      throw new ApiError(
        400,
        `Token 24h volume too low: $${priceData.volume.h24} < $${constraints.maxTradingVolumeUSD}`,
      );
    }
  }

  /**
   * Validates liquidity constraint
   */
  private validateLiquidConstraint(
    priceData: PriceReport,
    constraints: TradingConstraints,
  ): void {
    if (
      constraints.minLiquidityUSD &&
      priceData.liquidity !== null &&
      priceData.liquidity !== undefined &&
      priceData.liquidity.usd !== undefined &&
      priceData.liquidity.usd < constraints.minLiquidityUSD
    ) {
      throw new ApiError(
        400,
        `Token liquidity too low: $${priceData.liquidity.usd} < $${constraints.minLiquidityUSD}`,
      );
    }
  }
}
