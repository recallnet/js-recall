import assert from "assert";
import { TestHelpers, Trade, Transfer } from "generated";
const { MockDb, ERC20Transfers, UniswapV2, UniswapV3, Curve, BalancerV1, BalancerV2, Bancor, Addresses } = TestHelpers;

describe("ERC20 Transfer Events", () => {
  it("should track token transfers correctly", async () => {
    // Instantiate a mock DB
    const mockDb = MockDb.createMockDb();

    // Get mock addresses
    const userAddress1 = Addresses.mockAddresses[0];
    const userAddress2 = Addresses.mockAddresses[1];
    const tokenAddress = Addresses.mockAddresses[2];

    // Create a mock Transfer event
    const mockTransfer = ERC20Transfers.Transfer.createMockEvent({
      from: userAddress1,
      to: userAddress2,
      value: 1000000000000000000n, // 1 token with 18 decimals
      mockEventData: {
        chainId: 1,
        srcAddress: tokenAddress, // Token contract address
      }
    });

    // Process the event
    const mockDbAfterTransfer = await ERC20Transfers.Transfer.processEvent({
      event: mockTransfer,
      mockDb,
    });

    // Get the created Transfer entity
    const transferId = `${mockTransfer.chainId}_${mockTransfer.block.number}_${mockTransfer.logIndex}`;
    const transfer = mockDbAfterTransfer.entities.Transfer.get(transferId);

    // Assert the transfer was created correctly
    assert(transfer, "Transfer entity should be created");
    assert.equal(transfer.from, userAddress1.toLowerCase());
    assert.equal(transfer.to, userAddress2.toLowerCase());
    assert.equal(transfer.value, 1000000000000000000n);
    assert.equal(transfer.token, tokenAddress.toLowerCase());
    assert.equal(transfer.chain, "ethereum");
  });
});

describe("Uniswap V2 Swap Events", () => {
  it("should track Uniswap V2 swaps correctly", async () => {
    const mockDb = MockDb.createMockDb();

    const sender = Addresses.mockAddresses[0];
    const recipient = Addresses.mockAddresses[1];

    // Create a mock Swap event (token0 -> token1)
    const mockSwap = UniswapV2.Swap.createMockEvent({
      sender: sender,
      amount0In: 1000000000000000000n, // 1 token0 in
      amount1In: 0n,
      amount0Out: 0n,
      amount1Out: 2000000000000000000n, // 2 token1 out
      to: recipient,
      mockEventData: {
        chainId: 1,
      }
    });

    // Process the event
    const mockDbAfterSwap = await UniswapV2.Swap.processEvent({
      event: mockSwap,
      mockDb,
    });

    // Get the created Trade entity
    const tradeId = `${mockSwap.chainId}_${mockSwap.transaction.hash}_${mockSwap.logIndex}`;
    const trade = mockDbAfterSwap.entities.Trade.get(tradeId);

    // Assert the trade was created correctly
    assert(trade, "Trade entity should be created");
    assert.equal(trade.sender, sender.toLowerCase());
    assert.equal(trade.recipient, recipient.toLowerCase());
    assert.equal(trade.amountIn, 1000000000000000000n);
    assert.equal(trade.amountOut, 2000000000000000000n);
    assert.equal(trade.chain, "ethereum");
    assert(trade.protocol.includes("uniswap"), "Protocol should indicate Uniswap");
  });
});

describe("Uniswap V3 Swap Events", () => {
  it("should handle signed amounts correctly", async () => {
    const mockDb = MockDb.createMockDb();

    const sender = Addresses.mockAddresses[0];
    const recipient = Addresses.mockAddresses[1];

    // Create a mock V3 Swap event (positive amount0 = token0 in, negative amount1 = token1 out)
    const mockSwap = UniswapV3.Swap.createMockEvent({
      sender: sender,
      recipient: recipient,
      amount0: 1000000000000000000n, // 1 token0 in (positive)
      amount1: -2000000000000000000n, // 2 token1 out (negative)
      sqrtPriceX96: 0n,
      liquidity: 0n,
      tick: 0n,
      mockEventData: {
        chainId: 1,
      }
    });

    // Process the event
    const mockDbAfterSwap = await UniswapV3.Swap.processEvent({
      event: mockSwap,
      mockDb,
    });

    // Get the created Trade entity
    const tradeId = `${mockSwap.chainId}_${mockSwap.transaction.hash}_${mockSwap.logIndex}`;
    const trade = mockDbAfterSwap.entities.Trade.get(tradeId);

    // Assert the trade was created correctly
    assert(trade, "Trade entity should be created");
    assert.equal(trade.sender, sender.toLowerCase());
    assert.equal(trade.recipient, recipient.toLowerCase());
    assert.equal(trade.amountIn, 1000000000000000000n);
    assert.equal(trade.amountOut, 2000000000000000000n); // Should be absolute value
    assert.equal(trade.protocol, "uniswap-v3");
  });
});

