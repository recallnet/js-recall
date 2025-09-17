import axios, { AxiosError, AxiosInstance } from "axios";
import {
  MockedFunction,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  SymphonyPerpsProvider,
  SymphonyPositionResponse,
  SymphonyTransferResponse,
} from "@/services/providers/perps/symphony-perps.provider.js";

// Mock axios
vi.mock("axios");

// Mock logger to avoid console noise in tests
vi.mock("@/lib/logger.js", () => ({
  serviceLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Type for mocking axios instance
type MockAxiosInstance = {
  get: MockedFunction<AxiosInstance["get"]>;
  defaults: { baseURL: string };
};

describe("SymphonyPerpsProvider", () => {
  let provider: SymphonyPerpsProvider;
  let mockAxiosInstance: MockAxiosInstance;

  // Sample test data matching Symphony's actual response format
  const samplePositionResponse: SymphonyPositionResponse = {
    success: true,
    data: {
      userAddress: "0xtest123",
      accountSummary: {
        totalEquity: 650.5,
        initialCapital: 500,
        totalUnrealizedPnl: 50.5,
        totalRealizedPnl: 100,
        totalPnl: 150.5,
        totalFeesPaid: 10.25,
        availableBalance: 450.25,
        marginUsed: 200.25,
        totalVolume: 5000,
        totalTrades: 25,
        accountStatus: "active",
        openPositionsCount: 2,
        closedPositionsCount: 23,
        liquidatedPositionsCount: 0,
        performance: {
          roi: 30.1,
          roiPercent: 30.1,
          totalTrades: 25,
          averageTradeSize: 200,
        },
      },
      openPositions: [
        {
          protocolPositionHash: "0xprotocol123",
          symphonyPositionHash: "0xsymphony456",
          userAddress: "0xtest123",
          isLong: true,
          leverage: 10,
          positionSize: 1000,
          entryPrice: 45000,
          tpPrice: 50000,
          slPrice: 43000,
          currentPrice: 46000,
          liquidationPrice: 40000,
          collateralAmount: 100,
          pnlPercentage: 2.22,
          pnlUSDValue: 22.2,
          asset: "BTC",
          createdTimeStamp: "2025-01-15T10:00:00Z",
          lastUpdatedTimestamp: "2025-01-15T12:00:00Z",
          status: "Open",
        },
      ],
      lastUpdated: "2025-01-15T12:00:00Z",
      cacheExpiresAt: "2025-01-15T12:05:00Z",
    },
    processingTime: 150,
  };

  const sampleTransferResponse: SymphonyTransferResponse = {
    success: true,
    count: 2,
    successful: [42161, 137],
    failed: [],
    transfers: [
      {
        type: "deposit",
        amount: 100,
        asset: "USDC",
        from: "0xfrom123",
        to: "0xto456",
        timestamp: "2025-01-14T10:00:00Z",
        txHash: "0xtxhash123",
        chainId: 42161,
      },
      {
        type: "withdraw",
        amount: 50,
        asset: "USDC",
        from: "0xto456",
        to: "0xfrom123",
        timestamp: "2025-01-13T10:00:00Z",
        txHash: "0xtxhash456",
        chainId: 137,
      },
    ],
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock axios.create to return a mock instance
    mockAxiosInstance = {
      get: vi.fn() as MockedFunction<AxiosInstance["get"]>,
      defaults: { baseURL: "" },
    };

    vi.mocked(axios.create).mockReturnValue(
      mockAxiosInstance as unknown as AxiosInstance,
    );

    // By default, isAxiosError returns false
    vi.mocked(axios.isAxiosError).mockReturnValue(false);

    // Create provider instance
    provider = new SymphonyPerpsProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with default URL from config", () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: "https://api.symphony.finance",
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    it("should initialize with custom URL when provided", () => {
      const customUrl = "https://custom.symphony.api";
      new SymphonyPerpsProvider(customUrl);

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: customUrl,
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
        },
      });
    });
  });

  describe("isHealthy", () => {
    it("should return true when API responds with 200", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: {},
      });

      const result = await provider.isHealthy();

      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/agent/all-positions",
        {
          params: { userAddress: "0x0000000000000000000000000000000000000001" },
          timeout: 5000,
          validateStatus: expect.any(Function),
        },
      );
    });

    it("should return true when API responds with 404 (address not found)", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 404,
        data: { error: "Address not found" },
      });

      const result = await provider.isHealthy();

      expect(result).toBe(true);
    });

    it("should return false when API responds with 5xx error", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 500,
        data: { error: "Internal server error" },
      });

      const result = await provider.isHealthy();

      expect(result).toBe(false);
    });

    it("should return false when request fails", async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe("getAccountSummary", () => {
    it("should fetch and transform account summary successfully", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: samplePositionResponse,
      });

      const result = await provider.getAccountSummary("0xtest123");

      expect(result).toEqual({
        totalEquity: 650.5,
        initialCapital: 500,
        availableBalance: 450.25,
        marginUsed: 200.25,
        totalPnl: 150.5,
        totalRealizedPnl: 100,
        totalUnrealizedPnl: 50.5,
        totalVolume: 5000,
        totalTrades: 25,
        totalFeesPaid: 10.25,
        openPositionsCount: 2,
        closedPositionsCount: 23,
        liquidatedPositionsCount: 0,
        roi: 30.1,
        roiPercent: 30.1,
        averageTradeSize: 200,
        accountStatus: "active",
        rawData: samplePositionResponse.data,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/agent/all-positions",
        {
          params: { userAddress: "0xtest123" },
        },
      );
    });

    it("should handle missing performance data gracefully", async () => {
      const responseWithoutPerformance = {
        ...samplePositionResponse,
        data: {
          ...samplePositionResponse.data,
          accountSummary: {
            ...samplePositionResponse.data.accountSummary,
            performance: undefined,
          },
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: responseWithoutPerformance,
      });

      const result = await provider.getAccountSummary("0xtest123");

      expect(result.roi).toBeUndefined();
      expect(result.roiPercent).toBeUndefined();
      expect(result.averageTradeSize).toBeUndefined();
    });

    it("should handle zero and negative values correctly", async () => {
      const zeroNegativeResponse = {
        ...samplePositionResponse,
        data: {
          ...samplePositionResponse.data,
          accountSummary: {
            ...samplePositionResponse.data.accountSummary,
            totalEquity: 0,
            totalPnl: -500,
            totalRealizedPnl: -300,
            totalUnrealizedPnl: -200,
            availableBalance: 0,
            marginUsed: 0,
            totalVolume: 0,
            totalTrades: 0,
            openPositionsCount: 0,
            performance: {
              roi: -100,
              roiPercent: -100,
              totalTrades: 0,
              averageTradeSize: 0,
            },
          },
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: zeroNegativeResponse,
      });

      const result = await provider.getAccountSummary("0xtest123");

      expect(result.totalEquity).toBe(0);
      expect(result.totalPnl).toBe(-500);
      expect(result.totalRealizedPnl).toBe(-300);
      expect(result.totalUnrealizedPnl).toBe(-200);
      expect(result.roi).toBe(-100);
      expect(result.roiPercent).toBe(-100);
    });

    it("should retry on transient failures", async () => {
      // First call fails with network error
      mockAxiosInstance.get.mockRejectedValueOnce(new Error("Network error"));
      // Second call succeeds
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: samplePositionResponse,
      });

      const result = await provider.getAccountSummary("0xtest123");

      expect(result).toBeDefined();
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it("should not retry on 4xx errors", async () => {
      const error = new Error("Bad request") as AxiosError;
      error.response = {
        status: 400,
        data: { error: "Invalid address" },
        statusText: "Bad Request",
        headers: {},
        config: undefined as never,
      };
      error.isAxiosError = true;

      // Mock isAxiosError to return true for this specific error
      vi.mocked(axios.isAxiosError).mockImplementation((err) => err === error);

      mockAxiosInstance.get.mockRejectedValueOnce(error);

      await expect(provider.getAccountSummary("0xinvalid")).rejects.toThrow();
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    it("should throw after max retries", async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error("Network error"));

      await expect(provider.getAccountSummary("0xtest123")).rejects.toThrow(
        "Network error",
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3); // MAX_RETRIES = 3
    });
  });

  describe("getPositions", () => {
    it("should fetch and transform open positions successfully", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: samplePositionResponse,
      });

      const result = await provider.getPositions("0xtest123");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        providerPositionId: "0xsymphony456",
        providerTradeId: "0xprotocol123",
        symbol: "BTC",
        side: "long",
        positionSizeUsd: 1000,
        leverage: 10,
        collateralAmount: 100,
        entryPrice: 45000,
        currentPrice: 46000,
        liquidationPrice: 40000,
        pnlUsdValue: 22.2,
        pnlPercentage: 2.22,
        status: "Open",
        openedAt: new Date("2025-01-15T10:00:00Z"),
        lastUpdatedAt: new Date("2025-01-15T12:00:00Z"),
        closedAt: undefined,
      });
    });

    it("should handle empty positions array", async () => {
      const emptyResponse = {
        ...samplePositionResponse,
        data: {
          ...samplePositionResponse.data,
          openPositions: [],
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: emptyResponse,
      });

      const result = await provider.getPositions("0xtest123");

      expect(result).toEqual([]);
    });

    it("should correctly transform short positions", async () => {
      const shortPositionResponse = {
        ...samplePositionResponse,
        data: {
          ...samplePositionResponse.data,
          openPositions: [
            {
              ...samplePositionResponse.data.openPositions[0],
              isLong: false,
              side: "short" as const,
            },
          ],
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: shortPositionResponse,
      });

      const result = await provider.getPositions("0xtest123");

      expect(result[0]?.side).toBe("short");
    });

    it("should handle null/undefined optional fields in positions", async () => {
      const positionWithNulls = {
        ...samplePositionResponse,
        data: {
          ...samplePositionResponse.data,
          openPositions: [
            {
              ...samplePositionResponse.data.openPositions[0],
              liquidationPrice: null,
              lastUpdatedTimestamp: undefined,
              closedAt: null,
              tpPrice: null,
              slPrice: null,
            },
          ],
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: positionWithNulls,
      });

      const result = await provider.getPositions("0xtest123");

      expect(result[0]?.liquidationPrice).toBeUndefined();
      expect(result[0]?.lastUpdatedAt).toBeUndefined();
      expect(result[0]?.closedAt).toBeUndefined();
    });

    it("should handle multiple positions correctly", async () => {
      const multiplePositionsResponse = {
        ...samplePositionResponse,
        data: {
          ...samplePositionResponse.data,
          openPositions: [
            samplePositionResponse.data.openPositions[0],
            {
              ...samplePositionResponse.data.openPositions[0],
              symphonyPositionHash: "0xsymphony789",
              protocolPositionHash: "0xprotocol456",
              asset: "ETH",
              isLong: false,
              positionSize: 2000,
              entryPrice: 3000,
              currentPrice: 2900,
              pnlUSDValue: -100,
              pnlPercentage: -5,
            },
          ],
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: multiplePositionsResponse,
      });

      const result = await provider.getPositions("0xtest123");

      expect(result).toHaveLength(2);
      expect(result[0]?.symbol).toBe("BTC");
      expect(result[1]?.symbol).toBe("ETH");
      expect(result[1]?.side).toBe("short");
      expect(result[1]?.pnlUsdValue).toBe(-100);
    });

    it("should handle unsuccessful response", async () => {
      const unsuccessfulResponse = {
        success: false,
        error: "Account not found",
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: unsuccessfulResponse,
      });

      await expect(provider.getPositions("0xtest123")).rejects.toThrow(
        "Symphony API returned unsuccessful response",
      );
    });
  });

  describe("getTransferHistory", () => {
    it("should fetch and transform transfer history successfully", async () => {
      const since = new Date("2025-01-10T00:00:00Z");

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: sampleTransferResponse,
      });

      const result = await provider.getTransferHistory("0xtest123", since);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: "deposit",
        amount: 100,
        asset: "USDC",
        from: "0xfrom123",
        to: "0xto456",
        timestamp: new Date("2025-01-14T10:00:00Z"),
        txHash: "0xtxhash123",
        chainId: 42161,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/utils/transfers", {
        params: {
          walletAddress: "0xtest123",
          since: since.toISOString(),
        },
      });
    });

    it("should handle unsuccessful transfer response gracefully", async () => {
      const unsuccessfulResponse = {
        success: false,
        error: "Transfers not available",
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: unsuccessfulResponse,
      });

      const result = await provider.getTransferHistory("0xtest123", new Date());

      // Should return empty array instead of throwing
      expect(result).toEqual([]);
    });

    it("should return empty array on error", async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.getTransferHistory("0xtest123", new Date());

      // Transfer history is optional, so it returns empty array on error
      expect(result).toEqual([]);
    });

    it("should handle empty transfers array", async () => {
      const emptyResponse = {
        success: true,
        count: 0,
        successful: [],
        failed: [],
        transfers: [],
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: emptyResponse,
      });

      const result = await provider.getTransferHistory("0xtest123", new Date());

      expect(result).toEqual([]);
    });
  });

  describe("rate limiting", () => {
    it("should not delay on first request", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: samplePositionResponse,
      });

      const startTime = Date.now();
      await provider.getAccountSummary("0xtest123");
      const elapsed = Date.now() - startTime;

      // First request should not have any delay
      expect(elapsed).toBeLessThan(50);
    });

    it("should enforce rate limiting between requests", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: samplePositionResponse,
      });

      const start = Date.now();

      // Make two quick successive calls
      await Promise.all([
        provider.getAccountSummary("0xtest1"),
        provider.getAccountSummary("0xtest2"),
      ]);

      const elapsed = Date.now() - start;

      // Second request should be delayed by at least MIN_REQUEST_INTERVAL (100ms)
      // Allow 5ms tolerance for timing precision issues in CI/test environments
      // This still validates rate limiting is working (without it, elapsed would be ~1-2ms)
      expect(elapsed).toBeGreaterThanOrEqual(95);
      expect(elapsed).toBeLessThan(150); // Ensure it's not delayed too much
    });
  });

  describe("error handling", () => {
    it("should handle axios errors with response data", async () => {
      const error = new Error("Request failed") as AxiosError;
      error.response = {
        status: 500,
        data: {
          error: "Internal server error",
          details: "Database unavailable",
        },
        statusText: "Internal Server Error",
        headers: {},
        config: undefined as never,
      };
      error.isAxiosError = true;

      // Mock isAxiosError to return true for this specific error
      vi.mocked(axios.isAxiosError).mockImplementation((err) => err === error);

      mockAxiosInstance.get.mockRejectedValueOnce(error);

      await expect(provider.getAccountSummary("0xtest123")).rejects.toThrow();
    });

    it("should handle non-axios errors", async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(
        new TypeError("Cannot read property"),
      );

      await expect(provider.getAccountSummary("0xtest123")).rejects.toThrow();
    });

    it("should handle timeout errors", async () => {
      const error = new Error("Timeout") as AxiosError;
      error.code = "ECONNABORTED";
      error.isAxiosError = true;

      // Mock isAxiosError to return true for this specific error
      vi.mocked(axios.isAxiosError).mockImplementation((err) => err === error);

      mockAxiosInstance.get.mockRejectedValueOnce(error);

      await expect(provider.getAccountSummary("0xtest123")).rejects.toThrow();
    });
  });

  describe("data validation", () => {
    it("should throw error for invalid required date field (createdTimeStamp)", async () => {
      const invalidDateResponse = {
        ...samplePositionResponse,
        data: {
          ...samplePositionResponse.data,
          openPositions: [
            {
              ...samplePositionResponse.data.openPositions[0],
              createdTimeStamp: "invalid-date",
            },
          ],
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: invalidDateResponse,
      });

      // Should throw error because createdTimeStamp is required
      await expect(provider.getPositions("0xtest123")).rejects.toThrow(
        "Invalid createdTimeStamp for position",
      );
    });

    it("should handle invalid optional date fields gracefully", async () => {
      const invalidOptionalDateResponse = {
        ...samplePositionResponse,
        data: {
          ...samplePositionResponse.data,
          openPositions: [
            {
              ...samplePositionResponse.data.openPositions[0],
              lastUpdatedTimestamp: "2025-13-45T25:99:99Z", // Invalid date
              closedAt: "not-a-date",
            },
          ],
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: invalidOptionalDateResponse,
      });

      const result = await provider.getPositions("0xtest123");

      // Optional date fields should be undefined if invalid (logged as warning)
      expect(result[0]?.lastUpdatedAt).toBeUndefined();
      expect(result[0]?.closedAt).toBeUndefined();
    });

    it("should default missing required fields to 0 and log warning", async () => {
      const missingFieldsResponse = {
        success: true,
        data: {
          userAddress: "0xtest123",
          accountSummary: {
            // Missing required fields like totalEquity, initialCapital, etc.
            totalEquity: undefined,
            initialCapital: null,
            totalPnl: null,
            totalRealizedPnl: undefined,
            totalUnrealizedPnl: null,
            availableBalance: undefined,
            marginUsed: null,
            totalVolume: undefined,
            totalTrades: null,
            totalFeesPaid: undefined,
            openPositionsCount: null,
            closedPositionsCount: undefined,
            liquidatedPositionsCount: null,
            accountStatus: null,
          },
          openPositions: [],
          lastUpdated: "2025-01-15T12:00:00Z",
          cacheExpiresAt: "2025-01-15T12:05:00Z",
        },
        processingTime: 150,
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: missingFieldsResponse,
      });

      const result = await provider.getAccountSummary("0xtest123");

      // Should default missing numeric fields to 0
      expect(result.totalEquity).toBe(0);
      expect(result.initialCapital).toBe(0);
      expect(result.totalPnl).toBe(0);
      expect(result.totalRealizedPnl).toBe(0);
      expect(result.totalUnrealizedPnl).toBe(0);
      expect(result.availableBalance).toBe(0);
      expect(result.marginUsed).toBe(0);
      expect(result.totalVolume).toBe(0);
      expect(result.totalTrades).toBe(0);
      expect(result.totalFeesPaid).toBe(0);
      expect(result.openPositionsCount).toBe(0);
      expect(result.closedPositionsCount).toBe(0);
      expect(result.liquidatedPositionsCount).toBe(0);

      // Should default missing status to 'unknown'
      expect(result.accountStatus).toBe("unknown");
    });

    it("should handle very large numbers correctly", async () => {
      const largeNumberResponse = {
        ...samplePositionResponse,
        data: {
          ...samplePositionResponse.data,
          accountSummary: {
            ...samplePositionResponse.data.accountSummary,
            totalEquity: 999999999999.99,
            totalVolume: 1e15,
            totalTrades: Number.MAX_SAFE_INTEGER,
          },
          openPositions: [
            {
              ...samplePositionResponse.data.openPositions[0],
              positionSize: 1e12,
              entryPrice: 0.00000001,
              currentPrice: 0.00000002,
            },
          ],
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: largeNumberResponse,
      });

      const result = await provider.getAccountSummary("0xtest123");

      expect(result.totalEquity).toBe(999999999999.99);
      expect(result.totalVolume).toBe(1e15);
      expect(result.totalTrades).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe("retry logic", () => {
    it("should use exponential backoff for retries", async () => {
      const startTimes: number[] = [];

      mockAxiosInstance.get.mockImplementation(async () => {
        startTimes.push(Date.now());
        throw new Error("Network error");
      });

      await expect(provider.getAccountSummary("0xtest123")).rejects.toThrow();

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);

      // Check delays between retries (should increase)
      if (
        startTimes.length >= 3 &&
        startTimes[0] !== undefined &&
        startTimes[1] !== undefined &&
        startTimes[2] !== undefined
      ) {
        const delay1 = startTimes[1] - startTimes[0];
        const delay2 = startTimes[2] - startTimes[1];

        // Second delay should be roughly double the first (exponential backoff)
        expect(delay2).toBeGreaterThan(delay1);
      }
    });

    it("should succeed on second retry attempt", async () => {
      let callCount = 0;

      mockAxiosInstance.get.mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          throw new Error("Transient error");
        }
        return { data: samplePositionResponse };
      });

      const result = await provider.getAccountSummary("0xtest123");

      expect(result).toBeDefined();
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    });
  });
});
