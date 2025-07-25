import { NextFunction, Request, Response } from "express";

import { tradeLogger } from "@/lib/logger.js";
import { calculateSlippage } from "@/lib/trade-utils.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import { BlockchainType, SpecificChain } from "@/types/index.js";

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
        } = req.body;

        const agentId = req.agentId as string;
        const competitionId = req.competitionId as string;

        // Validate required parameters
        if (!fromToken || !toToken || !amount) {
          throw new ApiError(
            400,
            "Missing required parameters: fromToken, toToken, amount",
          );
        }

        // Validate reason is provided
        if (!reason) {
          throw new ApiError(400, "Missing required parameter: reason");
        }

        // Validate amount is a number
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          throw new ApiError(400, "Amount must be a positive number");
        }

        // Validate that we have a competition ID
        if (!competitionId) {
          throw new ApiError(
            400,
            "Missing competitionId: No active competition or competition ID not set",
          );
        }

        tradeLogger.info(
          `Executing trade with competition ID: ${competitionId}`,
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
                fromChain,
                fromSpecificChain,
                toChain,
                toSpecificChain,
              }
            : undefined;

        // Log chain options if provided
        if (chainOptions) {
          tradeLogger.info(
            `Using chain options: ${JSON.stringify(chainOptions)}`,
          );
        }

        // Execute the trade with optional chain parameters
        const result = await services.tradeSimulator.executeTrade(
          agentId,
          competitionId,
          fromToken,
          toToken,
          parsedAmount,
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
          // Chain parameters
          fromChain,
          fromSpecificChain,
          toChain,
          toSpecificChain,
        } = req.query;

        // Validate required parameters
        if (!fromToken || !toToken || !amount) {
          throw new ApiError(
            400,
            "Missing required parameters: fromToken, toToken, amount",
          );
        }

        // Validate amount is a number
        const parsedAmount = parseFloat(amount as string);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          throw new ApiError(400, "Amount must be a positive number");
        }

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
          tradeLogger.info(`Quote with chain info:
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
        const fromValueUSD = parsedAmount * fromPrice.price;

        // Apply slippage based on trade size
        const { effectiveFromValueUSD, slippagePercentage } =
          calculateSlippage(fromValueUSD);
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
