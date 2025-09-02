import {
  ERC20Transfers,
  UniswapV2,
  UniswapV3,
  Curve,
  BalancerV1,
  BalancerV2,
  Bancor,
  Trade,
  Transfer
} from "generated";

// Temporary storage for transfers by transaction hash
// This allows us to match transfers with trades in the same transaction
const transfersByTx = new Map<string, Transfer[]>();

// Helper function to get chain name from chain ID
function getChainName(chainId: number): string {
  const chainNames: Record<number, string> = {
    1: "ethereum",
    10: "optimism",
    42161: "arbitrum",
    137: "polygon",
    8453: "base",
    56: "bsc",
    43114: "avalanche",
    59144: "linea"
  };
  return chainNames[chainId] || `chain_${chainId}`;
}

// Helper function to find matching transfers for a trade
function findTokensFromTransfers(
  txHash: string,
  sender: string,
  recipient: string,
  amountIn: bigint,
  amountOut: bigint
): { tokenIn: string; tokenOut: string } {
  const transfers = transfersByTx.get(txHash) || [];

  // Look for transfer FROM sender (token going in)
  // This could be to a router or directly to a pool
  const inTransfer = transfers.find(t =>
    t.from.toLowerCase() === sender.toLowerCase() &&
    BigInt(t.value) === amountIn
  );

  // Look for transfer TO recipient (token coming out)
  // This could be from a router or directly from a pool
  const outTransfer = transfers.find(t =>
    t.to.toLowerCase() === recipient.toLowerCase() &&
    BigInt(t.value) === amountOut
  );

  return {
    tokenIn: inTransfer?.token || "unknown",
    tokenOut: outTransfer?.token || "unknown"
  };
}

// Helper function to get protocol name from contract address
function getProtocolFromAddress(address: string, eventType: string): string {
  // For MVP, we'll use event type as a proxy for protocol
  // In production, you'd want to maintain a mapping of known contract addresses
  const protocolMap: Record<string, string> = {
    "Swap": "uniswap", // Could be v2 or v3
    "TokenExchange": "curve",
    "LOG_SWAP": "balancer-v1",
    "TokensTraded": "bancor"
  };

  // For Balancer V2, the Vault contract is at a known address
  const balancerV2Vaults: Record<number, string> = {
    1: "0xBA12222222228d8Ba445958a75a0704d566BF2C8", // Ethereum
    137: "0xBA12222222228d8Ba445958a75a0704d566BF2C8", // Polygon
    42161: "0xBA12222222228d8Ba445958a75a0704d566BF2C8", // Arbitrum
  };

  // Check if it's Balancer V2 Vault
  for (const vault of Object.values(balancerV2Vaults)) {
    if (address.toLowerCase() === vault.toLowerCase()) {
      return "balancer-v2";
    }
  }

  return protocolMap[eventType] || address.toLowerCase();
}

// ERC20 Transfer handler - for tracking all token movements
ERC20Transfers.Transfer.handler(
  async ({ event, context }) => {
    const transfer: Transfer = {
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      from: event.params.from.toLowerCase(),
      to: event.params.to.toLowerCase(),
      chain: getChainName(event.chainId),
      transactionHash: event.transaction.hash,
      blockNumber: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
      token: event.srcAddress.toLowerCase(), // srcAddress is the token contract
      value: event.params.value
    };

    // Store in our temporary map for matching with trades
    const txHash = event.transaction.hash;
    if (!transfersByTx.has(txHash)) {
      transfersByTx.set(txHash, []);
    }
    transfersByTx.get(txHash)!.push(transfer);

    // Clean up old entries to prevent memory issues (keep last 1000 txs)
    if (transfersByTx.size > 1000) {
      const oldestKey = transfersByTx.keys().next().value;
      if (oldestKey) {
        transfersByTx.delete(oldestKey);
      }
    }

    context.Transfer.set(transfer);
  },
  { wildcard: true }
);

// Uniswap V2 and forks handler
UniswapV2.Swap.handler(
  async ({ event, context }) => {
    // Determine which amounts are non-zero to identify trade direction
    const isToken0ToToken1 = event.params.amount0In > 0n && event.params.amount1Out > 0n;
    const amountIn = isToken0ToToken1 ? event.params.amount0In : event.params.amount1In;
    const amountOut = isToken0ToToken1 ? event.params.amount1Out : event.params.amount0Out;

    // Try to find token addresses from transfers in the same transaction
    const { tokenIn, tokenOut } = findTokensFromTransfers(
      event.transaction.hash,
      event.params.sender.toLowerCase(),
      event.params.to.toLowerCase(),
      amountIn,
      amountOut
    );

    const trade: Trade = {
      id: `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
      sender: event.params.sender.toLowerCase(),
      recipient: event.params.to.toLowerCase(),
      chain: getChainName(event.chainId),
      transactionHash: event.transaction.hash,
      blockNumber: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      amountIn: amountIn,
      amountOut: amountOut,
      gasUsed: BigInt(event.transaction.gasUsed || 0),
      gasPrice: BigInt(event.transaction.gasPrice || 0),
      protocol: getProtocolFromAddress(event.srcAddress, "Swap")
    };

    context.Trade.set(trade);
  },
  { wildcard: true }
);

// Uniswap V3 handler
UniswapV3.Swap.handler(
  async ({ event, context }) => {
    // V3 uses signed amounts - positive means in, negative means out
    const amount0Abs = event.params.amount0 < 0n ? -event.params.amount0 : event.params.amount0;
    const amount1Abs = event.params.amount1 < 0n ? -event.params.amount1 : event.params.amount1;

    const isToken0In = event.params.amount0 > 0n;
    const amountIn = isToken0In ? event.params.amount0 : event.params.amount1;
    const amountOut = isToken0In ? amount1Abs : amount0Abs;

    // Try to find token addresses from transfers in the same transaction
    const { tokenIn, tokenOut } = findTokensFromTransfers(
      event.transaction.hash,
      event.params.sender.toLowerCase(),
      event.params.recipient.toLowerCase(),
      amountIn,
      amountOut
    );

    const trade: Trade = {
      id: `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
      sender: event.params.sender.toLowerCase(),
      recipient: event.params.recipient.toLowerCase(),
      chain: getChainName(event.chainId),
      transactionHash: event.transaction.hash,
      blockNumber: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      amountIn: amountIn,
      amountOut: amountOut,
      gasUsed: BigInt(event.transaction.gasUsed || 0),
      gasPrice: BigInt(event.transaction.gasPrice || 0),
      protocol: "uniswap-v3"
    };

    context.Trade.set(trade);
  },
  { wildcard: true }
);

