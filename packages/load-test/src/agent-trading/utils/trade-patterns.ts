export interface Balance {
  symbol?: string;
  chain?: string;
  specificChain?: string;
  amount?: number;
  value?: number;
  price?: number;
  tokenAddress?: string;
}

export interface TradeRequest {
  fromToken: string;
  toToken: string;
  amount: string;
  reason: string;
  fromChain: string;
  toChain: string;
}

/**
 * Normal trading pattern - balanced trades
 */
export function normalTradePattern(
  balances: Balance[],
  usdcToken: string,
  wethToken: string,
): TradeRequest | null {
  const usdc = balances.find(
    (b) => b.tokenAddress?.toLowerCase() === usdcToken.toLowerCase(),
  );
  const weth = balances.find(
    (b) => b.tokenAddress?.toLowerCase() === wethToken.toLowerCase(),
  );

  if (!usdc || !weth) return null;

  const usdcValue = usdc.amount || 0;
  const wethValue = (weth.amount || 0) * (weth.price || 4000);

  // Simple rebalancing - trade 5-15% of imbalance
  const imbalance = Math.abs(usdcValue - wethValue);
  const tradePercentage = 0.05 + Math.random() * 0.1;
  const tradeAmount = imbalance * tradePercentage;

  if (usdcValue > wethValue && tradeAmount > 0.1) {
    return {
      fromToken: usdcToken,
      toToken: wethToken,
      amount: tradeAmount.toString(),
      reason: "Rebalancing portfolio - buying WETH",
      fromChain: "EVM",
      toChain: "EVM",
    };
  } else if (wethValue > usdcValue && tradeAmount > 0.1) {
    const wethAmount = tradeAmount / (weth.price || 4000);
    return {
      fromToken: wethToken,
      toToken: usdcToken,
      amount: wethAmount.toString(),
      reason: "Rebalancing portfolio - taking profits",
      fromChain: "EVM",
      toChain: "EVM",
    };
  }

  return null;
}

/**
 * TGE FOMO trading pattern - aggressive buying
 */
export function tgeFomoPattern(
  balances: Balance[],
  usdcToken: string,
  targetToken: string,
): TradeRequest {
  const usdc = balances.find(
    (b) => b.tokenAddress?.toLowerCase() === usdcToken.toLowerCase(),
  );
  const usdcAmount = usdc?.amount || 5000;

  // FOMO trades are aggressive - 30-60% of balance
  const fomoPercentage = 0.3 + Math.random() * 0.3;
  const fomoAmount = Math.max(0.1, usdcAmount * fomoPercentage);

  const reasons = [
    "FOMO - everyone is buying, don't want to miss out!",
    "This is going to the moon! Buying more!",
    "TGE launch detected, aggressive accumulation",
    "Huge volume spike, following the trend",
    "Whale alert! Following smart money",
  ];

  return {
    fromToken: usdcToken,
    toToken: targetToken,
    amount: fomoAmount.toString(),
    reason:
      reasons[Math.floor(Math.random() * reasons.length)] || "TGE FOMO trade",
    fromChain: "EVM",
    toChain: "EVM",
  };
}

/**
 * Whale trading pattern - large volume trades
 */
export function whaleTradePattern(
  balances: Balance[],
  usdcToken: string,
  targetToken: string,
): TradeRequest {
  const usdc = balances.find(
    (b) => b.tokenAddress?.toLowerCase() === usdcToken.toLowerCase(),
  );
  const usdcAmount = usdc?.amount || 5000;

  // Whale trades are huge - 50-80% of balance
  const whalePercentage = 0.5 + Math.random() * 0.3;
  const whaleAmount = Math.max(0.1, usdcAmount * whalePercentage);

  return {
    fromToken: usdcToken,
    toToken: targetToken,
    amount: whaleAmount.toString(),
    reason: "Whale trade - large position accumulation",
    fromChain: "EVM",
    toChain: "EVM",
  };
}

/**
 * Catchup trading pattern - late joiners trying to catch up
 */
export function catchupTradePattern(
  balances: Balance[],
  usdcToken: string,
  targetToken: string,
): TradeRequest {
  const usdc = balances.find(
    (b) => b.tokenAddress?.toLowerCase() === usdcToken.toLowerCase(),
  );
  const usdcAmount = usdc?.amount || 2000;

  // Catchup trades are medium aggressive - 15-35% of balance
  const catchupPercentage = 0.15 + Math.random() * 0.2;
  const catchupAmount = Math.max(0.1, usdcAmount * catchupPercentage);

  return {
    fromToken: usdcToken,
    toToken: targetToken,
    amount: catchupAmount.toString(),
    reason: "Late to the party, catching up with aggressive buys",
    fromChain: "EVM",
    toChain: "EVM",
  };
}

/**
 * Panic selling pattern - rapid exits
 */
export function panicSellPattern(
  balances: Balance[],
  sellToken: string,
  usdcToken: string,
): TradeRequest | null {
  const token = balances.find(
    (b) => b.tokenAddress?.toLowerCase() === sellToken.toLowerCase(),
  );

  if (!token || !token.amount || token.amount < 0.01) return null;

  // Panic sells dump 40-70% of holdings
  const panicPercentage = 0.4 + Math.random() * 0.3;
  const panicAmount = token.amount * panicPercentage;

  return {
    fromToken: sellToken,
    toToken: usdcToken,
    amount: panicAmount.toString(),
    reason: "Panic selling - market crash detected!",
    fromChain: "EVM",
    toChain: "EVM",
  };
}
