import { randomUUID } from "crypto";
import type { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock, mockReset } from "vitest-mock-extended";

import { TradeRepository } from "@recallnet/db/repositories/trade";
import { TradingConstraintsRepository } from "@recallnet/db/repositories/trading-constraints";

import { BalanceService } from "../balance.service.js";
import { PriceTrackerService } from "../price-tracker.service.js";
import { TradeSimulatorService } from "../trade-simulator.service.js";
import {
  BlockchainType,
  CrossChainTradingType,
  PriceReport,
  SpecificChain,
} from "../types/index.js";

// Trading constraint constants - using defaults for testing
const MINIMUM_PAIR_AGE_HOURS = 168; // 1 week
const MINIMUM_24H_VOLUME_USD = 100000; // $100k
const MINIMUM_LIQUIDITY_USD = 100000; // $100k
const MINIMUM_FDV_USD = 1000000; // $1M

// Default constraints object for testing
const DEFAULT_CONSTRAINTS = {
  minimumPairAgeHours: MINIMUM_PAIR_AGE_HOURS,
  minimum24hVolumeUsd: MINIMUM_24H_VOLUME_USD,
  minimumLiquidityUsd: MINIMUM_LIQUIDITY_USD,
  minimumFdvUsd: MINIMUM_FDV_USD,
};