// Curve TokenExchange handler
Curve.TokenExchange.handler(
  async ({ event, context }) => {
    // Try to find token addresses from transfers in the same transaction
    // Note: Curve swaps are self-custody (sender = recipient)
    const { tokenIn, tokenOut } = findTokensFromTransfers(
      event.transaction.hash,
      event.params.buyer.toLowerCase(),
      event.params.buyer.toLowerCase(),
      event.params.tokens_sold,
      event.params.tokens_bought
    );

    const trade: Trade = {
      id: `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
      sender: event.params.buyer.toLowerCase(),
      recipient: event.params.buyer.toLowerCase(), // Curve swaps are self-custody
      chain: getChainName(event.chainId),
      transactionHash: event.transaction.hash,
      blockNumber: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
      // Use matched tokens if found, otherwise fall back to index notation
      tokenIn: tokenIn !== "unknown" ? tokenIn : `curve-token-${event.params.sold_id}`,
      tokenOut: tokenOut !== "unknown" ? tokenOut : `curve-token-${event.params.bought_id}`,
      amountIn: event.params.tokens_sold,
      amountOut: event.params.tokens_bought,
      gasUsed: BigInt(event.transaction.gasUsed || 0),
      gasPrice: BigInt(event.transaction.gasPrice || 0),
      protocol: "curve"
    };

    context.Trade.set(trade);
  },
  { wildcard: true }
);

// Balancer V1 LOG_SWAP handler
BalancerV1.LOG_SWAP.handler(
  async ({ event, context }) => {
    const trade: Trade = {
      id: `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
      sender: event.params.caller.toLowerCase(),
      recipient: event.params.caller.toLowerCase(), // Balancer V1 swaps are self-custody
      chain: getChainName(event.chainId),
      transactionHash: event.transaction.hash,
      blockNumber: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
      tokenIn: event.params.tokenIn.toLowerCase(),
      tokenOut: event.params.tokenOut.toLowerCase(),
      amountIn: event.params.tokenAmountIn,
      amountOut: event.params.tokenAmountOut,
      gasUsed: BigInt(event.transaction.gasUsed || 0),
      gasPrice: BigInt(event.transaction.gasPrice || 0),
      protocol: "balancer-v1"
    };

    context.Trade.set(trade);
  },
  { wildcard: true }
);

// Balancer V2 Swap handler
BalancerV2.Swap.handler(
  async ({ event, context }) => {
    const trade: Trade = {
      id: `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
      sender: event.transaction.from?.toLowerCase() || "", // V2 doesn't include sender in event
      recipient: event.transaction.from?.toLowerCase() || "", // Self-custody
      chain: getChainName(event.chainId),
      transactionHash: event.transaction.hash,
      blockNumber: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
      tokenIn: event.params.tokenIn.toLowerCase(),
      tokenOut: event.params.tokenOut.toLowerCase(),
      amountIn: event.params.amountIn,
      amountOut: event.params.amountOut,
      gasUsed: BigInt(event.transaction.gasUsed || 0),
      gasPrice: BigInt(event.transaction.gasPrice || 0),
      protocol: "balancer-v2"
    };

    context.Trade.set(trade);
  },
  { wildcard: true }
);

// Bancor TokensTraded handler
Bancor.TokensTraded.handler(
  async ({ event, context }) => {
    const trade: Trade = {
      id: `${event.chainId}_${event.transaction.hash}_${event.logIndex}`,
      sender: event.params.trader.toLowerCase(),
      recipient: event.params.trader.toLowerCase(),
      chain: getChainName(event.chainId),
      transactionHash: event.transaction.hash,
      blockNumber: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
      tokenIn: event.params.sourceToken.toLowerCase(),
      tokenOut: event.params.targetToken.toLowerCase(),
      amountIn: event.params.sourceAmount,
      amountOut: event.params.targetAmount,
      gasUsed: BigInt(event.transaction.gasUsed || 0),
      gasPrice: BigInt(event.transaction.gasPrice || 0),
      protocol: "bancor"
    };

    context.Trade.set(trade);
  },
  { wildcard: true }
);