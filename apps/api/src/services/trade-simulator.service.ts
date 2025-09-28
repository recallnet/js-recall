import { SelectTrade } from "@recallnet/db/schema/trading/types";

import {
  count,
  getAgentTrades,
  getAgentTradesInCompetition,
  getCompetitionTradeMetrics,
  getCompetitionTrades,
} from "@/database/repositories/trade-repository.js";
import { serviceLogger } from "@/lib/logger.js";
import { calculateSlippage } from "@/lib/trade-utils.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { BalanceService } from "@/services/balance.service.js";
import { BlockchainType, SpecificChain } from "@/types/index.js";

import { PriceTrackerService } from "./price-tracker.service.js";

// Result types inferred from repository functions to ensure consistency
type CompetitionTradesResult = Awaited<ReturnType<typeof getCompetitionTrades>>;
type AgentTradesInCompetitionResult = Awaited<
  ReturnType<typeof getAgentTradesInCompetition>
>;

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
 * Trade Simulator Service
 * Executes simulated trades between tokens
 */
export class TradeSimulatorService {
  private balanceService: BalanceService;
  private priceTrackerService: PriceTrackerService;
  // Cache of recent trades for performance (agentId -> trades)
  private tradeCache: Map<string, SelectTrade[]>;

  constructor(
    balanceService: BalanceService,
    priceTrackerService: PriceTrackerService,
  ) {
    this.balanceService = balanceService;
    this.priceTrackerService = priceTrackerService;
    this.tradeCache = new Map();
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
      const trades = await getAgentTrades(agentId, limit, offset);

      // Update cache if fetching recent trades
      if (!offset && (!limit || limit <= 100)) {
        this.tradeCache.set(agentId, [...trades]);
      }

      return trades;
    } catch (error) {
      serviceLogger.error(
        `[TradeSimulator] Error getting agent trades:`,
        error,
      );
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
  ): Promise<CompetitionTradesResult> {
    try {
      return await getCompetitionTrades(competitionId, limit, offset);
    } catch (error) {
      serviceLogger.error(
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
      return await getCompetitionTradeMetrics(competitionId);
    } catch (error) {
      serviceLogger.error(
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
  ): Promise<AgentTradesInCompetitionResult> {
    try {
      return await getAgentTradesInCompetition(
        competitionId,
        agentId,
        limit,
        offset,
      );
    } catch (error) {
      serviceLogger.error(
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
    serviceLogger.debug(
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

      serviceLogger.debug(
        `[TradeSimulator] Successfully calculated ${portfolioValues.size} portfolio values using ${uniqueTokens.length} unique tokens`,
      );

      return portfolioValues;
    } catch (error) {
      serviceLogger.error(
        `[TradeSimulator] Error calculating bulk portfolio values:`,
        error,
      );

      // Fallback to individual calculations
      serviceLogger.debug(
        `[TradeSimulator] Falling back to individual portfolio calculations`,
      );
      for (const agentId of agentIds) {
        try {
          const value = await this.calculatePortfolioValue(agentId);
          portfolioValues.set(agentId, value);
        } catch (agentError) {
          serviceLogger.error(
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
   * Get a quote for a trade between two tokens
   * @param params The quote parameters
   * @returns Trade quote result with prices, amounts, and exchange rates
   */
  async getTradeQuote(params: GetQuoteParams): Promise<TradeQuoteResult> {
    try {
      const {
        fromToken,
        toToken,
        amount,
        fromChain,
        fromSpecificChain,
        toChain,
        toSpecificChain,
      } = params;

      serviceLogger.debug(`[TradeSimulator] Getting quote:
        From Token: ${fromToken} (${fromChain || "auto"}, ${fromSpecificChain || "auto"})
        To Token: ${toToken} (${toChain || "auto"}, ${toSpecificChain || "auto"})
        Amount: ${amount}
      `);

      // Get token prices with chain information (let getPrice handle auto-detection)
      const fromPrice = await this.priceTrackerService.getPrice(
        fromToken,
        fromChain,
        fromSpecificChain,
      );

      const toPrice = await this.priceTrackerService.getPrice(
        toToken,
        toChain,
        toSpecificChain,
      );

      // Validate prices
      if (
        !fromPrice ||
        !toPrice ||
        fromPrice.price == null ||
        toPrice.price == null
      ) {
        serviceLogger.debug(`[TradeSimulator] Missing price data:
          From Token Price: ${fromPrice ? fromPrice.price : "null"}
          To Token Price: ${toPrice ? toPrice.price : "null"}
        `);
        throw new ApiError(400, "Unable to determine price for tokens");
      }

      // Calculate trade amounts
      const fromValueUSD = amount * fromPrice.price;
      const { effectiveFromValueUSD, slippagePercentage } =
        calculateSlippage(fromValueUSD);
      const toAmount = effectiveFromValueUSD / toPrice.price;
      const exchangeRate = toAmount / amount;

      // Determine chains for response (use detected chains if not provided)
      const fromChainResult =
        fromChain || this.priceTrackerService.determineChain(fromToken);
      const toChainResult =
        toChain || this.priceTrackerService.determineChain(toToken);

      serviceLogger.debug(`[TradeSimulator] Quote calculated:
        From: ${amount} ${fromPrice.symbol} @ $${fromPrice.price} = $${fromValueUSD}
        To: ${toAmount} ${toPrice.symbol} @ $${toPrice.price}
        Exchange Rate: 1 ${fromPrice.symbol} = ${exchangeRate} ${toPrice.symbol}
        Slippage: ${slippagePercentage}%
        Chains: ${fromChainResult} → ${toChainResult}
      `);

      // Return result
      return {
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount,
        exchangeRate,
        slippage: slippagePercentage,
        tradeAmountUsd: fromValueUSD,
        prices: {
          fromToken: fromPrice.price,
          toToken: toPrice.price,
        },
        symbols: {
          fromTokenSymbol: fromPrice.symbol,
          toTokenSymbol: toPrice.symbol,
        },
        chains: {
          fromChain: fromChainResult,
          toChain: toChainResult,
        },
      };
    } catch (error) {
      serviceLogger.error(`[TradeSimulator] Error getting trade quote:`, error);
      throw error;
    }
  }

  /**
   * Check if trade simulator is healthy
   * For system health check use
   */
  async isHealthy() {
    try {
      // Simple check to see if we can connect to the database
      await count();
      return true;
    } catch (error) {
      serviceLogger.error("[TradeSimulator] Health check failed:", error);
      return false;
    }
  }

  /**
   * Update trade cache with a new trade
   * @param agentId The agent ID
   * @param trade The trade to add to cache
   */
  public updateTradeCache(agentId: string, trade: SelectTrade): void {
    const cachedTrades = this.tradeCache.get(agentId) || [];
    cachedTrades.unshift(trade); // Add to beginning of array (newest first)
    // Limit cache size to 100 trades per agent
    if (cachedTrades.length > 100) {
      cachedTrades.pop();
    }
    this.tradeCache.set(agentId, cachedTrades);
  }
}
