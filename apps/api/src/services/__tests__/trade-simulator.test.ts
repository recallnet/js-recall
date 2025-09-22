import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { serviceLogger } from "@/lib/logger.js";
import { TradeSimulatorService } from "@/services/trade-simulator.service.js";
import { BlockchainType, PriceReport } from "@/types/index.js";

// Mock dependencies for unit tests
vi.mock("@/services/balance.service.js");
vi.mock("@/services/price-tracker.service.js");
vi.mock("@/database/repositories/trade-repository.js");

describe("TradeSimulatorService", () => {
  let tradeSimulator: TradeSimulatorService;
  let mockBalanceService: {
    getAllBalances: ReturnType<typeof vi.fn>;
    getBulkBalances: ReturnType<typeof vi.fn>;
  };
  let mockPriceTracker: {
    getPrice: ReturnType<typeof vi.fn>;
    getBulkPrices: ReturnType<typeof vi.fn>;
    determineChain: ReturnType<typeof vi.fn>;
  };

  beforeAll(() => {
    // Silence debug logs during tests
    vi.spyOn(serviceLogger, "debug").mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockBalanceService = {
      getAllBalances: vi.fn(),
      getBulkBalances: vi.fn(),
    };

    mockPriceTracker = {
      getPrice: vi.fn(),
      getBulkPrices: vi.fn(),
      determineChain: vi.fn(),
    };

    // Create TradeSimulator instance with mocked dependencies
    tradeSimulator = new TradeSimulatorService(
      mockBalanceService,
      mockPriceTracker,
    );
  });

  describe("calculatePortfolioValue", () => {
    it("should calculate portfolio value correctly", async () => {
      const mockBalances = [
        {
          tokenAddress: "0x1111111111111111111111111111111111111111",
          amount: 100,
          agentId: "agent1",
        },
        {
          tokenAddress: "0x2222222222222222222222222222222222222222",
          amount: 50,
          agentId: "agent1",
        },
      ];

      const mockPriceReports = [
        { price: 1.5, symbol: "TOKEN1" },
        { price: 2.0, symbol: "TOKEN2" },
      ];

      mockBalanceService.getAllBalances.mockResolvedValue(mockBalances);
      mockPriceTracker.getPrice
        .mockResolvedValueOnce(mockPriceReports[0])
        .mockResolvedValueOnce(mockPriceReports[1]);

      const portfolioValue =
        await tradeSimulator.calculatePortfolioValue("agent1");

      expect(portfolioValue).toBe(250); // 100 * 1.5 + 50 * 2.0
      expect(mockBalanceService.getAllBalances).toHaveBeenCalledWith("agent1");
      expect(mockPriceTracker.getPrice).toHaveBeenCalledTimes(2);
    });

    it("should handle tokens without price data gracefully", async () => {
      const mockBalances = [
        {
          tokenAddress: "0x1111111111111111111111111111111111111111",
          amount: 100,
          agentId: "agent1",
        },
        {
          tokenAddress: "0x2222222222222222222222222222222222222222",
          amount: 50,
          agentId: "agent1",
        },
      ];

      mockBalanceService.getAllBalances.mockResolvedValue(mockBalances);
      mockPriceTracker.getPrice
        .mockResolvedValueOnce({ price: 1.5, symbol: "TOKEN1" })
        .mockRejectedValueOnce(new Error("Price not found"));

      const portfolioValue =
        await tradeSimulator.calculatePortfolioValue("agent1");

      expect(portfolioValue).toBe(150); // Only first token counted
    });
  });

  describe("calculateBulkPortfolioValues", () => {
    it("should calculate bulk portfolio values efficiently", async () => {
      const agentIds = ["agent1", "agent2"];
      const mockBalances = [
        {
          tokenAddress: "0x1111111111111111111111111111111111111111",
          amount: 100,
          agentId: "agent1",
        },
        {
          tokenAddress: "0x2222222222222222222222222222222222222222",
          amount: 50,
          agentId: "agent2",
        },
      ];

      const mockPriceMap = new Map([
        ["0x1111111111111111111111111111111111111111", { price: 1.5 }],
        ["0x2222222222222222222222222222222222222222", { price: 2.0 }],
      ]);

      mockBalanceService.getBulkBalances.mockResolvedValue(mockBalances);
      mockPriceTracker.getBulkPrices.mockResolvedValue(mockPriceMap);

      const portfolioValues =
        await tradeSimulator.calculateBulkPortfolioValues(agentIds);

      expect(portfolioValues.get("agent1")).toBe(150); // 100 * 1.5
      expect(portfolioValues.get("agent2")).toBe(100); // 50 * 2.0
      expect(mockBalanceService.getBulkBalances).toHaveBeenCalledWith(agentIds);
    });

    it("should fallback to individual calculations on error", async () => {
      const agentIds = ["agent1", "agent2"];

      mockBalanceService.getBulkBalances.mockRejectedValue(
        new Error("DB error"),
      );

      // Mock individual portfolio calculations
      vi.spyOn(tradeSimulator, "calculatePortfolioValue")
        .mockResolvedValueOnce(150)
        .mockResolvedValueOnce(100);

      const portfolioValues =
        await tradeSimulator.calculateBulkPortfolioValues(agentIds);

      expect(portfolioValues.get("agent1")).toBe(150);
      expect(portfolioValues.get("agent2")).toBe(100);
    });
  });

  describe("getTradeQuote", () => {
    it("should generate trade quote correctly", async () => {
      const params = {
        fromToken: "0x1111111111111111111111111111111111111111",
        toToken: "0x2222222222222222222222222222222222222222",
        amount: 100,
      };

      const fromPrice: PriceReport = {
        token: params.fromToken,
        price: 1.5,
        symbol: "TOKEN1",
        chain: BlockchainType.EVM,
        specificChain: "eth",
        timestamp: new Date(),
      };

      const toPrice: PriceReport = {
        token: params.toToken,
        price: 2.0,
        symbol: "TOKEN2",
        chain: BlockchainType.EVM,
        specificChain: "eth",
        timestamp: new Date(),
      };

      mockPriceTracker.getPrice
        .mockResolvedValueOnce(fromPrice)
        .mockResolvedValueOnce(toPrice);
      mockPriceTracker.determineChain
        .mockReturnValueOnce(BlockchainType.EVM)
        .mockReturnValueOnce(BlockchainType.EVM);

      const quote = await tradeSimulator.getTradeQuote(params);

      expect(quote.fromToken).toBe(params.fromToken);
      expect(quote.toToken).toBe(params.toToken);
      expect(quote.fromAmount).toBe(100);
      expect(quote.prices.fromToken).toBe(1.5);
      expect(quote.prices.toToken).toBe(2.0);
      expect(quote.symbols.fromTokenSymbol).toBe("TOKEN1");
      expect(quote.symbols.toTokenSymbol).toBe("TOKEN2");
    });

    it("should throw error for missing price data", async () => {
      const params = {
        fromToken: "0x1111111111111111111111111111111111111111",
        toToken: "0x2222222222222222222222222222222222222222",
        amount: 100,
      };

      mockPriceTracker.getPrice
        .mockResolvedValueOnce({ price: 1.5 })
        .mockResolvedValueOnce(null); // Missing price

      await expect(tradeSimulator.getTradeQuote(params)).rejects.toThrow(
        "Unable to determine price for tokens",
      );
    });
  });

  describe("isHealthy", () => {
    it("should return true when healthy", async () => {
      // Mock count function to succeed
      vi.doMock("@/database/repositories/trade-repository.js", () => ({
        count: vi.fn().mockResolvedValue(100),
      }));

      const isHealthy = await tradeSimulator.isHealthy();
      expect(isHealthy).toBe(true);
    });
  });
});
