import { v4 as uuidv4 } from "uuid";

import { config, features } from "@/config/index.js";
import {
  count,
  create as createTrade,
  getAgentTrades,
  getCompetitionTrades,
} from "@/database/repositories/trade-repository.js";
import { InsertTrade, SelectTrade } from "@/database/schema/trading/types.js";
import { BalanceManager } from "@/services/balance-manager.service.js";
import { PortfolioSnapshotter } from "@/services/index.js";
import { BlockchainType, SpecificChain } from "@/types/index.js";

import { PriceTracker } from "./price-tracker.service.js";

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
export class TradeSimulator {
  private balanceManager: BalanceManager;
  private priceTracker: PriceTracker;
  // Cache of recent trades for performance (agentId -> trades)
  private tradeCache: Map<string, SelectTrade[]>;
  // Maximum trade percentage of portfolio value
  private maxTradePercentage: number;
  private portfolioSnapshotter: PortfolioSnapshotter;

  constructor(
    balanceManager: BalanceManager,
    priceTracker: PriceTracker,
    portfolioSnapshotter: PortfolioSnapshotter,
  ) {
    this.balanceManager = balanceManager;
    this.priceTracker = priceTracker;
    this.portfolioSnapshotter = portfolioSnapshotter;
    this.tradeCache = new Map();
    // Get the maximum trade percentage from config
    this.maxTradePercentage = config.maxTradePercentage;
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
   * @returns TradeResult object with success status and trade details
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
  ): Promise<{ success: boolean; trade?: SelectTrade; error?: string }> {
    try {
      console.log(`\n[TradeSimulator] Starting trade execution:
                Agent: ${agentId}
                Competition: ${competitionId}
                From Token: ${fromToken}
                To Token: ${toToken}
                Amount: ${fromAmount}
                Reason: ${reason}
                Slippage Tolerance: ${slippageTolerance || "default"}
                Chain Options: ${chainOptions ? JSON.stringify(chainOptions) : "none"}
            `);

      // Validate minimum trade amount
      if (fromAmount < 0.000001) {
        console.log(`[TradeSimulator] Trade amount too small: ${fromAmount}`);
        return {
          success: false,
          error: "Trade amount too small (minimum: 0.000001)",
        };
      }

      // Validate reason is provided
      if (!reason) {
        console.log(`[TradeSimulator] Trade reason is required`);
        return {
          success: false,
          error: "Trade reason is required",
        };
      }

      // Prevent trading between identical tokens
      if (fromToken === toToken) {
        console.log(
          `[TradeSimulator] Cannot trade between identical tokens: ${fromToken}`,
        );
        return {
          success: false,
          error: "Cannot trade between identical tokens",
        };
      }

      // Get prices with chain information for better performance
      let fromTokenChain: BlockchainType, toTokenChain: BlockchainType;
      let fromTokenSpecificChain: SpecificChain | undefined,
        toTokenSpecificChain: SpecificChain | undefined;

      // For the source token
      if (chainOptions?.fromChain) {
        fromTokenChain = chainOptions.fromChain;
        fromTokenSpecificChain = chainOptions.fromSpecificChain;
        console.log(
          `[TradeSimulator] Using provided chain for fromToken: ${fromTokenChain}, specificChain: ${fromTokenSpecificChain || "none"}`,
        );
      } else {
        fromTokenChain = this.priceTracker.determineChain(fromToken);
        console.log(
          `[TradeSimulator] Detected chain for fromToken: ${fromTokenChain}`,
        );
      }

      // assign the specific chain if provided
      if (chainOptions?.fromSpecificChain) {
        fromTokenSpecificChain = chainOptions.fromSpecificChain;
        console.log(
          `[TradeSimulator] Using provided specific chain for fromToken: ${fromTokenSpecificChain}`,
        );
      }

      // For the destination token
      if (chainOptions?.toChain) {
        toTokenChain = chainOptions.toChain;
        toTokenSpecificChain = chainOptions.toSpecificChain;
        console.log(
          `[TradeSimulator] Using provided chain for toToken: ${toTokenChain}, specificChain: ${toTokenSpecificChain || "none"}`,
        );
      } else {
        toTokenChain = this.priceTracker.determineChain(toToken);
        console.log(
          `[TradeSimulator] Detected chain for toToken: ${toTokenChain}`,
        );
      }

      // assign the specific chain if provided
      if (chainOptions?.toSpecificChain) {
        toTokenSpecificChain = chainOptions.toSpecificChain;
        console.log(
          `[TradeSimulator] Using provided specific chain for toToken: ${toTokenSpecificChain}`,
        );
      }

      // Get prices with chain information for better performance
      const fromPrice = await this.priceTracker.getPrice(
        fromToken,
        fromTokenChain,
        fromTokenSpecificChain,
      );

      const toPrice = await this.priceTracker.getPrice(
        toToken,
        toTokenChain,
        toTokenSpecificChain,
      );

      console.log("[TradeSimulator] Got prices:");
      console.log(
        `  From Token (${fromToken}): ${JSON.stringify(fromPrice, null, 4)} (${fromTokenChain})`,
      );
      console.log(
        `  To Token (${toToken}): ${JSON.stringify(toPrice, null, 4)} (${toTokenChain})`,
      );

      if (
        !fromPrice ||
        !toPrice ||
        fromPrice.price == null ||
        toPrice.price == null
      ) {
        console.log(`[TradeSimulator] Missing price data:
            From Token Price: ${fromPrice}
            To Token Price: ${toPrice}
        `);
        return {
          success: false,
          error: "Unable to determine price for tokens",
        };
      }

      if (
        !(fromPrice.specificChain !== null && toPrice.specificChain !== null)
      ) {
        console.log(`[TradeSimulator] Missing specific chain data:
            From Token Specific Chain: ${fromPrice.specificChain}
            To Token Specific Chain: ${toPrice.specificChain}
        `);
        return {
          success: false,
          error: "Unable to determine specific chain for tokens",
        };
      }

      switch (features.CROSS_CHAIN_TRADING_TYPE) {
        case "disallowXParent":
          // Check if the tokens are on the same chain
          if (fromTokenChain !== toTokenChain) {
            console.log(
              `[TradeSimulator] Cross-parent chain trading is disabled. Cannot trade between ${fromTokenChain} and ${toTokenChain}`,
            );
            return {
              success: false,
              error:
                "Cross-parent chain trading is disabled. Both tokens must be on the same parent blockchain.",
            };
          }
          break;
        case "disallowAll":
          // Check if the tokens are on the same chain
          if (
            fromTokenChain !== toTokenChain ||
            (fromTokenSpecificChain &&
              toTokenSpecificChain &&
              fromTokenSpecificChain !== toTokenSpecificChain)
          ) {
            console.log(
              `[TradeSimulator] Cross-chain trading is disabled. Cannot trade between ${fromTokenChain}(${fromTokenSpecificChain || "none"}) and ${toTokenChain}(${toTokenSpecificChain || "none"})`,
            );
            return {
              success: false,
              error:
                "Cross-chain trading is disabled. Both tokens must be on the same blockchain.",
            };
          }
          break;
      }

      // Calculate the trade using USD values
      const fromValueUSD = fromAmount * fromPrice.price;

      // Validate balances
      const currentBalance = await this.balanceManager.getBalance(
        agentId,
        fromToken,
      );
      console.log(
        `[TradeSimulator] Current balance of ${fromToken}: ${currentBalance}`,
      );

      if (currentBalance < fromAmount) {
        console.log(
          `[TradeSimulator] Insufficient balance: ${currentBalance} < ${fromAmount}`,
        );
        return {
          success: false,
          error: "Insufficient balance",
        };
      }

      // Calculate portfolio value to check maximum trade size (configurable percentage of portfolio)
      const portfolioValue = await this.calculatePortfolioValue(agentId);
      const maxTradeValue = portfolioValue * (this.maxTradePercentage / 100);
      console.log(
        `[TradeSimulator] Portfolio value: $${portfolioValue}, Max trade value: $${maxTradeValue}, Attempted trade value: $${fromValueUSD}`,
      );

      if (fromValueUSD > maxTradeValue) {
        console.log(
          `[TradeSimulator] Trade exceeds maximum size: $${fromValueUSD} > $${maxTradeValue} (${this.maxTradePercentage}% of portfolio)`,
        );
        return {
          success: false,
          error: `Trade exceeds maximum size (${this.maxTradePercentage}% of portfolio value)`,
        };
      }

      // Handle burn address (price = 0) specially
      let toAmount: number;
      let exchangeRate: number;
      let effectiveFromValueUSD: number;

      if (toPrice.price === 0) {
        // Burning tokens - toAmount is 0, no slippage calculation needed
        toAmount = 0;
        exchangeRate = 0;
        effectiveFromValueUSD = fromValueUSD; // For accounting purposes, record the full USD value burned
        console.log(
          `[TradeSimulator] Burn transaction detected - tokens will be burned (toAmount = 0)`,
        );
      } else {
        // Normal trade with slippage
        const baseSlippage = (fromValueUSD / 10000) * 0.05; // 0.05% per $10,000 (10x lower than before)
        const actualSlippage = baseSlippage * (0.9 + Math.random() * 0.2); // ±10% randomness (reduced from ±20%)

        // Calculate final amount with slippage
        effectiveFromValueUSD = fromValueUSD * (1 - actualSlippage);
        toAmount = effectiveFromValueUSD / toPrice.price;
        exchangeRate = toAmount / fromAmount;
      }

      // Debug logging for price calculations
      if (toPrice.price === 0) {
        console.log(`[TradeSimulator] Burn trade calculation details:
                From Token (${fromToken}):
                - Amount: ${fromAmount}
                - Price: $${fromPrice.price}
                - USD Value: $${fromValueUSD.toFixed(6)}
                
                Burn Details:
                - To Token (${toToken}): BURN ADDRESS
                - Price: $${toPrice.price}
                - Amount Burned: ${toAmount}
                - USD Value Burned: $${effectiveFromValueUSD.toFixed(6)}

                Exchange Rate: 1 ${fromToken} = ${exchangeRate} ${toToken} (BURN)
            `);
      } else {
        console.log(`[TradeSimulator] Trade calculation details:
                From Token (${fromToken}):
                - Amount: ${fromAmount}
                - Price: $${fromPrice.price}
                - USD Value: $${fromValueUSD.toFixed(6)}
                
                To Token (${toToken}):
                - Price: $${toPrice.price}
                - Calculated Amount: ${toAmount.toFixed(6)}

                Exchange Rate: 1 ${fromToken} = ${exchangeRate.toFixed(6)} ${toToken}
            `);
      }

      // Execute the trade
      await this.balanceManager.subtractAmount(
        agentId,
        fromToken,
        fromAmount,
        fromPrice.specificChain as SpecificChain,
        fromPrice.symbol,
      );

      // Only add balance for non-burn addresses (toAmount > 0)
      if (toAmount > 0) {
        await this.balanceManager.addAmount(
          agentId,
          toToken,
          toAmount,
          toPrice.specificChain as SpecificChain,
          toPrice.symbol,
        );
      } else {
        console.log(
          `[TradeSimulator] Burn trade completed - no balance added for ${toToken}`,
        );
      }

      // Create trade record
      const trade: InsertTrade = {
        id: uuidv4(),
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
        fromChain: fromTokenChain,
        toChain: toTokenChain,
        fromSpecificChain: fromPrice.specificChain,
        toSpecificChain: toPrice.specificChain,
      };

      // Store the trade in database
      const result = await createTrade(trade);

      // Update cache
      const cachedTrades = this.tradeCache.get(agentId) || [];
      cachedTrades.unshift(result); // Add to beginning of array (newest first)
      // Limit cache size to 100 trades per agent
      if (cachedTrades.length > 100) {
        cachedTrades.pop();
      }
      this.tradeCache.set(agentId, cachedTrades);

      console.log(`[TradeSimulator] Trade executed successfully:
                Initial ${fromToken} Balance: ${currentBalance}
                New ${fromToken} Balance: ${await this.balanceManager.getBalance(agentId, fromToken)}
                New ${toToken} Balance: ${await this.balanceManager.getBalance(agentId, toToken)}
            `);

      // Trigger a portfolio snapshot for the trading agent only
      // We run this asynchronously without awaiting to avoid delaying the trade response
      this.portfolioSnapshotter
        .takePortfolioSnapshotForAgent(competitionId, agentId)
        .catch((error) => {
          console.error(
            `[TradeSimulator] Error taking portfolio snapshot for agent ${agentId} after trade: ${error.message}`,
          );
        });
      console.log(
        `[TradeSimulator] Portfolio snapshot triggered for agent ${agentId} in competition ${competitionId} after trade`,
      );

      return {
        success: true,
        trade: result,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error during trade";
      console.error(`[TradeSimulator] Trade execution failed:`, errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
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
      const trades = await getAgentTrades(agentId, limit, offset);

      // Update cache if fetching recent trades
      if (!offset && (!limit || limit <= 100)) {
        this.tradeCache.set(agentId, [...trades]);
      }

      return trades;
    } catch (error) {
      console.error(`[TradeSimulator] Error getting agent trades:`, error);
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
      return await getCompetitionTrades(competitionId, limit, offset);
    } catch (error) {
      console.error(
        `[TradeSimulator] Error getting competition trades:`,
        error,
      );
      return [];
    }
  }

  /**
   * Calculate an agent's portfolio value in USD
   * @param agentId The agent ID
   * @returns Total portfolio value in USD
   */
  async calculatePortfolioValue(agentId: string) {
    let totalValue = 0;
    const balances = await this.balanceManager.getAllBalances(agentId);

    for (const balance of balances) {
      const price = await this.priceTracker.getPrice(balance.tokenAddress);
      if (price) {
        totalValue += balance.amount * price.price;
      }
    }

    return totalValue;
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
      console.error("[TradeSimulator] Health check failed:", error);
      return false;
    }
  }
}
