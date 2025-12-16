import axios, { AxiosError, AxiosInstance } from "axios";
import { Logger } from "pino";
import {
  MockedFunction,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { HyperliquidPerpsProvider } from "../perps/hyperliquid-perps.provider.js";

// Mock axios
vi.mock("axios");

// Mock logger for the constructor
const mockLogger: MockProxy<Logger> = mock<Logger>();

// Mock Sentry to avoid errors in tests
vi.mock("@sentry/node", () => ({
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

// Type for mocking axios instance
type MockAxiosInstance = {
  post: MockedFunction<AxiosInstance["post"]>;
  defaults: { baseURL: string };
};

describe("HyperliquidPerpsProvider", () => {
  let provider: HyperliquidPerpsProvider;
  let mockAxiosInstance: MockAxiosInstance;

  // Sample test data based on actual Hyperliquid API responses
  const sampleClearinghouseState = {
    marginSummary: {
      accountValue: "1500.50",
      totalMarginUsed: "250.00",
      totalNtlPos: "5000.00",
      totalRawUsd: "1250.50",
    },
    crossMarginSummary: {
      accountValue: "1500.50",
      totalMarginUsed: "250.00",
      totalNtlPos: "5000.00",
      totalRawUsd: "1250.50",
    },
    crossMaintenanceMarginUsed: "125.00",
    withdrawable: "1125.50",
    assetPositions: [
      {
        position: {
          coin: "BTC",
          szi: "0.1", // Positive for long
          entryPx: "45000",
          leverage: {
            type: "cross" as const,
            value: 10,
          },
          marginUsed: "450",
          maxLeverage: 50,
          liquidationPx: "40000",
          positionValue: "4600",
          returnOnEquity: "0.0222",
          unrealizedPnl: "100",
          cumFunding: {
            allTime: "-5.25",
            sinceOpen: "-2.50",
            sinceChange: "-1.00",
          },
        },
        type: "oneWay" as const,
      },
      {
        position: {
          coin: "ETH",
          szi: "-2", // Negative for short
          entryPx: "3000",
          leverage: {
            type: "cross" as const,
            value: 5,
          },
          marginUsed: "1200",
          maxLeverage: 25,
          liquidationPx: "3300",
          positionValue: "5800",
          returnOnEquity: "-0.0167",
          unrealizedPnl: "-200",
          cumFunding: {
            allTime: "-10.50",
            sinceOpen: "-3.25",
            sinceChange: "-0.75",
          },
        },
        type: "oneWay" as const,
      },
      {
        position: {
          coin: "SOL",
          szi: "0", // No position
          entryPx: "0",
          leverage: {
            type: "cross" as const,
            value: 1,
          },
          marginUsed: "0",
          maxLeverage: 20,
          liquidationPx: null,
          positionValue: "0",
          returnOnEquity: "0",
          unrealizedPnl: "0",
          cumFunding: {
            allTime: "0",
            sinceOpen: "0",
            sinceChange: "0",
          },
        },
        type: "oneWay" as const,
      },
    ],
    time: 1759757757621,
  };

  const sampleUserFills = [
    {
      coin: "BTC",
      px: "45100",
      sz: "0.05",
      side: "B" as const, // Buy
      time: 1759757700000,
      startPosition: "0.05",
      dir: "Open Long",
      closedPnl: "0",
      hash: "0x123456",
      oid: 187731467381,
      crossed: true,
      fee: "2.255",
      tid: 10570190,
      feeToken: "USDC",
      cloid: "0x6242b0a05c954634b9389fa9efd4d065",
      twapId: null,
    },
    {
      coin: "ETH",
      px: "2950",
      sz: "1",
      side: "A" as const, // Ask/Sell
      time: 1759757600000,
      startPosition: "-1",
      dir: "Open Short",
      closedPnl: "0",
      hash: "0x789abc",
      oid: 187731467382,
      crossed: true,
      fee: "1.475",
      tid: 10570191,
      feeToken: "USDC",
      cloid: "0x7353b0a05c954634b9389fa9efd4d066",
      twapId: null,
    },
    {
      coin: "BTC",
      px: "45500",
      sz: "0.02",
      side: "A" as const, // Closing long
      time: 1759757500000,
      startPosition: "0.07",
      dir: "Close Long",
      closedPnl: "10",
      hash: "0xdef123",
      oid: 187731467383,
      crossed: true,
      fee: "0.91",
      tid: 10570192,
      feeToken: "USDC",
      cloid: "0x8464b0a05c954634b9389fa9efd4d067",
      twapId: null,
    },
  ];

  // Sample fills for testing getClosedPositionFills - includes fills with non-zero closedPnl
  const sampleClosedFills = [
    {
      coin: "BTC",
      px: "46000", // Close price
      sz: "0.1",
      side: "A" as const, // Sell to close long
      time: 1759757700000,
      startPosition: "0.1",
      dir: "Close Long",
      closedPnl: "50", // Realized PnL
      hash: "0xclosed1",
      oid: 187731467390,
      crossed: true,
      fee: "2.3",
      tid: 10570200,
      feeToken: "USDC",
      cloid: null,
      twapId: null,
    },
    {
      coin: "ETH",
      px: "2800", // Close price
      sz: "2",
      side: "B" as const, // Buy to close short
      time: 1759757600000,
      startPosition: "-2",
      dir: "Close Short",
      closedPnl: "-100", // Negative PnL (loss)
      hash: "0xclosed2",
      oid: 187731467391,
      crossed: true,
      fee: "2.8",
      tid: 10570201,
      feeToken: "USDC",
      cloid: null,
      twapId: null,
    },
    {
      coin: "SOL",
      px: "100",
      sz: "10",
      side: "B" as const, // Buy to open long (NOT a close)
      time: 1759757500000,
      startPosition: "0",
      dir: "Open Long",
      closedPnl: "0", // Zero - this is an entry, not a close
      hash: "0xopen1",
      oid: 187731467392,
      crossed: true,
      fee: "1",
      tid: 10570202,
      feeToken: "USDC",
      cloid: null,
      twapId: null,
    },
  ];

  const sampleLedgerUpdates = [
    {
      time: 1759757400000,
      hash: "0xabc123",
      delta: {
        type: "deposit" as const,
        usdc: "500",
        user: undefined,
        destination: undefined,
        fee: undefined,
      },
    },
    {
      time: 1759757300000,
      hash: "0xdef456",
      delta: {
        type: "withdraw" as const,
        usdc: "100",
        user: undefined,
        destination: undefined,
        fee: "2",
      },
    },
    {
      time: 1759757200000,
      hash: "0xghi789",
      delta: {
        type: "subAccountTransfer" as const,
        usdc: "200",
        user: "0xfrom123",
        destination: "0xto456",
        fee: undefined,
      },
    },
  ];

  const sampleAllMids = {
    BTC: "46000",
    ETH: "2900",
    SOL: "120",
    DOGE: "0.35",
    // Include some spot tokens with @ prefix
    "@1": "41.3265",
    "@2": "0.482045",
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock axios.create to return a mock instance
    mockAxiosInstance = {
      post: vi.fn() as MockedFunction<AxiosInstance["post"]>,
      defaults: { baseURL: "" },
    };

    vi.mocked(axios.create).mockReturnValue(
      mockAxiosInstance as unknown as AxiosInstance,
    );

    // By default, isAxiosError returns false
    vi.mocked(axios.isAxiosError).mockReturnValue(false);

    // Create provider instance
    provider = new HyperliquidPerpsProvider(mockLogger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with default URL", () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: "https://api.hyperliquid.xyz",
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    it("should initialize with custom URL when provided", () => {
      const customUrl = "https://api.hyperliquid-testnet.xyz";
      new HyperliquidPerpsProvider(mockLogger, customUrl);

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: customUrl,
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
        },
      });
    });
  });

  describe("getName", () => {
    it("should return provider name", () => {
      expect(provider.getName()).toBe("Hyperliquid");
    });
  });

  describe("isHealthy", () => {
    it("should return true when allMids endpoint responds with data", async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: sampleAllMids,
      });

      const result = await provider.isHealthy();

      expect(result).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/info", {
        type: "allMids",
      });
    });

    it("should return false when allMids returns empty object", async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {},
      });

      const result = await provider.isHealthy();

      expect(result).toBe(false);
    });

    it("should return false when request fails", async () => {
      mockAxiosInstance.post.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe("getAccountSummary", () => {
    it("should fetch and transform account summary successfully", async () => {
      // Mock Math.random to ensure consistent rawData behavior (avoid sampling)
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.5); // Always return 0.5, which is > 0.01 sampling rate

      // Mock clearinghouseState
      mockAxiosInstance.post.mockImplementationOnce((url, body) => {
        if (
          body &&
          typeof body === "object" &&
          "type" in body &&
          body.type === "clearinghouseState"
        ) {
          return Promise.resolve({ data: sampleClearinghouseState });
        }
        return Promise.reject(new Error("Unexpected request"));
      });

      // Mock userFillsByTime
      mockAxiosInstance.post.mockImplementationOnce((url, body) => {
        if (
          body &&
          typeof body === "object" &&
          "type" in body &&
          body.type === "userFillsByTime"
        ) {
          return Promise.resolve({ data: sampleUserFills });
        }
        return Promise.reject(new Error("Unexpected request"));
      });

      const result = await provider.getAccountSummary("0xtest123");

      // Without initial capital provided, it defaults to current equity
      expect(result.totalEquity).toBe(1500.5);
      expect(result.initialCapital).toBe(1500.5);
      expect(result.availableBalance).toBe(1250.5);
      expect(result.marginUsed).toBe(250);
      expect(result.totalPnl).toBe(-90); // -100 (unrealized) + 10 (closed)
      expect(result.totalRealizedPnl).toBe(10);
      expect(result.totalUnrealizedPnl).toBe(-100); // 100 (BTC) - 200 (ETH)
      expect(result.totalVolume).toBe(6115); // Sum of all fills: 45100*0.05 + 2950*1 + 45500*0.02
      expect(result.totalTrades).toBe(3);
      expect(result.totalFeesPaid).toBe(4.64); // Sum of all fees
      expect(result.openPositionsCount).toBe(2); // BTC and ETH (SOL has size 0)
      expect(result.closedPositionsCount).toBe(0);
      expect(result.liquidatedPositionsCount).toBe(0);
      expect(result.roi).toBe(0); // Defaults to 0 without initial capital
      expect(result.roiPercent).toBe(0);
      expect(result.averageTradeSize).toBeCloseTo(2038.33, 1); // 6115 / 3
      expect(result.accountStatus).toBe("active");
      expect(result.rawData).toBeUndefined();

      // Restore original Math.random
      Math.random = originalRandom;
    });

    it("should calculate correct ROI when initial capital is provided", async () => {
      // Mock clearinghouseState
      mockAxiosInstance.post.mockImplementationOnce((url, body) => {
        if (
          body &&
          typeof body === "object" &&
          "type" in body &&
          body.type === "clearinghouseState"
        ) {
          return Promise.resolve({ data: sampleClearinghouseState });
        }
        return Promise.reject(new Error("Unexpected request"));
      });

      // Mock userFillsByTime
      mockAxiosInstance.post.mockImplementationOnce((url, body) => {
        if (
          body &&
          typeof body === "object" &&
          "type" in body &&
          body.type === "userFillsByTime"
        ) {
          return Promise.resolve({ data: sampleUserFills });
        }
        return Promise.reject(new Error("Unexpected request"));
      });

      // Provide initial capital of 1000
      const result = await provider.getAccountSummary("0xtest123", 1000);

      expect(result.totalEquity).toBe(1500.5);
      expect(result.initialCapital).toBe(1000);
      // ROI should be ((1500.5 - 1000) / 1000) * 100 = 50.05%
      expect(result.roi).toBe(50.05);
      expect(result.roiPercent).toBe(50.05);
    });

    it("should handle zero positions and no trades", async () => {
      const emptyState = {
        ...sampleClearinghouseState,
        assetPositions: [],
      };

      mockAxiosInstance.post.mockImplementationOnce(() =>
        Promise.resolve({ data: emptyState }),
      );
      mockAxiosInstance.post.mockImplementationOnce(() =>
        Promise.resolve({ data: [] }),
      );

      const result = await provider.getAccountSummary("0xtest123");

      expect(result.openPositionsCount).toBe(0);
      expect(result.totalUnrealizedPnl).toBe(0);
      expect(result.totalVolume).toBe(0);
      expect(result.totalTrades).toBe(0);
      expect(result.averageTradeSize).toBe(0);
      expect(result.accountStatus).toBe("inactive");
    });

    it("should handle negative equity and PnL correctly", async () => {
      const negativeState = {
        ...sampleClearinghouseState,
        marginSummary: {
          accountValue: "250.00", // Lost money
          totalMarginUsed: "100.00",
          totalNtlPos: "1000.00",
          totalRawUsd: "150.00",
        },
        crossMarginSummary: {
          accountValue: "250.00",
          totalMarginUsed: "100.00",
          totalNtlPos: "1000.00",
          totalRawUsd: "150.00",
        },
      };

      mockAxiosInstance.post.mockImplementationOnce(() =>
        Promise.resolve({ data: negativeState }),
      );
      mockAxiosInstance.post.mockImplementationOnce(() =>
        Promise.resolve({ data: [] }),
      );

      const result = await provider.getAccountSummary("0xtest123");

      expect(result.totalEquity).toBe(250);
      expect(result.roi).toBe(0); // Defaults to 0 without initial capital
      expect(result.roiPercent).toBe(0);
    });

    it("should retry on transient failures", async () => {
      // First call fails
      mockAxiosInstance.post.mockRejectedValueOnce(new Error("Network error"));
      // Second call succeeds
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: sampleClearinghouseState,
      });
      mockAxiosInstance.post.mockResolvedValueOnce({ data: sampleUserFills });

      const result = await provider.getAccountSummary("0xtest123");

      expect(result).toBeDefined();
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3); // 1 retry + 2 successful
    });

    it("should not retry on 4xx errors", async () => {
      const error = new Error("Bad request") as AxiosError;
      error.response = {
        status: 400,
        data: { error: "Invalid user address" },
        statusText: "Bad Request",
        headers: {},
        config: undefined as never,
      };
      error.isAxiosError = true;

      vi.mocked(axios.isAxiosError).mockImplementation((err) => err === error);
      mockAxiosInstance.post.mockRejectedValueOnce(error);

      await expect(provider.getAccountSummary("0xinvalid")).rejects.toThrow();
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it("should throw after max retries", async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error("Network error"));

      await expect(provider.getAccountSummary("0xtest123")).rejects.toThrow(
        "Network error",
      );
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3); // MAX_RETRIES = 3
    });
  });

  describe("getPositions", () => {
    it("should fetch and transform positions successfully", async () => {
      // Mock clearinghouseState
      mockAxiosInstance.post.mockImplementationOnce(() =>
        Promise.resolve({ data: sampleClearinghouseState }),
      );

      // Mock allMids for current prices
      mockAxiosInstance.post.mockImplementationOnce(() =>
        Promise.resolve({ data: sampleAllMids }),
      );

      const result = await provider.getPositions("0xtest123");

      expect(result).toHaveLength(2); // BTC and ETH (SOL has size 0)

      // Check BTC position (long)
      expect(result[0]).toMatchObject({
        symbol: "BTC",
        side: "long",
        positionSizeUsd: 4600,
        leverage: 10,
        collateralAmount: 450,
        entryPrice: 45000,
        currentPrice: 46000, // From allMids
        liquidationPrice: 40000,
        pnlUsdValue: 100,
        pnlPercentage: 2.22,
        status: "Open",
      });

      // Check ETH position (short)
      expect(result[1]).toMatchObject({
        symbol: "ETH",
        side: "short",
        positionSizeUsd: 5800,
        leverage: 5,
        collateralAmount: 1200,
        entryPrice: 3000,
        currentPrice: 2900, // From allMids
        liquidationPrice: 3300,
        pnlUsdValue: -200,
        pnlPercentage: -1.67,
        status: "Open",
      });
    });

    it("should calculate current price from position data when allMids fails", async () => {
      const positionWithoutMarketPrice = {
        ...sampleClearinghouseState,
        assetPositions: [
          {
            position: {
              coin: "UNKNOWN",
              szi: "10",
              entryPx: "100",
              leverage: {
                type: "cross" as const,
                value: 2,
              },
              marginUsed: "500",
              maxLeverage: 10,
              liquidationPx: "80",
              positionValue: "1050",
              returnOnEquity: "0.10",
              unrealizedPnl: "50",
              cumFunding: {
                allTime: "0",
                sinceOpen: "0",
                sinceChange: "0",
              },
            },
            type: "oneWay" as const,
          },
        ],
      };

      mockAxiosInstance.post.mockImplementationOnce(() =>
        Promise.resolve({ data: positionWithoutMarketPrice }),
      );

      // allMids fails or doesn't have the coin
      mockAxiosInstance.post.mockImplementationOnce(() =>
        Promise.resolve({ data: {} }),
      );

      const result = await provider.getPositions("0xtest123");

      // Should calculate: entryPx + (unrealizedPnl / size) = 100 + (50 / 10) = 105
      expect(result[0]?.currentPrice).toBe(105);
    });

    it("should handle liquidation price being null", async () => {
      const stateWithNullLiquidation = {
        ...sampleClearinghouseState,
        assetPositions: [
          {
            ...sampleClearinghouseState.assetPositions[0],
            position: {
              ...sampleClearinghouseState.assetPositions[0]!.position,
              liquidationPx: null,
            },
          },
        ],
      };

      mockAxiosInstance.post.mockImplementationOnce(() =>
        Promise.resolve({ data: stateWithNullLiquidation }),
      );
      mockAxiosInstance.post.mockImplementationOnce(() =>
        Promise.resolve({ data: sampleAllMids }),
      );

      const result = await provider.getPositions("0xtest123");

      expect(result[0]?.liquidationPrice).toBeUndefined();
    });

    it("should handle empty positions correctly", async () => {
      const emptyState = {
        ...sampleClearinghouseState,
        assetPositions: [],
      };

      mockAxiosInstance.post.mockImplementationOnce(() =>
        Promise.resolve({ data: emptyState }),
      );
      mockAxiosInstance.post.mockImplementationOnce(() =>
        Promise.resolve({ data: sampleAllMids }),
      );

      const result = await provider.getPositions("0xtest123");

      expect(result).toEqual([]);
    });

    it("should skip positions with zero size", async () => {
      mockAxiosInstance.post.mockImplementationOnce(() =>
        Promise.resolve({ data: sampleClearinghouseState }),
      );
      mockAxiosInstance.post.mockImplementationOnce(() =>
        Promise.resolve({ data: sampleAllMids }),
      );

      const result = await provider.getPositions("0xtest123");

      // Should not include SOL which has szi = "0"
      const solPosition = result.find((p) => p.symbol === "SOL");
      expect(solPosition).toBeUndefined();
    });
  });

  describe("getTransferHistory", () => {
    it("should fetch and transform deposit/withdrawal history", async () => {
      const since = new Date("2025-01-10T00:00:00Z");

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: sampleLedgerUpdates,
      });

      const result = await provider.getTransferHistory("0xtest123", since);

      // Should only include deposits and withdrawals (not subAccountTransfers)
      expect(result).toHaveLength(2);

      // First transfer (deposit)
      expect(result[0]).toEqual({
        type: "deposit",
        amount: 500,
        asset: "USDC",
        from: "external",
        to: "0xtest123",
        timestamp: new Date(1759757400000),
        txHash: "0xabc123",
        chainId: 1,
      });

      // Second transfer (withdrawal)
      expect(result[1]).toEqual({
        type: "withdraw",
        amount: 100,
        asset: "USDC",
        from: "0xtest123",
        to: "external",
        timestamp: new Date(1759757300000),
        txHash: "0xdef456",
        chainId: 1,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/info", {
        type: "userNonFundingLedgerUpdates",
        user: "0xtest123",
        startTime: since.getTime(),
        endTime: expect.any(Number),
      });
    });

    it("should skip subAccountTransfer as they are internal", async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: sampleLedgerUpdates,
      });

      const result = await provider.getTransferHistory("0xtest123", new Date());

      // Should not include the subAccountTransfer
      const hasSubAccountTransfer = result.some((t) => t.txHash === "0xghi789");
      expect(hasSubAccountTransfer).toBe(false);
    });

    it("should handle empty transfer history", async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: [],
      });

      const result = await provider.getTransferHistory("0xtest123", new Date());

      expect(result).toEqual([]);
    });

    it("should handle null/undefined response gracefully", async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: null,
      });

      const result = await provider.getTransferHistory("0xtest123", new Date());

      expect(result).toEqual([]);
    });

    it("should return empty array on error (transfers are optional)", async () => {
      mockAxiosInstance.post.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.getTransferHistory("0xtest123", new Date());

      // Transfer history is optional, so it returns empty array on error
      expect(result).toEqual([]);
    });

    it("should handle transfers with zero amounts", async () => {
      const zeroAmountTransfers = [
        {
          time: 1759757400000,
          hash: "0xzero123",
          delta: {
            type: "deposit" as const,
            usdc: "0",
            user: undefined,
            destination: undefined,
            fee: undefined,
          },
        },
      ];

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: zeroAmountTransfers,
      });

      const result = await provider.getTransferHistory("0xtest123", new Date());

      expect(result[0]).toEqual({
        type: "deposit",
        amount: 0,
        asset: "USDC",
        from: "external",
        to: "0xtest123",
        timestamp: new Date(1759757400000),
        txHash: "0xzero123",
        chainId: 1,
      });
    });

    it("should handle non-USDC asset transfers (BTC, ETH, SOL)", async () => {
      const multiAssetTransfers = [
        {
          time: 1759757500000,
          hash: "0xbtc123",
          delta: {
            type: "deposit" as const,
            amount: "0.5",
            token: "BTC",
          },
        },
        {
          time: 1759757600000,
          hash: "0xeth456",
          delta: {
            type: "withdraw" as const,
            amount: "-2.5",
            token: "ETH",
          },
        },
        {
          time: 1759757700000,
          hash: "0xsol789",
          delta: {
            type: "deposit" as const,
            amount: "100",
            token: "SOL",
          },
        },
        // Mixed with USDC
        {
          time: 1759757800000,
          hash: "0xusdc999",
          delta: {
            type: "deposit" as const,
            usdc: "1000",
          },
        },
      ];

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: multiAssetTransfers,
      });

      const result = await provider.getTransferHistory("0xtest123", new Date());

      expect(result).toHaveLength(4);

      // BTC deposit
      expect(result[0]).toEqual({
        type: "deposit",
        amount: 0.5,
        asset: "BTC",
        from: "external",
        to: "0xtest123",
        timestamp: new Date(1759757500000),
        txHash: "0xbtc123",
        chainId: 1,
      });

      // ETH withdrawal
      expect(result[1]).toEqual({
        type: "withdraw",
        amount: 2.5,
        asset: "ETH",
        from: "0xtest123",
        to: "external",
        timestamp: new Date(1759757600000),
        txHash: "0xeth456",
        chainId: 1,
      });

      // SOL deposit
      expect(result[2]).toEqual({
        type: "deposit",
        amount: 100,
        asset: "SOL",
        from: "external",
        to: "0xtest123",
        timestamp: new Date(1759757700000),
        txHash: "0xsol789",
        chainId: 1,
      });

      // USDC deposit
      expect(result[3]).toEqual({
        type: "deposit",
        amount: 1000,
        asset: "USDC",
        from: "external",
        to: "0xtest123",
        timestamp: new Date(1759757800000),
        txHash: "0xusdc999",
        chainId: 1,
      });
    });

    it("should handle negative amounts correctly", async () => {
      const negativeAmountTransfers = [
        {
          time: 1759757400000,
          hash: "0xneg123",
          delta: {
            type: "withdraw" as const,
            usdc: "-100", // Negative amount
            user: undefined,
            destination: undefined,
            fee: "2",
          },
        },
      ];

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: negativeAmountTransfers,
      });

      const result = await provider.getTransferHistory("0xtest123", new Date());

      // Should use Math.abs to ensure positive amount
      expect(result[0]?.amount).toBe(100);
    });
  });

  describe("retry logic", () => {
    it("should use exponential backoff for retries", async () => {
      const startTimes: number[] = [];

      mockAxiosInstance.post.mockImplementation(async () => {
        startTimes.push(Date.now());
        throw new Error("Network error");
      });

      await expect(provider.getAccountSummary("0xtest123")).rejects.toThrow();

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);

      // Check delays between retries (should increase)
      if (startTimes.length >= 3) {
        const delay1 = (startTimes[1] ?? 0) - (startTimes[0] ?? 0);
        const delay2 = (startTimes[2] ?? 0) - (startTimes[1] ?? 0);

        // Second delay should be roughly double the first (exponential backoff)
        expect(delay2).toBeGreaterThan(delay1);
      }
    });

    it("should succeed on second retry attempt", async () => {
      let callCount = 0;

      mockAxiosInstance.post.mockImplementation(
        async (_url: string, body: unknown) => {
          callCount++;

          // Check if this is a clearinghouseState request
          if (
            body &&
            typeof body === "object" &&
            "type" in body &&
            body.type === "clearinghouseState"
          ) {
            if (callCount <= 2) {
              throw new Error("Transient error");
            }
            return { data: sampleClearinghouseState };
          }

          // Check if this is a userFillsByTime request
          if (
            body &&
            typeof body === "object" &&
            "type" in body &&
            body.type === "userFillsByTime"
          ) {
            return { data: sampleUserFills };
          }

          throw new Error("Unexpected request");
        },
      );

      const result = await provider.getAccountSummary("0xtest123");

      expect(result).toBeDefined();
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(4); // 3 attempts for clearinghouse + 1 for fills
    });
  });

  describe("edge cases", () => {
    it("should handle very large numbers correctly", async () => {
      const largeNumberState = {
        ...sampleClearinghouseState,
        marginSummary: {
          accountValue: "999999999999.99",
          totalMarginUsed: "10000000.00",
          totalNtlPos: "1000000000000",
          totalRawUsd: "989999999999.99",
        },
        crossMarginSummary: {
          accountValue: "999999999999.99",
          totalMarginUsed: "10000000.00",
          totalNtlPos: "1000000000000",
          totalRawUsd: "989999999999.99",
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce({ data: largeNumberState });
      mockAxiosInstance.post.mockResolvedValueOnce({ data: [] });

      const result = await provider.getAccountSummary("0xtest123");

      expect(result.totalEquity).toBe(999999999999.99);
      expect(result.marginUsed).toBe(10000000);
    });

    it("should handle very small decimal numbers correctly", async () => {
      const smallNumberState = {
        ...sampleClearinghouseState,
        assetPositions: [
          {
            position: {
              coin: "SHIB",
              szi: "1000000000",
              entryPx: "0.00000001",
              leverage: {
                type: "cross" as const,
                value: 1,
              },
              marginUsed: "10",
              maxLeverage: 5,
              liquidationPx: "0.000000005",
              positionValue: "10.5",
              returnOnEquity: "0.05",
              unrealizedPnl: "0.5",
              cumFunding: {
                allTime: "0",
                sinceOpen: "0",
                sinceChange: "0",
              },
            },
            type: "oneWay" as const,
          },
        ],
      };

      mockAxiosInstance.post.mockResolvedValueOnce({ data: smallNumberState });
      mockAxiosInstance.post.mockResolvedValueOnce({ data: sampleAllMids });

      const result = await provider.getPositions("0xtest123");

      expect(result[0]?.entryPrice).toBe(0.00000001);
      expect(result[0]?.liquidationPrice).toBe(0.000000005);
    });

    it("should handle position ID generation deterministically", async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: sampleClearinghouseState,
      });
      mockAxiosInstance.post.mockResolvedValueOnce({ data: sampleAllMids });

      const result = await provider.getPositions("0xtest123");

      // Position IDs should be deterministic hashes (16 chars of hex)
      expect(result[0]?.providerPositionId).toMatch(/^[0-9a-f]{16}$/i);

      // Verify same position generates same ID (deterministic)
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: sampleClearinghouseState,
      });
      mockAxiosInstance.post.mockResolvedValueOnce({ data: sampleAllMids });

      const result2 = await provider.getPositions("0xtest123");
      expect(result2[0]?.providerPositionId).toMatch(/^[0-9a-f]{16}$/i);

      // Same position should have same ID (deterministic based on wallet-coin-side-entryPrice)
      expect(result2[0]?.providerPositionId).toBe(
        result[0]?.providerPositionId,
      );
    });

    it("should generate different IDs for positions with different entry prices", async () => {
      const firstAsset = sampleClearinghouseState.assetPositions[0];
      if (!firstAsset) {
        throw new Error("Sample data missing first asset position");
      }

      const stateWithDifferentEntry = {
        ...sampleClearinghouseState,
        assetPositions: [
          {
            ...firstAsset,
            position: {
              ...firstAsset.position,
              entryPx: "50000", // Different entry price
            },
          },
        ],
      };

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: sampleClearinghouseState, // Entry price: 45000
      });
      mockAxiosInstance.post.mockResolvedValueOnce({ data: sampleAllMids });

      const result1 = await provider.getPositions("0xtest123");

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: stateWithDifferentEntry, // Entry price: 50000
      });
      mockAxiosInstance.post.mockResolvedValueOnce({ data: sampleAllMids });

      const result2 = await provider.getPositions("0xtest123");

      // Different entry prices should generate different IDs
      expect(result1[0]?.providerPositionId).not.toBe(
        result2[0]?.providerPositionId,
      );
    });

    it("should mask wallet addresses in logs", async () => {
      const debugSpy = vi.spyOn(mockLogger, "debug");

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: sampleClearinghouseState,
      });
      mockAxiosInstance.post.mockResolvedValueOnce({ data: sampleUserFills });

      await provider.getAccountSummary(
        "0x1234567890abcdef1234567890abcdef12345678",
      );

      // Check that wallet address is masked in logs
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining("0x1234...5678"),
      );
    });
  });

  describe("getClosedPositionFills", () => {
    it("should fetch and filter closed fills with non-zero closedPnl", async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: sampleClosedFills,
      });

      const since = new Date(1759757400000);
      const until = new Date(1759757800000);

      const result = await provider.getClosedPositionFills(
        "0xtest123",
        since,
        until,
      );

      // Should only include fills with non-zero closedPnl (2 of 3)
      expect(result).toHaveLength(2);

      // Verify first fill (BTC Close Long)
      // positionSizeUsd = 0.1 BTC * $46000 = $4600
      expect(result[0]).toEqual({
        providerFillId: "0xclosed1-10570200",
        symbol: "BTC",
        side: "long",
        positionSizeUsd: 4600,
        closePrice: 46000,
        closedPnl: 50,
        closedAt: new Date(1759757700000),
        fee: 2.3,
      });

      // Verify second fill (ETH Close Short)
      // positionSizeUsd = 2 ETH * $2800 = $5600
      expect(result[1]).toEqual({
        providerFillId: "0xclosed2-10570201",
        symbol: "ETH",
        side: "short",
        positionSizeUsd: 5600,
        closePrice: 2800,
        closedPnl: -100,
        closedAt: new Date(1759757600000),
        fee: 2.8,
      });
    });

    it("should return empty array when no closed fills exist", async () => {
      // Only entry fills (closedPnl = 0)
      const entryOnlyFills = [
        {
          coin: "SOL",
          px: "100",
          sz: "10",
          side: "B" as const,
          time: 1759757500000,
          startPosition: "0",
          dir: "Open Long",
          closedPnl: "0",
          hash: "0xentry1",
          oid: 187731467400,
          crossed: true,
          fee: "1",
          tid: 10570300,
          feeToken: "USDC",
          cloid: null,
          twapId: null,
        },
      ];

      mockAxiosInstance.post.mockResolvedValueOnce({ data: entryOnlyFills });

      const result = await provider.getClosedPositionFills(
        "0xtest123",
        new Date(1759757400000),
        new Date(1759757800000),
      );

      expect(result).toHaveLength(0);
    });

    it("should return empty array when API returns no fills", async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: [] });

      const result = await provider.getClosedPositionFills(
        "0xtest123",
        new Date(1759757400000),
        new Date(1759757800000),
      );

      expect(result).toHaveLength(0);
    });

    it("should correctly parse direction for long closes", async () => {
      const longCloseFills = [
        {
          coin: "BTC",
          px: "50000",
          sz: "0.5",
          side: "A" as const,
          time: 1759757700000,
          startPosition: "0.5",
          dir: "Close Long",
          closedPnl: "100",
          hash: "0xlong1",
          oid: 187731467500,
          crossed: true,
          fee: "2.5",
          tid: 10570400,
          feeToken: "USDC",
          cloid: null,
          twapId: null,
        },
      ];

      mockAxiosInstance.post.mockResolvedValueOnce({ data: longCloseFills });

      const result = await provider.getClosedPositionFills(
        "0xtest123",
        new Date(1759757400000),
        new Date(1759757800000),
      );

      expect(result[0]?.side).toBe("long");
    });

    it("should correctly parse direction for short closes", async () => {
      const shortCloseFills = [
        {
          coin: "ETH",
          px: "3000",
          sz: "1",
          side: "B" as const,
          time: 1759757700000,
          startPosition: "-1",
          dir: "Close Short",
          closedPnl: "50",
          hash: "0xshort1",
          oid: 187731467600,
          crossed: true,
          fee: "1.5",
          tid: 10570500,
          feeToken: "USDC",
          cloid: null,
          twapId: null,
        },
      ];

      mockAxiosInstance.post.mockResolvedValueOnce({ data: shortCloseFills });

      const result = await provider.getClosedPositionFills(
        "0xtest123",
        new Date(1759757400000),
        new Date(1759757800000),
      );

      expect(result[0]?.side).toBe("short");
    });

    it("should pass correct time parameters to API", async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: [] });

      const since = new Date("2024-01-01T00:00:00Z");
      const until = new Date("2024-01-02T00:00:00Z");

      await provider.getClosedPositionFills("0xtest123", since, until);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/info", {
        type: "userFillsByTime",
        user: "0xtest123",
        startTime: since.getTime(),
        endTime: until.getTime(),
      });
    });

    it("should generate unique provider fill IDs using hash and tid", async () => {
      const fillsWithSameHash = [
        {
          coin: "BTC",
          px: "50000",
          sz: "0.1",
          side: "A" as const,
          time: 1759757700000,
          startPosition: "0.2",
          dir: "Close Long",
          closedPnl: "10",
          hash: "0xsamehash",
          oid: 187731467700,
          crossed: true,
          fee: "2.5",
          tid: 10570600, // Different tid
          feeToken: "USDC",
          cloid: null,
          twapId: null,
        },
        {
          coin: "BTC",
          px: "50100",
          sz: "0.1",
          side: "A" as const,
          time: 1759757701000,
          startPosition: "0.1",
          dir: "Close Long",
          closedPnl: "11",
          hash: "0xsamehash", // Same hash
          oid: 187731467701,
          crossed: true,
          fee: "2.51",
          tid: 10570601, // Different tid
          feeToken: "USDC",
          cloid: null,
          twapId: null,
        },
      ];

      mockAxiosInstance.post.mockResolvedValueOnce({ data: fillsWithSameHash });

      const result = await provider.getClosedPositionFills(
        "0xtest123",
        new Date(1759757400000),
        new Date(1759757800000),
      );

      // Both fills should have unique IDs due to different tid values
      expect(result[0]?.providerFillId).toBe("0xsamehash-10570600");
      expect(result[1]?.providerFillId).toBe("0xsamehash-10570601");
      expect(result[0]?.providerFillId).not.toBe(result[1]?.providerFillId);
    });
  });
});
