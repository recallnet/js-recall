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

const ExecuteTradeBodySchema = z.object({
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
  reason: z.string().min(1, "reason is required"),
  slippageTolerance: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const parsed = parseFloat(val);
      if (isNaN(parsed) || parsed < 0) {
        throw new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            message: "Slippage tolerance must be a non-negative number",
            path: ["slippageTolerance"],
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
        // Parse and validate request body
        const validatedBody = ExecuteTradeBodySchema.parse(req.body);

        const agentId = req.agentId as string;

        // Create chain options object if any chain parameters were provided
        const chainOptions =
          validatedBody.fromChain ||
          validatedBody.fromSpecificChain ||
          validatedBody.toChain ||
          validatedBody.toSpecificChain
            ? {
                fromChain: validatedBody.fromChain,
                fromSpecificChain: validatedBody.fromSpecificChain,
                toChain: validatedBody.toChain,
                toSpecificChain: validatedBody.toSpecificChain,
              }
            : undefined;

        // Execute the trade via service
        const trade =
          await services.simulatedTradeExecutionService.executeTrade({
            agentId,
            competitionId: validatedBody.competitionId,
            fromToken: validatedBody.fromToken,
            toToken: validatedBody.toToken,
            fromAmount: validatedBody.amount,
            reason: validatedBody.reason,
            slippageTolerance: validatedBody.slippageTolerance,
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
