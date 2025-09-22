import { NextFunction, Request, Response } from "express";
import { z } from "zod";

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

const ExecuteTradeBodySchema = z.object({
  fromToken: z.string().min(1, "fromToken is required"),
  toToken: z.string().min(1, "toToken is required"),
  amount: z
    .number()
    .positive("Amount must be a positive number")
    .or(
      z.string().transform((val) => {
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
    ),
  reason: z.string().min(1, "reason is required"),
  slippageTolerance: z.number().optional(),
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
        // Parse and validate request body
        const validatedBody = ExecuteTradeBodySchema.parse(req.body);

        const agentId = req.agentId as string;
        const competitionId = req.competitionId as string;

        // Validate that we have a competition ID
        if (!competitionId) {
          throw new ApiError(
            400,
            "Missing competitionId: No active competition or competition ID not set",
          );
        }

        // Build chain options object from validated parameters
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

        // Call service method
        const trade = await services.tradeSimulatorService.executeTrade(
          agentId,
          competitionId,
          validatedBody.fromToken,
          validatedBody.toToken,
          validatedBody.amount,
          validatedBody.reason,
          validatedBody.slippageTolerance,
          chainOptions,
        );

        // Return response
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