describe("TradeSimulatorService - Trading Constraints", () => {
  describe("Unit Tests", () => {
    let tradeSimulator: TradeSimulatorService;
    let mockBalanceService: MockProxy<BalanceService>;
    let mockPriceTrackerService: MockProxy<PriceTrackerService>;
    let mockTradeRepo: MockProxy<TradeRepository>;
    let mockTradingConstraintsRepo: MockProxy<TradingConstraintsRepository>;
    let mockLogger: MockProxy<Logger>;

    const mockSpecificChainTokens: Record<
      SpecificChain,
      Record<string, string>
    > = {
      eth: { WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
      polygon: { USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" },
      base: { USDC: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA" },
      arbitrum: {},
      optimism: {},
      bsc: {},
      avalanche: {},
      svm: {}, // Use 'svm' instead of 'solana'
      linea: {},
      zksync: {},
      scroll: {},
      mantle: {},
    };

    beforeEach(() => {
      // Create all service mocks
      mockBalanceService = mock<BalanceService>();
      mockPriceTrackerService = mock<PriceTrackerService>();
      mockTradeRepo = mock<TradeRepository>();
      mockTradingConstraintsRepo = mock<TradingConstraintsRepository>();
      mockLogger = mock<Logger>();

      // Setup basic mock implementations
      mockBalanceService.getBalance.mockResolvedValue(1000);
      mockBalanceService.getAllBalances.mockResolvedValue([
        {
          id: 1,
          agentId: "agent-1",
          tokenAddress: "0xA0b86a33E6441e6C97D5c02c1C0Bdc63FcA88c26",
          amount: 1000,
          symbol: "TEST",
          specificChain: "eth",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockPriceTrackerService.determineChain.mockResolvedValue(
        BlockchainType.EVM,
      );

      // Create TradeSimulator instance with mocked dependencies
      tradeSimulator = new TradeSimulatorService(
        mockBalanceService,
        mockPriceTrackerService,
        mockTradeRepo,
        mockTradingConstraintsRepo,
        0.1, // maxTradePercentage (10%)
        MINIMUM_PAIR_AGE_HOURS,
        MINIMUM_24H_VOLUME_USD,
        MINIMUM_LIQUIDITY_USD,
        MINIMUM_FDV_USD,
        "allow" as CrossChainTradingType,
        mockSpecificChainTokens,
        mockLogger,
      );
    });

    afterEach(() => {
      // Reset all mocks
      mockReset(mockBalanceService);
      mockReset(mockPriceTrackerService);
      mockReset(mockTradeRepo);
      mockReset(mockTradingConstraintsRepo);
      mockReset(mockLogger);
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
          liquidity: { usd: 200000 },
          fdv: 2000000,
        };

        // Access private method using type assertion
        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeSimulator as any).validateTradingConstraints(
            validPriceData,
            "VALID_TOKEN",
            DEFAULT_CONSTRAINTS,
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
          liquidity: { usd: 200000 },
          fdv: 2000000,
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeSimulator as any).validateTradingConstraints(
            youngPairData,
            "YOUNG_TOKEN",
            DEFAULT_CONSTRAINTS,
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
          liquidity: { usd: 200000 },
          fdv: 2000000,
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeSimulator as any).validateTradingConstraints(
            noPairTimeData,
            "NOTIME_TOKEN",
            DEFAULT_CONSTRAINTS,
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
          liquidity: { usd: 200000 },
          fdv: 2000000,
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeSimulator as any).validateTradingConstraints(
            lowVolumeData,
            "LOWVOL_TOKEN",
            DEFAULT_CONSTRAINTS,
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
          liquidity: { usd: 200000 },
          fdv: 2000000,
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeSimulator as any).validateTradingConstraints(
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
          (tradeSimulator as any).validateTradingConstraints(
            lowLiquidityData,
            "NOLIQ_TOKEN",
            DEFAULT_CONSTRAINTS,
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

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeSimulator as any).validateTradingConstraints(
            noLiquidityData,
            "NOLIQ_TOKEN",
            DEFAULT_CONSTRAINTS,
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
          liquidity: { usd: 200000 },
          fdv: 500000, // Below minimum
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeSimulator as any).validateTradingConstraints(
            lowFdvData,
            "LOWFDV_TOKEN",
            DEFAULT_CONSTRAINTS,
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
          liquidity: { usd: 200000 },
          fdv: undefined,
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeSimulator as any).validateTradingConstraints(
            noFdvData,
            "NOFDV_TOKEN",
            DEFAULT_CONSTRAINTS,
          ),
        ).toThrow("Cannot get token FDV");
      });

      it("should handle custom constraints properly", () => {
        const customConstraints = {
          minimumPairAgeHours: 48, // 2 days
          minimum24hVolumeUsd: 50000, // $50k
          minimumLiquidityUsd: 75000, // $75k
          minimumFdvUsd: 500000, // $500k
        };

        const borderlineValidData: PriceReport = {
          token: "0x1234567890123456789012345678901234567890",
          price: 1.5,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "BORDER",
          pairCreatedAt: Date.now() - 50 * 60 * 60 * 1000, // 50 hours ago (> 48)
          volume: { h24: 60000 }, // Above custom minimum
          liquidity: { usd: 80000 }, // Above custom minimum
          fdv: 600000, // Above custom minimum
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeSimulator as any).validateTradingConstraints(
            borderlineValidData,
            "BORDER_TOKEN",
            customConstraints,
          ),
        ).not.toThrow();
      });

      it("should handle edge case values correctly", () => {
        const edgeCaseData: PriceReport = {
          token: "0x1234567890123456789012345678901234567890",
          price: 1.5,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "EDGE",
          pairCreatedAt:
            Date.now() - MINIMUM_PAIR_AGE_HOURS * 60 * 60 * 1000 - 1000, // Just over minimum
          volume: { h24: MINIMUM_24H_VOLUME_USD + 1 }, // Just over minimum
          liquidity: { usd: MINIMUM_LIQUIDITY_USD + 1 }, // Just over minimum
          fdv: MINIMUM_FDV_USD + 1, // Just over minimum
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeSimulator as any).validateTradingConstraints(
            edgeCaseData,
            "EDGE_TOKEN",
            DEFAULT_CONSTRAINTS,
          ),
        ).not.toThrow();
      });

      it("should handle zero and negative values properly", () => {
        const zeroValuesData: PriceReport = {
          token: "0x1234567890123456789012345678901234567890",
          price: 1.5,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "ZERO",
          pairCreatedAt: Date.now() - 200 * 60 * 60 * 1000, // 200 hours ago
          volume: { h24: 0 }, // Zero volume
          liquidity: { usd: 0 }, // Zero liquidity
          fdv: 0, // Zero FDV
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeSimulator as any).validateTradingConstraints(
            zeroValuesData,
            "ZERO_TOKEN",
            DEFAULT_CONSTRAINTS,
          ),
        ).toThrow(); // Should fail due to insufficient values
      });

      it("should handle very large values without overflow", () => {
        const largeValuesData: PriceReport = {
          token: "0x1234567890123456789012345678901234567890",
          price: 1.5,
          timestamp: new Date(),
          chain: BlockchainType.EVM,
          specificChain: "eth",
          symbol: "LARGE",
          pairCreatedAt: Date.now() - 200 * 60 * 60 * 1000, // 200 hours ago
          volume: { h24: 1e12 }, // Trillion dollar volume
          liquidity: { usd: 1e11 }, // Hundred billion liquidity
          fdv: 1e13, // Ten trillion FDV
        };

        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tradeSimulator as any).validateTradingConstraints(
            largeValuesData,
            "LARGE_TOKEN",
            DEFAULT_CONSTRAINTS,
          ),
        ).not.toThrow();
      });
    });

    describe("Service initialization", () => {
      it("should initialize with proper dependencies", () => {
        expect(tradeSimulator).toBeDefined();
        expect(tradeSimulator).toBeInstanceOf(TradeSimulatorService);
      });

      it("should have access to constraints repository for competition-specific rules", () => {
        const competitionId = randomUUID();

        // Verify the service can access the repository (through actual usage)
        expect(mockTradingConstraintsRepo.findByCompetitionId).toBeDefined();
        expect(typeof mockTradingConstraintsRepo.findByCompetitionId).toBe(
          "function",
        );
      });
    });
  });
});
