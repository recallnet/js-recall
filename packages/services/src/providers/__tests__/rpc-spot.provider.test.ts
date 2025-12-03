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

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("No chains provided"),
      );
    });

    it("should detect swap from transfer pattern", async () => {
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: sampleSwapTransfers,
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

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        txHash: "0xtxhash1",
        fromToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        toToken: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
        fromAmount: 100,
        toAmount: 50,
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

      expect(result).toHaveLength(0);
    });

    it("should handle empty transfers gracefully", async () => {
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: [],
        pageKey: undefined,
      });

      const result = await provider.getTradesSince("0xagent123", 10000, [
        "base",
      ]);

      expect(result).toEqual([]);
    });

    it("should continue processing other chains when one fails", async () => {
      mockRpcProvider.getAssetTransfers
        .mockRejectedValueOnce(new Error("RPC error for base"))
        .mockResolvedValueOnce({
          transfers: sampleSwapTransfers,
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
      expect(result).toHaveLength(1);
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
        transfers: sampleSwapTransfers,
        pageKey: undefined,
      });

      // Mock tx to match Aerodrome router
      mockRpcProvider.getTransaction.mockResolvedValue({
        to: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43", // Aerodrome router
        from: "0xagent123",
      });

      // Mock receipt with Aerodrome swap event
      mockRpcProvider.getTransactionReceipt.mockResolvedValue({
        transactionHash: "0xtxhash1",
        blockNumber: 1000000,
        gasUsed: "150000",
        effectiveGasPrice: "50000000000",
        status: true,
        from: "0xagent123",
        to: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
        logs: [
          {
            topics: [
              "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822", // Aerodrome swap sig
            ],
          } as Log,
        ],
      });

      const result = await provider.getTradesSince("0xagent123", 10000, [
        "base",
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]?.protocol).toBe("aerodrome");
    });

    it("should reject swap with wrong router address", async () => {
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: sampleSwapTransfers,
        pageKey: undefined,
      });

      // Mock tx with wrong router (Uniswap, not Aerodrome)
      mockRpcProvider.getTransaction.mockResolvedValue({
        to: "0xWrongRouter111111111111111111111111111111",
        from: "0xagent123",
      });

      mockRpcProvider.getTransactionReceipt.mockResolvedValue({
        transactionHash: "0xtxhash1",
        blockNumber: 1000000,
        gasUsed: "150000",
        effectiveGasPrice: "50000000000",
        status: true,
        from: "0xagent123",
        to: "0xWrongRouter",
        logs: [],
      });

      const result = await provider.getTradesSince("0xagent123", 10000, [
        "base",
      ]);

      expect(result).toHaveLength(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ txHash: "0xtxhash1" }),
        expect.stringContaining("not from allowed protocol"),
      );
    });

    it("should reject swap with correct router but wrong event signature", async () => {
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: sampleSwapTransfers,
        pageKey: undefined,
      });

      // Correct router
      mockRpcProvider.getTransaction.mockResolvedValue({
        to: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
        from: "0xagent123",
      });

      // But wrong event signature (not Aerodrome swap)
      mockRpcProvider.getTransactionReceipt.mockResolvedValue({
        transactionHash: "0xtxhash1",
        blockNumber: 1000000,
        gasUsed: "150000",
        effectiveGasPrice: "50000000000",
        status: true,
        from: "0xagent123",
        to: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
        logs: [
          {
            topics: [
              "0xWrongEventSignature0000000000000000000000000000000000000000000000", // Wrong sig
            ],
          } as Log,
        ],
      });

      const result = await provider.getTradesSince("0xagent123", 10000, [
        "base",
      ]);

      expect(result).toHaveLength(0);
    });

    it("should handle missing transaction data gracefully", async () => {
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: sampleSwapTransfers,
        pageKey: undefined,
      });

      // Transaction not found
      mockRpcProvider.getTransaction.mockResolvedValue(null);
      mockRpcProvider.getTransactionReceipt.mockResolvedValue(null);

      const result = await provider.getTradesSince("0xagent123", 10000, [
        "base",
      ]);

      expect(result).toHaveLength(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ txHash: "0xtxhash1" }),
        expect.stringContaining("Could not fetch tx/receipt"),
      );
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

      expect(result).toHaveLength(0);
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

      expect(result).toHaveLength(0);
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

      expect(result).toHaveLength(1);
      // fromToken must be zero address for proper price lookup
      // (mapped to WETH in spot-data-processor)
      expect(result[0]?.fromToken).toBe(NATIVE_TOKEN_ADDRESS);
      expect(result[0]?.toToken).toBe(
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

      expect(result).toHaveLength(1);
      expect(result[0]?.fromToken).toBe(
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      );
      // toToken must be zero address for proper price lookup
      expect(result[0]?.toToken).toBe(NATIVE_TOKEN_ADDRESS);
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
    beforeEach(() => {
      provider = new RpcSpotProvider(mockRpcProvider, [], mockLogger);
      mockRpcProvider.getBlockNumber.mockResolvedValue(1000000);
    });

    it("should include gas data when receipt is available", async () => {
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: sampleSwapTransfers,
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

      expect(result).toHaveLength(1);
      expect(result[0]?.gasUsed).toBe(150000);
      expect(result[0]?.gasPrice).toBe(50000000000);
    });

    it("should handle missing receipt gracefully", async () => {
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: sampleSwapTransfers,
        pageKey: undefined,
      });

      mockRpcProvider.getTransactionReceipt.mockResolvedValue(null);

      const result = await provider.getTradesSince("0xagent123", 10000, [
        "base",
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]?.gasUsed).toBe(0);
      expect(result[0]?.gasPrice).toBe(0);
    });

    it("should log warning when gas fetch fails", async () => {
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

      expect(result).toHaveLength(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Receipt fetch failed" }),
        expect.stringContaining("Could not fetch gas data"),
      );
    });
  });

  describe("multi-chain processing", () => {
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

    it("should process multiple chains", async () => {
      mockRpcProvider.getAssetTransfers.mockResolvedValue({
        transfers: sampleSwapTransfers,
        pageKey: undefined,
      });

      const result = await provider.getTradesSince("0xagent123", 10000, [
        "base",
        "arbitrum",
        "optimism",
      ]);

      // Should call getAssetTransfers for each chain
      expect(mockRpcProvider.getAssetTransfers).toHaveBeenCalledTimes(3);
      expect(result.length).toBeGreaterThan(0);
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
});
