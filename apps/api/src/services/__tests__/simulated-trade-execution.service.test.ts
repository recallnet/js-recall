/**
 * Test Plan for SimulatedTradeExecutionService
 *
 * Target: apps/api/src/services/simulated-trade-execution.service.ts
 * Coverage Goal: >80% line coverage
 *
 * Test Scenarios:
 * 1. Success Cases (3 tests)
 *    - Successful standard trade execution
 *    - Successful burn transaction (toToken price = 0)
 *    - Trade at constraint boundaries (exactly at minimum thresholds)
 *
 * 2. Competition Validation (3 tests)
 *    - Competition ended (endDate in past)
 *    - Agent not registered in competition
 *    - Perps competition rejection
 *
 * 3. Balance and Portfolio Validation (3 tests)
 *    - Insufficient balance
 *    - Portfolio limit exceeded (maxTradePercentage)
 *    - Minimum trade amount violation
 *
 * 4. Trading Constraints (6 tests)
 *    - Pair too young (below minimumPairAgeHours)
 *    - Insufficient 24h volume
 *    - Insufficient liquidity
 *    - Insufficient FDV
 *    - Missing price data
 *    - Stablecoin exemption from constraints
 *
 * 5. Trade Rules (3 tests)
 *    - Cross-chain trading violation
 *    - Identical token trade (fromToken === toToken)
 *    - Empty reason validation
 *
 * 6. State Management (2 tests)
 *    - Balance cache update after trade
 *    - Trade cache update after trade
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SelectTrade } from "@recallnet/db/schema/trading/types";

import { features } from "@/config/index.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { BalanceService } from "@/services/balance.service.js";
import { CompetitionService } from "@/services/competition.service.js";
import { PriceTrackerService } from "@/services/price-tracker.service.js";
import { SimulatedTradeExecutionService } from "@/services/simulated-trade-execution.service.js";
import { TradeSimulatorService } from "@/services/trade-simulator.service.js";
import { BlockchainType, Competition, PriceReport } from "@/types/index.js";

// Mock dependencies
vi.mock("@/database/repositories/trade-repository.js", () => ({
  createTradeWithBalances: vi.fn(),
}));

vi.mock("@/database/repositories/trading-constraints-repository.js", () => ({
  findByCompetitionId: vi.fn(),
}));

vi.mock("@/lib/logger.js", () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    logger: mockLogger,
    createLogger: vi.fn(() => mockLogger),
    dbLogger: mockLogger,
    authLogger: mockLogger,
    apiLogger: mockLogger,
    tradeLogger: mockLogger,
    competitionLogger: mockLogger,
    competitionRewardsLogger: mockLogger,
    adminLogger: mockLogger,
    userLogger: mockLogger,
    agentLogger: mockLogger,
    priceLogger: mockLogger,
    balanceLogger: mockLogger,
    repositoryLogger: mockLogger,
    middlewareLogger: mockLogger,
    serviceLogger: mockLogger,
    configLogger: mockLogger,
    indexingLogger: mockLogger,
  };
});

vi.mock("@/services/providers/price/dexscreener.provider.js", () => ({
  DexScreenerProvider: vi.fn().mockImplementation(() => ({
    isStablecoin: vi.fn().mockReturnValue(false),
  })),
}));

describe("SimulatedTradeExecutionService", () => {
  let service: SimulatedTradeExecutionService;
  let mockCompetitionService: Partial<CompetitionService>;
  let mockTradeSimulatorService: Partial<TradeSimulatorService>;
  let mockBalanceService: Partial<BalanceService>;
  let mockPriceTrackerService: Partial<PriceTrackerService>;
  let mockCreateTradeWithBalances: ReturnType<typeof vi.fn>;
  let mockFindByCompetitionId: ReturnType<typeof vi.fn>;

  // Test data constants
  const testAgentId = "agent-123";
  const testCompetitionId = "comp-456";
  const testFromToken = "0xFromToken";
  const testToToken = "0xToToken";
  const testFromAmount = 100;
  const testReason = "Test trade reason";

  const mockActiveCompetition = {
    id: testCompetitionId,
    name: "Test Competition",
    description: "Test Description",
    type: "trading" as const,
    externalUrl: undefined,
    imageUrl: undefined,
    startDate: new Date(Date.now() - 86400000), // Yesterday
    endDate: new Date(Date.now() + 86400000), // Tomorrow
    votingStartDate: null,
    votingEndDate: null,
    joinStartDate: null,
    joinEndDate: null,
    maxParticipants: null,
    registeredParticipants: 0,
    status: "active" as const,
    crossChainTradingType: "allow",
    sandboxMode: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Competition;

  const mockFromPrice: PriceReport = {
    token: testFromToken,
    price: 10,
    timestamp: new Date(),
    symbol: "FROM",
    specificChain: "eth",
    chain: BlockchainType.EVM,
    pairCreatedAt: Date.now() - 86400000 * 8, // 8 days ago
    volume: { h24: 200000 },
    liquidity: { usd: 150000 },
    fdv: 2000000,
  };

  const mockToPrice: PriceReport = {
    token: testToToken,
    price: 5,
    timestamp: new Date(),
    symbol: "TO",
    specificChain: "eth",
    chain: BlockchainType.EVM,
    pairCreatedAt: Date.now() - 86400000 * 8, // 8 days ago
    volume: { h24: 200000 },
    liquidity: { usd: 150000 },
    fdv: 2000000,
  };

  const mockTradeResult = {
    trade: {
      id: "trade-789",
      timestamp: new Date(),
      fromToken: testFromToken,
      toToken: testToToken,
      fromAmount: testFromAmount,
      toAmount: 200,
      price: 2,
      toTokenSymbol: "TO",
      fromTokenSymbol: "FROM",
      tradeAmountUsd: 1000,
      success: true,
      agentId: testAgentId,
      competitionId: testCompetitionId,
      reason: testReason,
      fromChain: "evm",
      toChain: "evm",
      fromSpecificChain: "eth",
      toSpecificChain: "eth",
    } as SelectTrade,
    updatedBalances: {
      fromTokenBalance: 900,
      toTokenBalance: 200,
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import mocked functions
    const tradeRepo = await import(
      "@/database/repositories/trade-repository.js"
    );
    mockCreateTradeWithBalances = vi.mocked(tradeRepo.createTradeWithBalances);

    const constraintsRepo = await import(
      "@/database/repositories/trading-constraints-repository.js"
    );
    mockFindByCompetitionId = vi.mocked(constraintsRepo.findByCompetitionId);

    // Setup service mocks
    mockCompetitionService = {
      getCompetition: vi.fn().mockResolvedValue(mockActiveCompetition),
      isAgentActiveInCompetition: vi.fn().mockResolvedValue(true),
    };

    mockTradeSimulatorService = {
      calculatePortfolioValue: vi.fn().mockResolvedValue(50000),
      updateTradeCache: vi.fn(),
    };

    mockBalanceService = {
      getBalance: vi.fn().mockResolvedValue(1000),
      setBalanceCache: vi.fn(),
    };

    mockPriceTrackerService = {
      getPrice: vi.fn().mockImplementation((token: string) => {
        if (token === testFromToken) return Promise.resolve(mockFromPrice);
        if (token === testToToken) return Promise.resolve(mockToPrice);
        return Promise.resolve(null);
      }),
      determineChain: vi.fn().mockReturnValue(BlockchainType.EVM),
    };

    // Default: no custom constraints (will use defaults)
    mockFindByCompetitionId.mockResolvedValue(null);

    // Default: trade execution succeeds
    mockCreateTradeWithBalances.mockResolvedValue(mockTradeResult);

    // Create service instance
    service = new SimulatedTradeExecutionService(
      mockCompetitionService as CompetitionService,
      mockTradeSimulatorService as TradeSimulatorService,
      mockBalanceService as BalanceService,
      mockPriceTrackerService as PriceTrackerService,
    );
  });

  describe("Success Cases", () => {
    it("should execute a successful standard trade", async () => {
      const result = await service.executeTrade({
        agentId: testAgentId,
        competitionId: testCompetitionId,
        fromToken: testFromToken,
        toToken: testToToken,
        fromAmount: testFromAmount,
        reason: testReason,
      });

      expect(result).toEqual(mockTradeResult.trade);
      expect(mockCompetitionService.getCompetition).toHaveBeenCalledWith(
        testCompetitionId,
      );
      expect(
        mockCompetitionService.isAgentActiveInCompetition,
      ).toHaveBeenCalledWith(testCompetitionId, testAgentId);
      expect(mockBalanceService.getBalance).toHaveBeenCalledWith(
        testAgentId,
        testFromToken,
      );
      expect(mockPriceTrackerService.getPrice).toHaveBeenCalledTimes(2);
      expect(mockCreateTradeWithBalances).toHaveBeenCalled();
      expect(mockBalanceService.setBalanceCache).toHaveBeenCalledTimes(2);
      expect(mockTradeSimulatorService.updateTradeCache).toHaveBeenCalledWith(
        testAgentId,
        mockTradeResult.trade,
      );
    });

    it("should execute a successful burn transaction", async () => {
      const burnToPrice = { ...mockToPrice, price: 0 };
      vi.mocked(mockPriceTrackerService.getPrice!).mockImplementation(
        (token: string) => {
          if (token === testFromToken) return Promise.resolve(mockFromPrice);
          if (token === testToToken) return Promise.resolve(burnToPrice);
          return Promise.resolve(null);
        },
      );

      const burnResult = {
        ...mockTradeResult,
        trade: {
          ...mockTradeResult.trade,
          toAmount: 0,
          price: 0,
        },
        updatedBalances: {
          fromTokenBalance: 900,
          toTokenBalance: undefined,
        },
      };
      mockCreateTradeWithBalances.mockResolvedValue(burnResult);

      const result = await service.executeTrade({
        agentId: testAgentId,
        competitionId: testCompetitionId,
        fromToken: testFromToken,
        toToken: testToToken,
        fromAmount: testFromAmount,
        reason: testReason,
      });

      expect(result.toAmount).toBe(0);
      expect(result.price).toBe(0);
      expect(mockBalanceService.setBalanceCache).toHaveBeenCalledWith(
        testAgentId,
        testFromToken,
        900,
      );
      // Should not set cache for burn address
      expect(mockBalanceService.setBalanceCache).toHaveBeenCalledTimes(1);
    });

    it("should execute trade at constraint boundaries", async () => {
      // Set constraints to exact match with mock data
      const boundaryConstraints = {
        id: "tc-1",
        competitionId: testCompetitionId,
        minimumPairAgeHours: 168, // 7 days
        minimum24hVolumeUsd: 200000,
        minimumLiquidityUsd: 150000,
        minimumFdvUsd: 2000000,
        minTradesPerDay: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockFindByCompetitionId.mockResolvedValue(boundaryConstraints);

      // Adjust mock prices to be exactly at boundaries
      const boundaryToPrice = {
        ...mockToPrice,
        pairCreatedAt: Date.now() - 168 * 60 * 60 * 1000, // Exactly 168 hours
        volume: { h24: 200000 }, // Exactly at minimum
        liquidity: { usd: 150000 }, // Exactly at minimum
        fdv: 2000000, // Exactly at minimum
      };
      vi.mocked(mockPriceTrackerService.getPrice!).mockImplementation(
        (token: string) => {
          if (token === testFromToken) return Promise.resolve(mockFromPrice);
          if (token === testToToken) return Promise.resolve(boundaryToPrice);
          return Promise.resolve(null);
        },
      );

      const result = await service.executeTrade({
        agentId: testAgentId,
        competitionId: testCompetitionId,
        fromToken: testFromToken,
        toToken: testToToken,
        fromAmount: testFromAmount,
        reason: testReason,
      });

      expect(result).toEqual(mockTradeResult.trade);
    });
  });

  describe("Competition Validation", () => {
    it("should reject trade when competition has ended", async () => {
      const endedCompetition = {
        ...mockActiveCompetition,
        endDate: new Date(Date.now() - 86400000), // Yesterday
      } as Competition;
      vi.mocked(mockCompetitionService.getCompetition!).mockResolvedValue(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        endedCompetition as any,
      );

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow(ApiError);

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow("Competition has ended");
    });

    it("should reject trade when agent is not registered", async () => {
      vi.mocked(
        mockCompetitionService.isAgentActiveInCompetition!,
      ).mockResolvedValue(false);

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow(ApiError);

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow("is not registered for competition");
    });

    it("should reject trade for perpetual futures competitions", async () => {
      const perpsCompetition = {
        ...mockActiveCompetition,
        type: "perpetual_futures" as const,
      } as Competition;
      vi.mocked(mockCompetitionService.getCompetition!).mockResolvedValue(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        perpsCompetition as any,
      );

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow(ApiError);

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow("not available for perpetual futures competitions");
    });
  });

  describe("Balance and Portfolio Validation", () => {
    it("should reject trade with insufficient balance", async () => {
      vi.mocked(mockBalanceService.getBalance!).mockResolvedValue(50); // Less than fromAmount (100)

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow(ApiError);

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow("Insufficient balance");
    });

    it("should reject trade exceeding portfolio limit", async () => {
      // Portfolio value: 50000, maxTradePercentage: default from config
      // Trade value: 100 * 10 = 1000 USD
      // Set portfolio value low enough that 1000 USD exceeds maxTradePercentage
      const lowPortfolioValue = 500; // 1000 USD trade would be 200% of portfolio
      vi.mocked(
        mockTradeSimulatorService.calculatePortfolioValue!,
      ).mockResolvedValue(lowPortfolioValue);

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow(ApiError);

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow("Trade exceeds maximum size");
    });

    it("should reject trade below minimum amount", async () => {
      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: 0.0000001, // Below MIN_TRADE_AMOUNT (0.000001)
          reason: testReason,
        }),
      ).rejects.toThrow(ApiError);

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: 0.0000001,
          reason: testReason,
        }),
      ).rejects.toThrow("Trade amount too small");
    });
  });

  describe("Trading Constraints", () => {
    beforeEach(() => {
      // Set custom constraints for these tests
      const constraints = {
        id: "tc-1",
        competitionId: testCompetitionId,
        minimumPairAgeHours: 168, // 7 days
        minimum24hVolumeUsd: 200000,
        minimumLiquidityUsd: 150000,
        minimumFdvUsd: 2000000,
        minTradesPerDay: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockFindByCompetitionId.mockResolvedValue(constraints);
    });

    it("should reject trade when pair is too young", async () => {
      const youngToPrice = {
        ...mockToPrice,
        pairCreatedAt: Date.now() - 24 * 60 * 60 * 1000, // Only 1 day old
      };
      vi.mocked(mockPriceTrackerService.getPrice!).mockImplementation(
        (token: string) => {
          if (token === testFromToken) return Promise.resolve(mockFromPrice);
          if (token === testToToken) return Promise.resolve(youngToPrice);
          return Promise.resolve(null);
        },
      );

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow(ApiError);

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow("Token pair is too young");
    });

    it("should reject trade with insufficient 24h volume", async () => {
      const lowVolumeToPrice = {
        ...mockToPrice,
        volume: { h24: 50000 }, // Below minimum 200000
      };
      vi.mocked(mockPriceTrackerService.getPrice!).mockImplementation(
        (token: string) => {
          if (token === testFromToken) return Promise.resolve(mockFromPrice);
          if (token === testToToken) return Promise.resolve(lowVolumeToPrice);
          return Promise.resolve(null);
        },
      );

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow(ApiError);

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow("insufficient 24h volume");
    });

    it("should reject trade with insufficient liquidity", async () => {
      const lowLiquidityToPrice = {
        ...mockToPrice,
        liquidity: { usd: 50000 }, // Below minimum 150000
      };
      vi.mocked(mockPriceTrackerService.getPrice!).mockImplementation(
        (token: string) => {
          if (token === testFromToken) return Promise.resolve(mockFromPrice);
          if (token === testToToken)
            return Promise.resolve(lowLiquidityToPrice);
          return Promise.resolve(null);
        },
      );

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow(ApiError);

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow("insufficient liquidity");
    });

    it("should reject trade with insufficient FDV", async () => {
      const lowFdvToPrice = {
        ...mockToPrice,
        fdv: 500000, // Below minimum 2000000
      };
      vi.mocked(mockPriceTrackerService.getPrice!).mockImplementation(
        (token: string) => {
          if (token === testFromToken) return Promise.resolve(mockFromPrice);
          if (token === testToToken) return Promise.resolve(lowFdvToPrice);
          return Promise.resolve(null);
        },
      );

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow(ApiError);

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow("insufficient FDV");
    });

    it("should reject trade when price data is missing", async () => {
      vi.mocked(mockPriceTrackerService.getPrice!).mockImplementation(
        (token: string) => {
          if (token === testFromToken) return Promise.resolve(mockFromPrice);
          return Promise.resolve(null); // No price for toToken
        },
      );

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow(ApiError);

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow("Unable to determine price for tokens");
    });

    it("should allow stablecoin trades to bypass constraints", async () => {
      // Import DexScreenerProvider to mock isStablecoin
      const DexScreenerModule = await import(
        "@/services/providers/price/dexscreener.provider.js"
      );

      // Mock the instance method
      const mockDexScreenerInstance = {
        isStablecoin: vi.fn().mockReturnValue(true),
      };

      // Update the mock to return our instance
      vi.mocked(DexScreenerModule.DexScreenerProvider).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => mockDexScreenerInstance as any,
      );

      // Create new service with updated mock
      service = new SimulatedTradeExecutionService(
        mockCompetitionService as CompetitionService,
        mockTradeSimulatorService as TradeSimulatorService,
        mockBalanceService as BalanceService,
        mockPriceTrackerService as PriceTrackerService,
      );

      // Set toToken to have poor metrics that would normally fail
      const poorMetricsToPrice = {
        ...mockToPrice,
        pairCreatedAt: Date.now() - 1000, // Very young
        volume: { h24: 100 }, // Very low volume
        liquidity: { usd: 100 }, // Very low liquidity
        fdv: 1000, // Very low FDV
      };
      vi.mocked(mockPriceTrackerService.getPrice!).mockImplementation(
        (token: string) => {
          if (token === testFromToken) return Promise.resolve(mockFromPrice);
          if (token === testToToken) return Promise.resolve(poorMetricsToPrice);
          return Promise.resolve(null);
        },
      );

      // Should succeed because stablecoins are exempt
      const result = await service.executeTrade({
        agentId: testAgentId,
        competitionId: testCompetitionId,
        fromToken: testFromToken,
        toToken: testToToken,
        fromAmount: testFromAmount,
        reason: testReason,
      });

      expect(result).toEqual(mockTradeResult.trade);
    });
  });

  describe("Trade Rules", () => {
    it("should reject identical token trades", async () => {
      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testFromToken, // Same as fromToken
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow(ApiError);

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testFromToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow("Cannot trade between identical tokens");
    });

    it("should reject trade without reason", async () => {
      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: "", // Empty reason
        }),
      ).rejects.toThrow(ApiError);

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: "",
        }),
      ).rejects.toThrow("Trade reason is required");
    });

    it("should validate cross-chain trading rules when disabled", async () => {
      // Mock features to disable cross-chain trading
      const originalCrossChainType = features.CROSS_CHAIN_TRADING_TYPE;
      features.CROSS_CHAIN_TRADING_TYPE = "disallowXParent";

      // Set different chains for from and to tokens
      const evmFromPrice = { ...mockFromPrice, chain: BlockchainType.EVM };
      const svmToPrice = { ...mockToPrice, chain: BlockchainType.SVM };

      vi.mocked(mockPriceTrackerService.getPrice!).mockImplementation(
        (token: string) => {
          if (token === testFromToken) return Promise.resolve(evmFromPrice);
          if (token === testToToken) return Promise.resolve(svmToPrice);
          return Promise.resolve(null);
        },
      );

      vi.mocked(mockPriceTrackerService.determineChain!).mockImplementation(
        (token: string) => {
          if (token === testFromToken) return BlockchainType.EVM;
          if (token === testToToken) return BlockchainType.SVM;
          return BlockchainType.EVM;
        },
      );

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow(ApiError);

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow("Cross-parent chain trading is disabled");

      // Restore original value
      features.CROSS_CHAIN_TRADING_TYPE = originalCrossChainType;
    });
  });

  describe("State Management", () => {
    it("should update balance cache after successful trade", async () => {
      await service.executeTrade({
        agentId: testAgentId,
        competitionId: testCompetitionId,
        fromToken: testFromToken,
        toToken: testToToken,
        fromAmount: testFromAmount,
        reason: testReason,
      });

      expect(mockBalanceService.setBalanceCache).toHaveBeenCalledWith(
        testAgentId,
        testFromToken,
        mockTradeResult.updatedBalances.fromTokenBalance,
      );
      expect(mockBalanceService.setBalanceCache).toHaveBeenCalledWith(
        testAgentId,
        testToToken,
        mockTradeResult.updatedBalances.toTokenBalance,
      );
    });

    it("should update trade cache after successful trade", async () => {
      await service.executeTrade({
        agentId: testAgentId,
        competitionId: testCompetitionId,
        fromToken: testFromToken,
        toToken: testToToken,
        fromAmount: testFromAmount,
        reason: testReason,
      });

      expect(mockTradeSimulatorService.updateTradeCache).toHaveBeenCalledWith(
        testAgentId,
        mockTradeResult.trade,
      );
    });
  });

  describe("Competition Not Found", () => {
    it("should reject trade when competition does not exist", async () => {
      vi.mocked(mockCompetitionService.getCompetition!).mockResolvedValue(
        undefined,
      );

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow(ApiError);

      await expect(
        service.executeTrade({
          agentId: testAgentId,
          competitionId: testCompetitionId,
          fromToken: testFromToken,
          toToken: testToToken,
          fromAmount: testFromAmount,
          reason: testReason,
        }),
      ).rejects.toThrow("Competition not found");
    });
  });
});
