import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { ArenaRepository } from "@recallnet/db/repositories/arena";
import type { ClassificationFilters } from "@recallnet/db/repositories/arena";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { SelectArena } from "@recallnet/db/schema/core/types";

import { ArenaService } from "../arena.service.js";
import { ApiError } from "../types/index.js";

describe("ArenaService", () => {
  let service: ArenaService;
  let mockRepo: MockProxy<ArenaRepository>;
  let mockLogger: MockProxy<Logger>;

  // Helper to create mock arena
  const createMockArena = (id: string, name: string): SelectArena => ({
    id,
    name,
    createdBy: "system",
    category: "crypto_trading",
    skill: "spot_paper_trading",
    venues: null,
    chains: null,
    kind: "Competition",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = mock<ArenaRepository>();
    const mockCompetitionRepo = mock<CompetitionRepository>();
    mockLogger = mock<Logger>();
    service = new ArenaService(mockRepo, mockCompetitionRepo, mockLogger);
  });

  describe("createArena", () => {
    it("should create arena with valid data", async () => {
      const arenaData = {
        id: "test-arena",
        name: "Test Arena",
        createdBy: "admin-123",
        category: "crypto_trading",
        skill: "spot_paper_trading",
        venues: ["aerodrome"],
        chains: ["base"],
      };

      const mockArena = createMockArena("test-arena", "Test Arena");
      mockRepo.findById.mockResolvedValue(undefined); // No existing arena
      mockRepo.create.mockResolvedValue(mockArena);

      const result = await service.createArena(arenaData);

      expect(result).toEqual(mockArena);
      expect(mockRepo.findById).toHaveBeenCalledWith("test-arena");
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "test-arena",
          name: "Test Arena",
          category: "crypto_trading",
          skill: "spot_paper_trading",
        }),
      );
    });

    it("should reject invalid arena ID format", async () => {
      const arenaData = {
        id: "InvalidID_With_Caps",
        name: "Test Arena",
        createdBy: "admin-123",
        category: "crypto_trading",
        skill: "spot_paper_trading",
      };

      await expect(service.createArena(arenaData)).rejects.toThrow(ApiError);
      await expect(service.createArena(arenaData)).rejects.toThrow(
        /lowercase kebab-case/,
      );
    });

    it("should reject duplicate arena ID", async () => {
      const arenaData = {
        id: "existing-arena",
        name: "Test Arena",
        createdBy: "admin-123",
        category: "crypto_trading",
        skill: "spot_paper_trading",
      };

      mockRepo.findById.mockResolvedValue(
        createMockArena("existing-arena", "Existing Arena"),
      );

      await expect(service.createArena(arenaData)).rejects.toThrow(ApiError);
      await expect(service.createArena(arenaData)).rejects.toThrow(
        /already exists/,
      );
    });
  });

  describe("findById", () => {
    it("should return arena when found", async () => {
      const mockArena = createMockArena("test-arena", "Test Arena");
      mockRepo.findById.mockResolvedValue(mockArena);

      const result = await service.findById("test-arena");

      expect(result).toEqual(mockArena);
      expect(mockRepo.findById).toHaveBeenCalledWith("test-arena");
    });

    it("should throw 404 when arena not found", async () => {
      mockRepo.findById.mockResolvedValue(undefined);

      await expect(service.findById("nonexistent")).rejects.toThrow(ApiError);
      await expect(service.findById("nonexistent")).rejects.toThrow(
        /not found/,
      );
    });
  });

  describe("findAll", () => {
    it("should return paginated arenas", async () => {
      const mockArenas = [
        createMockArena("arena-1", "Arena 1"),
        createMockArena("arena-2", "Arena 2"),
      ];

      mockRepo.findAll.mockResolvedValue({
        arenas: mockArenas,
        total: 2,
      });

      const result = await service.findAll({ limit: 10, offset: 0, sort: "" });

      expect(result.arenas).toEqual(mockArenas);
      expect(result.pagination).toEqual({
        total: 2,
        limit: 10,
        offset: 0,
        hasMore: false,
      });
    });

    it("should pass name filter to repository", async () => {
      mockRepo.findAll.mockResolvedValue({
        arenas: [],
        total: 0,
      });

      await service.findAll({ limit: 10, offset: 0, sort: "" }, "Aerodrome");

      expect(mockRepo.findAll).toHaveBeenCalledWith(
        { limit: 10, offset: 0, sort: "" },
        "Aerodrome",
      );
    });
  });

  describe("update", () => {
    it("should update arena successfully", async () => {
      const updateData = { name: "Updated Name" };
      const updatedArena = createMockArena("test-arena", "Updated Name");

      mockRepo.update.mockResolvedValue(updatedArena);

      const result = await service.update("test-arena", updateData);

      expect(result).toEqual(updatedArena);
      expect(mockRepo.update).toHaveBeenCalledWith("test-arena", updateData);
    });

    it("should throw error when update fails", async () => {
      mockRepo.update.mockRejectedValue(new Error("Database error"));

      await expect(
        service.update("test-arena", { name: "New Name" }),
      ).rejects.toThrow(ApiError);
    });
  });

  describe("delete", () => {
    it("should delete arena when no competitions exist", async () => {
      mockRepo.canDelete.mockResolvedValue(true);
      mockRepo.delete.mockResolvedValue(true);

      const result = await service.delete("test-arena");

      expect(result).toBe(true);
      expect(mockRepo.canDelete).toHaveBeenCalledWith("test-arena");
      expect(mockRepo.delete).toHaveBeenCalledWith("test-arena");
    });

    it("should throw 409 when arena has competitions", async () => {
      mockRepo.canDelete.mockResolvedValue(false);

      await expect(service.delete("test-arena")).rejects.toThrow(ApiError);
      await expect(service.delete("test-arena")).rejects.toThrow(
        /associated competitions/,
      );
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it("should throw 404 when arena not found", async () => {
      mockRepo.canDelete.mockResolvedValue(true);
      mockRepo.delete.mockResolvedValue(false); // No rows deleted

      await expect(service.delete("nonexistent")).rejects.toThrow(ApiError);
      await expect(service.delete("nonexistent")).rejects.toThrow(/not found/);
    });
  });

  describe("searchByClassification", () => {
    it("should search arenas by category", async () => {
      const mockArenas = [createMockArena("arena-1", "Arena 1")];
      const filters: ClassificationFilters = { category: "crypto_trading" };

      mockRepo.searchByClassification.mockResolvedValue(mockArenas);

      const result = await service.searchByClassification(filters);

      expect(result).toEqual(mockArenas);
      expect(mockRepo.searchByClassification).toHaveBeenCalledWith(filters);
    });

    it("should search arenas by skill", async () => {
      const mockArenas = [createMockArena("arena-1", "Arena 1")];
      const filters: ClassificationFilters = { skill: "spot_paper_trading" };

      mockRepo.searchByClassification.mockResolvedValue(mockArenas);

      const result = await service.searchByClassification(filters);

      expect(result).toEqual(mockArenas);
    });

    it("should search arenas by multiple filters", async () => {
      const filters: ClassificationFilters = {
        category: "crypto_trading",
        skill: "aerodrome",
        chains: ["base"],
        venues: ["aerodrome"],
      };

      mockRepo.searchByClassification.mockResolvedValue([]);

      await service.searchByClassification(filters);

      expect(mockRepo.searchByClassification).toHaveBeenCalledWith(filters);
    });
  });

  describe("findByCategory", () => {
    it("should return arenas for category", async () => {
      const mockArenas = [createMockArena("arena-1", "Arena 1")];
      mockRepo.findByCategory.mockResolvedValue(mockArenas);

      const result = await service.findByCategory("crypto_trading");

      expect(result).toEqual(mockArenas);
      expect(mockRepo.findByCategory).toHaveBeenCalledWith("crypto_trading");
    });
  });

  describe("findBySkill", () => {
    it("should return arenas for skill", async () => {
      const mockArenas = [createMockArena("arena-1", "Arena 1")];
      mockRepo.findBySkill.mockResolvedValue(mockArenas);

      const result = await service.findBySkill("spot_paper_trading");

      expect(result).toEqual(mockArenas);
      expect(mockRepo.findBySkill).toHaveBeenCalledWith("spot_paper_trading");
    });
  });

  describe("getCompetitionCount", () => {
    it("should return competition count for arena", async () => {
      mockRepo.getCompetitionCount.mockResolvedValue(5);

      const result = await service.getCompetitionCount("test-arena");

      expect(result).toBe(5);
      expect(mockRepo.getCompetitionCount).toHaveBeenCalledWith("test-arena");
    });
  });

  describe("findAllWithCompetitionCounts", () => {
    it("should return arenas with competition counts", async () => {
      const mockArenas = [
        { ...createMockArena("arena-1", "Arena 1"), competitionCount: 5 },
        { ...createMockArena("arena-2", "Arena 2"), competitionCount: 3 },
      ];

      mockRepo.findAllWithCompetitionCounts.mockResolvedValue({
        arenas: mockArenas,
        total: 2,
      });

      const result = await service.findAllWithCompetitionCounts({
        limit: 10,
        offset: 0,
        sort: "",
      });

      expect(result.arenas).toEqual(mockArenas);
      expect(result.pagination).toEqual({
        total: 2,
        limit: 10,
        offset: 0,
        hasMore: false,
      });
    });
  });
});
