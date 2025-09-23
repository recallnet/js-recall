import { beforeEach, describe, expect, it, vi } from "vitest";

import { config } from "@/config/index.js";
// Import mocked functions
import * as repo from "@/database/repositories/trading-constraints-repository.js";
import { TradingConstraintsService } from "@/services/trading-constraints.service.js";

// Mock the trading constraints repository
vi.mock("@/database/repositories/trading-constraints-repository.js", () => ({
  create: vi.fn(),
  findByCompetitionId: vi.fn(),
  update: vi.fn(),
  deleteConstraints: vi.fn(),
  upsert: vi.fn(),
}));

describe("TradingConstraintsService", () => {
  let service: TradingConstraintsService;
  const mockCreate = vi.mocked(repo.create);
  const mockFindByCompetitionId = vi.mocked(repo.findByCompetitionId);
  const mockUpdate = vi.mocked(repo.update);
  const mockDeleteConstraints = vi.mocked(repo.deleteConstraints);
  const mockUpsert = vi.mocked(repo.upsert);

  const testCompetitionId = "comp-123";
  const mockConstraintsRecord = {
    id: "tc-456",
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
    service = new TradingConstraintsService();
    vi.clearAllMocks();
  });

  describe("createConstraints", () => {
    it("should create constraints with custom values", async () => {
      mockCreate.mockResolvedValue(mockConstraintsRecord);

      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 200,
        minimum24hVolumeUsd: 150000,
        minimumLiquidityUsd: 120000,
        minimumFdvUsd: 1500000,
        minTradesPerDay: 10,
      };

      const result = await service.createConstraints(input);

      expect(mockCreate).toHaveBeenCalledWith(
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
      mockCreate.mockResolvedValue(mockConstraintsRecord);

      const input = {
        competitionId: testCompetitionId,
      };

      await service.createConstraints(input);

      expect(mockCreate).toHaveBeenCalledWith(
        {
          competitionId: testCompetitionId,
          minimumPairAgeHours:
            config.tradingConstraints.defaultMinimumPairAgeHours,
          minimum24hVolumeUsd:
            config.tradingConstraints.defaultMinimum24hVolumeUsd,
          minimumLiquidityUsd:
            config.tradingConstraints.defaultMinimumLiquidityUsd,
          minimumFdvUsd: config.tradingConstraints.defaultMinimumFdvUsd,
          minTradesPerDay: null,
        },
        undefined,
      );
    });

    it("should create constraints mixing custom and default values", async () => {
      mockCreate.mockResolvedValue(mockConstraintsRecord);

      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 240,
        minimum24hVolumeUsd: 200000,
        // minimumLiquidityUsd and minimumFdvUsd will use defaults
        minTradesPerDay: 8,
      };

      await service.createConstraints(input);

      expect(mockCreate).toHaveBeenCalledWith(
        {
          competitionId: testCompetitionId,
          minimumPairAgeHours: 240,
          minimum24hVolumeUsd: 200000,
          minimumLiquidityUsd:
            config.tradingConstraints.defaultMinimumLiquidityUsd,
          minimumFdvUsd: config.tradingConstraints.defaultMinimumFdvUsd,
          minTradesPerDay: 8,
        },
        undefined,
      );
    });

    it("should handle repository errors gracefully", async () => {
      mockCreate.mockRejectedValue(new Error("Database connection failed"));

      const input = {
        competitionId: testCompetitionId,
      };

      await expect(service.createConstraints(input)).rejects.toThrow(
        "Database connection failed",
      );
    });

    it("should handle undefined return from repository", async () => {
      mockCreate.mockResolvedValue(undefined);

      const input = {
        competitionId: testCompetitionId,
      };

      const result = await service.createConstraints(input);
      expect(result).toBeUndefined();
    });
  });

  describe("getConstraints", () => {
    it("should retrieve existing constraints", async () => {
      mockFindByCompetitionId.mockResolvedValue(mockConstraintsRecord);

      const result = await service.getConstraints(testCompetitionId);

      expect(mockFindByCompetitionId).toHaveBeenCalledWith(testCompetitionId);
      expect(result).toEqual(mockConstraintsRecord);
    });

    it("should return null when constraints not found", async () => {
      mockFindByCompetitionId.mockResolvedValue(null);

      const result = await service.getConstraints(testCompetitionId);

      expect(result).toBeNull();
    });

    it("should handle repository errors", async () => {
      mockFindByCompetitionId.mockRejectedValue(new Error("Query timeout"));

      await expect(service.getConstraints(testCompetitionId)).rejects.toThrow(
        "Query timeout",
      );
    });
  });

  describe("updateConstraints", () => {
    it("should update constraints with partial data", async () => {
      mockUpdate.mockResolvedValue(mockConstraintsRecord);

      const update = {
        minimumPairAgeHours: 300,
        minimum24hVolumeUsd: 250000,
      };

      const result = await service.updateConstraints(testCompetitionId, update);

      expect(mockUpdate).toHaveBeenCalledWith(
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
      mockUpdate.mockResolvedValue(mockConstraintsRecord);

      const update = {
        minimumPairAgeHours: 400,
        minimum24hVolumeUsd: 300000,
        minimumLiquidityUsd: 200000,
        minimumFdvUsd: 2000000,
        minTradesPerDay: 12,
      };

      const result = await service.updateConstraints(testCompetitionId, update);

      expect(mockUpdate).toHaveBeenCalledWith(
        testCompetitionId,
        update,
        undefined,
      );
      expect(result).toEqual(mockConstraintsRecord);
    });

    it("should handle null minTradesPerDay explicitly", async () => {
      mockUpdate.mockResolvedValue(mockConstraintsRecord);

      const update = {
        minTradesPerDay: null,
      };

      const result = await service.updateConstraints(testCompetitionId, update);

      expect(mockUpdate).toHaveBeenCalledWith(
        testCompetitionId,
        {
          minTradesPerDay: null,
        },
        undefined,
      );
      expect(result).toEqual(mockConstraintsRecord);
    });

    it("should throw error when update fails", async () => {
      mockUpdate.mockResolvedValue(undefined);

      const update = {
        minimumPairAgeHours: 200,
      };

      await expect(
        service.updateConstraints(testCompetitionId, update),
      ).rejects.toThrow(
        `Failed to update trading constraints for competition ${testCompetitionId}`,
      );
    });

    it("should handle repository errors", async () => {
      mockUpdate.mockRejectedValue(new Error("Constraint violation"));

      const update = {
        minimumPairAgeHours: 200,
      };

      await expect(
        service.updateConstraints(testCompetitionId, update),
      ).rejects.toThrow("Constraint violation");
    });

    it("should filter out undefined values correctly", async () => {
      mockUpdate.mockResolvedValue(mockConstraintsRecord);

      const update = {
        minimumPairAgeHours: 200,
        minimum24hVolumeUsd: undefined, // Should be filtered out
        minimumLiquidityUsd: 150000,
        minimumFdvUsd: undefined, // Should be filtered out
        minTradesPerDay: 0, // Should be included as 0 is valid
      };

      await service.updateConstraints(testCompetitionId, update);

      expect(mockUpdate).toHaveBeenCalledWith(
        testCompetitionId,
        {
          minimumPairAgeHours: 200,
          minimumLiquidityUsd: 150000,
          minTradesPerDay: 0,
        },
        undefined,
      );
    });
  });

  describe("deleteConstraints", () => {
    it("should delete constraints successfully", async () => {
      mockDeleteConstraints.mockResolvedValue(true);

      const result = await service.deleteConstraints(testCompetitionId);

      expect(mockDeleteConstraints).toHaveBeenCalledWith(testCompetitionId);
      expect(result).toBe(true);
    });

    it("should return false when constraints not found for deletion", async () => {
      mockDeleteConstraints.mockResolvedValue(false);

      const result = await service.deleteConstraints(testCompetitionId);

      expect(result).toBe(false);
    });

    it("should handle repository errors", async () => {
      mockDeleteConstraints.mockRejectedValue(
        new Error("Foreign key violation"),
      );

      await expect(
        service.deleteConstraints(testCompetitionId),
      ).rejects.toThrow("Foreign key violation");
    });
  });

  describe("upsertConstraints", () => {
    it("should upsert constraints with custom values", async () => {
      mockUpsert.mockResolvedValue(mockConstraintsRecord);

      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 180,
        minimum24hVolumeUsd: 120000,
        minimumLiquidityUsd: 110000,
        minimumFdvUsd: 1200000,
        minTradesPerDay: 6,
      };

      const result = await service.upsertConstraints(input);

      expect(mockUpsert).toHaveBeenCalledWith({
        competitionId: testCompetitionId,
        minimumPairAgeHours: 180,
        minimum24hVolumeUsd: 120000,
        minimumLiquidityUsd: 110000,
        minimumFdvUsd: 1200000,
        minTradesPerDay: 6,
      });
      expect(result).toEqual(mockConstraintsRecord);
    });

    it("should upsert constraints with defaults", async () => {
      mockUpsert.mockResolvedValue(mockConstraintsRecord);

      const input = {
        competitionId: testCompetitionId,
      };

      await service.upsertConstraints(input);

      expect(mockUpsert).toHaveBeenCalledWith({
        competitionId: testCompetitionId,
        minimumPairAgeHours:
          config.tradingConstraints.defaultMinimumPairAgeHours,
        minimum24hVolumeUsd:
          config.tradingConstraints.defaultMinimum24hVolumeUsd,
        minimumLiquidityUsd:
          config.tradingConstraints.defaultMinimumLiquidityUsd,
        minimumFdvUsd: config.tradingConstraints.defaultMinimumFdvUsd,
        minTradesPerDay: null,
      });
    });

    it("should throw error when upsert fails", async () => {
      mockUpsert.mockResolvedValue(undefined);

      const input = {
        competitionId: testCompetitionId,
      };

      await expect(service.upsertConstraints(input)).rejects.toThrow(
        `Failed to upsert trading constraints for competition ${testCompetitionId}`,
      );
    });

    it("should handle repository errors", async () => {
      mockUpsert.mockRejectedValue(new Error("Unique constraint violation"));

      const input = {
        competitionId: testCompetitionId,
      };

      await expect(service.upsertConstraints(input)).rejects.toThrow(
        "Unique constraint violation",
      );
    });
  });

  describe("getConstraintsWithDefaults", () => {
    it("should return existing constraints when found", async () => {
      mockFindByCompetitionId.mockResolvedValue(mockConstraintsRecord);

      const result =
        await service.getConstraintsWithDefaults(testCompetitionId);

      expect(result).toEqual({
        minimumPairAgeHours: mockConstraintsRecord.minimumPairAgeHours,
        minimum24hVolumeUsd: mockConstraintsRecord.minimum24hVolumeUsd,
        minimumLiquidityUsd: mockConstraintsRecord.minimumLiquidityUsd,
        minimumFdvUsd: mockConstraintsRecord.minimumFdvUsd,
        minTradesPerDay: mockConstraintsRecord.minTradesPerDay,
      });
    });

    it("should return default constraints when not found", async () => {
      mockFindByCompetitionId.mockResolvedValue(null);

      const result =
        await service.getConstraintsWithDefaults(testCompetitionId);

      expect(result).toEqual({
        minimumPairAgeHours:
          config.tradingConstraints.defaultMinimumPairAgeHours,
        minimum24hVolumeUsd:
          config.tradingConstraints.defaultMinimum24hVolumeUsd,
        minimumLiquidityUsd:
          config.tradingConstraints.defaultMinimumLiquidityUsd,
        minimumFdvUsd: config.tradingConstraints.defaultMinimumFdvUsd,
        minTradesPerDay: null,
      });
    });

    it("should handle repository errors", async () => {
      mockFindByCompetitionId.mockRejectedValue(new Error("Connection lost"));

      await expect(
        service.getConstraintsWithDefaults(testCompetitionId),
      ).rejects.toThrow("Connection lost");
    });
  });

  describe("validateConstraints", () => {
    it("should pass validation for valid constraints", () => {
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

    it("should pass validation for minimal valid constraints", () => {
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

    it("should handle null minTradesPerDay as valid", () => {
      const input = {
        competitionId: testCompetitionId,
        minTradesPerDay: null,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation for negative minimumPairAgeHours", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: -1,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "minimumPairAgeHours must be non-negative",
      );
    });

    it("should fail validation for excessive minimumPairAgeHours", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 9000,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "minimumPairAgeHours cannot exceed 8760 hours (1 year)",
      );
    });

    it("should pass validation at exact boundary for minimumPairAgeHours", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 8760,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation for negative minimum24hVolumeUsd", () => {
      const input = {
        competitionId: testCompetitionId,
        minimum24hVolumeUsd: -100,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "minimum24hVolumeUsd must be non-negative",
      );
    });

    it("should fail validation for excessive minimum24hVolumeUsd", () => {
      const input = {
        competitionId: testCompetitionId,
        minimum24hVolumeUsd: 2000000000,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "minimum24hVolumeUsd cannot exceed 1 billion USD",
      );
    });

    it("should pass validation at exact boundary for minimum24hVolumeUsd", () => {
      const input = {
        competitionId: testCompetitionId,
        minimum24hVolumeUsd: 1000000000,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation for negative minimumLiquidityUsd", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumLiquidityUsd: -500,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "minimumLiquidityUsd must be non-negative",
      );
    });

    it("should fail validation for excessive minimumLiquidityUsd", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumLiquidityUsd: 1500000000,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "minimumLiquidityUsd cannot exceed 1 billion USD",
      );
    });

    it("should fail validation for negative minimumFdvUsd", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumFdvUsd: -1000,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("minimumFdvUsd must be non-negative");
    });

    it("should fail validation for excessive minimumFdvUsd", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumFdvUsd: 2000000000000,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "minimumFdvUsd cannot exceed 1 trillion USD",
      );
    });

    it("should pass validation at exact boundary for minimumFdvUsd", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumFdvUsd: 1000000000000,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation for negative minTradesPerDay", () => {
      const input = {
        competitionId: testCompetitionId,
        minTradesPerDay: -2,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("minTradesPerDay must be non-negative");
    });

    it("should accumulate multiple validation errors", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: -10,
        minimum24hVolumeUsd: 2000000000,
        minimumLiquidityUsd: -500,
        minimumFdvUsd: 3000000000000,
        minTradesPerDay: -5,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(5);
      expect(result.errors).toContain(
        "minimumPairAgeHours must be non-negative",
      );
      expect(result.errors).toContain(
        "minimum24hVolumeUsd cannot exceed 1 billion USD",
      );
      expect(result.errors).toContain(
        "minimumLiquidityUsd must be non-negative",
      );
      expect(result.errors).toContain(
        "minimumFdvUsd cannot exceed 1 trillion USD",
      );
      expect(result.errors).toContain("minTradesPerDay must be non-negative");
    });

    it("should handle partial constraint validation", () => {
      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 200, // Only this field provided
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle empty constraint object", () => {
      const input = {
        competitionId: testCompetitionId,
      };

      const result = service.validateConstraints(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    describe("Edge Cases", () => {
      it("should handle extremely large valid values", () => {
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
  });

  describe("Financial Edge Cases and Risk Scenarios", () => {
    it("should handle market crash scenario with extreme constraints", async () => {
      mockUpdate.mockResolvedValue({
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
      mockCreate.mockResolvedValue({
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
    it("should handle service instantiation without dependencies", () => {
      const newService = new TradingConstraintsService();
      expect(newService).toBeInstanceOf(TradingConstraintsService);
    });

    it("should maintain consistent error messages", async () => {
      mockUpdate.mockResolvedValue(undefined);
      mockUpsert.mockResolvedValue(undefined);

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
      mockCreate.mockRejectedValue(originalError);

      await expect(
        service.createConstraints({ competitionId: testCompetitionId }),
      ).rejects.toThrow("Database deadlock detected");
    });

    it("should handle race conditions during constraint updates", async () => {
      const concurrencyError = new Error(
        "could not serialize access due to concurrent update",
      );
      mockUpdate.mockRejectedValueOnce(concurrencyError);

      await expect(
        service.updateConstraints(testCompetitionId, {
          minimumPairAgeHours: 200,
        }),
      ).rejects.toThrow("could not serialize access due to concurrent update");
    });

    it("should maintain constraint consistency during partial repository failures", async () => {
      mockFindByCompetitionId.mockResolvedValue(null);
      mockUpsert.mockResolvedValue(mockConstraintsRecord);

      const result = await service.upsertConstraints({
        competitionId: testCompetitionId,
        minimumPairAgeHours: 168,
      });

      expect(mockUpsert).toHaveBeenCalledWith({
        competitionId: testCompetitionId,
        minimumPairAgeHours: 168,
        minimum24hVolumeUsd:
          config.tradingConstraints.defaultMinimum24hVolumeUsd,
        minimumLiquidityUsd:
          config.tradingConstraints.defaultMinimumLiquidityUsd,
        minimumFdvUsd: config.tradingConstraints.defaultMinimumFdvUsd,
        minTradesPerDay: null,
      });
      expect(result).toEqual(mockConstraintsRecord);
    });

    it("should handle memory pressure during bulk constraint operations", async () => {
      mockCreate.mockRejectedValue(new Error("out of memory"));

      await expect(
        service.createConstraints({ competitionId: testCompetitionId }),
      ).rejects.toThrow("out of memory");
    });
  });
});
