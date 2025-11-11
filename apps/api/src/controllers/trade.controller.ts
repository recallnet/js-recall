import { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  ApiError,
  BlockchainType,
  SPECIFIC_CHAIN_NAMES,
} from "@recallnet/services/types";

import { ServiceRegistry } from "@/services/index.js";

const GetQuoteQuerySchema = z.object({
  competitionId: z.string().min(1, "competitionId is required"),
  fromToken: z.string().min(1, "fromToken is required"),
  toToken: z.string().min(1, "toToken is required"),
  amount: z
    .string()
    .min(1, "amount is required")
    .transform((val) => {
      const parsed = parseFloat(val);
      if (isNaN(parsed) || parsed <= 0) {
        throw new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            message: "Amount must be a positive number",
            path: ["amount"],
          },
        ]);
      }
      return parsed;
    }),
  fromChain: z.nativeEnum(BlockchainType).optional(),
  fromSpecificChain: z.enum(SPECIFIC_CHAIN_NAMES).optional(),
  toChain: z.nativeEnum(BlockchainType).optional(),
  toSpecificChain: z.enum(SPECIFIC_CHAIN_NAMES).optional(),
});

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
          competitionId,
          // parameters for chain specification
          fromChain,
          fromSpecificChain,
          toChain,
          toSpecificChain,
        } = req.body;

        const agentId = req.agentId as string;

        // Validate required parameters
        if (!fromToken || !toToken || !amount) {
          throw new ApiError(
            400,
            "Missing required parameters: fromToken, toToken, amount",
          );
        }

        // Validate competitionId is provided
        if (!competitionId || typeof competitionId !== "string") {
          throw new ApiError(
            400,
            "Missing required parameter: competitionId. Use POST /api/trade/execute with competitionId in body",
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

        // Execute the trade via service
        const trade =
          await services.simulatedTradeExecutionService.executeTrade({
            agentId,
            competitionId,
            fromToken,
            toToken,
            fromAmount: parsedAmount,
            reason,
            slippageTolerance,
            chainOptions,
          });

        // Return successful trade result
        res.status(200).json({
          success: true,
          transaction: trade,
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
        // Parse and validate query parameters
        const queryParams = GetQuoteQuerySchema.parse(req.query);

        // Get and validate competition
        const competition = await services.competitionService.getCompetition(
          queryParams.competitionId,
        );

        if (!competition) {
          throw new ApiError(404, "Competition not found");
        }

        if (competition.type === "perpetual_futures") {
          throw new ApiError(
            400,
            "This endpoint is not available for perpetual futures competitions. " +
              "Perpetual futures positions are managed through Symphony, not through this API.",
          );
        }

        // Call service method
        const result = await services.tradeSimulatorService.getTradeQuote({
          fromToken: queryParams.fromToken,
          toToken: queryParams.toToken,
          amount: queryParams.amount,
          fromChain: queryParams.fromChain,
          fromSpecificChain: queryParams.fromSpecificChain,
          toChain: queryParams.toChain,
          toSpecificChain: queryParams.toSpecificChain,
        });

        // Return formatted response
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },
  };
}

export type TradeController = ReturnType<typeof makeTradeController>;
