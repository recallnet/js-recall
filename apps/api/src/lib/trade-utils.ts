/**
 * Trade utility functions
 * Shared logic for trade-related calculations
 */

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
 */
export const EXEMPT_TOKENS = new Set([
  // TODO: maybe this should either be config or part of competition data?
  // Solana native token
  "So11111111111111111111111111111111111111112", // SOL
  // Ethereum and major EVM tokens
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
  "0x0000000000000000000000000000000000000000", // Zero address
]);
