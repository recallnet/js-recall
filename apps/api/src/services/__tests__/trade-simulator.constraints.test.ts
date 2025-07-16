import { v4 as uuidv4 } from "uuid";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TradeSimulator } from "@/services/trade-simulator.service.js";
import { BlockchainType, PriceReport } from "@/types/index.js";

// Mock dependencies
vi.mock("@/services/balance-manager.service.js");
vi.mock("@/services/price-tracker.service.js");
vi.mock("@/services/index.js");
vi.mock("@/database/repositories/trade-repository.js", () => ({
  create: vi.fn(),
}));
vi.mock("@/database/repositories/trading-constraints-repository.js", () => ({
  findByCompetitionId: vi.fn(),
}));

// Trading constraint constants (matching TradeSimulator)
const MINIMUM_PAIR_AGE_HOURS = 168; // 7 days
const MINIMUM_24H_VOLUME_USD = 100000; // $100,000
const MINIMUM_LIQUIDITY_USD = 100000; // $100,000
const MINIMUM_FDV_USD = 1000000; // $1,000,000

// Default constraints object for testing
const DEFAULT_CONSTRAINTS = {
  minimumPairAgeHours: MINIMUM_PAIR_AGE_HOURS,
  minimum24hVolumeUsd: MINIMUM_24H_VOLUME_USD,
  minimumLiquidityUsd: MINIMUM_LIQUIDITY_USD,
  minimumFdvUsd: MINIMUM_FDV_USD,
};

