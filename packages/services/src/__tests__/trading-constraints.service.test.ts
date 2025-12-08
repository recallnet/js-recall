import { beforeEach, describe, expect, it, vi } from "vitest";

// Import mocked functions
import { TradingConstraintsRepository } from "@recallnet/db/repositories/trading-constraints";

import {
  TradingConstraintsService,
  TradingConstraintsServiceConfig,
} from "../trading-constraints.service.js";

// Create a mock class that implements TradingConstraintsRepository
class MockTradingConstraintsRepository {
  create = vi.fn();
  findByCompetitionId = vi.fn();
  update = vi.fn();
  delete = vi.fn();
  upsert = vi.fn();
}

vi.mock("@recallnet/db/repositories/trading-constraints", () => ({
  TradingConstraintsRepository: vi
    .fn()
    .mockImplementation(() => new MockTradingConstraintsRepository()),
}));

// Mock config with default values
const mockConfig: TradingConstraintsServiceConfig = {
  tradingConstraints: {
    defaultMinimumPairAgeHours: 168,
    defaultMinimum24hVolumeUsd: 100000,
    defaultMinimumLiquidityUsd: 100000,
    defaultMinimumFdvUsd: 1000000,
  },
};

describe("TradingConstraintsService", () => {
  let service: TradingConstraintsService;
  let mockRepo: TradingConstraintsRepository;
  let mockRepoInstance: MockTradingConstraintsRepository;

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
    mockRepoInstance = new MockTradingConstraintsRepository();
    mockRepo = mockRepoInstance as unknown as TradingConstraintsRepository;
    service = new TradingConstraintsService(mockRepo, mockConfig);
    vi.clearAllMocks();
  });

  describe("createConstraints", () => {
    it("should create constraints with custom values", async () => {
      mockRepoInstance.create.mockResolvedValue(mockConstraintsRecord);

      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 200,
        minimum24hVolumeUsd: 150000,
        minimumLiquidityUsd: 120000,
        minimumFdvUsd: 1500000,
        minTradesPerDay: 10,
      };

      const result = await service.createConstraints(input);

      expect(mockRepoInstance.create).toHaveBeenCalledWith(
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
      expect(result?.minimumPairAgeHours).toBe(
        mockConstraintsRecord.minimumPairAgeHours,
      );
    });

    it("should create constraints with default values when custom values not provided", async () => {
      mockRepoInstance.create.mockResolvedValue(mockConstraintsRecord);

      const input = {
        competitionId: testCompetitionId,
      };

      await service.createConstraints(input);

      expect(mockRepoInstance.create).toHaveBeenCalledWith(
        {
          competitionId: testCompetitionId,
          minimumPairAgeHours: 168,
          minimum24hVolumeUsd: 100000,
          minimumLiquidityUsd: 100000,
          minimumFdvUsd: 1000000,
          minTradesPerDay: null,
        },
        undefined,
      );
    });

    it("should create constraints mixing custom and default values", async () => {
      mockRepoInstance.create.mockResolvedValue(mockConstraintsRecord);

      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 240,
        minimum24hVolumeUsd: 200000,
        // minimumLiquidityUsd and minimumFdvUsd will use defaults
        minTradesPerDay: 8,
      };

      await service.createConstraints(input);

      expect(mockRepoInstance.create).toHaveBeenCalledWith(
        {
          competitionId: testCompetitionId,
          minimumPairAgeHours: 240,
          minimum24hVolumeUsd: 200000,
          minimumLiquidityUsd: 100000,
          minimumFdvUsd: 1000000,
          minTradesPerDay: 8,
        },
        undefined,
      );
    });

    it("should handle repository errors gracefully", async () => {
      mockRepoInstance.create.mockRejectedValue(
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
      mockRepoInstance.create.mockResolvedValue(undefined);

      const input = {
        competitionId: testCompetitionId,
      };

      const result = await service.createConstraints(input);
      expect(result).toBeUndefined();
    });
  });

  describe("getConstraints", () => {
    it("should retrieve existing constraints", async () => {
      mockRepoInstance.findByCompetitionId.mockResolvedValue(
        mockConstraintsRecord,
      );

      const result = await service.getConstraints(testCompetitionId);

      expect(mockRepoInstance.findByCompetitionId).toHaveBeenCalledWith(
        testCompetitionId,
      );
      expect(result?.minimumPairAgeHours).toBe(
        mockConstraintsRecord.minimumPairAgeHours,
      );
    });

    it("should return null when constraints not found", async () => {
      mockRepoInstance.findByCompetitionId.mockResolvedValue(null);

      const result = await service.getConstraints(testCompetitionId);

      expect(result).toBeNull();
    });

    it("should handle repository errors", async () => {
      mockRepoInstance.findByCompetitionId.mockRejectedValue(
        new Error("Query timeout"),
      );

      await expect(service.getConstraints(testCompetitionId)).rejects.toThrow(
        "Query timeout",
      );
    });

    it("should cache constraints after first retrieval", async () => {
      mockRepoInstance.findByCompetitionId.mockResolvedValue(
        mockConstraintsRecord,
      );

      // First call - should hit database
      const result1 = await service.getConstraints(testCompetitionId);
      expect(mockRepoInstance.findByCompetitionId).toHaveBeenCalledTimes(1);
      expect(result1?.minimumPairAgeHours).toBe(
        mockConstraintsRecord.minimumPairAgeHours,
      );
      expect(result1?.minimumFdvUsd).toBe(mockConstraintsRecord.minimumFdvUsd);

      // Second call - should use cache
      const result2 = await service.getConstraints(testCompetitionId);
      expect(mockRepoInstance.findByCompetitionId).toHaveBeenCalledTimes(1); // Still 1

      // Verify cached result has correct business data
      expect(result2).toBeDefined();
      expect(result2?.minimumPairAgeHours).toBe(
        mockConstraintsRecord.minimumPairAgeHours,
      );
      expect(result2?.minimum24hVolumeUsd).toBe(
        mockConstraintsRecord.minimum24hVolumeUsd,
      );
      expect(result2?.minimumLiquidityUsd).toBe(
        mockConstraintsRecord.minimumLiquidityUsd,
      );
      expect(result2?.minimumFdvUsd).toBe(mockConstraintsRecord.minimumFdvUsd);
      expect(result2?.minTradesPerDay).toBe(
        mockConstraintsRecord.minTradesPerDay,
      );
    });

    it("should return cached constraints with correct structure", async () => {
      mockRepoInstance.findByCompetitionId.mockResolvedValue(
        mockConstraintsRecord,
      );

      // Prime the cache
      await service.getConstraints(testCompetitionId);

      // Get from cache
      const cached = await service.getConstraints(testCompetitionId);

      expect(cached).toBeDefined();
      expect(cached?.minimumPairAgeHours).toBe(
        mockConstraintsRecord.minimumPairAgeHours,
      );
      expect(cached?.minimum24hVolumeUsd).toBe(
        mockConstraintsRecord.minimum24hVolumeUsd,
      );
      expect(cached?.minimumLiquidityUsd).toBe(
        mockConstraintsRecord.minimumLiquidityUsd,
      );
      expect(cached?.minimumFdvUsd).toBe(mockConstraintsRecord.minimumFdvUsd);
    });

    it("should cache null results", async () => {
      mockRepoInstance.findByCompetitionId.mockResolvedValue(null);

      // First call
      const result1 = await service.getConstraints(testCompetitionId);
      expect(result1).toBeNull();
      expect(mockRepoInstance.findByCompetitionId).toHaveBeenCalledTimes(1);

      // Second call - should NOT hit database again because null is cached
      const result2 = await service.getConstraints(testCompetitionId);
      expect(result2).toBeNull();
      expect(mockRepoInstance.findByCompetitionId).toHaveBeenCalledTimes(1); // Still 1 - null is cached
    });

    it("should handle concurrent requests for same competition", async () => {
      mockRepoInstance.findByCompetitionId.mockResolvedValue(
        mockConstraintsRecord,
      );

      // Make concurrent requests - without cache locking, each request will independently
      // check the cache (empty), query the database, and populate the cache. This may result
      // in multiple DB calls, but all requests will receive correct data and the cache will
      // be populated by the last request to complete.
      const [result1, result2, result3] = await Promise.all([
        service.getConstraints(testCompetitionId),
        service.getConstraints(testCompetitionId),
        service.getConstraints(testCompetitionId),
      ]);

      // All should succeed with business data
      expect(result1?.minimumPairAgeHours).toBe(
        mockConstraintsRecord.minimumPairAgeHours,
      );
      expect(result2?.minimumPairAgeHours).toBe(
        mockConstraintsRecord.minimumPairAgeHours,
      );
      expect(result3?.minimumPairAgeHours).toBe(
        mockConstraintsRecord.minimumPairAgeHours,
      );

      // DB should be called at least once (may be called multiple times for concurrent requests)
      expect(mockRepoInstance.findByCompetitionId).toHaveBeenCalled();
    });
  });

  describe("updateConstraints", () => {
    it("should update constraints with partial data", async () => {
      mockRepoInstance.update.mockResolvedValue(mockConstraintsRecord);

      const update = {
        minimumPairAgeHours: 300,
        minimum24hVolumeUsd: 250000,
      };

      const result = await service.updateConstraints(testCompetitionId, update);

      expect(mockRepoInstance.update).toHaveBeenCalledWith(
        testCompetitionId,
        {
          minimumPairAgeHours: 300,
          minimum24hVolumeUsd: 250000,
        },
        undefined,
      );
      expect(result?.minimumPairAgeHours).toBe(
        mockConstraintsRecord.minimumPairAgeHours,
      );
    });

    it("should update all constraint fields", async () => {
      mockRepoInstance.update.mockResolvedValue(mockConstraintsRecord);

      const update = {
        minimumPairAgeHours: 400,
        minimum24hVolumeUsd: 300000,
        minimumLiquidityUsd: 200000,
        minimumFdvUsd: 2000000,
        minTradesPerDay: 12,
      };

      const result = await service.updateConstraints(testCompetitionId, update);

      expect(mockRepoInstance.update).toHaveBeenCalledWith(
        testCompetitionId,
        update,
        undefined,
      );
      expect(result?.minimumPairAgeHours).toBe(
        mockConstraintsRecord.minimumPairAgeHours,
      );
    });

    it("should handle null minTradesPerDay explicitly", async () => {
      mockRepoInstance.update.mockResolvedValue(mockConstraintsRecord);

      const update = {
        minTradesPerDay: null,
      };

      const result = await service.updateConstraints(testCompetitionId, update);

      expect(mockRepoInstance.update).toHaveBeenCalledWith(
        testCompetitionId,
        {
          minTradesPerDay: null,
        },
        undefined,
      );
      expect(result?.minimumPairAgeHours).toBe(
        mockConstraintsRecord.minimumPairAgeHours,
      );
    });

    it("should throw error when update fails", async () => {
      mockRepoInstance.update.mockResolvedValue(undefined);

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
      mockRepoInstance.update.mockRejectedValue(
        new Error("Constraint violation"),
      );

      const update = {
        minimumPairAgeHours: 200,
      };

      await expect(
        service.updateConstraints(testCompetitionId, update),
      ).rejects.toThrow("Constraint violation");
    });

    it("should filter out undefined values correctly", async () => {
      mockRepoInstance.update.mockResolvedValue(mockConstraintsRecord);

      const update = {
        minimumPairAgeHours: 200,
        minimum24hVolumeUsd: undefined, // Should be filtered out
        minimumLiquidityUsd: 150000,
        minimumFdvUsd: undefined, // Should be filtered out
        minTradesPerDay: 0, // Should be included as 0 is valid
      };

      await service.updateConstraints(testCompetitionId, update);

      expect(mockRepoInstance.update).toHaveBeenCalledWith(
        testCompetitionId,
        {
          minimumPairAgeHours: 200,
          minimumLiquidityUsd: 150000,
          minTradesPerDay: 0,
        },
        undefined,
      );
    });

    it("should clear cache after updating constraints", async () => {
      mockRepoInstance.findByCompetitionId.mockResolvedValue(
        mockConstraintsRecord,
      );
      mockRepoInstance.update.mockResolvedValue({
        ...mockConstraintsRecord,
        minimumPairAgeHours: 300,
      });

      // Prime the cache
      await service.getConstraints(testCompetitionId);
      expect(mockRepoInstance.findByCompetitionId).toHaveBeenCalledTimes(1);

      // Update constraints - should clear cache
      await service.updateConstraints(testCompetitionId, {
        minimumPairAgeHours: 300,
      });

      // Next read should hit database again
      await service.getConstraints(testCompetitionId);
      expect(mockRepoInstance.findByCompetitionId).toHaveBeenCalledTimes(2);
    });
  });

  describe("deleteConstraints", () => {
    it("should delete constraints successfully", async () => {
      mockRepoInstance.delete.mockResolvedValue(true);

      const result = await service.deleteConstraints(testCompetitionId);

      expect(mockRepoInstance.delete).toHaveBeenCalledWith(testCompetitionId);
      expect(result).toBe(true);
    });

    it("should return false when constraints not found for deletion", async () => {
      mockRepoInstance.delete.mockResolvedValue(false);

      const result = await service.deleteConstraints(testCompetitionId);

      expect(result).toBe(false);
    });

    it("should handle repository errors", async () => {
      mockRepoInstance.delete.mockRejectedValue(
        new Error("Foreign key violation"),
      );

      await expect(
        service.deleteConstraints(testCompetitionId),
      ).rejects.toThrow("Foreign key violation");
    });

    it("should clear cache after deleting constraints", async () => {
      mockRepoInstance.findByCompetitionId.mockResolvedValue(
        mockConstraintsRecord,
      );
      mockRepoInstance.delete.mockResolvedValue(true);

      // Prime the cache
      await service.getConstraints(testCompetitionId);
      expect(mockRepoInstance.findByCompetitionId).toHaveBeenCalledTimes(1);

      // Delete constraints - should clear cache
      await service.deleteConstraints(testCompetitionId);

      // Next read should hit database again
      mockRepoInstance.findByCompetitionId.mockResolvedValue(null);
      await service.getConstraints(testCompetitionId);
      expect(mockRepoInstance.findByCompetitionId).toHaveBeenCalledTimes(2);
    });
  });

  describe("upsertConstraints", () => {
    it("should upsert constraints with custom values", async () => {
      mockRepoInstance.upsert.mockResolvedValue(mockConstraintsRecord);

      const input = {
        competitionId: testCompetitionId,
        minimumPairAgeHours: 180,
        minimum24hVolumeUsd: 120000,
        minimumLiquidityUsd: 110000,
        minimumFdvUsd: 1200000,
        minTradesPerDay: 6,
      };

      const result = await service.upsertConstraints(input);

      expect(mockRepoInstance.upsert).toHaveBeenCalledWith({
        competitionId: testCompetitionId,
        minimumPairAgeHours: 180,
        minimum24hVolumeUsd: 120000,
        minimumLiquidityUsd: 110000,
        minimumFdvUsd: 1200000,
        minTradesPerDay: 6,
      });
      expect(result?.minimumPairAgeHours).toBe(
        mockConstraintsRecord.minimumPairAgeHours,
      );
    });

    it("should upsert constraints with defaults", async () => {
      mockRepoInstance.upsert.mockResolvedValue(mockConstraintsRecord);

      const input = {
        competitionId: testCompetitionId,
      };

      await service.upsertConstraints(input);

      expect(mockRepoInstance.upsert).toHaveBeenCalledWith({
        competitionId: testCompetitionId,
        minimumPairAgeHours: 168,
        minimum24hVolumeUsd: 100000,
        minimumLiquidityUsd: 100000,
        minimumFdvUsd: 1000000,
        minTradesPerDay: null,
      });
    });

    it("should throw error when upsert fails", async () => {
      mockRepoInstance.upsert.mockResolvedValue(undefined);

      const input = {
        competitionId: testCompetitionId,
      };

      await expect(service.upsertConstraints(input)).rejects.toThrow(
        `Failed to upsert trading constraints for competition ${testCompetitionId}`,
      );
    });

    it("should handle repository errors", async () => {
      mockRepoInstance.upsert.mockRejectedValue(
        new Error("Unique constraint violation"),
      );

      const input = {
        competitionId: testCompetitionId,
      };

      await expect(service.upsertConstraints(input)).rejects.toThrow(
        "Unique constraint violation",
      );
    });

    it("should clear cache after upserting constraints", async () => {
      mockRepoInstance.findByCompetitionId.mockResolvedValue(
        mockConstraintsRecord,
      );
      mockRepoInstance.upsert.mockResolvedValue({
        ...mockConstraintsRecord,
        minimumPairAgeHours: 200,
      });

      // Prime the cache
      await service.getConstraints(testCompetitionId);
      expect(mockRepoInstance.findByCompetitionId).toHaveBeenCalledTimes(1);

      // Upsert constraints - should clear cache
      await service.upsertConstraints({
        competitionId: testCompetitionId,
        minimumPairAgeHours: 200,
      });

      // Next read should hit database again
      await service.getConstraints(testCompetitionId);
      expect(mockRepoInstance.findByCompetitionId).toHaveBeenCalledTimes(2);
    });
  });

  describe("getConstraintsWithDefaults", () => {
    it("should return existing constraints when found", async () => {
      mockRepoInstance.findByCompetitionId.mockResolvedValue(
        mockConstraintsRecord,
      );

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
      mockRepoInstance.findByCompetitionId.mockResolvedValue(null);

      const result =
        await service.getConstraintsWithDefaults(testCompetitionId);

      expect(result).toEqual({
        minimumPairAgeHours: 168,
        minimum24hVolumeUsd: 100000,
        minimumLiquidityUsd: 100000,
        minimumFdvUsd: 1000000,
        minTradesPerDay: null,
      });
    });

    it("should handle repository errors", async () => {
      mockRepoInstance.findByCompetitionId.mockRejectedValue(
        new Error("Connection lost"),
      );

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
      mockRepoInstance.update.mockResolvedValue({
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
      mockRepoInstance.create.mockResolvedValue({
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
      const newService = new TradingConstraintsService(mockRepo, mockConfig);
      expect(newService).toBeInstanceOf(TradingConstraintsService);
    });

    it("should maintain consistent error messages", async () => {
      mockRepoInstance.update.mockResolvedValue(undefined);
      mockRepoInstance.upsert.mockResolvedValue(undefined);

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
      mockRepoInstance.create.mockRejectedValue(originalError);

      await expect(
        service.createConstraints({ competitionId: testCompetitionId }),
      ).rejects.toThrow("Database deadlock detected");
    });

    it("should handle race conditions during constraint updates", async () => {
      const concurrencyError = new Error(
        "could not serialize access due to concurrent update",
      );
      mockRepoInstance.update.mockRejectedValueOnce(concurrencyError);

      await expect(
        service.updateConstraints(testCompetitionId, {
          minimumPairAgeHours: 200,
        }),
      ).rejects.toThrow("could not serialize access due to concurrent update");
    });

    it("should maintain constraint consistency during partial repository failures", async () => {
      mockRepoInstance.findByCompetitionId.mockResolvedValue(null);
      mockRepoInstance.upsert.mockResolvedValue(mockConstraintsRecord);

      const result = await service.upsertConstraints({
        competitionId: testCompetitionId,
        minimumPairAgeHours: 168,
      });

      expect(mockRepoInstance.upsert).toHaveBeenCalledWith({
        competitionId: testCompetitionId,
        minimumPairAgeHours: 168,
        minimum24hVolumeUsd: 100000,
        minimumLiquidityUsd: 100000,
        minimumFdvUsd: 1000000,
        minTradesPerDay: null,
      });
      expect(result?.minimumPairAgeHours).toBe(
        mockConstraintsRecord.minimumPairAgeHours,
      );
    });

    it("should handle memory pressure during bulk constraint operations", async () => {
      mockRepoInstance.create.mockRejectedValue(new Error("out of memory"));

      await expect(
        service.createConstraints({ competitionId: testCompetitionId }),
      ).rejects.toThrow("out of memory");
    });
  });
});
