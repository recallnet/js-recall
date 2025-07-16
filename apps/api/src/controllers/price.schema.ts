import { z } from "zod/v4";

/**
 * Query schema for price endpoints (getPrice, getTokenInfo).
 * @example { token: "0x...", chain: "evm", specificChain: "eth" }
 */
export const PriceQuerySchema = z.object({
  token: z.string().min(1, "Token address is required"),
  chain: z.string().optional(),
  specificChain: z.string().optional(),
});

export type PriceQuery = z.infer<typeof PriceQuerySchema>;
