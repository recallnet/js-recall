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
} from "@/services/providers/symphony-perps.provider.js";

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
          winRate: 60,
          bestTrade: 250,
          worstTrade: -50,
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
        winRate: 60,
        openPositionsCount: 2,
        closedPositionsCount: 23,
        liquidatedPositionsCount: 0,
        roi: 30.1,
        roiPercent: 30.1,
        bestTrade: 250,
        worstTrade: -50,
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
      expect(result.winRate).toBeUndefined();
      expect(result.bestTrade).toBeUndefined();
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
      expect(elapsed).toBeGreaterThanOrEqual(100);
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
