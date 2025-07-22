/**
 * Trade utility functions
 * Shared logic for trade-related calculations
 */
import { config } from "../config/index.js";

export interface SlippageResult {
  actualSlippage: number;
  effectiveFromValueUSD: number;
  slippagePercentage: number;
}

/**
 * Calculate slippage for a trade based on USD value
 * @param fromValueUSD The USD value of the trade
 * @returns SlippageResult containing slippage calculations
 */
export function calculateSlippage(fromValueUSD: number): SlippageResult {
  // Apply slippage based on trade size
  const baseSlippage = (fromValueUSD / 10000) * 0.05; // 0.05% per $10,000 (10x lower than before)
  const actualSlippage = baseSlippage * (0.9 + Math.random() * 0.2); // ±10% randomness (reduced from ±20%)
  const slippagePercentage = actualSlippage * 100;

  // Calculate final amount with slippage
  const effectiveFromValueUSD = fromValueUSD * (1 - actualSlippage);

  return {
    actualSlippage,
    effectiveFromValueUSD,
    slippagePercentage,
  };
}

/**
 * Major tokens exempt from trading constraint requirements (native tokens, established assets)
 * Populated from all token addresses configured in the system
 */
export const EXEMPT_TOKENS = new Set([
  // Collect all token addresses from all chains in config
  ...Object.values(config.specificChainTokens).flatMap((chainTokens) =>
    Object.values(chainTokens),
  ),
  // Add the zero address for native EVM tokens
  "0x0000000000000000000000000000000000000000", // Ethereum, etc...
]);
