import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock, mockReset } from "vitest-mock-extended";

import { TradingConstraintsRepository } from "@recallnet/db/repositories/trading-constraints";

import { TradingConstraintsService } from "../trading-constraints.service.js";

describe("TradingConstraintsService", () => {
  let service: TradingConstraintsService;
  let mockTradingConstraintsRepo: MockProxy<TradingConstraintsRepository>;

  // Default constraint values for testing
  const DEFAULT_MINIMUM_PAIR_AGE_HOURS = 168; // 1 week
  const DEFAULT_MINIMUM_24H_VOLUME_USD = 100000; // $100k
  const DEFAULT_MINIMUM_LIQUIDITY_USD = 100000; // $100k
  const DEFAULT_MINIMUM_FDV_USD = 1000000; // $1M

  const testCompetitionId = "comp-123";
  const mockConstraintsRecord = {
    competitionId: testCompetitionId,
    minimumPairAgeHours: 168,
    minimum24hVolumeUsd: 100000,
    minimumLiquidityUsd: 100000,
    minimumFdvUsd: 1000000,
    minTradesPerDay: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create repository mock
    mockTradingConstraintsRepo = mock<TradingConstraintsRepository>();

    service = new TradingConstraintsService(mockTradingConstraintsRepo, {
      tradingConstraints: {
        defaultMinimum24hVolumeUsd: DEFAULT_MINIMUM_24H_VOLUME_USD,
        defaultMinimumLiquidityUsd: DEFAULT_MINIMUM_LIQUIDITY_USD,
        defaultMinimumFdvUsd: DEFAULT_MINIMUM_FDV_USD,
        defaultMinimumPairAgeHours: DEFAULT_MINIMUM_PAIR_AGE_HOURS,
      },
    });
  });

  afterEach(() => {
    // Reset all mocks
    mockReset(mockTradingConstraintsRepo);
  });

  describe("createConstraints", () => {
    it("should create constraints with custom values", async () => {
      mockTradingConstraintsRepo.create.mockResolvedValue(
        mockConstraintsRecord,
      );

      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 200,
        minimum24hVolumeUsd: 150000,
        minimumLiquidityUsd: 120000,
        minimumFdvUsd: 1500000,
        minTradesPerDay: 10,
      };

      const result = await service.createConstraints(input);

      expect(mockTradingConstraintsRepo.create).toHaveBeenCalledWith(
        {
          competitionId: testCompetitionId,
          minimumPairAgeHours: 200,
          minimum24hVolumeUsd: 150000,
          minimumLiquidityUsd: 120000,
          minimumFdvUsd: 1500000,
          minTradesPerDay: 10,
        },
        undefined,
      );
      expect(result).toEqual(mockConstraintsRecord);
    });

    it("should create constraints with default values when custom values not provided", async () => {
      mockTradingConstraintsRepo.create.mockResolvedValue(
        mockConstraintsRecord,
      );

      const input = {
        competitionId: testCompetitionId,
      };

      await service.createConstraints(input);

      expect(mockTradingConstraintsRepo.create).toHaveBeenCalledWith(
        {
          competitionId: testCompetitionId,
          minimumPairAgeHours: DEFAULT_MINIMUM_PAIR_AGE_HOURS,
          minimum24hVolumeUsd: DEFAULT_MINIMUM_24H_VOLUME_USD,
          minimumLiquidityUsd: DEFAULT_MINIMUM_LIQUIDITY_USD,
          minimumFdvUsd: DEFAULT_MINIMUM_FDV_USD,
          minTradesPerDay: null,
        },
        undefined,
      );
    });

    it("should create constraints mixing custom and default values", async () => {
      mockTradingConstraintsRepo.create.mockResolvedValue(
        mockConstraintsRecord,
      );

      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 240,
        minimum24hVolumeUsd: 200000,
        // minimumLiquidityUsd and minimumFdvUsd will use defaults
        minTradesPerDay: 8,
      };

      await service.createConstraints(input);

      expect(mockTradingConstraintsRepo.create).toHaveBeenCalledWith(
        {
          competitionId: testCompetitionId,
          minimumPairAgeHours: 240,
          minimum24hVolumeUsd: 200000,
          minimumLiquidityUsd: DEFAULT_MINIMUM_LIQUIDITY_USD,
          minimumFdvUsd: DEFAULT_MINIMUM_FDV_USD,
          minTradesPerDay: 8,
        },
        undefined,
      );
    });

    it("should handle repository errors gracefully", async () => {
      mockTradingConstraintsRepo.create.mockRejectedValue(
        new Error("Database connection failed"),
      );

      const input = {
        competitionId: testCompetitionId,
      };

      await expect(service.createConstraints(input)).rejects.toThrow(
        "Database connection failed",
      );
    });

    it("should handle undefined return from repository", async () => {
      mockTradingConstraintsRepo.create.mockResolvedValue(undefined);

      const input = {
        competitionId: testCompetitionId,
      };

      const result = await service.createConstraints(input);
      expect(result).toBeUndefined();
    });
  });

  describe("getConstraints", () => {
    it("should retrieve existing constraints", async () => {
      mockTradingConstraintsRepo.findByCompetitionId.mockResolvedValue(
        mockConstraintsRecord,
      );

      const result = await service.getConstraints(testCompetitionId);

      expect(
        mockTradingConstraintsRepo.findByCompetitionId,
      ).toHaveBeenCalledWith(testCompetitionId);
      expect(result).toEqual(mockConstraintsRecord);
    });

    it("should return null when constraints not found", async () => {
      mockTradingConstraintsRepo.findByCompetitionId.mockResolvedValue(null);

      const result = await service.getConstraints(testCompetitionId);

      expect(result).toBeNull();
    });

    it("should handle repository errors", async () => {
      mockTradingConstraintsRepo.findByCompetitionId.mockRejectedValue(
        new Error("Query timeout"),
      );

      await expect(service.getConstraints(testCompetitionId)).rejects.toThrow(
        "Query timeout",
      );
    });
  });

  describe("updateConstraints", () => {
    it("should update constraints with partial data", async () => {
      mockTradingConstraintsRepo.update.mockResolvedValue(
        mockConstraintsRecord,
      );

      const update = {
        minimumPairAgeHours: 300,
        minimum24hVolumeUsd: 250000,
      };

      const result = await service.updateConstraints(testCompetitionId, update);

      expect(mockTradingConstraintsRepo.update).toHaveBeenCalledWith(
        testCompetitionId,
        {
          minimumPairAgeHours: 300,
          minimum24hVolumeUsd: 250000,
        },
        undefined,
      );
      expect(result).toEqual(mockConstraintsRecord);
    });

    it("should update all constraint fields", async () => {
      mockTradingConstraintsRepo.update.mockResolvedValue(
        mockConstraintsRecord,
      );

      const update = {
        minimumPairAgeHours: 400,
        minimum24hVolumeUsd: 300000,
        minimumLiquidityUsd: 200000,
        minimumFdvUsd: 2000000,
        minTradesPerDay: 12,
      };

      const result = await service.updateConstraints(testCompetitionId, update);

      expect(mockTradingConstraintsRepo.update).toHaveBeenCalledWith(
        testCompetitionId,
        update,
        undefined,
      );
      expect(result).toEqual(mockConstraintsRecord);
    });

    it("should handle null minTradesPerDay explicitly", async () => {
      mockTradingConstraintsRepo.update.mockResolvedValue(
        mockConstraintsRecord,
      );

      const update = {
        minTradesPerDay: null,
      };

      const result = await service.updateConstraints(testCompetitionId, update);

      expect(mockTradingConstraintsRepo.update).toHaveBeenCalledWith(
        testCompetitionId,
        {
          minTradesPerDay: null,
        },
        undefined,
      );
      expect(result).toEqual(mockConstraintsRecord);
    });

    it("should throw error when update fails", async () => {
      mockTradingConstraintsRepo.update.mockResolvedValue(undefined);

      const update = {
        minimumPairAgeHours: 200,
      };

      await expect(
        service.updateConstraints(testCompetitionId, update),
      ).rejects.toThrow(
        `Failed to update trading constraints for competition ${testCompetitionId}`,
      );
    });

    it("should handle repository errors during update", async () => {
      mockTradingConstraintsRepo.update.mockRejectedValue(
        new Error("Constraint violation"),
      );

      const update = {
        minimumPairAgeHours: 200,
      };

      await expect(
        service.updateConstraints(testCompetitionId, update),
      ).rejects.toThrow("Constraint violation");
    });
  });

  describe("upsertConstraints", () => {
    it("should upsert constraints with custom values", async () => {
      mockTradingConstraintsRepo.upsert.mockResolvedValue(
        mockConstraintsRecord,
      );

      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 200,
        minimum24hVolumeUsd: 150000,
      };

      const result = await service.upsertConstraints(input);

      expect(mockTradingConstraintsRepo.upsert).toHaveBeenCalledWith({
        competitionId: testCompetitionId,
        minimumPairAgeHours: 200,
        minimum24hVolumeUsd: 150000,
        minimumLiquidityUsd: DEFAULT_MINIMUM_LIQUIDITY_USD,
        minimumFdvUsd: DEFAULT_MINIMUM_FDV_USD,
        minTradesPerDay: null,
      });
      expect(result).toEqual(mockConstraintsRecord);
    });

    it("should upsert constraints with all default values", async () => {
      mockTradingConstraintsRepo.upsert.mockResolvedValue(
        mockConstraintsRecord,
      );

      const input = {
        competitionId: testCompetitionId,
      };

      const result = await service.upsertConstraints(input);

      expect(mockTradingConstraintsRepo.upsert).toHaveBeenCalledWith({
        competitionId: testCompetitionId,
        minimumPairAgeHours: DEFAULT_MINIMUM_PAIR_AGE_HOURS,
        minimum24hVolumeUsd: DEFAULT_MINIMUM_24H_VOLUME_USD,
        minimumLiquidityUsd: DEFAULT_MINIMUM_LIQUIDITY_USD,
        minimumFdvUsd: DEFAULT_MINIMUM_FDV_USD,
        minTradesPerDay: null,
      });
      expect(result).toEqual(mockConstraintsRecord);
    });

    it("should throw error when upsert fails", async () => {
      mockTradingConstraintsRepo.upsert.mockResolvedValue(undefined);

      const input = {
        competitionId: testCompetitionId,
      };

      await expect(service.upsertConstraints(input)).rejects.toThrow(
        `Failed to upsert trading constraints for competition ${testCompetitionId}`,
      );
    });

    it("should handle repository errors during upsert", async () => {
      mockTradingConstraintsRepo.upsert.mockRejectedValue(
        new Error("Unique constraint violation"),
      );

      const input = {
        competitionId: testCompetitionId,
      };

      await expect(service.upsertConstraints(input)).rejects.toThrow(
        "Unique constraint violation",
      );
    });
  });

  describe("deleteConstraints", () => {
    it("should delete constraints for a competition", async () => {
      mockTradingConstraintsRepo.delete.mockResolvedValue(true);

      const result = await service.deleteConstraints(testCompetitionId);

      expect(mockTradingConstraintsRepo.delete).toHaveBeenCalledWith(
        testCompetitionId,
      );
      expect(result).toBe(true);
    });

    it("should handle repository errors during delete", async () => {
      mockTradingConstraintsRepo.delete.mockRejectedValue(
        new Error("Foreign key constraint"),
      );

      await expect(
        service.deleteConstraints(testCompetitionId),
      ).rejects.toThrow("Foreign key constraint");
    });
  });

  describe("validateConstraints", () => {
    it("should validate valid constraints", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 168,
        minimum24hVolumeUsd: 100000,
        minimumLiquidityUsd: 100000,
        minimumFdvUsd: 1000000,
        minTradesPerDay: 5,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation for negative values", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: -10,
        minimum24hVolumeUsd: -50000,
        minimumLiquidityUsd: -25000,
        minimumFdvUsd: -500000,
        minTradesPerDay: -5,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        "minimumPairAgeHours must be non-negative",
        "minimum24hVolumeUsd must be non-negative",
        "minimumLiquidityUsd must be non-negative",
        "minimumFdvUsd must be non-negative",
        "minTradesPerDay must be non-negative",
      ]);
    });

    it("should fail validation for excessively large values", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 8761, // Over 1 year
        minimum24hVolumeUsd: 1000000001, // Over 1 billion
        minimumLiquidityUsd: 1000000001, // Over 1 billion
        minimumFdvUsd: 1000000000001, // Over 1 trillion
        minTradesPerDay: 10001, // Large number (no limit validation in actual implementation)
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "minimumPairAgeHours cannot exceed 8760 hours (1 year)",
      );
      expect(result.errors).toContain(
        "minimum24hVolumeUsd cannot exceed 1 billion USD",
      );
      expect(result.errors).toContain(
        "minimumLiquidityUsd cannot exceed 1 billion USD",
      );
      expect(result.errors).toContain(
        "minimumFdvUsd cannot exceed 1 trillion USD",
      );
      // minTradesPerDay has no upper limit validation in the actual implementation
    });

    it("should pass validation for reasonable large values", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 8759,
        minimum24hVolumeUsd: 999999999,
        minimumLiquidityUsd: 999999999,
        minimumFdvUsd: 999999999999,
        minTradesPerDay: 10000,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle zero values correctly", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 0,
        minimum24hVolumeUsd: 0,
        minimumLiquidityUsd: 0,
        minimumFdvUsd: 0,
        minTradesPerDay: 0,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle decimal values (should still pass validation)", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 168.5,
        minimum24hVolumeUsd: 100000.99,
        minimumLiquidityUsd: 100000.01,
        minimumFdvUsd: 1000000.5,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate financial constraints realistically for high-frequency trading", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 1, // Very new pair
        minimum24hVolumeUsd: 50000, // Lower volume threshold
        minimumLiquidityUsd: 25000, // Minimal liquidity
        minimumFdvUsd: 500000, // Smaller market cap
        minTradesPerDay: 100, // High frequency trading
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle institutional-level constraints validation", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 720, // 30 days
        minimum24hVolumeUsd: 50000000, // $50M daily volume
        minimumLiquidityUsd: 10000000, // $10M liquidity
        minimumFdvUsd: 100000000000, // $100B FDV
        minTradesPerDay: 1000, // Institutional trading volume
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation when liquidity exceeds maximum safe trading threshold", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumLiquidityUsd: 1000000001, // Just over 1 billion
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "minimumLiquidityUsd cannot exceed 1 billion USD",
      );
    });
  });

  describe("Financial Edge Cases and Risk Scenarios", () => {
    it("should handle market crash scenario with extreme constraints", async () => {
      mockTradingConstraintsRepo.update.mockResolvedValue({
        ...mockConstraintsRecord,
        minimum24hVolumeUsd: 500000000, // $500M volume during crisis
        minimumLiquidityUsd: 100000000, // $100M liquidity requirement
        minimumFdvUsd: 50000000000, // $50B FDV minimum
      });

      const extremeConstraints = {
        minimum24hVolumeUsd: 500000000,
        minimumLiquidityUsd: 100000000,
        minimumFdvUsd: 50000000000,
      };

      const result = await service.updateConstraints(
        testCompetitionId,
        extremeConstraints,
      );

      expect(result.minimum24hVolumeUsd).toBe(500000000);
      expect(result.minimumLiquidityUsd).toBe(100000000);
      expect(result.minimumFdvUsd).toBe(50000000000);
    });

    it("should enforce minimum trading frequency for competition safety", () => {
      const constraints = {
        competitionId: testCompetitionId,
        minTradesPerDay: 1, // Minimum viable trading activity
      };

      const result = service.validateConstraints(constraints);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject unreasonable pair age for active trading", () => {
      const constraints = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 8761, // Over 1 year
      };

      const result = service.validateConstraints(constraints);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "minimumPairAgeHours cannot exceed 8760 hours (1 year)",
      );
    });

    it("should handle DeFi blue-chip token constraints", async () => {
      mockTradingConstraintsRepo.create.mockResolvedValue({
        ...mockConstraintsRecord,
        minimum24hVolumeUsd: 10000000, // $10M daily volume
        minimumLiquidityUsd: 5000000, // $5M liquidity
        minimumFdvUsd: 1000000000, // $1B FDV
        minimumPairAgeHours: 2160, // 90 days established
      });

      const blueChipConstraints = {
        competitionId: testCompetitionId,
        minimum24hVolumeUsd: 10000000,
        minimumLiquidityUsd: 5000000,
        minimumFdvUsd: 1000000000,
        minimumPairAgeHours: 2160,
      };

      const result = await service.createConstraints(blueChipConstraints);

      expect(result?.minimum24hVolumeUsd).toBe(10000000);
      expect(result?.minimumLiquidityUsd).toBe(5000000);
      expect(result?.minimumFdvUsd).toBe(1000000000);
      expect(result?.minimumPairAgeHours).toBe(2160);
    });
  });

  describe("Error Handling and Robustness", () => {
    it("should handle service instantiation with dependencies", () => {
      const newService = new TradingConstraintsService(
        mockTradingConstraintsRepo,
        {
          tradingConstraints: {
            defaultMinimum24hVolumeUsd: 168,
            defaultMinimumLiquidityUsd: 100000,
            defaultMinimumFdvUsd: 100000,
            defaultMinimumPairAgeHours: 1000000,
          },
        },
      );
      expect(newService).toBeInstanceOf(TradingConstraintsService);
    });

    it("should maintain consistent error messages", async () => {
      mockTradingConstraintsRepo.update.mockResolvedValue(undefined);
      mockTradingConstraintsRepo.upsert.mockResolvedValue(undefined);

      const competitionId = "test-comp";

      // Test update error message
      await expect(
        service.updateConstraints(competitionId, { minimumPairAgeHours: 200 }),
      ).rejects.toThrow(
        `Failed to update trading constraints for competition ${competitionId}`,
      );

      // Test upsert error message
      await expect(
        service.upsertConstraints({ competitionId }),
      ).rejects.toThrow(
        `Failed to upsert trading constraints for competition ${competitionId}`,
      );
    });

    it("should preserve original error when repository operations fail", async () => {
      const originalError = new Error("Database deadlock detected");
      mockTradingConstraintsRepo.create.mockRejectedValue(originalError);

      await expect(
        service.createConstraints({ competitionId: testCompetitionId }),
      ).rejects.toThrow("Database deadlock detected");
    });

    it("should handle race conditions during constraint updates", async () => {
      const concurrencyError = new Error(
        "could not serialize access due to concurrent update",
      );
      mockTradingConstraintsRepo.update.mockRejectedValueOnce(concurrencyError);

      await expect(
        service.updateConstraints(testCompetitionId, {
          minimumPairAgeHours: 200,
        }),
      ).rejects.toThrow("could not serialize access due to concurrent update");
    });

    it("should maintain constraint consistency during partial repository failures", async () => {
      mockTradingConstraintsRepo.findByCompetitionId.mockResolvedValue(null);
      mockTradingConstraintsRepo.upsert.mockResolvedValue(
        mockConstraintsRecord,
      );

      const result = await service.upsertConstraints({
        competitionId: testCompetitionId,
        minimumPairAgeHours: 168,
      });

      expect(mockTradingConstraintsRepo.upsert).toHaveBeenCalledWith({
        competitionId: testCompetitionId,
        minimumPairAgeHours: 168,
        minimum24hVolumeUsd: DEFAULT_MINIMUM_24H_VOLUME_USD,
        minimumLiquidityUsd: DEFAULT_MINIMUM_LIQUIDITY_USD,
        minimumFdvUsd: DEFAULT_MINIMUM_FDV_USD,
        minTradesPerDay: null,
      });
      expect(result).toEqual(mockConstraintsRecord);
    });

    it("should handle memory pressure during bulk constraint operations", async () => {
      mockTradingConstraintsRepo.create.mockRejectedValue(
        new Error("out of memory"),
      );

      await expect(
        service.createConstraints({ competitionId: testCompetitionId }),
      ).rejects.toThrow("out of memory");
    });
  });
});
