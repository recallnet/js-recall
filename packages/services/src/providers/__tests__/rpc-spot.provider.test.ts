import {
  AssetTransfersCategory,
  AssetTransfersWithMetadataResult,
  Log,
} from "alchemy-sdk";
import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import {
  NATIVE_TOKEN_ADDRESS,
  getTokenAddressForPriceLookup,
  getWrappedNativeAddress,
} from "../../lib/config-utils.js";
import { IRpcProvider } from "../../types/rpc.js";
import { ProtocolFilter } from "../../types/spot-live.js";
import { RpcSpotProvider } from "../spot-live/rpc-spot.provider.js";

vi.mock("@sentry/node", () => ({
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

const mockLogger: MockProxy<Logger> = mock<Logger>();

/**
 * Helper to create mock transfer with all required fields
 */
function createMockTransfer(
  partial: Partial<AssetTransfersWithMetadataResult>,
): AssetTransfersWithMetadataResult {
  return {
    erc721TokenId: null,
    erc1155Metadata: null,
    tokenId: null,
    ...partial,
  } as AssetTransfersWithMetadataResult;
}

describe("RpcSpotProvider", () => {
  let mockRpcProvider: MockProxy<IRpcProvider>;
  let provider: RpcSpotProvider;

  // Sample protocol filter for Aerodrome on Base
  const aerodromeFilter: ProtocolFilter = {
    protocol: "aerodrome",
    chain: "base",
    routerAddress: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
    swapEventSignature:
      "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822",
    factoryAddress: "0x420DD381b31aEf6683db6B902084cB0ffECe40Da",
  };

  // Sample transfer data
  const sampleSwapTransfers: AssetTransfersWithMetadataResult[] = [
    // Outbound USDC
    createMockTransfer({
      from: "0xagent123",
      to: "0xrouter456",
      value: 100,
      asset: "USDC",
      hash: "0xtxhash1",
      blockNum: "0x1000000",
      metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
      rawContract: {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimal: "6",
        value: "0x5f5e100",
      },
      category: AssetTransfersCategory.ERC20,
      uniqueId: "unique1",
    }),
    // Inbound AERO
    createMockTransfer({
      from: "0xrouter456",
      to: "0xagent123",
      value: 50,
      asset: "AERO",
      hash: "0xtxhash1", // Same tx hash
      blockNum: "0x1000000",
      metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
      rawContract: {
        address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
        decimal: "18",
        value: "0x2b5e3af16b1880000",
      },
      category: AssetTransfersCategory.ERC20,
      uniqueId: "unique2",
    }),
  ];

  const sampleDepositTransfers: AssetTransfersWithMetadataResult[] = [
    // Only inbound - deposit
    createMockTransfer({
      from: "0xexternal999",
      to: "0xagent123",
      value: 1000,
      asset: "USDC",
      hash: "0xtxhash2",
      blockNum: "0x1000001",
      metadata: { blockTimestamp: "2025-01-15T11:00:00.000Z" },
      rawContract: {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimal: "6",
        value: "0x3b9aca00",
      },
      category: AssetTransfersCategory.ERC20,
      uniqueId: "unique3",
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpcProvider = mock<IRpcProvider>();
  });

  describe("constructor", () => {
    it("should initialize without protocol filters", () => {
      provider = new RpcSpotProvider(mockRpcProvider, [], mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("No protocol filtering - all DEXs allowed"),
      );
    });

    it("should initialize with protocol filters", () => {
      provider = new RpcSpotProvider(
        mockRpcProvider,
        [aerodromeFilter],
        mockLogger,
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Protocol filtering enabled for chains: base"),
      );
    });

    it("should group filters by chain", () => {
      const uniswapFilter: ProtocolFilter = {
        protocol: "uniswap_v3",
        chain: "arbitrum",
        routerAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        swapEventSignature:
          "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67",
        factoryAddress: null,
      };

      provider = new RpcSpotProvider(
        mockRpcProvider,
        [aerodromeFilter, uniswapFilter],
        mockLogger,
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("base, arbitrum"),
      );
    });
  });

  describe("getName", () => {
    it("should return provider name with underlying RPC provider name", () => {
      mockRpcProvider.getName.mockReturnValue("Alchemy");
      provider = new RpcSpotProvider(mockRpcProvider, [], mockLogger);

      expect(provider.getName()).toBe("RPC Direct (Alchemy)");
    });

    it("should work with different RPC providers", () => {
      mockRpcProvider.getName.mockReturnValue("QuickNode");
      provider = new RpcSpotProvider(mockRpcProvider, [], mockLogger);

      expect(provider.getName()).toBe("RPC Direct (QuickNode)");
    });
  });

  describe("isHealthy", () => {
    it("should delegate to alchemy provider health check", async () => {
      mockRpcProvider.isHealthy.mockResolvedValue(true);
      provider = new RpcSpotProvider(mockRpcProvider, [], mockLogger);

      const result = await provider.isHealthy();

      expect(result).toBe(true);
      expect(mockRpcProvider.isHealthy).toHaveBeenCalledOnce();
    });

    it("should return false when alchemy provider is unhealthy", async () => {
      mockRpcProvider.isHealthy.mockResolvedValue(false);
      provider = new RpcSpotProvider(mockRpcProvider, [], mockLogger);

      const result = await provider.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe("getTradesSince", () => {
    beforeEach(() => {
      provider = new RpcSpotProvider(mockRpcProvider, [], mockLogger);
      mockRpcProvider.getBlockNumber.mockResolvedValue(1000000);
    });

    it("should return empty array when no chains provided", async () => {
      const result = await provider.getTradesSince(
        "0xagent123",
        new Date(),
        [],
      );

      expect(result.trades).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("No chains provided"),
      );
    });

    it("should detect swap from transfer pattern", async () => {
      // Use native ETH swap for basic detection test (no complex receipt logs needed)
      const BASIC_WALLET = "0xbasic1230000000000000000000000000000000000";
      const BASIC_ROUTER = "0xrouter456000000000000000000000000000000000";
      const USDC_ADDR = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

      const basicSwapTransfers = [
        createMockTransfer({
          from: BASIC_WALLET,
          to: BASIC_ROUTER,
          value: 1.0,
          asset: "ETH",
          hash: "0xtxhash1",
          blockNum: "0x1000000",
          metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
          rawContract: { address: null, decimal: null, value: "0x" },
          category: AssetTransfersCategory.EXTERNAL,
          uniqueId: "unique1",
        }),
        createMockTransfer({
          from: BASIC_ROUTER,
          to: BASIC_WALLET,
          value: 2000,
          asset: "USDC",
          hash: "0xtxhash1",
          blockNum: "0x1000000",
          metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
          rawContract: { address: USDC_ADDR, decimal: "6", value: "0x" },
          category: AssetTransfersCategory.ERC20,
          uniqueId: "unique2",
        }),
      ];

      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: basicSwapTransfers,
        pageKey: undefined,
      });

      mockRpcProvider.getTransactionReceipt.mockResolvedValue({
        transactionHash: "0xtxhash1",
        blockNumber: 1000000,
        gasUsed: "150000",
        effectiveGasPrice: "50000000000",
        status: true,
        from: BASIC_WALLET,
        to: BASIC_ROUTER,
        logs: [], // Native ETH swaps work with empty ERC20 logs
      });

      const result = await provider.getTradesSince(BASIC_WALLET, 10000, [
        "base",
      ]);

      expect(result.trades).toHaveLength(1);
      expect(result.trades[0]).toMatchObject({
        txHash: "0xtxhash1",
        fromToken: "0x0000000000000000000000000000000000000000", // Native ETH = zero address
        toToken: USDC_ADDR,
        fromAmount: 1.0,
        toAmount: 2000,
        chain: "base",
        protocol: "Unknown", // No filtering
      });
    });

    it("should not detect swap from deposit-only transfers", async () => {
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: sampleDepositTransfers,
        pageKey: undefined,
      });

      const result = await provider.getTradesSince("0xagent123", 10000, [
        "base",
      ]);

      expect(result.trades).toHaveLength(0);
    });

    it("should handle empty transfers gracefully", async () => {
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: [],
        pageKey: undefined,
      });

      const result = await provider.getTradesSince("0xagent123", 10000, [
        "base",
      ]);

      expect(result.trades).toEqual([]);
    });

    it("should continue processing other chains when one fails", async () => {
      // Use native ETH swap for this test
      const CHAIN_WALLET = "0xchain1230000000000000000000000000000000000";
      const CHAIN_ROUTER = "0xrouter456000000000000000000000000000000000";
      const USDC_ADDR = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

      const chainTestTransfers = [
        createMockTransfer({
          from: CHAIN_WALLET,
          to: CHAIN_ROUTER,
          value: 1.0,
          asset: "ETH",
          hash: "0xtxhash1",
          blockNum: "0x1000000",
          metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
          rawContract: { address: null, decimal: null, value: "0x" },
          category: AssetTransfersCategory.EXTERNAL,
          uniqueId: "unique1",
        }),
        createMockTransfer({
          from: CHAIN_ROUTER,
          to: CHAIN_WALLET,
          value: 2000,
          asset: "USDC",
          hash: "0xtxhash1",
          blockNum: "0x1000000",
          metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
          rawContract: { address: USDC_ADDR, decimal: "6", value: "0x" },
          category: AssetTransfersCategory.ERC20,
          uniqueId: "unique2",
        }),
      ];

      mockRpcProvider.getAssetTransfers
        .mockRejectedValueOnce(new Error("RPC error for base"))
        .mockResolvedValueOnce({
          transfers: chainTestTransfers,
          pageKey: undefined,
        });

      mockRpcProvider.getTransactionReceipt.mockResolvedValue({
        transactionHash: "0xtxhash1",
        blockNumber: 1000000,
        gasUsed: "150000",
        effectiveGasPrice: "50000000000",
        status: true,
        from: CHAIN_WALLET,
        to: CHAIN_ROUTER,
        logs: [], // Native ETH swap works with empty logs
      });

      const result = await provider.getTradesSince(CHAIN_WALLET, 10000, [
        "base",
        "arbitrum",
      ]);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "RPC error for base",
          chain: "base",
        }),
        expect.stringContaining("Error fetching trades for chain"),
      );

      // Should still process arbitrum
      expect(result.trades).toHaveLength(1);
    });

    it("should convert Date to block number", async () => {
      const date = new Date("2025-01-15T10:00:00Z");

      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: [],
        pageKey: undefined,
      });

      await provider.getTradesSince("0xagent123", date, ["base"]);

      // Should call getBlockNumber to estimate block from date
      expect(mockRpcProvider.getBlockNumber).toHaveBeenCalledWith("base");
    });
  });

  describe("getTradesSince with protocol filtering", () => {
    const PROTO_WALLET = "0xproto1230000000000000000000000000000000000";
    const AERODROME_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
    const WRONG_ROUTER = "0xWrongRouter111111111111111111111111111111";
    const USDC_ADDR = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

    // Native ETH swap transfers for protocol filter tests
    const protoFilterTransfers = [
      createMockTransfer({
        from: PROTO_WALLET,
        to: AERODROME_ROUTER,
        value: 1.0,
        asset: "ETH",
        hash: "0xtxhash1",
        blockNum: "0x1000000",
        metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
        rawContract: { address: null, decimal: null, value: "0x" },
        category: AssetTransfersCategory.EXTERNAL,
        uniqueId: "unique1",
      }),
      createMockTransfer({
        from: AERODROME_ROUTER,
        to: PROTO_WALLET,
        value: 2000,
        asset: "USDC",
        hash: "0xtxhash1",
        blockNum: "0x1000000",
        metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
        rawContract: { address: USDC_ADDR, decimal: "6", value: "0x" },
        category: AssetTransfersCategory.ERC20,
        uniqueId: "unique2",
      }),
    ];

    beforeEach(() => {
      provider = new RpcSpotProvider(
        mockRpcProvider,
        [aerodromeFilter],
        mockLogger,
      );
      mockRpcProvider.getBlockNumber.mockResolvedValue(1000000);
    });

    it("should accept swap matching protocol filter", async () => {
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: protoFilterTransfers,
        pageKey: undefined,
      });

      // Mock transaction to get 'to' address for protocol filter
      mockRpcProvider.getTransaction.mockResolvedValue({
        to: AERODROME_ROUTER,
        from: PROTO_WALLET,
      });

      // Mock receipt with Aerodrome swap event
      mockRpcProvider.getTransactionReceipt.mockResolvedValue({
        transactionHash: "0xtxhash1",
        blockNumber: 1000000,
        gasUsed: "150000",
        effectiveGasPrice: "50000000000",
        status: true,
        from: PROTO_WALLET,
        to: AERODROME_ROUTER,
        logs: [
          {
            topics: [
              "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822", // Aerodrome swap sig
            ],
          } as Log,
        ],
      });

      const result = await provider.getTradesSince(PROTO_WALLET, 10000, [
        "base",
      ]);

      expect(result.trades).toHaveLength(1);
      expect(result.trades[0]?.protocol).toBe("aerodrome");
    });

    it("should reject swap with wrong router address", async () => {
      // Transfers with wrong router
      const wrongRouterTransfers = [
        createMockTransfer({
          from: PROTO_WALLET,
          to: WRONG_ROUTER,
          value: 1.0,
          asset: "ETH",
          hash: "0xtxhash1",
          blockNum: "0x1000000",
          metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
          rawContract: { address: null, decimal: null, value: "0x" },
          category: AssetTransfersCategory.EXTERNAL,
          uniqueId: "unique1",
        }),
        createMockTransfer({
          from: WRONG_ROUTER,
          to: PROTO_WALLET,
          value: 2000,
          asset: "USDC",
          hash: "0xtxhash1",
          blockNum: "0x1000000",
          metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
          rawContract: { address: USDC_ADDR, decimal: "6", value: "0x" },
          category: AssetTransfersCategory.ERC20,
          uniqueId: "unique2",
        }),
      ];

      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: wrongRouterTransfers,
        pageKey: undefined,
      });

      // Mock transaction with wrong router
      mockRpcProvider.getTransaction.mockResolvedValue({
        to: WRONG_ROUTER,
        from: PROTO_WALLET,
      });

      mockRpcProvider.getTransactionReceipt.mockResolvedValue({
        transactionHash: "0xtxhash1",
        blockNumber: 1000000,
        gasUsed: "150000",
        effectiveGasPrice: "50000000000",
        status: true,
        from: PROTO_WALLET,
        to: WRONG_ROUTER,
        logs: [],
      });

      const result = await provider.getTradesSince(PROTO_WALLET, 10000, [
        "base",
      ]);

      expect(result.trades).toHaveLength(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ txHash: "0xtxhash1" }),
        expect.stringContaining("not from allowed protocol"),
      );
    });

    it("should reject swap with correct router but wrong event signature", async () => {
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: protoFilterTransfers,
        pageKey: undefined,
      });

      // Mock transaction with correct router
      mockRpcProvider.getTransaction.mockResolvedValue({
        to: AERODROME_ROUTER,
        from: PROTO_WALLET,
      });

      // Correct router but wrong event signature (not Aerodrome swap)
      mockRpcProvider.getTransactionReceipt.mockResolvedValue({
        transactionHash: "0xtxhash1",
        blockNumber: 1000000,
        gasUsed: "150000",
        effectiveGasPrice: "50000000000",
        status: true,
        from: PROTO_WALLET,
        to: AERODROME_ROUTER,
        logs: [
          {
            topics: [
              "0xWrongEventSignature0000000000000000000000000000000000000000000000", // Wrong sig
            ],
          } as Log,
        ],
      });

      const result = await provider.getTradesSince(PROTO_WALLET, 10000, [
        "base",
      ]);

      expect(result.trades).toHaveLength(0);
    });

    it("should handle missing transaction data gracefully", async () => {
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: protoFilterTransfers,
        pageKey: undefined,
      });

      // Transaction receipt not found - swap detection requires receipt for logIndex ordering
      mockRpcProvider.getTransactionReceipt.mockResolvedValue(null);

      const result = await provider.getTradesSince(PROTO_WALLET, 10000, [
        "base",
      ]);

      // No swaps detected without receipt
      expect(result.trades).toHaveLength(0);
      // Should track skipped block for retry
      expect(result.lowestSkippedBlock).toBeDefined();
    });
  });

  describe("getTransferHistory", () => {
    beforeEach(() => {
      provider = new RpcSpotProvider(mockRpcProvider, [], mockLogger);
      mockRpcProvider.getBlockNumber.mockResolvedValue(1000000);
    });

    it("should return deposits and withdrawals, but not swaps", async () => {
      // Mix of swap and deposit
      const mixedTransfers = [
        ...sampleSwapTransfers,
        ...sampleDepositTransfers,
      ];

      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: mixedTransfers,
        pageKey: undefined,
      });

      const result = await provider.getTransferHistory(
        "0xagent123",
        new Date("2025-01-15T00:00:00Z"),
        ["base"],
      );

      // Should only return the deposit (not the swap)
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "deposit",
        tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        amount: 1000,
        from: "0xexternal999",
        to: "0xagent123",
        chain: "base",
      });
    });

    it("should classify transfers correctly", async () => {
      const withdrawTransfer: AssetTransfersWithMetadataResult[] = [
        createMockTransfer({
          from: "0xagent123", // Agent sending
          to: "0xexternal999",
          value: 500,
          asset: "USDC",
          hash: "0xtxhash3",
          blockNum: "0x1000002",
          metadata: { blockTimestamp: "2025-01-15T12:00:00.000Z" },
          rawContract: {
            address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            decimal: "6",
            value: "0x1dcd6500",
          },
          category: AssetTransfersCategory.ERC20,
          uniqueId: "unique4",
        }),
      ];

      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: withdrawTransfer,
        pageKey: undefined,
      });

      const result = await provider.getTransferHistory(
        "0xagent123",
        new Date("2025-01-15T00:00:00Z"),
        ["base"],
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe("withdraw");
    });

    it("should return empty array when no chains provided", async () => {
      const result = await provider.getTransferHistory(
        "0xagent123",
        new Date(),
        [],
      );

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("No chains provided"),
      );
    });

    it("should handle errors and continue processing", async () => {
      mockRpcProvider.getAssetTransfers.mockRejectedValue(
        new Error("RPC timeout"),
      );

      const result = await provider.getTransferHistory(
        "0xagent123",
        new Date(),
        ["base"],
      );

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: "RPC timeout" }),
        expect.stringContaining("Error fetching transfer history"),
      );
    });
  });

  describe("swap detection edge cases", () => {
    beforeEach(() => {
      provider = new RpcSpotProvider(mockRpcProvider, [], mockLogger);
      mockRpcProvider.getBlockNumber.mockResolvedValue(1000000);
      mockRpcProvider.getTransactionReceipt.mockResolvedValue({
        transactionHash: "0xtxhash1",
        blockNumber: 1000000,
        gasUsed: "150000",
        effectiveGasPrice: "50000000000",
        status: true,
        from: "0xagent123",
        to: "0xrouter456",
        logs: [],
      });
    });

    it("should not detect swap with only outbound transfers", async () => {
      const outboundOnly: AssetTransfersWithMetadataResult[] = [
        createMockTransfer({
          from: "0xagent123",
          to: "0xexternal999",
          value: 100,
          asset: "USDC",
          hash: "0xtxhash1",
          blockNum: "0x1000000",
          metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
          rawContract: {
            address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            decimal: "6",
            value: "0x5f5e100",
          },
          category: AssetTransfersCategory.ERC20,
          uniqueId: "unique5",
        }),
      ];

      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: outboundOnly,
        pageKey: undefined,
      });

      const result = await provider.getTradesSince("0xagent123", 10000, [
        "base",
      ]);

      expect(result.trades).toHaveLength(0);
    });

    it("should not detect swap with only inbound transfers", async () => {
      const inboundOnly: AssetTransfersWithMetadataResult[] = [
        createMockTransfer({
          from: "0xexternal999",
          to: "0xagent123",
          value: 100,
          asset: "USDC",
          hash: "0xtxhash1",
          blockNum: "0x1000000",
          metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
          rawContract: {
            address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            decimal: "6",
            value: "0x5f5e100",
          },
          category: AssetTransfersCategory.ERC20,
          uniqueId: "unique6",
        }),
      ];

      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: inboundOnly,
        pageKey: undefined,
      });

      const result = await provider.getTradesSince("0xagent123", 10000, [
        "base",
      ]);

      expect(result.trades).toHaveLength(0);
    });

    it("should handle native ETH transfers with zero address", async () => {
      // Native ETH → ERC20 swap
      // The fromToken should be NATIVE_TOKEN_ADDRESS (zero address), not "ETH" string
      // This enables proper price lookup by mapping zero address to WETH
      const ethSwap: AssetTransfersWithMetadataResult[] = [
        createMockTransfer({
          from: "0xagent123",
          to: "0xrouter456",
          value: 1,
          asset: "ETH",
          hash: "0xtxhash1",
          blockNum: "0x1000000",
          metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
          category: AssetTransfersCategory.EXTERNAL,
          uniqueId: "unique7",
        }),
        createMockTransfer({
          from: "0xrouter456",
          to: "0xagent123",
          value: 1000,
          asset: "USDC",
          hash: "0xtxhash1",
          blockNum: "0x1000000",
          metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
          rawContract: {
            address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            decimal: "6",
            value: "0x3b9aca00",
          },
          category: AssetTransfersCategory.ERC20,
          uniqueId: "unique8",
        }),
      ];

      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: ethSwap,
        pageKey: undefined,
      });

      mockRpcProvider.getTransactionReceipt.mockResolvedValue({
        transactionHash: "0xtxhash1",
        blockNumber: 1000000,
        gasUsed: "150000",
        effectiveGasPrice: "50000000000",
        status: true,
        from: "0xagent123",
        to: "0xrouter456",
        logs: [],
      });

      const result = await provider.getTradesSince("0xagent123", 10000, [
        "base",
      ]);

      expect(result.trades).toHaveLength(1);
      // fromToken must be zero address for proper price lookup
      // (mapped to WETH in spot-data-processor)
      expect(result.trades[0]?.fromToken).toBe(NATIVE_TOKEN_ADDRESS);
      expect(result.trades[0]?.toToken).toBe(
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      );
    });

    it("should handle ERC20 to native ETH swaps with zero address", async () => {
      // ERC20 → Native ETH swap (reverse direction)
      // The toToken should be NATIVE_TOKEN_ADDRESS (zero address)
      const ethSwap: AssetTransfersWithMetadataResult[] = [
        createMockTransfer({
          from: "0xagent123",
          to: "0xrouter456",
          value: 1000,
          asset: "USDC",
          hash: "0xtxhash2",
          blockNum: "0x1000000",
          metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
          rawContract: {
            address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            decimal: "6",
            value: "0x3b9aca00",
          },
          category: AssetTransfersCategory.ERC20,
          uniqueId: "unique9",
        }),
        createMockTransfer({
          from: "0xrouter456",
          to: "0xagent123",
          value: 0.5,
          asset: "ETH",
          hash: "0xtxhash2",
          blockNum: "0x1000000",
          metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
          category: AssetTransfersCategory.INTERNAL,
          uniqueId: "unique10",
        }),
      ];

      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: ethSwap,
        pageKey: undefined,
      });

      mockRpcProvider.getTransactionReceipt.mockResolvedValue({
        transactionHash: "0xtxhash2",
        blockNumber: 1000000,
        gasUsed: "150000",
        effectiveGasPrice: "50000000000",
        status: true,
        from: "0xagent123",
        to: "0xrouter456",
        logs: [],
      });

      const result = await provider.getTradesSince("0xagent123", 10000, [
        "base",
      ]);

      expect(result.trades).toHaveLength(1);
      expect(result.trades[0]?.fromToken).toBe(
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      );
      // toToken must be zero address for proper price lookup
      expect(result.trades[0]?.toToken).toBe(NATIVE_TOKEN_ADDRESS);
    });
  });

  describe("native token address mapping", () => {
    it("should map Polygon native token to WMATIC (not WETH)", () => {
      // Polygon's native token is MATIC, so we need WMATIC for price lookups
      const wmaticAddress = getWrappedNativeAddress("polygon");
      expect(wmaticAddress).toBe("0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270");

      // Verify it's NOT the bridged WETH address
      expect(wmaticAddress).not.toBe(
        "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
      );

      // Verify getTokenAddressForPriceLookup also returns WMATIC for Polygon
      const priceLookupAddress = getTokenAddressForPriceLookup(
        NATIVE_TOKEN_ADDRESS,
        "polygon",
      );
      expect(priceLookupAddress).toBe(
        "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
      );
    });
  });

  describe("gas data enrichment", () => {
    const TRANSFER_TOPIC =
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const GAS_TEST_WALLET = "0xagent1230000000000000000000000000000000000";
    const GAS_TEST_ROUTER = "0xrouter456000000000000000000000000000000000";
    const USDC_ADDR = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

    beforeEach(() => {
      provider = new RpcSpotProvider(mockRpcProvider, [], mockLogger);
      mockRpcProvider.getBlockNumber.mockResolvedValue(1000000);
    });

    it("should include gas data when receipt is available", async () => {
      // Use native ETH swap so we can test gas enrichment without complex receipt logs
      const nativeEthTransfers = [
        createMockTransfer({
          from: GAS_TEST_WALLET,
          to: GAS_TEST_ROUTER,
          value: 0.5,
          asset: "ETH",
          hash: "0xtxhash1",
          blockNum: "0x1000000",
          metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
          rawContract: { address: null, decimal: null, value: "0x" },
          category: AssetTransfersCategory.EXTERNAL,
          uniqueId: "unique1",
        }),
        createMockTransfer({
          from: GAS_TEST_ROUTER,
          to: GAS_TEST_WALLET,
          value: 100,
          asset: "USDC",
          hash: "0xtxhash1",
          blockNum: "0x1000000",
          metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
          rawContract: { address: USDC_ADDR, decimal: "6", value: "0x" },
          category: AssetTransfersCategory.ERC20,
          uniqueId: "unique2",
        }),
      ];

      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: nativeEthTransfers,
        pageKey: undefined,
      });

      mockRpcProvider.getTransactionReceipt.mockResolvedValue({
        transactionHash: "0xtxhash1",
        blockNumber: 1000000,
        gasUsed: "150000",
        effectiveGasPrice: "50000000000",
        status: true,
        from: GAS_TEST_WALLET,
        to: GAS_TEST_ROUTER,
        logs: [
          // Only USDC inbound log (native ETH has no ERC20 log)
          {
            address: USDC_ADDR,
            topics: [
              TRANSFER_TOPIC,
              "0x" + GAS_TEST_ROUTER.slice(2).padStart(64, "0"),
              "0x" + GAS_TEST_WALLET.slice(2).padStart(64, "0"),
            ],
            data: "0x" + BigInt("100000000").toString(16).padStart(64, "0"),
            logIndex: 0,
            blockNumber: 1000000,
            blockHash: "0xblockhash",
            transactionIndex: 0,
            transactionHash: "0xtxhash1",
            removed: false,
          },
        ],
      });

      const result = await provider.getTradesSince(GAS_TEST_WALLET, 10000, [
        "base",
      ]);

      expect(result.trades).toHaveLength(1);
      expect(result.trades[0]?.gasUsed).toBe(150000);
      expect(result.trades[0]?.gasPrice).toBe(50000000000);
    });

    it("should skip transactions when receipt is missing and track for retry", async () => {
      // Receipt is required for deterministic swap detection via logIndex ordering
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: sampleSwapTransfers,
        pageKey: undefined,
      });

      mockRpcProvider.getTransactionReceipt.mockResolvedValue(null);

      const result = await provider.getTradesSince("0xagent123", 10000, [
        "base",
      ]);

      // No trades detected without receipt
      expect(result.trades).toHaveLength(0);
      // Should track skipped block for retry
      expect(result.lowestSkippedBlock).toBeDefined();
    });

    it("should skip transactions when receipt fetch fails and track for retry", async () => {
      // Receipt is required for deterministic swap detection
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: sampleSwapTransfers,
        pageKey: undefined,
      });

      mockRpcProvider.getTransactionReceipt.mockRejectedValue(
        new Error("Receipt fetch failed"),
      );

      const result = await provider.getTradesSince("0xagent123", 10000, [
        "base",
      ]);

      // No trades detected when receipt fetch fails
      expect(result.trades).toHaveLength(0);
      // Should track skipped block for retry
      expect(result.lowestSkippedBlock).toBeDefined();
    });

    it("should NOT track lowestSkippedBlock for very old transactions (max-age safeguard)", async () => {
      // Simulate a very old transaction (>1800 blocks old) where receipt is unavailable
      const CURRENT_BLOCK = 2000000;
      // Use block that's 2000 blocks behind current (>1800 max age threshold)
      const OLD_BLOCK = CURRENT_BLOCK - 2000;
      const OLD_BLOCK_HEX = `0x${OLD_BLOCK.toString(16)}`;

      mockRpcProvider.getBlockNumber.mockResolvedValue(CURRENT_BLOCK);

      const oldTransfers = [
        createMockTransfer({
          from: "0x0000000000000000000000000000000000000123",
          to: "0xrouter456",
          value: 1.0,
          asset: "USDC",
          hash: "0xoldtx123",
          blockNum: OLD_BLOCK_HEX,
          metadata: { blockTimestamp: "2025-01-01T10:00:00.000Z" },
          rawContract: { address: "0xusdc123", decimal: "6", value: "0x" },
          category: AssetTransfersCategory.ERC20,
          uniqueId: "unique1",
        }),
        createMockTransfer({
          from: "0xrouter456",
          to: "0x0000000000000000000000000000000000000123",
          value: 0.5,
          asset: "WETH",
          hash: "0xoldtx123",
          blockNum: OLD_BLOCK_HEX,
          metadata: { blockTimestamp: "2025-01-01T10:00:00.000Z" },
          rawContract: { address: "0xweth456", decimal: "18", value: "0x" },
          category: AssetTransfersCategory.ERC20,
          uniqueId: "unique2",
        }),
      ];

      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: oldTransfers,
        pageKey: undefined,
      });

      // Receipt not found for old transaction
      mockRpcProvider.getTransactionReceipt.mockResolvedValue(null);

      const result = await provider.getTradesSince(
        "0x0000000000000000000000000000000000000123",
        OLD_BLOCK - 100,
        ["base"],
      );

      // No trades detected
      expect(result.trades).toHaveLength(0);

      // Should NOT track skipped block because transaction is too old (>1800 blocks)
      // This allows sync to progress instead of being permanently stuck
      expect(result.lowestSkippedBlock).toBeUndefined();
    });
  });

  describe("multi-chain processing", () => {
    const MULTICHAIN_WALLET = "0xmultichain000000000000000000000000000000";
    const MULTICHAIN_ROUTER = "0xrouter4560000000000000000000000000000000";

    // Native ETH swap transfers for testing (works with empty receipt logs)
    const multiChainTransfers = [
      createMockTransfer({
        from: MULTICHAIN_WALLET,
        to: MULTICHAIN_ROUTER,
        value: 1.0,
        asset: "ETH",
        hash: "0xtxhash1",
        blockNum: "0x1000000",
        metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
        rawContract: { address: null, decimal: null, value: "0x" },
        category: AssetTransfersCategory.EXTERNAL,
        uniqueId: "unique1",
      }),
      createMockTransfer({
        from: MULTICHAIN_ROUTER,
        to: MULTICHAIN_WALLET,
        value: 2000,
        asset: "USDC",
        hash: "0xtxhash1",
        blockNum: "0x1000000",
        metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
        rawContract: {
          address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          decimal: "6",
          value: "0x",
        },
        category: AssetTransfersCategory.ERC20,
        uniqueId: "unique2",
      }),
    ];

    beforeEach(() => {
      provider = new RpcSpotProvider(mockRpcProvider, [], mockLogger);
      mockRpcProvider.getBlockNumber.mockResolvedValue(1000000);
      mockRpcProvider.getTransactionReceipt.mockResolvedValue({
        transactionHash: "0xtxhash1",
        blockNumber: 1000000,
        gasUsed: "150000",
        effectiveGasPrice: "50000000000",
        status: true,
        from: MULTICHAIN_WALLET,
        to: MULTICHAIN_ROUTER,
        logs: [], // Empty logs is fine for native ETH swaps
      });
    });

    it("should process multiple chains", async () => {
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: multiChainTransfers,
        pageKey: undefined,
      });

      const result = await provider.getTradesSince(MULTICHAIN_WALLET, 10000, [
        "base",
        "arbitrum",
        "optimism",
      ]);

      // Should call getAssetTransfers for each chain
      expect(mockRpcProvider.getAssetTransfers).toHaveBeenCalledTimes(3);
      expect(result.trades.length).toBeGreaterThan(0);
    });
  });

  describe("getNativeBalance", () => {
    beforeEach(() => {
      provider = new RpcSpotProvider(mockRpcProvider, [], mockLogger);
    });

    it("should return native balance from underlying provider", async () => {
      const expectedBalance = "1000000000000000000"; // 1 ETH in wei
      mockRpcProvider.getBalance.mockResolvedValue(expectedBalance);

      const result = await provider.getNativeBalance("0xagent123", "base");

      expect(result).toBe(expectedBalance);
      expect(mockRpcProvider.getBalance).toHaveBeenCalledWith(
        "0xagent123",
        "base",
      );
    });

    it("should throw error for Solana chain", async () => {
      await expect(
        provider.getNativeBalance("0xagent123", "svm"),
      ).rejects.toThrow(
        "Solana (svm) is not supported for RPC-based spot live trading",
      );
    });

    it("should work with different EVM chains", async () => {
      mockRpcProvider.getBalance.mockResolvedValue("500000000000000000");

      const chains = ["base", "arbitrum", "optimism", "polygon"] as const;
      for (const chain of chains) {
        const result = await provider.getNativeBalance("0xagent123", chain);
        expect(result).toBe("500000000000000000");
      }

      expect(mockRpcProvider.getBalance).toHaveBeenCalledTimes(4);
    });
  });

  describe("Receipt-based swap detection (logIndex ordering)", () => {
    beforeEach(() => {
      provider = new RpcSpotProvider(mockRpcProvider, [], mockLogger);
      mockRpcProvider.getBlockNumber.mockResolvedValue(1000000);
    });

    // ERC20 Transfer event signature
    const TRANSFER_TOPIC =
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

    // Helper to create mock receipt log
    function createTransferLog(
      tokenAddress: string,
      from: string,
      to: string,
      value: bigint,
      logIndex: number,
    ) {
      // Pad addresses to 32 bytes (64 hex chars)
      const fromPadded = "0x" + from.slice(2).toLowerCase().padStart(64, "0");
      const toPadded = "0x" + to.slice(2).toLowerCase().padStart(64, "0");
      // Convert value to hex data (32 bytes)
      const valueHex = "0x" + value.toString(16).padStart(64, "0");

      return {
        address: tokenAddress,
        topics: [TRANSFER_TOPIC, fromPadded, toPadded],
        data: valueHex,
        logIndex,
        blockNumber: 1000000,
        blockHash: "0xblockhash",
        transactionIndex: 0,
        removed: false,
        transactionHash: "0xtxhash",
      };
    }

    it("should detect swap using logIndex ordering, picking correct tokens regardless of array order", async () => {
      // Simulates the deepseek bug scenario:
      // - Transaction has ERC20 AERO transfer (logIndex 0) and 0-value ETH transfer
      // - Old code would pick based on getAssetTransfers order (non-deterministic)
      // - New code uses logIndex ordering (deterministic)

      const AERO_ADDRESS = "0x940181a94a35a4569e4529a3cdfb74e38fd98631";
      const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
      const WALLET = "0x1234567890abcdef1234567890abcdef12345678";

      // Create receipt with ERC20 transfers in logIndex order
      const mockReceipt = {
        transactionHash: "0xtxhash1",
        blockNumber: 1000000,
        gasUsed: "150000",
        effectiveGasPrice: "50000000000",
        status: true,
        from: WALLET,
        to: "0xrouter456",
        logs: [
          // AERO outbound at logIndex 0 (first in execution order)
          createTransferLog(
            AERO_ADDRESS,
            WALLET,
            "0xrouter456",
            BigInt("106830000000000000000"), // 106.83 AERO (18 decimals)
            0,
          ),
          // USDC inbound at logIndex 1
          createTransferLog(
            USDC_ADDRESS,
            "0xrouter456",
            WALLET,
            BigInt("69820000"), // 69.82 USDC (6 decimals)
            1,
          ),
        ],
      };

      // Mock getAssetTransfers to return transfers (for amount extraction)
      // Note: Order here doesn't matter - logIndex determines token selection
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: [
          createMockTransfer({
            from: WALLET,
            to: "0xrouter456",
            value: 106.83, // Already decimal-adjusted
            asset: "AERO",
            hash: "0xtxhash1",
            blockNum: "0xf4240",
            metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
            rawContract: {
              address: AERO_ADDRESS,
              decimal: "18",
              value: "0x",
            },
            category: AssetTransfersCategory.ERC20,
            uniqueId: "unique1",
          }),
          createMockTransfer({
            from: "0xrouter456",
            to: WALLET,
            value: 69.82,
            asset: "USDC",
            hash: "0xtxhash1",
            blockNum: "0xf4240",
            metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
            rawContract: {
              address: USDC_ADDRESS,
              decimal: "6",
              value: "0x",
            },
            category: AssetTransfersCategory.ERC20,
            uniqueId: "unique2",
          }),
        ],
        pageKey: undefined,
      });

      mockRpcProvider.getTransactionReceipt.mockResolvedValue(mockReceipt);

      const result = await provider.getTradesSince(WALLET, 999990, ["base"]);

      expect(result.trades).toHaveLength(1);
      const trade = result.trades[0]!;

      // CRITICAL: Verify we picked AERO as fromToken (not ETH)
      expect(trade.fromToken.toLowerCase()).toBe(AERO_ADDRESS.toLowerCase());
      expect(trade.toToken.toLowerCase()).toBe(USDC_ADDRESS.toLowerCase());

      // Verify amounts are correct (not 0)
      expect(trade.fromAmount).toBeCloseTo(106.83, 1);
      expect(trade.toAmount).toBeCloseTo(69.82, 1);
    });

    it("should handle multi-hop swap by picking first outbound and last inbound", async () => {
      // Multi-hop: AERO -> WETH -> USDC
      // Should pick AERO as input (first outbound) and USDC as output (last inbound)

      const AERO_ADDRESS = "0x940181a94a35a4569e4529a3cdfb74e38fd98631";
      const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
      const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
      const WALLET = "0x1234567890abcdef1234567890abcdef12345678";

      const mockReceipt = {
        transactionHash: "0xtxhash1",
        blockNumber: 1000000,
        gasUsed: "200000",
        effectiveGasPrice: "50000000000",
        status: true,
        from: WALLET,
        to: "0xrouter456",
        logs: [
          // Hop 1: AERO out from wallet (logIndex 0)
          createTransferLog(
            AERO_ADDRESS,
            WALLET,
            "0xpool1",
            BigInt("100000000000000000000"),
            0,
          ),
          // Hop 1: WETH in to router (logIndex 1) - intermediate
          createTransferLog(
            WETH_ADDRESS,
            "0xpool1",
            "0xrouter456",
            BigInt("50000000000000000"),
            1,
          ),
          // Hop 2: WETH out from router (logIndex 2) - intermediate
          createTransferLog(
            WETH_ADDRESS,
            "0xrouter456",
            "0xpool2",
            BigInt("50000000000000000"),
            2,
          ),
          // Hop 2: USDC in to wallet (logIndex 3) - final output
          createTransferLog(
            USDC_ADDRESS,
            "0xpool2",
            WALLET,
            BigInt("150000000"),
            3,
          ),
        ],
      };

      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: [
          createMockTransfer({
            from: WALLET,
            to: "0xpool1",
            value: 100,
            asset: "AERO",
            hash: "0xtxhash1",
            blockNum: "0xf4240",
            metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
            rawContract: { address: AERO_ADDRESS, decimal: "18", value: "0x" },
            category: AssetTransfersCategory.ERC20,
            uniqueId: "unique1",
          }),
          createMockTransfer({
            from: "0xpool2",
            to: WALLET,
            value: 150,
            asset: "USDC",
            hash: "0xtxhash1",
            blockNum: "0xf4240",
            metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
            rawContract: { address: USDC_ADDRESS, decimal: "6", value: "0x" },
            category: AssetTransfersCategory.ERC20,
            uniqueId: "unique2",
          }),
        ],
        pageKey: undefined,
      });

      mockRpcProvider.getTransactionReceipt.mockResolvedValue(mockReceipt);

      const result = await provider.getTradesSince(WALLET, 999990, ["base"]);

      expect(result.trades).toHaveLength(1);
      const trade = result.trades[0]!;

      // Should pick AERO (first outbound) and USDC (last inbound)
      // NOT WETH (intermediate hop)
      expect(trade.fromToken.toLowerCase()).toBe(AERO_ADDRESS.toLowerCase());
      expect(trade.toToken.toLowerCase()).toBe(USDC_ADDRESS.toLowerCase());
    });

    it("should skip transactions with zero-value outbound transfers only", async () => {
      const WALLET = "0x1234567890abcdef1234567890abcdef12345678";
      const ROUTER = "0xabcdef1234567890abcdef1234567890abcdef12";
      const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
      const SOME_TOKEN = "0xdeadbeef1234567890abcdef1234567890abcdef";

      // Receipt where the only outbound has 0 value
      const mockReceipt = {
        transactionHash: "0xtxhash1",
        blockNumber: 1000000,
        gasUsed: "150000",
        effectiveGasPrice: "50000000000",
        status: true,
        from: WALLET,
        to: ROUTER,
        logs: [
          // 0-value outbound (contract interaction)
          createTransferLog(SOME_TOKEN, WALLET, ROUTER, BigInt(0), 0),
          // Inbound USDC
          createTransferLog(
            USDC_ADDRESS,
            ROUTER,
            WALLET,
            BigInt("100000000"),
            1,
          ),
        ],
      };

      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: [
          createMockTransfer({
            from: WALLET,
            to: ROUTER,
            value: 0,
            asset: "TOKEN",
            hash: "0xtxhash1",
            blockNum: "0xf4240",
            metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
            rawContract: { address: SOME_TOKEN, decimal: "18", value: "0x" },
            category: AssetTransfersCategory.ERC20,
            uniqueId: "unique1",
          }),
          createMockTransfer({
            from: ROUTER,
            to: WALLET,
            value: 100,
            asset: "USDC",
            hash: "0xtxhash1",
            blockNum: "0xf4240",
            metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
            rawContract: { address: USDC_ADDRESS, decimal: "6", value: "0x" },
            category: AssetTransfersCategory.ERC20,
            uniqueId: "unique2",
          }),
        ],
        pageKey: undefined,
      });

      mockRpcProvider.getTransactionReceipt.mockResolvedValue(mockReceipt);

      const result = await provider.getTradesSince(WALLET, 999990, ["base"]);

      // Should NOT detect this as a valid swap (0-value outbound)
      expect(result.trades).toHaveLength(0);

      // Should have logged warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          txHash: "0xtxhash1",
        }),
        expect.stringContaining("0 outbound value"),
      );
    });

    it("should fallback to transfer-based detection for native ETH swaps", async () => {
      // Native ETH swaps don't emit ERC20 Transfer events for the ETH side
      // detectSwapFromReceiptLogs will fail, should fallback to detectSwapPattern
      const WALLET = "0xagent123";
      const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
      const NATIVE_ADDRESS = "0x0000000000000000000000000000000000000000";

      // Receipt with only inbound ERC20 (ETH outbound has no ERC20 log)
      const mockReceipt = {
        transactionHash: "0xtxhash1",
        blockNumber: 1000000,
        gasUsed: "150000",
        effectiveGasPrice: "50000000000",
        status: true,
        from: WALLET,
        to: "0xrouter456",
        logs: [
          // Only USDC inbound - no ERC20 log for native ETH
          createTransferLog(
            USDC_ADDRESS,
            "0xrouter456",
            WALLET,
            BigInt("100000000"), // 100 USDC
            0,
          ),
        ],
      };

      // getAssetTransfers includes both ETH (EXTERNAL category) and ERC20
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: [
          // Native ETH outbound (EXTERNAL category, no rawContract.address)
          createMockTransfer({
            from: WALLET,
            to: "0xrouter456",
            value: 0.5, // 0.5 ETH
            asset: "ETH",
            hash: "0xtxhash1",
            blockNum: "0xf4240",
            metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
            rawContract: { address: null, decimal: null, value: "0x" },
            category: AssetTransfersCategory.EXTERNAL,
            uniqueId: "unique1",
          }),
          // USDC inbound
          createMockTransfer({
            from: "0xrouter456",
            to: WALLET,
            value: 100,
            asset: "USDC",
            hash: "0xtxhash1",
            blockNum: "0xf4240",
            metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
            rawContract: { address: USDC_ADDRESS, decimal: "6", value: "0x" },
            category: AssetTransfersCategory.ERC20,
            uniqueId: "unique2",
          }),
        ],
        pageKey: undefined,
      });

      mockRpcProvider.getTransactionReceipt.mockResolvedValue(mockReceipt);

      const result = await provider.getTradesSince(WALLET, 999990, ["base"]);

      // Fallback should detect this as a swap
      expect(result.trades).toHaveLength(1);
      const trade = result.trades[0]!;

      // Native ETH as fromToken (zero address)
      expect(trade.fromToken.toLowerCase()).toBe(NATIVE_ADDRESS);
      expect(trade.toToken.toLowerCase()).toBe(USDC_ADDRESS.toLowerCase());
      expect(trade.fromAmount).toBeCloseTo(0.5, 1);
      expect(trade.toAmount).toBeCloseTo(100, 1);
    });

    it("should not detect deposit-only transactions as swaps", async () => {
      const WALLET = "0xagent123";
      const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

      // Only inbound transfer (deposit)
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: [
          createMockTransfer({
            from: "0xexternal",
            to: WALLET,
            value: 1000,
            asset: "USDC",
            hash: "0xtxhash1",
            blockNum: "0xf4240",
            metadata: { blockTimestamp: "2025-01-15T10:00:00.000Z" },
            rawContract: { address: USDC_ADDRESS, decimal: "6", value: "0x" },
            category: AssetTransfersCategory.ERC20,
            uniqueId: "unique1",
          }),
        ],
        pageKey: undefined,
      });

      const result = await provider.getTradesSince(WALLET, 999990, ["base"]);

      // Deposit-only should not be detected as swap
      expect(result.trades).toHaveLength(0);

      // Should NOT have fetched receipt (pre-filter catches this)
      expect(mockRpcProvider.getTransactionReceipt).not.toHaveBeenCalled();
    });
  });
});
