import { randomUUID } from "crypto";
import { Logger } from "pino";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { PaperTradingConfigRepository } from "@recallnet/db/repositories/paper-trading-config";
import { TradeRepository } from "@recallnet/db/repositories/trade";

import { BalanceService } from "../balance.service.js";
import { CompetitionService } from "../competition.service.js";
import { specificChainTokens } from "../lib/config-utils.js";
import {
  PriceTrackerService,
  PriceTrackerServiceConfig,
} from "../price-tracker.service.js";
import { MultiChainProvider } from "../providers/multi-chain.provider.js";
import { DexScreenerProvider } from "../providers/price/dexscreener.provider.js";
import { SimulatedTradeExecutionService } from "../simulated-trade-execution.service.js";
import { TradeSimulatorService } from "../trade-simulator.service.js";
import { TradingConstraintsService } from "../trading-constraints.service.js";
import {
  BlockchainType,
  PriceReport,
  SpecificChainTokens,
} from "../types/index.js";

// Mock dependencies for unit tests
vi.mock("../balance.service.js");
vi.mock("../competition.service.js");
vi.mock("../price-tracker.service.js");
vi.mock("../trade-simulator.service.js");

// Trading constraint constants (hardcoded for testing)
const MINIMUM_PAIR_AGE_HOURS = 168; // 7 days
const MINIMUM_24H_VOLUME_USD = 100000; // $100k
const MINIMUM_LIQUIDITY_USD = 500000; // $500k
const MINIMUM_FDV_USD = 1000000; // $1M

// Default constraints object for testing
const DEFAULT_CONSTRAINTS = {
  minimumPairAgeHours: MINIMUM_PAIR_AGE_HOURS,
  minimum24hVolumeUsd: MINIMUM_24H_VOLUME_USD,
  minimumLiquidityUsd: MINIMUM_LIQUIDITY_USD,
  minimumFdvUsd: MINIMUM_FDV_USD,
};