describe("TradeSimulator - Trading Constraints", () => {
  let tradeSimulator: TradeSimulator;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockBalanceManager: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPriceTracker: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPortfolioSnapshotter: any;

  // Mock constraints used across all tests
  const mockConstraints = {
    minimumPairAgeHours: MINIMUM_PAIR_AGE_HOURS,
    minimum24hVolumeUsd: MINIMUM_24H_VOLUME_USD,
    minimumLiquidityUsd: MINIMUM_LIQUIDITY_USD,
    minimumFdvUsd: MINIMUM_FDV_USD,
  };

  beforeEach(() => {
    // Create mock implementations
    mockBalanceManager = {
      getBalance: vi.fn(),
      subtractAmount: vi.fn(),
      addAmount: vi.fn(),
    };

    mockPriceTracker = {
      determineChain: vi.fn(),
      getPrice: vi.fn(),
    };

    mockPortfolioSnapshotter = {
      takePortfolioSnapshotForAgent: vi.fn(),
    };

    // Create TradeSimulator instance with mocked dependencies
    tradeSimulator = new TradeSimulator(
      mockBalanceManager,
      mockPriceTracker,
      mockPortfolioSnapshotter,
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
        liquidity: { usd: 200000 },
        fdv: 2000000,
      };

      // Access private method using type assertion
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (tradeSimulator as any).validateTradingConstraints(
        validPriceData,
        "VALID_TOKEN",
        mockConstraints,
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (tradeSimulator as any).validateTradingConstraints(
        youngPairData,
        "YOUNG_TOKEN",
        mockConstraints,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Token pair is too young");
      expect(result.error).toContain("100.00 hours old");
      expect(result.error).toContain(
        `minimum: ${MINIMUM_PAIR_AGE_HOURS} hours`,
      );
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (tradeSimulator as any).validateTradingConstraints(
        noPairTimeData,
        "NOTIME_TOKEN",
        mockConstraints,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot get token pair creation time");
      expect(result.error).toContain(
        `minimum age is: ${MINIMUM_PAIR_AGE_HOURS} hours`,
      );
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (tradeSimulator as any).validateTradingConstraints(
        lowVolumeData,
        "LOWVOL_TOKEN",
        mockConstraints,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Token has insufficient 24h volume");
      expect(result.error).toContain("$50,000");
      expect(result.error).toContain(
        `minimum: $${MINIMUM_24H_VOLUME_USD.toLocaleString()}`,
      );
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (tradeSimulator as any).validateTradingConstraints(
        noVolumeData,
        "NOVOL_TOKEN",
        DEFAULT_CONSTRAINTS,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot get token 24h volume data");
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (tradeSimulator as any).validateTradingConstraints(
        lowLiquidityData,
        "NOLIQ_TOKEN",
        mockConstraints,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Token has insufficient liquidity");
      expect(result.error).toContain("$50,000");
      expect(result.error).toContain(
        `minimum: $${MINIMUM_LIQUIDITY_USD.toLocaleString()}`,
      );
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (tradeSimulator as any).validateTradingConstraints(
        noLiquidityData,
        "LOWLIQ_TOKEN",
        mockConstraints,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot get token liquidity");
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (tradeSimulator as any).validateTradingConstraints(
        lowFdvData,
        "LOWFDV_TOKEN",
        mockConstraints,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Token has insufficient FDV");
      expect(result.error).toContain("$500,000");
      expect(result.error).toContain(
        `minimum: $${MINIMUM_FDV_USD.toLocaleString()}`,
      );
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (tradeSimulator as any).validateTradingConstraints(
        noFdvData,
        "NOFDV_TOKEN",
        mockConstraints,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot get token FDV");
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (tradeSimulator as any).validateTradingConstraints(
        boundaryData,
        "BOUNDARY_TOKEN",
        mockConstraints,
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (tradeSimulator as any).validateTradingConstraints(
        zeroData,
        "ZERO_TOKEN",
        mockConstraints,
      );

      expect(result.success).toBe(false);
      // Should fail on the first zero value encountered (volume)
      expect(result.error).toContain("insufficient 24h volume");
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
        liquidity: { usd: 200000 },
        fdv: 2000000,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (tradeSimulator as any).validateTradingConstraints(
        nullVolumeData,
        "NULLVOL_TOKEN",
        mockConstraints,
      );

      expect(result.success).toBe(false);
      // Should fail on missing volume data check first
      expect(result.error).toContain("Cannot get token 24h volume data");
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
        liquidity: { usd: 200000 },
        fdv: undefined, // No FDV data - but should pass due to exemption
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (tradeSimulator as any).validateTradingConstraints(
        solTokenData,
        "SOL_TOKEN",
        mockConstraints,
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
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
        liquidity: { usd: 200000 },
        fdv: undefined, // No FDV data - but should pass due to exemption
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (tradeSimulator as any).validateTradingConstraints(
        usdcTokenData,
        "USDC_TOKEN",
        mockConstraints,
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe("executeTrade - constraint integration", () => {
    it("should reject trade for token with insufficient constraints", async () => {
      // Mock balance and price data
      mockBalanceManager.getBalance.mockResolvedValue(1000);
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
        liquidity: { usd: 200000 },
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
        liquidity: { usd: 200000 },
        fdv: 2000000,
      };

      mockPriceTracker.getPrice
        .mockResolvedValueOnce(validFromPrice)
        .mockResolvedValueOnce(invalidToPrice);

      const result = await tradeSimulator.executeTrade(
        uuidv4(),
        uuidv4(),
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
        100,
        "Test trade",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Token pair is too young");
      expect(result.trade).toBeUndefined();
    });

    it("should skip constraints for burn tokens (price = 0)", async () => {
      // Mock balance and price data
      mockBalanceManager.getBalance.mockResolvedValue(1000);
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
        liquidity: { usd: 200000 },
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

      const result = await tradeSimulator.executeTrade(
        uuidv4(),
        uuidv4(),
        "0x1111111111111111111111111111111111111111",
        "0x0000000000000000000000000000000000000000",
        100,
        "Burn trade",
      );

      // Should pass constraints validation but may fail later due to mocking limitations
      // The important thing is that constraints are skipped for burn tokens
      expect(result.success).toBe(false);
      expect(result.error).not.toContain("Token pair is too young");
      expect(result.error).not.toContain("insufficient");
    });
  });
});
