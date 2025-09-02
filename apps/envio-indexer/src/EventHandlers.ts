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

// Type for transfers stored in memory with logIndex for ordering
type TransferWithLogIndex = Transfer & { logIndex: number };

// Temporary storage for transfers by transaction hash
// This allows us to match transfers with trades in the same transaction
const transfersByTx = new Map<string, TransferWithLogIndex[]>();

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
// For protocols that don't provide token addresses in events (Uniswap V2/V3, Curve)
// Uses amount matching with address validation for safety
async function findTokensFromTransfers(
  txHash: string,
  swapLogIndex: number,
  context: any
): Promise<{ tokenIn: string; tokenOut: string }> {
  // First try memory cache
  let transfers = transfersByTx.get(txHash) || [];

  // If not in cache, query from database (handles parallel event processing)
  if (transfers.length === 0) {
    const dbTransfers = await context.Transfer.getWhere.transactionHash.eq(txHash);

    if (dbTransfers && dbTransfers.length > 0) {
      // Extract log index from the ID (format: chainId_blockNumber_logIndex)
      transfers = dbTransfers.map((t: any) => ({
        ...t,
        logIndex: parseInt(t.id.split('_')[2])
      }));
    }
  }

  if (transfers.length === 0) {
    return { tokenIn: "unknown", tokenOut: "unknown" };
  }

  // Sort transfers by logIndex for fallback logic
  const sortedTransfers = [...transfers].sort((a, b) => a.logIndex - b.logIndex);

  // Use log index as initial guess (works for most protocols)
  // Find transfers that happened before the swap (potential tokenIn)
  const transfersBeforeSwap = sortedTransfers.filter(t => t.logIndex < swapLogIndex);

  // Find transfers that happened after the swap (potential tokenOut)
  const transfersAfterSwap = sortedTransfers.filter(t => t.logIndex > swapLogIndex);

  // Initial guess based on log index ordering
  let tokenIn = transfersBeforeSwap.length > 0
    ? transfersBeforeSwap[transfersBeforeSwap.length - 1].token
    : "unknown";

  let tokenOut = transfersAfterSwap.length > 0
    ? transfersAfterSwap[0].token
    : "unknown";

  // For Uniswap V2 specifically: both transfers often happen BEFORE the swap event
  // So if we don't have a tokenOut from transfers after, check all transfers
  if (tokenOut === "unknown" && transfersBeforeSwap.length >= 2) {
    // In Uniswap V2, typically:
    // Transfer 1: User sends tokenA to pool
    // Transfer 2: Pool sends tokenB to user  
    // Swap event: Emitted last
    // So the first transfer before swap is tokenIn, second is tokenOut
    tokenIn = transfersBeforeSwap[0].token;
    tokenOut = transfersBeforeSwap[transfersBeforeSwap.length - 1].token;
  }

  return { tokenIn, tokenOut };
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
    // Include logIndex for ordering within the transaction
    const txHash = event.transaction.hash;
    if (!transfersByTx.has(txHash)) {
      transfersByTx.set(txHash, []);
    }
    transfersByTx.get(txHash)!.push({
      ...transfer,
      logIndex: event.logIndex // Add logIndex for event ordering
    });

    // Clean up old entries to prevent memory issues (keep last 1000 txs)
    if (transfersByTx.size > 1000) {
      const oldestKey = transfersByTx.keys().next().value;
      if (oldestKey) {
        transfersByTx.delete(oldestKey);
      }
    }

    context.Transfer.set(transfer);

    // POST-PROCESSING: Check if there are any orphaned trades in this transaction
    // that we can now fix with the transfer data we have
    const orphanedTrades = await context.Trade.getWhere.transactionHash.eq(txHash);

    if (orphanedTrades && orphanedTrades.length > 0) {
      for (const trade of orphanedTrades) {
        // Only fix trades that have unknown tokens
        if (trade.tokenIn === "unknown" || trade.tokenOut === "unknown") {
          // Get all transfers for this transaction
          const allTransfers = transfersByTx.get(txHash) || [];

          // If we don't have enough transfers yet, query from DB
          if (allTransfers.length < 2) {
            const dbTransfers = await context.Transfer.getWhere.transactionHash.eq(txHash);
            if (dbTransfers && dbTransfers.length > 0) {
              for (const dbTransfer of dbTransfers) {
                // Extract log index from the ID
                const idParts = dbTransfer.id.split('_');
                const logIndex = parseInt(idParts[2]);
                if (!allTransfers.find(t => t.logIndex === logIndex)) {
                  allTransfers.push({
                    ...dbTransfer,
                    logIndex: logIndex
                  });
                }
              }
            }
          }

          // Now try to match tokens based on log index ordering
          if (allTransfers.length >= 2) {
            const sortedTransfers = [...allTransfers].sort((a, b) => a.logIndex - b.logIndex);

            // Extract trade's log index from its ID
            const tradeIdParts = trade.id.split('_');
            const tradeLogIndex = parseInt(tradeIdParts[2]);

            // Find transfers before and after the trade
            const transfersBefore = sortedTransfers.filter(t => t.logIndex < tradeLogIndex);
            const transfersAfter = sortedTransfers.filter(t => t.logIndex > tradeLogIndex);

            // Update the trade with the correct tokens
            const updatedTrade = {
              ...trade,
              tokenIn: transfersBefore.length > 0
                ? transfersBefore[transfersBefore.length - 1].token
                : trade.tokenIn,
              tokenOut: transfersAfter.length > 0
                ? transfersAfter[0].token
                : trade.tokenOut
            };

            // Only update if we actually found tokens
            if (updatedTrade.tokenIn !== trade.tokenIn || updatedTrade.tokenOut !== trade.tokenOut) {
              context.Trade.set(updatedTrade);
            }
          }
        }
      }
    }
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
    let { tokenIn, tokenOut } = await findTokensFromTransfers(
      event.transaction.hash,
      event.logIndex,
      context
    );

    // POST-PROCESSING: If we still have unknown tokens, try querying the database directly
    // This handles the case where Transfers were processed before this Trade
    if (tokenIn === "unknown" || tokenOut === "unknown") {
      const dbTransfers = await context.Transfer.getWhere.transactionHash.eq(event.transaction.hash);

      if (dbTransfers && dbTransfers.length >= 2) {
        const transfers: TransferWithLogIndex[] = dbTransfers.map((t: any) => ({
          ...t,
          logIndex: parseInt(t.id.split('_')[2])
        }));

        // For Uniswap V2: Match by amounts instead of log index position
        // This is safer because we validate:
        // 1. Same transaction (already filtered)
        // 2. Amount matches (with 0.5% tolerance for fees/slippage)
        // 3. Address pattern matches expected flow

        // IMPORTANT: In Uniswap V2, event.params.sender is the Router,
        // and event.params.to is the actual trader/recipient
        const trader = event.params.to.toLowerCase();  // The actual user

        // Helper to check if amounts match within tolerance
        const amountsMatch = (a: bigint, b: bigint): boolean => {
          if (a === b) return true;
          const tolerance = a / 200n; // 0.5% tolerance
          return (a - tolerance <= b) && (b <= a + tolerance);
        };

        // Find tokenIn: transfer FROM trader with amount ≈ amountIn
        if (tokenIn === "unknown") {
          const inTransfer = transfers.find(t =>
            t.from.toLowerCase() === trader &&
            amountsMatch(BigInt(t.value), amountIn)
          );
          if (inTransfer) {
            tokenIn = inTransfer.token;
          }
        }

        // Find tokenOut: transfer TO trader with amount ≈ amountOut  
        if (tokenOut === "unknown") {
          const outTransfer = transfers.find(t =>
            t.to.toLowerCase() === trader &&
            amountsMatch(BigInt(t.value), amountOut)
          );
          if (outTransfer) {
            tokenOut = outTransfer.token;
          }
        }

        // Fallback to log index if amount matching fails
        if (tokenIn === "unknown" || tokenOut === "unknown") {
          const sortedTransfers = transfers.sort((a, b) => a.logIndex - b.logIndex);
          const transfersBefore = sortedTransfers.filter(t => t.logIndex < event.logIndex);
          const transfersAfter = sortedTransfers.filter(t => t.logIndex > event.logIndex);

          if (tokenIn === "unknown" && transfersBefore.length > 0) {
            tokenIn = transfersBefore[transfersBefore.length - 1].token;
          }
          if (tokenOut === "unknown" && transfersAfter.length > 0) {
            tokenOut = transfersAfter[0].token;
          }
        }
      }
    }

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
    let { tokenIn, tokenOut } = await findTokensFromTransfers(
      event.transaction.hash,
      event.logIndex,
      context
    );

    // POST-PROCESSING: If we still have unknown tokens, try querying the database directly
    if (tokenIn === "unknown" || tokenOut === "unknown") {
      const dbTransfers = await context.Transfer.getWhere.transactionHash.eq(event.transaction.hash);

      if (dbTransfers && dbTransfers.length >= 2) {
        const transfers: TransferWithLogIndex[] = dbTransfers.map((t: any) => ({
          ...t,
          logIndex: parseInt(t.id.split('_')[2])
        }));

        // For Uniswap V3: Also try amount matching with address validation
        // IMPORTANT: In Uniswap V3, event.params.sender is the Router,
        // and event.params.recipient is the actual trader
        const trader = event.params.recipient.toLowerCase();  // The actual user

        // Helper to check if amounts match within tolerance
        const amountsMatch = (a: bigint, b: bigint): boolean => {
          if (a === b) return true;
          const tolerance = a / 200n; // 0.5% tolerance
          return (a - tolerance <= b) && (b <= a + tolerance);
        };

        // Find tokenIn: transfer FROM trader with amount ≈ amountIn
        if (tokenIn === "unknown") {
          const inTransfer = transfers.find(t =>
            t.from.toLowerCase() === trader &&
            amountsMatch(BigInt(t.value), amountIn)
          );
          if (inTransfer) {
            tokenIn = inTransfer.token;
          }
        }

        // Find tokenOut: transfer TO trader with amount ≈ amountOut  
        if (tokenOut === "unknown") {
          const outTransfer = transfers.find(t =>
            t.to.toLowerCase() === trader &&
            amountsMatch(BigInt(t.value), amountOut)
          );
          if (outTransfer) {
            tokenOut = outTransfer.token;
          }
        }

        // Fallback to log index if amount matching fails
        if (tokenIn === "unknown" || tokenOut === "unknown") {
          const sortedTransfers = transfers.sort((a, b) => a.logIndex - b.logIndex);
          const transfersBefore = sortedTransfers.filter(t => t.logIndex < event.logIndex);
          const transfersAfter = sortedTransfers.filter(t => t.logIndex > event.logIndex);

          if (tokenIn === "unknown" && transfersBefore.length > 0) {
            tokenIn = transfersBefore[transfersBefore.length - 1].token;
          }
          if (tokenOut === "unknown" && transfersAfter.length > 0) {
            tokenOut = transfersAfter[0].token;
          }
        }
      }
    }

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
    const { tokenIn, tokenOut } = await findTokensFromTransfers(
      event.transaction.hash,
      event.logIndex,
      context
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