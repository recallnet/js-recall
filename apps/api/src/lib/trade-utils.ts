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
  // Apply slippage based on trade size with logarithmic scaling
  // This prevents slippage from exceeding reasonable limits for large trades
  const MAX_SLIPPAGE = 0.15; // 15% maximum slippage

  // Logarithmic scaling: slippage increases with trade size but at a decreasing rate
  // Base formula: slippage = k * log(1 + value/scale)
  // where k = 0.02 (2% base) and scale = 10000 ($10k reference)
  const baseSlippage = Math.min(
    0.02 * Math.log10(1 + fromValueUSD / 10000),
    MAX_SLIPPAGE,
  );

  // Apply randomness: ±10% variation
  const randomMultiplier = 0.9 + Math.random() * 0.2;
  const actualSlippage = Math.min(
    baseSlippage * randomMultiplier,
    MAX_SLIPPAGE,
  );
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
