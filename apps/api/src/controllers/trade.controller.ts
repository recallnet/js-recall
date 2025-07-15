import { NextFunction, Request, Response } from "express";

import { flatParse } from "@/lib/flat-parse.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import {
  AgentIdParamsSchema,
  BlockchainType,
  CompetitionIdParamsSchema,
  SpecificChain,
} from "@/types/index.js";

import {
  ExecuteTradeBodySchema,
  TradeQuoteQuerySchema,
} from "./trade.schema.js";

export function makeTradeController(services: ServiceRegistry) {
  /**
   * Trade Controller
   * Handles trade-related operations
   */
  return {
    /**
     * Execute a trade between two tokens
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async executeTrade(req: Request, res: Response, next: NextFunction) {
      try {
        const { agentId } = flatParse(AgentIdParamsSchema, req);
        const { competitionId } = flatParse(CompetitionIdParamsSchema, req);
        const {
          fromToken,
          toToken,
          amount,
          reason,
          slippageTolerance,
          // parameters for chain specification
          fromChain,
          fromSpecificChain,
          toChain,
          toSpecificChain,
        } = flatParse(ExecuteTradeBodySchema, req.body, "body");

        console.log(
          `[TradeController] Executing trade with competition ID: ${competitionId}`,
        );

        // Fetch the competition and check if end date has passed
        const competition =
          await services.competitionManager.getCompetition(competitionId);
        if (!competition) {
          throw new ApiError(404, `Competition not found: ${competitionId}`);
        }

        // Check if competition has passed its end date
        const now = new Date();
        if (competition.endDate !== null && now > competition.endDate) {
          throw new ApiError(
            400,
            `Competition has ended. Trading is no longer allowed for competition: ${competition.name}`,
          );
        }

        // Create chain options object if any chain parameters were provided
        const chainOptions =
          fromChain || fromSpecificChain || toChain || toSpecificChain
            ? {
                fromChain: fromChain as BlockchainType,
                fromSpecificChain: fromSpecificChain as SpecificChain,
                toChain: toChain as BlockchainType,
                toSpecificChain: toSpecificChain as SpecificChain,
              }
            : undefined;

        // Log chain options if provided
        if (chainOptions) {
          console.log(
            `[TradeController] Using chain options:`,
            JSON.stringify(chainOptions),
          );
        }

        // Execute the trade with optional chain parameters
        const result = await services.tradeSimulator.executeTrade(
          agentId,
          competitionId,
          fromToken,
          toToken,
          parseFloat(amount as string),
          reason,
          slippageTolerance,
          chainOptions,
        );

        if (!result.success) {
          throw new ApiError(400, result.error || "Trade execution failed");
        }

        // Return successful trade result
        res.status(200).json({
          success: true,
          transaction: result.trade,
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * Get a quote for a trade
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    async getQuote(req: Request, res: Response, next: NextFunction) {
      try {
        const {
          fromToken,
          toToken,
          amount,
          fromChain,
          fromSpecificChain,
          toChain,
          toSpecificChain,
        } = flatParse(TradeQuoteQuerySchema, req.query, "query");

        // Determine chains for from/to tokens
        let fromTokenChain: BlockchainType | undefined;
        let fromTokenSpecificChain: SpecificChain | undefined;
        let toTokenChain: BlockchainType | undefined;
        let toTokenSpecificChain: SpecificChain | undefined;

        // Parse chain parameters if provided
        if (fromChain) {
          fromTokenChain = fromChain as BlockchainType;
        }
        if (fromSpecificChain) {
          fromTokenSpecificChain = fromSpecificChain as SpecificChain;
        }
        if (toChain) {
          toTokenChain = toChain as BlockchainType;
        }
        if (toSpecificChain) {
          toTokenSpecificChain = toSpecificChain as SpecificChain;
        }

        // Log chain information if provided
        if (
          fromTokenChain ||
          fromTokenSpecificChain ||
          toTokenChain ||
          toTokenSpecificChain
        ) {
          console.log(`[TradeController] Quote with chain info:
          From Token Chain: ${fromTokenChain || "auto"}, Specific Chain: ${fromTokenSpecificChain || "auto"}
          To Token Chain: ${toTokenChain || "auto"}, Specific Chain: ${toTokenSpecificChain || "auto"}
        `);
        }

        // Get token prices with chain information for better performance
        const fromPrice = await services.priceTracker.getPrice(
          fromToken as string,
          fromTokenChain,
          fromTokenSpecificChain,
        );

        const toPrice = await services.priceTracker.getPrice(
          toToken as string,
          toTokenChain,
          toTokenSpecificChain,
        );

        if (
          !fromPrice ||
          !toPrice ||
          fromPrice.price == null ||
          toPrice.price == null
        ) {
          throw new ApiError(400, "Unable to determine price for tokens");
        }

        // Calculate the trade
        const parsedAmount = parseFloat(amount as string);
        const fromValueUSD = parsedAmount * fromPrice.price;

        // Apply slippage based on trade size
        const baseSlippage = (fromValueUSD / 10000) * 0.05; // 0.05% per $10,000 (10x lower than before)
        const actualSlippage = baseSlippage * (0.9 + Math.random() * 0.2); // ±10% randomness (reduced from ±20%)
        const slippagePercentage = actualSlippage * 100;

        // Calculate final amount with slippage
        const effectiveFromValueUSD = fromValueUSD * (1 - actualSlippage);
        const toAmount = effectiveFromValueUSD / toPrice.price;

        // Return quote with chain information
        res.status(200).json({
          fromToken,
          toToken,
          fromAmount: parsedAmount,
          toAmount,
          exchangeRate: toAmount / parsedAmount,
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
            fromChain:
              fromTokenChain ||
              services.priceTracker.determineChain(fromToken as string),
            toChain:
              toTokenChain ||
              services.priceTracker.determineChain(toToken as string),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  };
}

export type TradeController = ReturnType<typeof makeTradeController>;