describe("SimulatedTradeExecutionService - Trading Constraints", () => {
  // Shared logger for all tests
  let mockLogger: Logger;

  beforeAll(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger;
  });

  describe("Unit Tests", () => {
    let tradeExecutor: SimulatedTradeExecutionService;
    let mockBalanceService: {
      getBalance: ReturnType<typeof vi.fn>;
      setBalanceCache: ReturnType<typeof vi.fn>;
    };
    let mockCompetitionService: {
      getCompetition: ReturnType<typeof vi.fn>;
      isAgentActiveInCompetition: ReturnType<typeof vi.fn>;
    };
    let mockPriceTracker: {
      determineChain: ReturnType<typeof vi.fn>;
      getPrice: ReturnType<typeof vi.fn>;
    };
    let mockTradeRepo: {
      create: ReturnType<typeof vi.fn>;
    };
    let mockTradingConstraintsService: {
      getConstraintsWithDefaults: ReturnType<typeof vi.fn>;
    };
    let mockDexScreenerProvider: {
      getTokenPairData: ReturnType<typeof vi.fn>;
      isStablecoin: ReturnType<typeof vi.fn>;
    };
    let mockPaperTradingConfigRepo: {
      findByCompetitionId: ReturnType<typeof vi.fn>;
    };
    let mockTradeSimulatorService: {
      calculatePortfolioValue: ReturnType<typeof vi.fn>;
    };
    let mockConfig: {
      specificChainTokens: SpecificChainTokens;
      maxTradePercentage: number;
      tradingConstraints: {
        defaultMinimumPairAgeHours: number;
        defaultMinimum24hVolumeUsd: number;
        defaultMinimumLiquidityUsd: number;
        defaultMinimumFdvUsd: number;
      };
    };
    let mockFeatures: {
      enableAdvancedValidation: boolean;
      CROSS_CHAIN_TRADING_TYPE: "allow" | "disallowAll" | "disallowXParent";
    };

    // Mock constraints used across all tests
    const mockConstraints = {
      minimumPairAgeHours: MINIMUM_PAIR_AGE_HOURS,
      minimum24hVolumeUsd: MINIMUM_24H_VOLUME_USD,
      minimumLiquidityUsd: MINIMUM_LIQUIDITY_USD,
      minimumFdvUsd: MINIMUM_FDV_USD,
    };

    beforeEach(() => {
      // Create mock implementations
      mockBalanceService = {
        getBalance: vi.fn(),
        setBalanceCache: vi.fn(),
      };

      mockCompetitionService = {
        getCompetition: vi.fn(),
        isAgentActiveInCompetition: vi.fn(),
      };

      mockPriceTracker = {
        determineChain: vi.fn(),
        getPrice: vi.fn(),
      };

      mockTradeSimulatorService = {
        calculatePortfolioValue: vi.fn(),
      };

      mockTradeRepo = {
        create: vi.fn(),
      };

      mockTradingConstraintsService = {
        getConstraintsWithDefaults: vi.fn(),
      };

      mockDexScreenerProvider = {
        getTokenPairData: vi.fn(),
        isStablecoin: vi.fn().mockImplementation((symbol: string) => {
          // Return true for stablecoins and SOL to exempt them from FDV checks
          return symbol === "USDC" || symbol === "SOL";
        }),
      };

      mockPaperTradingConfigRepo = {
        findByCompetitionId: vi.fn().mockResolvedValue(null),
      };

      mockConfig = {
        specificChainTokens,
        maxTradePercentage: 25,
        tradingConstraints: {
          defaultMinimumPairAgeHours: MINIMUM_PAIR_AGE_HOURS,
          defaultMinimum24hVolumeUsd: MINIMUM_24H_VOLUME_USD,
          defaultMinimumLiquidityUsd: MINIMUM_LIQUIDITY_USD,
          defaultMinimumFdvUsd: MINIMUM_FDV_USD,
        },
      };

      mockFeatures = {
        enableAdvancedValidation: true,
        CROSS_CHAIN_TRADING_TYPE: "allow",
      };

      mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as unknown as Logger;

      // Create SimulatedTradeExecutionService instance with mocked dependencies
      tradeExecutor = new SimulatedTradeExecutionService(
        mockCompetitionService as unknown as CompetitionService,
        mockTradeSimulatorService as unknown as TradeSimulatorService,
        mockBalanceService as unknown as BalanceService,
        mockPriceTracker as unknown as PriceTrackerService,
        mockTradeRepo as unknown as TradeRepository,
        mockTradingConstraintsService as unknown as TradingConstraintsService,
        mockDexScreenerProvider as unknown as DexScreenerProvider,
        mockPaperTradingConfigRepo as unknown as PaperTradingConfigRepository,
        mockConfig,
        mockLogger,
      );
    });

    describe("validateTradingConstraints", () => {
      it("should pass validation for token with all valid constraints", () => {
        const validPriceData: PriceReport = {
          token: "0x1234567890123456789012345678901234567890",
          price: 1.5,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "VALID",
          pairCreatedAt: Date.now() - 200 * 60 * 60 * 1000, // 200 hours ago
          volume: { h24: 500000 },
          liquidity: { usd: 600000 },
          fdv: 2000000,
        };

        // Access private method using type assertion
        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeExecutor as any).validateTradingConstraints(
            validPriceData,
            "VALID_TOKEN",
            mockConstraints,
          ),
        ).not.toThrow();
      });

      it("should fail validation for token with young pair (< 168 hours)", () => {
        const youngPairData: PriceReport = {
          token: "0x1234567890123456789012345678901234567890",
          price: 1.5,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "YOUNG",
          pairCreatedAt: Date.now() - 100 * 60 * 60 * 1000, // 100 hours ago
          volume: { h24: 500000 },
          liquidity: { usd: 600000 },
          fdv: 2000000,
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeExecutor as any).validateTradingConstraints(
            youngPairData,
            "YOUNG_TOKEN",
            mockConstraints,
          ),
        ).toThrow("Token pair is too young");
      });

      it("should fail validation for token with missing pairCreatedAt", () => {
        const noPairTimeData: PriceReport = {
          token: "0x1234567890123456789012345678901234567890",
          price: 1.5,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "NOTIME",
          pairCreatedAt: undefined,
          volume: { h24: 500000 },
          liquidity: { usd: 600000 },
          fdv: 2000000,
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeExecutor as any).validateTradingConstraints(
            noPairTimeData,
            "NOTIME_TOKEN",
            mockConstraints,
          ),
        ).toThrow("Cannot get token pair creation time");
      });

      it("should fail validation for token with low 24h volume", () => {
        const lowVolumeData: PriceReport = {
          token: "0x1234567890123456789012345678901234567890",
          price: 1.5,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "LOWVOL",
          pairCreatedAt: Date.now() - 200 * 60 * 60 * 1000, // 200 hours ago
          volume: { h24: 50000 }, // Below minimum
          liquidity: { usd: 600000 },
          fdv: 2000000,
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeExecutor as any).validateTradingConstraints(
            lowVolumeData,
            "LOWVOL_TOKEN",
            mockConstraints,
          ),
        ).toThrow("Token has insufficient 24h volume");
      });

      it("should fail validation for token with missing volume data", () => {
        const noVolumeData: PriceReport = {
          token: "0x1234567890123456789012345678901234567890",
          price: 1.5,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "NOVOL",
          pairCreatedAt: Date.now() - 200 * 60 * 60 * 1000, // 200 hours ago
          volume: undefined,
          liquidity: { usd: 600000 },
          fdv: 2000000,
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeExecutor as any).validateTradingConstraints(
            noVolumeData,
            "NOVOL_TOKEN",
            DEFAULT_CONSTRAINTS,
          ),
        ).toThrow("Cannot get token 24h volume data");
      });

      it("should fail validation for token with low liquidity", () => {
        const lowLiquidityData: PriceReport = {
          token: "0x1234567890123456789012345678901234567890",
          price: 1.5,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "LOWLIQ",
          pairCreatedAt: Date.now() - 200 * 60 * 60 * 1000, // 200 hours ago
          volume: { h24: 500000 },
          liquidity: { usd: 50000 }, // Below minimum
          fdv: 2000000,
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeExecutor as any).validateTradingConstraints(
            lowLiquidityData,
            "NOLIQ_TOKEN",
            mockConstraints,
          ),
        ).toThrow("Token has insufficient liquidity");
      });

      it("should fail validation for token with missing liquidity data", () => {
        const noLiquidityData: PriceReport = {
          token: "0x1234567890123456789012345678901234567890",
          price: 1.5,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "NOLIQ",
          pairCreatedAt: Date.now() - 200 * 60 * 60 * 1000, // 200 hours ago
          volume: { h24: 500000 },
          liquidity: undefined,
          fdv: 2000000,
        };

        // Mock constraints
        const mockConstraints = {
          minimumPairAgeHours: MINIMUM_PAIR_AGE_HOURS,
          minimum24hVolumeUsd: MINIMUM_24H_VOLUME_USD,
          minimumLiquidityUsd: MINIMUM_LIQUIDITY_USD,
          minimumFdvUsd: MINIMUM_FDV_USD,
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeExecutor as any).validateTradingConstraints(
            noLiquidityData,
            "LOWLIQ_TOKEN",
            mockConstraints,
          ),
        ).toThrow("Cannot get token liquidity");
      });

      it("should fail validation for token with low FDV", () => {
        const lowFdvData: PriceReport = {
          token: "0x1234567890123456789012345678901234567890",
          price: 1.5,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "LOWFDV",
          pairCreatedAt: Date.now() - 200 * 60 * 60 * 1000, // 200 hours ago
          volume: { h24: 500000 },
          liquidity: { usd: 600000 },
          fdv: 500000, // Below minimum
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeExecutor as any).validateTradingConstraints(
            lowFdvData,
            "LOWFDV_TOKEN",
            mockConstraints,
          ),
        ).toThrow("Token has insufficient FDV");
      });

      it("should fail validation for token with missing FDV data", () => {
        const noFdvData: PriceReport = {
          token: "0x1234567890123456789012345678901234567890",
          price: 1.5,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "NOFDV",
          pairCreatedAt: Date.now() - 200 * 60 * 60 * 1000, // 200 hours ago
          volume: { h24: 500000 },
          liquidity: { usd: 600000 },
          fdv: undefined,
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeExecutor as any).validateTradingConstraints(
            noFdvData,
            "NOFDV_TOKEN",
            mockConstraints,
          ),
        ).toThrow("Cannot get token FDV");
      });

      it("should validate boundary conditions correctly", () => {
        // Test exact boundary values
        const boundaryData: PriceReport = {
          token: "0x1234567890123456789012345678901234567890",
          price: 1.5,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "BOUNDARY",
          pairCreatedAt: Date.now() - MINIMUM_PAIR_AGE_HOURS * 60 * 60 * 1000, // Exactly minimum age
          volume: { h24: MINIMUM_24H_VOLUME_USD }, // Exactly minimum volume
          liquidity: { usd: MINIMUM_LIQUIDITY_USD }, // Exactly minimum liquidity
          fdv: MINIMUM_FDV_USD, // Exactly minimum FDV
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeExecutor as any).validateTradingConstraints(
            boundaryData,
            "BOUNDARY_TOKEN",
            mockConstraints,
          ),
        ).not.toThrow();
      });

      it("should handle edge case with zero values", () => {
        const zeroData: PriceReport = {
          token: "0x1234567890123456789012345678901234567890",
          price: 1.5,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "ZERO",
          pairCreatedAt: Date.now() - 200 * 60 * 60 * 1000, // 200 hours ago
          volume: { h24: 0 },
          liquidity: { usd: 0 },
          fdv: 0,
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeExecutor as any).validateTradingConstraints(
            zeroData,
            "ZERO_TOKEN",
            mockConstraints,
          ),
        ).toThrow("insufficient 24h volume");
      });

      it("should handle edge case with null volume", () => {
        const nullVolumeData: PriceReport = {
          token: "0x1234567890123456789012345678901234567890",
          price: 1.5,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "NULLVOL",
          pairCreatedAt: Date.now() - 200 * 60 * 60 * 1000, // 200 hours ago
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          volume: { h24: null as any },
          liquidity: { usd: 600000 },
          fdv: 2000000,
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeExecutor as any).validateTradingConstraints(
            nullVolumeData,
            "NULLVOL_TOKEN",
            mockConstraints,
          ),
        ).toThrow("Cannot get token 24h volume data");
      });

      it("should pass validation for FDV-exempt token (SOL) without FDV data", () => {
        const solTokenData: PriceReport = {
          token: "So11111111111111111111111111111111111111112", // SOL - in exempt list
          price: 174.0,
          timestamp: new Date(),
          chain: BlockchainType.SVM,
          specificChain: "svm",
          symbol: "SOL",
          pairCreatedAt: Date.now() - 200 * 60 * 60 * 1000, // 200 hours ago
          volume: { h24: 500000 },
          liquidity: { usd: 600000 },
          fdv: undefined, // No FDV data - but should pass due to exemption
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeExecutor as any).validateTradingConstraints(
            solTokenData,
            "SOL_TOKEN",
            mockConstraints,
          ),
        ).not.toThrow();
      });

      it("should pass validation for FDV-exempt token (USDC) without FDV data", () => {
        const usdcTokenData: PriceReport = {
          token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC - in exempt list
          price: 1.0,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "USDC",
          pairCreatedAt: Date.now() - 200 * 60 * 60 * 1000, // 200 hours ago
          volume: { h24: 500000 },
          liquidity: { usd: 600000 },
          fdv: undefined, // No FDV data - but should pass due to exemption
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeExecutor as any).validateTradingConstraints(
            usdcTokenData,
            "USDC_TOKEN",
            mockConstraints,
          ),
        ).not.toThrow();
      });
    });

    describe("validateCrossChainTrading", () => {
      it("should use competition-specific crossChainTradingType, not global features", async () => {
        // Set global features to disallow all cross-chain trading
        mockFeatures.CROSS_CHAIN_TRADING_TYPE = "disallowAll";

        // But competition allows cross-chain trading
        const competitionWithAllowCrossChain = {
          id: "comp-1",
          name: "Test Competition",
          endDate: null,
          type: "trading" as const,
          crossChainTradingType: "allow" as const,
        };

        mockCompetitionService.getCompetition.mockResolvedValue(
          competitionWithAllowCrossChain,
        );
        mockCompetitionService.isAgentActiveInCompetition.mockResolvedValue(
          true,
        );

        mockBalanceService.getBalance.mockResolvedValue(1000);
        mockPriceTracker.determineChain.mockReturnValue(BlockchainType.SVM);

        const fromPrice: PriceReport = {
          token: "SVM_TOKEN_1",
          price: 1.0,
          timestamp: new Date(),
          chain: BlockchainType.SVM,
          specificChain: "svm",
          symbol: "SVMT1",
          pairCreatedAt: Date.now() - 200 * 60 * 60 * 1000,
          volume: { h24: 500000 },
          liquidity: { usd: 600000 },
          fdv: 2000000,
        };

        const toPrice: PriceReport = {
          token: "0xETH_TOKEN_1",
          price: 2.0,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "EVMT1",
          pairCreatedAt: Date.now() - 200 * 60 * 60 * 1000,
          volume: { h24: 500000 },
          liquidity: { usd: 600000 },
          fdv: 2000000,
        };

        mockPriceTracker.getPrice
          .mockResolvedValueOnce(fromPrice)
          .mockResolvedValueOnce(toPrice);

        mockTradingConstraintsService.getConstraintsWithDefaults.mockResolvedValue(
          mockConstraints,
        );

        // Mock portfolio value calculation
        mockTradeSimulatorService.calculatePortfolioValue.mockResolvedValue(
          1000,
        );

        // Mock paper trading config with maxTradePercentage
        mockPaperTradingConfigRepo.findByCompetitionId.mockResolvedValue({
          competitionId: "comp-1",
          maxTradePercentage: 25,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        mockTradeRepo.create.mockResolvedValue({
          id: randomUUID(),
          timestamp: new Date(),
          fromToken: "SVM_TOKEN_1",
          toToken: "0xETH_TOKEN_1",
          fromAmount: 100,
          toAmount: 50,
          price: 2.0,
          success: true,
          agentId: randomUUID(),
          competitionId: "comp-1",
          reason: "Test cross-chain trade",
          fromChain: BlockchainType.SVM,
          toChain: BlockchainType.EVM,
          fromSpecificChain: "svm",
          toSpecificChain: "eth",
          toTokenSymbol: "EVMT1",
          fromTokenSymbol: "SVMT1",
          tradeAmountUsd: 100,
        });

        // Execute a cross-chain trade (SVM -> EVM)
        // Note: this should NOT throw "Cross-chain trading is disabled"
        // We use a try-catch because the `SimulatedTradeExecutionService`'s `executeTrade` method
        // throws a 400 error due to missing mock logic. Without the try-catch, the test will
        // complain that `this.tradeRepo.createTradeWithBalances` is not a method. However, this
        // logic comes *after* the `validateCrossChainTrading` is used, and is called by the
        // `executeTradeAndUpdateDatabase` method. That is, all we're testing is the validation.
        try {
          await tradeExecutor.executeTrade({
            agentId: randomUUID(),
            competitionId: "comp-1",
            fromToken: "SVM_TOKEN_1",
            toToken: "0xETH_TOKEN_1",
            fromAmount: 100,
            reason: "Test cross-chain trade with allow setting",
            chainOptions: {
              fromChain: BlockchainType.SVM,
              toChain: BlockchainType.EVM,
            },
          });
          // We should not get here
          expect(false).toBe(true);
        } catch (error) {
          // Make sure it's not the cross-chain validation error
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          expect(errorMessage).not.toContain("Cross-chain trading is disabled");
          expect(errorMessage).toContain(
            "this.tradeRepo.createTradeWithBalances is not a function",
          );
        }
      });
    });

    describe("executeTrade - constraint integration", () => {
      it("should reject trade for token with insufficient constraints", async () => {
        // Mock balance and price data
        mockBalanceService.getBalance.mockResolvedValue(1000);
        mockPriceTracker.determineChain.mockReturnValue(BlockchainType.EVM);

        const validFromPrice: PriceReport = {
          token: "0x1111111111111111111111111111111111111111",
          price: 1.0,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "FROM",
          pairCreatedAt: Date.now() - 200 * 60 * 60 * 1000,
          volume: { h24: 500000 },
          liquidity: { usd: 600000 },
          fdv: 2000000,
        };

        const invalidToPrice: PriceReport = {
          token: "0x2222222222222222222222222222222222222222",
          price: 2.0,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "INVALID",
          pairCreatedAt: Date.now() - 100 * 60 * 60 * 1000, // Too young
          volume: { h24: 500000 },
          liquidity: { usd: 600000 },
          fdv: 2000000,
        };

        mockPriceTracker.getPrice
          .mockResolvedValueOnce(validFromPrice)
          .mockResolvedValueOnce(invalidToPrice);

        // Mock trading constraints
        mockTradingConstraintsService.getConstraintsWithDefaults.mockResolvedValue(
          {
            minimumPairAgeHours: 168, // 7 days
            minimum24hVolumeUsd: 100000,
            minimumLiquidityUsd: 100000,
            minimumFdvUsd: 1000000,
            minTradesPerDay: null,
          },
        );

        // Mock competition service responses
        mockCompetitionService.getCompetition.mockResolvedValue({
          id: "comp-1",
          name: "Test Competition",
          endDate: null,
        });
        mockCompetitionService.isAgentActiveInCompetition.mockResolvedValue(
          true,
        );

        await expect(
          tradeExecutor.executeTrade({
            agentId: randomUUID(),
            competitionId: randomUUID(),
            fromToken: "0x1111111111111111111111111111111111111111",
            toToken: "0x2222222222222222222222222222222222222222",
            fromAmount: 100,
            reason: "Test trade",
          }),
        ).rejects.toThrow("Token pair is too young");
      });

      it("should skip constraints for burn tokens (price = 0)", async () => {
        // Mock balance and price data
        mockBalanceService.getBalance.mockResolvedValue(1000);
        mockPriceTracker.determineChain.mockReturnValue(BlockchainType.EVM);

        const validFromPrice: PriceReport = {
          token: "0x1111111111111111111111111111111111111111",
          price: 1.0,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "FROM",
          pairCreatedAt: Date.now() - 200 * 60 * 60 * 1000,
          volume: { h24: 500000 },
          liquidity: { usd: 600000 },
          fdv: 2000000,
        };

        const burnTokenPrice: PriceReport = {
          token: "0x0000000000000000000000000000000000000000",
          price: 0, // Burn token
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "BURN",
          pairCreatedAt: undefined,
          volume: undefined,
          liquidity: undefined,
          fdv: undefined,
        };

        mockPriceTracker.getPrice
          .mockResolvedValueOnce(validFromPrice)
          .mockResolvedValueOnce(burnTokenPrice);

        // For burn tokens, constraints should be skipped, but the trade may still fail due to mocking limitations
        // The important thing is that constraints are skipped for burn tokens
        // Mock competition service responses
        mockCompetitionService.getCompetition.mockResolvedValue({
          id: "comp-1",
          name: "Test Competition",
          endDate: null,
        });
        mockCompetitionService.isAgentActiveInCompetition.mockResolvedValue(
          true,
        );

        try {
          await tradeExecutor.executeTrade({
            agentId: randomUUID(),
            competitionId: randomUUID(),
            fromToken: "0x1111111111111111111111111111111111111111",
            toToken: "0x0000000000000000000000000000000000000000",
            fromAmount: 100,
            reason: "Burn trade",
          });
          throw Error("trade should fail");
        } catch (error) {
          // The error should not be related to constraints validation
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          expect(errorMessage).not.toContain("Token pair is too young");
          expect(errorMessage).not.toContain("insufficient");
          expect(errorMessage).not.toContain("trade should fail");
          // If we get here, the trade failed for a reason other than constraints
          // which is expected due to mocking limitations
        }
      });
    });
  });

  describe("Integration Tests", () => {
    let priceTracker: PriceTrackerService;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let originalConsoleLog: any;

    // Test tokens with different characteristics
    const testTokens = [
      {
        name: "WETH (Ethereum)",
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        chain: BlockchainType.EVM,
        specificChain: "eth",
        expectedToPass: true,
        description: "Major token - should pass all constraints",
      },
      {
        name: "USDC (Ethereum)",
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        chain: BlockchainType.EVM,
        specificChain: "eth",
        expectedToPass: true,
        description: "Stablecoin - should pass all constraints",
      },
      {
        name: "PEPE (Ethereum)",
        address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
        chain: BlockchainType.EVM,
        specificChain: "eth",
        expectedToPass: true,
        description: "Popular meme token - likely to pass constraints",
      },
      {
        name: "SOL (Solana)",
        address: "So11111111111111111111111111111111111111112",
        chain: BlockchainType.SVM,
        specificChain: "svm",
        expectedToPass: true,
        description: "SOL native token - test for FDV availability",
      },
    ];

    beforeAll(() => {
      // Keep console logging for SOL test
      originalConsoleLog = mockLogger.debug;
      // Don't mock mockLogger.debug so we can see the constraint data

      priceTracker = new PriceTrackerService(
        {} as unknown as MultiChainProvider, // mockMultiChainProvider
        {} as unknown as PriceTrackerServiceConfig, // mockConfig
        mockLogger,
      );
    });

    afterAll(() => {
      // Restore mockLogger.debug
      mockLogger.debug = originalConsoleLog;
    });

    describe("Real Token Constraint Validation", () => {
      it.each(testTokens)(
        "should validate constraints for $name",
        async (token) => {
          const priceData = await priceTracker.getPrice(
            token.address,
            token.chain,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            token.specificChain as any,
          );

          // Skip test if price data is not available
          if (!priceData) {
            // Skipping token - no price data available
            return;
          }

          expect(priceData.price).toBeGreaterThan(0);
          expect(priceData.symbol).toBeTruthy();

          // Log token information for debugging
          mockLogger.debug(`\n--- ${token.name} Constraint Analysis ---`);
          mockLogger.debug(`Price: $${priceData.price}`);
          mockLogger.debug(`Symbol: ${priceData.symbol}`);

          // Check individual constraints
          let constraintsPassed = 0;
          let constraintsFailed = 0;

          // 1. Pair age constraint
          if (priceData.pairCreatedAt) {
            const pairAgeHours =
              (Date.now() - priceData.pairCreatedAt) / (1000 * 60 * 60);
            const passesAgeCheck = pairAgeHours > MINIMUM_PAIR_AGE_HOURS;
            mockLogger.debug(
              `Pair Age: ${pairAgeHours.toFixed(2)} hours ${passesAgeCheck ? "✅" : "❌"}`,
            );

            if (passesAgeCheck) constraintsPassed++;
            else constraintsFailed++;
          } else {
            mockLogger.debug(`Pair Age: N/A ❌`);
            constraintsFailed++;
          }

          // 2. Volume constraint
          if (priceData.volume?.h24) {
            const passesVolumeCheck =
              priceData.volume.h24 > MINIMUM_24H_VOLUME_USD;
            mockLogger.debug(
              `24h Volume: $${priceData.volume.h24.toLocaleString()} ${passesVolumeCheck ? "✅" : "❌"} (min: $${MINIMUM_24H_VOLUME_USD.toLocaleString()})`,
            );

            if (passesVolumeCheck) constraintsPassed++;
            else constraintsFailed++;
          } else {
            mockLogger.debug(`24h Volume: N/A ❌`);
            constraintsFailed++;
          }

          // 3. Liquidity constraint
          if (priceData.liquidity?.usd) {
            const passesLiquidityCheck =
              priceData.liquidity.usd > MINIMUM_LIQUIDITY_USD;
            mockLogger.debug(
              `Liquidity: $${priceData.liquidity.usd.toLocaleString()} ${passesLiquidityCheck ? "✅" : "❌"}`,
            );

            if (passesLiquidityCheck) constraintsPassed++;
            else constraintsFailed++;
          } else {
            mockLogger.debug(`Liquidity: N/A ❌`);
            constraintsFailed++;
          }

          // 4. FDV constraint
          if (priceData.fdv) {
            const passesFdvCheck = priceData.fdv > MINIMUM_FDV_USD;
            mockLogger.debug(
              `FDV: $${priceData.fdv.toLocaleString()} ${passesFdvCheck ? "✅" : "❌"}`,
            );

            if (passesFdvCheck) constraintsPassed++;
            else constraintsFailed++;
          } else {
            mockLogger.debug(`FDV: N/A ❌`);
            constraintsFailed++;
          }

          // Overall assessment
          const allConstraintsMet = constraintsFailed === 0;
          mockLogger.debug(
            `Overall: ${allConstraintsMet ? "TRADEABLE ✅" : "NOT TRADEABLE ❌"}`,
          );
          mockLogger.debug(
            `Constraints passed: ${constraintsPassed}/4, failed: ${constraintsFailed}/4`,
          );

          // For major tokens, we expect them to pass most constraints
          if (token.expectedToPass) {
            expect(constraintsPassed).toBeGreaterThan(constraintsFailed);
          }

          // Verify data structure
          expect(priceData).toHaveProperty("token");
          expect(priceData).toHaveProperty("price");
          expect(priceData).toHaveProperty("symbol");
          expect(priceData).toHaveProperty("timestamp");
          expect(priceData).toHaveProperty("chain");
          expect(priceData).toHaveProperty("specificChain");
        },
        30000,
      ); // 30 second timeout for API calls
    });

    describe("Constraint Boundary Testing", () => {
      it("should handle edge cases in constraint validation", async () => {
        // Test with a well-known token to verify edge case handling
        const priceData = await priceTracker.getPrice(
          "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
          BlockchainType.EVM,
          "eth",
        );

        if (!priceData) {
          // Skipping edge case test - no price data available
          return;
        }

        // Test boundary conditions
        if (priceData.pairCreatedAt) {
          const pairAgeHours =
            (Date.now() - priceData.pairCreatedAt) / (1000 * 60 * 60);

          // For established tokens like WETH, pair age should be well above minimum
          expect(pairAgeHours).toBeGreaterThan(MINIMUM_PAIR_AGE_HOURS * 10);
        }

        if (priceData.volume?.h24) {
          // For major tokens, volume should be well above minimum
          expect(priceData.volume.h24).toBeGreaterThan(
            MINIMUM_24H_VOLUME_USD * 10,
          );
        }

        if (priceData.liquidity?.usd) {
          // For major tokens, liquidity should be well above minimum
          expect(priceData.liquidity.usd).toBeGreaterThan(
            MINIMUM_LIQUIDITY_USD * 10,
          );
        }

        if (priceData.fdv) {
          // For major tokens, FDV should be well above minimum
          expect(priceData.fdv).toBeGreaterThan(MINIMUM_FDV_USD * 10);
        }
      }, 30000);
    });

    describe("Price Data Structure Validation", () => {
      it("should return properly structured price data with constraint fields", async () => {
        const priceData = await priceTracker.getPrice(
          "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
          BlockchainType.EVM,
          "eth",
        );

        if (!priceData) {
          // Skipping structure test - no price data available
          return;
        }

        // Verify core fields
        expect(priceData).toHaveProperty("token");
        expect(priceData).toHaveProperty("price");
        expect(priceData).toHaveProperty("symbol");
        expect(priceData).toHaveProperty("timestamp");
        expect(priceData).toHaveProperty("chain");
        expect(priceData).toHaveProperty("specificChain");

        // Verify constraint fields are present (even if undefined)
        expect(priceData).toHaveProperty("pairCreatedAt");
        expect(priceData).toHaveProperty("volume");
        expect(priceData).toHaveProperty("liquidity");
        expect(priceData).toHaveProperty("fdv");

        // Verify types
        expect(typeof priceData.price).toBe("number");
        expect(typeof priceData.symbol).toBe("string");
        expect(priceData.timestamp).toBeInstanceOf(Date);
        expect(typeof priceData.chain).toBe("string");
        expect(typeof priceData.specificChain).toBe("string");

        // Verify constraint field types (when present)
        if (priceData.pairCreatedAt !== undefined) {
          expect(typeof priceData.pairCreatedAt).toBe("number");
        }

        if (priceData.volume !== undefined) {
          expect(typeof priceData.volume).toBe("object");
          if (priceData.volume.h24 !== undefined) {
            expect(typeof priceData.volume.h24).toBe("number");
          }
        }

        if (priceData.liquidity !== undefined) {
          expect(typeof priceData.liquidity).toBe("object");
          if (priceData.liquidity.usd !== undefined) {
            expect(typeof priceData.liquidity.usd).toBe("number");
          }
        }

        if (priceData.fdv !== undefined) {
          expect(typeof priceData.fdv).toBe("number");
        }
      }, 30000);
    });

    describe("Multi-Chain Constraint Support", () => {
      it("should validate constraints across different chains", async () => {
        const chainTokens = [
          {
            name: "WETH (Ethereum)",
            address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            chain: BlockchainType.EVM,
            specificChain: "eth",
          },
          {
            name: "USDC (Polygon)",
            address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
            chain: BlockchainType.EVM,
            specificChain: "polygon",
          },
          {
            name: "USDC (Base)",
            address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            chain: BlockchainType.EVM,
            specificChain: "base",
          },
        ];

        for (const token of chainTokens) {
          const priceData = await priceTracker.getPrice(
            token.address,
            token.chain,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            token.specificChain as any,
          );

          if (!priceData) {
            // Skipping token - no price data available
            continue;
          }

          // Verify chain information is correctly set
          expect(priceData.chain).toBe(token.chain);
          expect(priceData.specificChain).toBe(token.specificChain);

          // Verify constraint fields are present
          expect(priceData).toHaveProperty("pairCreatedAt");
          expect(priceData).toHaveProperty("volume");
          expect(priceData).toHaveProperty("liquidity");
          expect(priceData).toHaveProperty("fdv");

          mockLogger.debug(
            `${token.name} - Chain: ${priceData.chain}, Specific: ${priceData.specificChain}`,
          );
        }
      }, 45000); // Longer timeout for multiple API calls
    });
  });
});
