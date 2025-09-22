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
import { BalanceService } from "@/services/balance.service.js";
import { CompetitionService } from "@/services/competition.service.js";
import { PortfolioSnapshotterService } from "@/services/portfolio-snapshotter.service.js";
import { PriceTrackerService } from "@/services/price-tracker.service.js";
import { TradeExecutionService } from "@/services/trade-execution.service.js";
import { TradeSimulatorService } from "@/services/trade-simulator.service.js";
import { BlockchainType, PriceReport } from "@/types/index.js";

// Mock dependencies for unit tests
vi.mock("@/services/balance.service.js");
vi.mock("@/services/competition.service.js");
vi.mock("@/services/portfolio-snapshotter.service.js");
vi.mock("@/services/price-tracker.service.js");
vi.mock("@/services/trade-simulator.service.js");

describe("TradeExecutionService - Constraints Tests", () => {
  let tradeExecutionService: TradeExecutionService;
  let mockCompetitionService: {
    getCompetition: ReturnType<typeof vi.fn>;
    isAgentActiveInCompetition: ReturnType<typeof vi.fn>;
  };
  let mockTradeSimulatorService: {
    calculatePortfolioValue: ReturnType<typeof vi.fn>;
  };
  let mockBalanceService: {
    getBalance: ReturnType<typeof vi.fn>;
  };
  let mockPriceTrackerService: {
    getPrice: ReturnType<typeof vi.fn>;
    determineChain: ReturnType<typeof vi.fn>;
  };
  let mockPortfolioSnapshotterService: {
    takePortfolioSnapshotForAgent: ReturnType<typeof vi.fn>;
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

    // Mock CompetitionService
    mockCompetitionService = {
      getCompetition: vi.fn(),
      isAgentActiveInCompetition: vi.fn(),
    };

    // Mock TradeSimulatorService
    mockTradeSimulatorService = {
      calculatePortfolioValue: vi.fn(),
    };

    // Mock BalanceService
    mockBalanceService = {
      getBalance: vi.fn(),
    };

    // Mock PriceTrackerService
    mockPriceTrackerService = {
      getPrice: vi.fn(),
      determineChain: vi.fn(),
    };

    // Mock PortfolioSnapshotterService
    mockPortfolioSnapshotterService = {
      takePortfolioSnapshotForAgent: vi.fn(),
    };

    // Create TradeExecutionService instance with mocked dependencies
    tradeExecutionService = new TradeExecutionService(
      mockCompetitionService as unknown as CompetitionService,
      mockTradeSimulatorService as unknown as TradeSimulatorService,
      mockBalanceService as unknown as BalanceService,
      mockPriceTrackerService as unknown as PriceTrackerService,
      mockPortfolioSnapshotterService as unknown as PortfolioSnapshotterService,
    );
  });

  describe("validateTradingConstraints", () => {
    it("should reject trades for tokens that are too young", async () => {
      // Mock competition and agent validation to pass
      mockCompetitionService.getCompetition.mockResolvedValue({
        id: "comp-1",
        name: "Test Competition",
        endDate: null,
      });
      mockCompetitionService.isAgentActiveInCompetition.mockResolvedValue(true);

      // Mock balance validation
      mockBalanceService.getBalance.mockResolvedValue(1000);
      mockTradeSimulatorService.calculatePortfolioValue.mockResolvedValue(
        10000,
      );

      // Mock price tracker
      mockPriceTrackerService.determineChain.mockReturnValue(
        BlockchainType.EVM,
      );

      const validFromPrice: PriceReport = {
        token: "0x1111111111111111111111111111111111111111",
        symbol: "TOKEN1",
        price: 1.5,
        chain: BlockchainType.EVM,
        specificChain: "eth",
        timestamp: new Date(),
        pairCreatedAt: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
        fdv: 5000000,
        volume: { h24: 100000 },
        liquidity: { usd: 50000 },
      };

      const invalidToPrice: PriceReport = {
        token: "0x2222222222222222222222222222222222222222",
        symbol: "TOKEN2",
        price: 2.0,
        chain: BlockchainType.EVM,
        specificChain: "eth",
        timestamp: new Date(),
        pairCreatedAt: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago (too young)
        fdv: 1000000,
        volume: { h24: 50000 },
        liquidity: { usd: 25000 },
      };

      mockPriceTrackerService.getPrice
        .mockResolvedValueOnce(validFromPrice)
        .mockResolvedValueOnce(invalidToPrice);

      await expect(
        tradeExecutionService.executeTrade(
          "agent-1",
          "comp-1",
          "0x1111111111111111111111111111111111111111",
          "0x2222222222222222222222222222222222222222",
          100,
          "Test trade",
        ),
      ).rejects.toThrow("Token pair is too young");
    });

    it("should skip constraints for burn tokens (price = 0)", async () => {
      // Mock competition and agent validation to pass
      mockCompetitionService.getCompetition.mockResolvedValue({
        id: "comp-1",
        name: "Test Competition",
        endDate: null,
      });
      mockCompetitionService.isAgentActiveInCompetition.mockResolvedValue(true);

      // Mock balance validation
      mockBalanceService.getBalance.mockResolvedValue(1000);
      mockTradeSimulatorService.calculatePortfolioValue.mockResolvedValue(
        10000,
      );

      // Mock price tracker
      mockPriceTrackerService.determineChain.mockReturnValue(
        BlockchainType.EVM,
      );

      const validFromPrice: PriceReport = {
        token: "0x1111111111111111111111111111111111111111",
        symbol: "TOKEN1",
        price: 1.5,
        chain: BlockchainType.EVM,
        specificChain: "eth",
        timestamp: new Date(),
        pairCreatedAt: Date.now() - 1000 * 60 * 60 * 2,
        fdv: 5000000,
        volume: { h24: 100000 },
        liquidity: { usd: 50000 },
      };

      const burnTokenPrice: PriceReport = {
        token: "0x0000000000000000000000000000000000000000",
        symbol: "BURN",
        price: 0, // Burn token
        chain: BlockchainType.EVM,
        specificChain: "eth",
        timestamp: new Date(),
        pairCreatedAt: Date.now() - 1000 * 60 * 60 * 1, // 1 hour ago (would be too young normally)
        fdv: undefined,
        volume: undefined,
        liquidity: undefined,
      };

      mockPriceTrackerService.getPrice
        .mockResolvedValueOnce(validFromPrice)
        .mockResolvedValueOnce(burnTokenPrice);

      // Mock the trade creation to avoid database calls
      vi.doMock("@/database/repositories/trade-repository.js", () => ({
        createTradeWithBalances: vi.fn().mockResolvedValue({
          trade: { id: "trade-1" },
          updatedBalances: { fromTokenBalance: 900, toTokenBalance: 0 },
        }),
      }));

      // This should not throw an error because burn tokens skip constraint validation
      const result = await tradeExecutionService.executeTrade(
        "agent-1",
        "comp-1",
        "0x1111111111111111111111111111111111111111",
        "0x0000000000000000000000000000000000000000",
        100,
        "Burn trade",
      );

      expect(result).toBeDefined();
      expect(
        mockPortfolioSnapshotterService.takePortfolioSnapshotForAgent,
      ).toHaveBeenCalled();
    });
  });
});