describe("Curve TokenExchange Events", () => {
  it("should track Curve swaps with token indices", async () => {
    const mockDb = MockDb.createMockDb();

    const buyer = Addresses.mockAddresses[0];

    // Create a mock TokenExchange event
    const mockExchange = Curve.TokenExchange.createMockEvent({
      buyer: buyer,
      sold_id: 0n, // Token index 0
      tokens_sold: 1000000n, // 1 USDC (6 decimals)
      bought_id: 1n, // Token index 1
      tokens_bought: 999000000000000000n, // 0.999 DAI (18 decimals)
      mockEventData: {
        chainId: 1,
      }
    });

    // Process the event
    const mockDbAfterExchange = await Curve.TokenExchange.processEvent({
      event: mockExchange,
      mockDb,
    });

    // Get the created Trade entity
    const tradeId = `${mockExchange.chainId}_${mockExchange.transaction.hash}_${mockExchange.logIndex}`;
    const trade = mockDbAfterExchange.entities.Trade.get(tradeId);

    // Assert the trade was created correctly
    assert(trade, "Trade entity should be created");
    assert.equal(trade.sender, buyer.toLowerCase());
    assert.equal(trade.recipient, buyer.toLowerCase()); // Curve is self-custody
    assert.equal(trade.tokenIn, "curve-token-0");
    assert.equal(trade.tokenOut, "curve-token-1");
    assert.equal(trade.protocol, "curve");
  });
});

describe("Balancer V2 Swap Events", () => {
  it("should track Balancer V2 swaps with poolId", async () => {
    const mockDb = MockDb.createMockDb();

    const tokenIn = Addresses.mockAddresses[0];
    const tokenOut = Addresses.mockAddresses[1];
    const trader = Addresses.mockAddresses[2];
    const poolId = "0x0000000000000000000000000000000000000000000000000000000000000001";

    // Create a mock Swap event
    const mockSwap = BalancerV2.Swap.createMockEvent({
      poolId: poolId as `0x${string}`,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      amountIn: 1000000000000000000n,
      amountOut: 2000000000000000000n,
      mockEventData: {
        chainId: 1,
        transaction: {
          from: trader,
        }
      }
    });

    // Process the event
    const mockDbAfterSwap = await BalancerV2.Swap.processEvent({
      event: mockSwap,
      mockDb,
    });

    // Get the created Trade entity
    const tradeId = `${mockSwap.chainId}_${mockSwap.transaction.hash}_${mockSwap.logIndex}`;
    const trade = mockDbAfterSwap.entities.Trade.get(tradeId);

    // Assert the trade was created correctly
    assert(trade, "Trade entity should be created");
    assert.equal(trade.tokenIn, tokenIn.toLowerCase());
    assert.equal(trade.tokenOut, tokenOut.toLowerCase());
    assert.equal(trade.protocol, "balancer-v2");
  });
});

describe("Multi-chain Support", () => {
  it("should correctly identify chain names", async () => {
    const mockDb = MockDb.createMockDb();

    const testChains = [
      { id: 1, name: "ethereum" },
      { id: 137, name: "polygon" },
      { id: 42161, name: "arbitrum" },
      { id: 10, name: "optimism" },
      { id: 8453, name: "base" }
    ];

    for (const chain of testChains) {
      const mockTransfer = ERC20Transfers.Transfer.createMockEvent({
        from: Addresses.mockAddresses[0],
        to: Addresses.mockAddresses[1],
        value: 1000n,
        mockEventData: {
          chainId: chain.id,
        }
      });

      const mockDbAfter = await ERC20Transfers.Transfer.processEvent({
        event: mockTransfer,
        mockDb,
      });

      const transferId = `${chain.id}_${mockTransfer.block.number}_${mockTransfer.logIndex}`;
      const transfer = mockDbAfter.entities.Transfer.get(transferId);

      assert.equal(transfer?.chain, chain.name, `Chain ${chain.id} should be identified as ${chain.name}`);
    }
  });
});