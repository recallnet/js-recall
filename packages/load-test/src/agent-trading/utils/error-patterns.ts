import { TradeRequest } from "./trade-patterns.js";

/**
 * Creates an overdraw trade attempt (intentional error)
 */
export function createOverdrawnTrade(
  usdcToken: string,
  wethToken: string,
): TradeRequest {
  return {
    fromToken: usdcToken,
    toToken: wethToken,
    amount: "1000000", // Intentionally huge amount
    reason: "Overdraw attempt for error testing",
    fromChain: "EVM",
    toChain: "EVM",
  };
}

/**
 * Creates a malformed trade request (missing required fields)
 */
export function createMalformedTrade(): Partial<TradeRequest> {
  const malformedTypes = [
    { fromToken: "0xinvalid" }, // Invalid token address
    { amount: "-100" }, // Negative amount
    { amount: "abc" }, // Non-numeric amount
    { fromToken: "", toToken: "" }, // Empty tokens
    { reason: "" }, // Empty reason
  ];

  return malformedTypes[
    Math.floor(Math.random() * malformedTypes.length)
  ] as Partial<TradeRequest>;
}

/**
 * Creates a rate limit test pattern (rapid requests)
 */
export function createRateLimitPattern(): TradeRequest[] {
  const trades: TradeRequest[] = [];
  const usdcToken = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const wethToken = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

  // Generate 50 rapid trades
  for (let i = 0; i < 50; i++) {
    trades.push({
      fromToken: usdcToken,
      toToken: wethToken,
      amount: "1",
      reason: `Rate limit test ${i}`,
      fromChain: "EVM",
      toChain: "EVM",
    });
  }

  return trades;
}

/**
 * Creates invalid authentication attempts
 */
export function createInvalidAuthPattern(): string[] {
  return [
    "Bearer invalid_token_123",
    "Bearer ",
    "NoBearer token",
    "", // Empty auth
    "Bearer expired_" + Date.now(),
  ];
}

/**
 * Creates cross-chain trade attempts when disallowed
 */
export function createDisallowedCrossChainTrade(): TradeRequest {
  return {
    fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // EVM USDC
    toToken: "So11111111111111111111111111111111111111112", // Solana SOL
    amount: "100",
    reason: "Cross-chain trade attempt",
    fromChain: "EVM",
    toChain: "SVM", // Different chain
  };
}
