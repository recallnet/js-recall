/**
 * Trade utility functions
 * Shared logic for trade-related calculations
 */
import { config } from "../config/index.js";

/**
 * Result of slippage calculation
 * @param actualSlippage Actual slippage is a decimal between 0 and 1
 * @param slippagePercentage Slippage percentage is a percentage between 0 and 100
 * @param effectiveFromValueUSD Effective from value USD is the USD value of the trade after slippage
 */
export interface SlippageResult {
  actualSlippage: number;
  slippagePercentage: number;
  effectiveFromValueUSD: number;
}

/**
 * Calculate slippage for a trade based on USD value
 * @param fromValueUSD The USD value of the trade
 * @returns SlippageResult containing slippage calculations
 */
export function calculateSlippage(fromValueUSD: number): SlippageResult {
  if (!Number.isFinite(fromValueUSD) || fromValueUSD < 0) {
    throw new Error(
      `fromValueUSD must be a finite, non-negative number: ${fromValueUSD}`,
    );
  }
  if (fromValueUSD === 0) {
    return {
      actualSlippage: 0,
      effectiveFromValueUSD: 0,
      slippagePercentage: 0,
    };
  }
  // Apply slippage based on trade size with logarithmic scaling
  // This prevents slippage from exceeding reasonable limits for large trades
  const MAX_SLIPPAGE = 0.15; // 15% absolute cap
  const MIN_SLIPPAGE = 0.0005; // 5 bps floor for dust trades
  const K = 0.035; // base slippage (slope of the curve)
  const SCALE = 5_000; // $5k reference for curve

  // Logarithmic scaling: slippage increases with trade size but at a decreasing rate
  // Base formula: `slippage = k * log(1 + value/scale)` (clamped to [MIN, MAX] bounds)
  // where `K` is base slippage and `SCALE` is the reference value (e.g. $5k)
  // Thus, slippage is negligible under ~$1k, but climbs quickly past $10k
  const baseSlippage = Math.min(
    // Note: defensive to ensure we don't get negative slippage and hit the MIN_SLIPPAGE for dust
    Math.max(K * (Math.log1p(fromValueUSD / SCALE) / Math.LN10), MIN_SLIPPAGE),
    MAX_SLIPPAGE,
  );

  // Randomness with slight upward bias (max of 2 uniforms skews high)
  const bias = Math.max(Math.random(), Math.random());
  const randomMultiplier = 0.95 + 0.25 * bias; // Range: [0.95, 1.20]
  const actualSlippage = Math.min(
    baseSlippage * randomMultiplier,
    MAX_SLIPPAGE,
  );
  const slippagePercentage = actualSlippage * 100;

  // Calculate final amount after slippage
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
