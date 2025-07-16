import { z } from "zod/v4";

/**
 * Body schema for executing a trade.
 * @example { fromToken: "0x...", toToken: "0x...", amount: "100", reason: "rebalance", slippageTolerance: 0.01, fromChain: "evm", fromSpecificChain: "eth", toChain: "evm", toSpecificChain: "polygon" }
 */
export const ExecuteTradeBodySchema = z.object({
  fromToken: z.string().min(1, "fromToken is required"),
  toToken: z.string().min(1, "toToken is required"),
  amount: z
    .union([z.string(), z.number()])
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be a positive number",
    }),
  reason: z.string().min(1, "reason is required"),
  slippageTolerance: z.number().optional(),
  // parameters for chain specification
  fromChain: z.string().optional(),
  fromSpecificChain: z.string().optional(),
  toChain: z.string().optional(),
  toSpecificChain: z.string().optional(),
});

/**
 * Query schema for getting a trade quote.
 * @example { fromToken: "0x...", toToken: "0x...", amount: "100", fromChain: "evm", fromSpecificChain: "eth", toChain: "evm", toSpecificChain: "polygon" }
 */
export const TradeQuoteQuerySchema = z.object({
  fromToken: z.string().min(1, "fromToken is required"),
  toToken: z.string().min(1, "toToken is required"),
  amount: z
    .union([z.string(), z.number()])
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be a positive number",
    }),
  fromChain: z.string().optional(),
  fromSpecificChain: z.string().optional(),
  toChain: z.string().optional(),
  toSpecificChain: z.string().optional(),
});

export type ExecuteTradeBody = z.infer<typeof ExecuteTradeBodySchema>;
export type TradeQuoteQuery = z.infer<typeof TradeQuoteQuerySchema>;
