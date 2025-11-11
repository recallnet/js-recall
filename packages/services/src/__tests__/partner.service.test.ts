import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { PartnerRepository } from "@recallnet/db/repositories/partner";
import {
  SelectCompetitionPartner,
  SelectPartner,
} from "@recallnet/db/schema/core/types";

import { PartnerService } from "../partner.service.js";
import { ApiError } from "../types/index.js";

describe("PartnerService", () => {
  let service: PartnerService;
  let mockRepo: MockProxy<PartnerRepository>;
  let mockLogger: MockProxy<Logger>;

  // Helper to create mock partner
  const createMockPartner = (id: string, name: string): SelectPartner => ({
    id,
    name,
    url: "https://example.com",
    logoUrl: "https://example.com/logo.png",
    details: "Partner details",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  });

  // Helper to create mock competition partner association
  const createMockAssociation = (
    competitionId: string,
    partnerId: string,
    position: number,
  ): SelectCompetitionPartner => ({
    id: `assoc-${competitionId}-${partnerId}`,
    competitionId,
    partnerId,
    position,
    createdAt: new Date("2025-01-01"),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = mock<PartnerRepository>();
    mockLogger = mock<Logger>();
    service = new PartnerService(mockRepo, mockLogger);
  });

  describe("createPartner", () => {
    it("should create partner with valid data", async () => {
      const partnerData = {
        name: "Aerodrome",
        url: "https://aerodrome.finance",
        logoUrl: "https://aerodrome.finance/logo.png",
        details: "Leading DEX on Base",
      };

      const mockPartner = createMockPartner("partner-123", "Aerodrome");
      mockRepo.findByName.mockResolvedValue(undefined); // No existing partner
      mockRepo.create.mockResolvedValue(mockPartner);

      const result = await service.createPartner(partnerData);

      expect(result).toEqual(mockPartner);
      expect(mockRepo.findByName).toHaveBeenCalledWith("Aerodrome");
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Aerodrome",
          url: "https://aerodrome.finance",
        }),
      );
    });

    it("should reject duplicate partner name", async () => {
      const partnerData = {
        name: "Existing Partner",
        url: "https://example.com",
      };

      mockRepo.findByName.mockResolvedValue(
        createMockPartner("partner-123", "Existing Partner"),
      );

      await expect(service.createPartner(partnerData)).rejects.toThrow(
        ApiError,
      );
      await expect(service.createPartner(partnerData)).rejects.toThrow(
        /already exists/,
      );
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("should return partner when found", async () => {
      const mockPartner = createMockPartner("partner-123", "Aerodrome");
      mockRepo.findById.mockResolvedValue(mockPartner);

      const result = await service.findById("partner-123");

      expect(result).toEqual(mockPartner);
      expect(mockRepo.findById).toHaveBeenCalledWith("partner-123");
    });

    it("should throw 404 when partner not found", async () => {
      mockRepo.findById.mockResolvedValue(undefined);

      await expect(service.findById("nonexistent")).rejects.toThrow(ApiError);
      await expect(service.findById("nonexistent")).rejects.toThrow(
        /not found/,
      );
    });
  });

  describe("findAll", () => {
    it("should return paginated partners", async () => {
      const mockPartners = [
        createMockPartner("partner-1", "Partner 1"),
        createMockPartner("partner-2", "Partner 2"),
      ];

      mockRepo.findAll.mockResolvedValue({
        partners: mockPartners,
        total: 2,
      });

      const result = await service.findAll({ limit: 10, offset: 0, sort: "" });

      expect(result.partners).toEqual(mockPartners);
      expect(result.pagination).toEqual({
        total: 2,
        limit: 10,
        offset: 0,
        hasMore: false,
      });
    });

    it("should pass name filter to repository", async () => {
      mockRepo.findAll.mockResolvedValue({
        partners: [],
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
    it("should update partner successfully", async () => {
      const updateData = { name: "Updated Name", url: "https://newurl.com" };
      const updatedPartner = createMockPartner("partner-123", "Updated Name");

      mockRepo.update.mockResolvedValue(updatedPartner);

      const result = await service.update("partner-123", updateData);

      expect(result).toEqual(updatedPartner);
      expect(mockRepo.update).toHaveBeenCalledWith("partner-123", updateData);
    });
  });

  describe("delete", () => {
    it("should delete partner successfully", async () => {
      mockRepo.delete.mockResolvedValue(true);

      const result = await service.delete("partner-123");

      expect(result).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith("partner-123");
    });

    it("should throw 404 when partner not found", async () => {
      mockRepo.delete.mockResolvedValue(false);

      await expect(service.delete("nonexistent")).rejects.toThrow(ApiError);
      await expect(service.delete("nonexistent")).rejects.toThrow(/not found/);
    });
  });

  describe("findByCompetition", () => {
    it("should return partners for competition", async () => {
      const mockPartners = [
        {
          ...createMockPartner("partner-1", "Partner 1"),
          position: 1,
          competitionPartnerId: "assoc-1",
        },
        {
          ...createMockPartner("partner-2", "Partner 2"),
          position: 2,
          competitionPartnerId: "assoc-2",
        },
      ];

      mockRepo.findByCompetition.mockResolvedValue(mockPartners);

      const result = await service.findByCompetition("comp-123");

      expect(result).toEqual(mockPartners);
      expect(mockRepo.findByCompetition).toHaveBeenCalledWith("comp-123");
    });
  });

  describe("addToCompetition", () => {
    it("should add partner to competition", async () => {
      const params = {
        competitionId: "comp-123",
        partnerId: "partner-123",
        position: 1,
      };

      const mockPartner = createMockPartner("partner-123", "Aerodrome");
      const mockAssociation = createMockAssociation(
        "comp-123",
        "partner-123",
        1,
      );

      mockRepo.findById.mockResolvedValue(mockPartner);
      mockRepo.addToCompetition.mockResolvedValue(mockAssociation);

      const result = await service.addToCompetition(params);

      expect(result).toEqual(mockAssociation);
      expect(mockRepo.findById).toHaveBeenCalledWith("partner-123");
      expect(mockRepo.addToCompetition).toHaveBeenCalledWith(
        "comp-123",
        "partner-123",
        1,
      );
    });

    it("should throw 404 when partner does not exist", async () => {
      const params = {
        competitionId: "comp-123",
        partnerId: "nonexistent",
        position: 1,
      };

      mockRepo.findById.mockResolvedValue(undefined);

      await expect(service.addToCompetition(params)).rejects.toThrow(ApiError);
      await expect(service.addToCompetition(params)).rejects.toThrow(
        /not found/,
      );
      expect(mockRepo.addToCompetition).not.toHaveBeenCalled();
    });
  });

  describe("removeFromCompetition", () => {
    it("should remove partner from competition", async () => {
      mockRepo.removeFromCompetition.mockResolvedValue(true);

      const result = await service.removeFromCompetition(
        "comp-123",
        "partner-123",
      );

      expect(result).toBe(true);
      expect(mockRepo.removeFromCompetition).toHaveBeenCalledWith(
        "comp-123",
        "partner-123",
      );
    });

    it("should throw 404 when association not found", async () => {
      mockRepo.removeFromCompetition.mockResolvedValue(false);

      await expect(
        service.removeFromCompetition("comp-123", "partner-123"),
      ).rejects.toThrow(ApiError);
      await expect(
        service.removeFromCompetition("comp-123", "partner-123"),
      ).rejects.toThrow(/not found/);
    });
  });

  describe("updatePosition", () => {
    it("should update partner position in competition", async () => {
      const mockAssociation = createMockAssociation(
        "comp-123",
        "partner-123",
        2,
      );
      mockRepo.updatePosition.mockResolvedValue(mockAssociation);

      const result = await service.updatePosition("comp-123", "partner-123", 2);

      expect(result).toEqual(mockAssociation);
      expect(mockRepo.updatePosition).toHaveBeenCalledWith(
        "comp-123",
        "partner-123",
        2,
      );
    });
  });

  describe("replaceCompetitionPartners", () => {
    it("should replace all partners atomically", async () => {
      const partnerData = [
        { partnerId: "partner-1", position: 1 },
        { partnerId: "partner-2", position: 2 },
      ];

      const mockPartner1 = createMockPartner("partner-1", "Partner 1");
      const mockPartner2 = createMockPartner("partner-2", "Partner 2");
      const mockAssociations = [
        createMockAssociation("comp-123", "partner-1", 1),
        createMockAssociation("comp-123", "partner-2", 2),
      ];

      // Mock enriched data that will be returned
      const mockEnrichedPartners = [
        {
          ...mockPartner1,
          position: 1,
          competitionPartnerId: "assoc-comp-123-partner-1",
        },
        {
          ...mockPartner2,
          position: 2,
          competitionPartnerId: "assoc-comp-123-partner-2",
        },
      ];

      mockRepo.findById
        .mockResolvedValueOnce(mockPartner1)
        .mockResolvedValueOnce(mockPartner2);
      mockRepo.replaceCompetitionPartners.mockResolvedValue(mockAssociations);
      mockRepo.findByCompetition.mockResolvedValue(mockEnrichedPartners);

      const result = await service.replaceCompetitionPartners(
        "comp-123",
        partnerData,
      );

      expect(result).toEqual(mockAssociations);
      expect(result).toEqual(mockEnrichedPartners);
      expect(mockRepo.findById).toHaveBeenCalledTimes(2);
      expect(mockRepo.replaceCompetitionPartners).toHaveBeenCalledWith(
        "comp-123",
        partnerData,
      );
      expect(mockRepo.findByCompetition).toHaveBeenCalledWith("comp-123");
    });

    it("should throw error if any partner not found", async () => {
      const partnerData = [
        { partnerId: "partner-1", position: 1 },
        { partnerId: "nonexistent", position: 2 },
      ];

      const mockPartner1 = createMockPartner("partner-1", "Partner 1");
      mockRepo.findById
        .mockResolvedValueOnce(mockPartner1)
        .mockResolvedValueOnce(undefined);

      await expect(
        service.replaceCompetitionPartners("comp-123", partnerData),
      ).rejects.toThrow(ApiError);
      await expect(
        service.replaceCompetitionPartners("comp-123", partnerData),
      ).rejects.toThrow(/not found/);
      expect(mockRepo.replaceCompetitionPartners).not.toHaveBeenCalled();
    });
  });

  describe("findOrCreate", () => {
    it("should return existing partner when found", async () => {
      const partnerData = {
        name: "Aerodrome",
        url: "https://aerodrome.finance",
      };

      const mockPartner = createMockPartner("partner-123", "Aerodrome");
      mockRepo.findOrCreate.mockResolvedValue(mockPartner);

      const result = await service.findOrCreate(partnerData);

      expect(result).toEqual(mockPartner);
      expect(mockRepo.findOrCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Aerodrome",
          url: "https://aerodrome.finance",
        }),
      );
    });

    it("should create new partner when not found", async () => {
      const partnerData = {
        name: "New Partner",
      };

      const mockPartner = createMockPartner("partner-new", "New Partner");
      mockRepo.findOrCreate.mockResolvedValue(mockPartner);

      const result = await service.findOrCreate(partnerData);

      expect(result).toEqual(mockPartner);
    });
  });
});
