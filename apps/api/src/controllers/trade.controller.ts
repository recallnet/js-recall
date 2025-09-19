import { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { tradeLogger } from "@/lib/logger.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { ServiceRegistry } from "@/services/index.js";
import { BlockchainType } from "@/types/index.js";

const GetQuoteQuerySchema = z.object({
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
  fromSpecificChain: z
    .enum([
      "eth",
      "polygon",
      "bsc",
      "arbitrum",
      "optimism",
      "avalanche",
      "base",
      "linea",
      "zksync",
      "scroll",
      "mantle",
      "svm",
    ])
    .optional(),
  toChain: z.nativeEnum(BlockchainType).optional(),
  toSpecificChain: z
    .enum([
      "eth",
      "polygon",
      "bsc",
      "arbitrum",
      "optimism",
      "avalanche",
      "base",
      "linea",
      "zksync",
      "scroll",
      "mantle",
      "svm",
    ])
    .optional(),
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

        tradeLogger.debug(
          `Executing trade with competition ID: ${competitionId}`,
        );

        // Fetch the competition and check if end date has passed
        const competition =
          await services.competitionService.getCompetition(competitionId);
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

        // Check if agent is registered and active in the competition
        const isAgentActive =
          await services.competitionService.isAgentActiveInCompetition(
            competitionId,
            agentId,
          );
        if (!isAgentActive) {
          throw new ApiError(
            403,
            `Agent ${agentId} is not registered for competition ${competitionId}. Trading is not allowed.`,
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
          tradeLogger.debug(
            `Using chain options: ${JSON.stringify(chainOptions)}`,
          );
        }

        // Execute the trade with optional chain parameters
        const trade = await services.tradeSimulatorService.executeTrade(
          agentId,
          competitionId,
          fromToken,
          toToken,
          parsedAmount,
          reason,
          slippageTolerance,
          chainOptions,
        );

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
