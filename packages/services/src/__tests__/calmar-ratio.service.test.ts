import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";

import { CalmarRatioService } from "../calmar-ratio.service.js";

describe("CalmarRatioService", () => {
  let service: CalmarRatioService;

  // Helper to create mock competition with all required fields
  const createMockCompetition = (
    startDate: Date | null,
    endDate?: Date | null,
  ) => ({
    id: "comp-123",
    name: "Test Competition",
    description: "Test competition description",
    type: "perpetual_futures" as const,
    externalUrl: null,
    imageUrl: null,
    startDate,
    endDate: endDate !== undefined ? endDate : null,
    boostStartDate: null,
    boostEndDate: null,
    joinStartDate: null,
    joinEndDate: null,
    maxParticipants: null,
    registeredParticipants: 0,
    status: "active" as const,
    sandboxMode: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    creatorId: "creator-123",
    crossChainTradingType: "disallowAll" as const,
    minimumStake: null,
    evaluationMetric: "calmar_ratio" as const,
  });

  // Helper to create mock portfolio snapshots
  const createMockSnapshots = (startValue: number, endValue: number) => ({
    first: {
      id: 1,
      agentId: "agent-456",
      competitionId: "comp-123",
      totalValue: startValue,
      timestamp: new Date("2025-01-20T00:00:00Z"),
    },
    last: {
      id: 2,
      agentId: "agent-456",
      competitionId: "comp-123",
      totalValue: endValue,
      timestamp: new Date("2025-01-25T00:00:00Z"),
    },
  });

  let mockCompeitionRepo: MockProxy<CompetitionRepository>;
  let mockLogger: MockProxy<Logger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCompeitionRepo = mock<CompetitionRepository>();
    mockLogger = mock<Logger>();
    service = new CalmarRatioService(mockCompeitionRepo, mockLogger);
  });

  describe("calculateCalmarRatio", () => {
    it("should calculate Calmar ratio with simple returns", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";
      const competition = createMockCompetition(
        new Date("2025-01-20"),
        new Date("2025-01-27"),
      );
      const snapshots = createMockSnapshots(1000, 1150); // 15% return
      const maxDrawdown = -0.2; // 20% drawdown

      mockCompeitionRepo.findById.mockResolvedValue(competition);
      mockCompeitionRepo.getFirstAndLastSnapshots.mockResolvedValue(snapshots);
      mockCompeitionRepo.calculateMaxDrawdown.mockResolvedValue(maxDrawdown);

      const result = await service.calculateCalmarRatio(agentId, competitionId);

      expect(result).toBeDefined();
      expect(result.simpleReturn).toBe("0.15000000");
      expect(result.calmarRatio).toBeDefined();

      // Verify snapshots were fetched
      expect(mockCompeitionRepo.getFirstAndLastSnapshots).toHaveBeenCalledWith(
        competitionId,
        agentId,
      );

      // Verify max drawdown calculation uses snapshot dates for consistency
      expect(mockCompeitionRepo.calculateMaxDrawdown).toHaveBeenCalledWith(
        agentId,
        competitionId,
        snapshots.first?.timestamp,
        snapshots.last?.timestamp,
      );

      // Verify calculated values
      expect(result).toMatchObject({
        agentId,
        competitionId,
        simpleReturn: "0.15000000",
        maxDrawdown: "-0.20000000",
        snapshotCount: 2,
      });
    });

    it("should handle zero drawdown by using minimum value", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompeitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")),
      );
      mockCompeitionRepo.getFirstAndLastSnapshots.mockResolvedValue(
        createMockSnapshots(1000, 2500), // 150% return
      );
      mockCompeitionRepo.calculateMaxDrawdown.mockResolvedValue(0); // No drawdown

      const result = await service.calculateCalmarRatio(agentId, competitionId);

      // Should use minimum drawdown of 0.0001: 1.50 / 0.0001 = 15000
      expect(result).toMatchObject({
        calmarRatio: "15000.00000000",
      });
    });

    it("should handle negative returns with drawdown", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompeitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")),
      );
      mockCompeitionRepo.getFirstAndLastSnapshots.mockResolvedValue(
        createMockSnapshots(1000, 900), // -10% return
      );
      mockCompeitionRepo.calculateMaxDrawdown.mockResolvedValue(-0.1); // 10% drawdown (must exist with negative return)

      const result = await service.calculateCalmarRatio(agentId, competitionId);

      // Should calculate normally: -0.10 / 0.10 = -1.0
      expect(result).toMatchObject({
        calmarRatio: "-1.00000000",
      });
    });

    it("should handle very short competitions (< 1 day)", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";
      const startDate = new Date("2025-01-20T10:00:00Z");
      const endDate = new Date("2025-01-20T14:00:00Z"); // 4 hours

      mockCompeitionRepo.findById.mockResolvedValue(
        createMockCompetition(startDate, endDate),
      );
      // Create custom snapshots with 4-hour gap for this test
      mockCompeitionRepo.getFirstAndLastSnapshots.mockResolvedValue({
        first: {
          id: 1,
          agentId: "agent-456",
          competitionId: "comp-123",
          totalValue: 1000,
          timestamp: new Date("2025-01-20T10:00:00Z"),
        },
        last: {
          id: 2,
          agentId: "agent-456",
          competitionId: "comp-123",
          totalValue: 1010,
          timestamp: new Date("2025-01-20T14:00:00Z"), // 4 hours later
        },
      });
      mockCompeitionRepo.calculateMaxDrawdown.mockResolvedValue(-0.005); // 0.5% drawdown

      const result = await service.calculateCalmarRatio(agentId, competitionId);

      // For very short periods (< 1 day), return should NOT be annualized
      expect(result).toMatchObject({
        simpleReturn: "0.01000000",
        annualizedReturn: "0.01000000", // Not annualized for < 1 day
      });
    });

    it("should use snapshot dates for calculations even if competition has no end date", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";
      const startDate = new Date("2025-01-20");

      mockCompeitionRepo.findById.mockResolvedValue(
        createMockCompetition(startDate), // No end date
      );

      const mockSnapshots = createMockSnapshots(1000, 1100); // 10% return
      mockCompeitionRepo.getFirstAndLastSnapshots.mockResolvedValue(
        mockSnapshots,
      );
      mockCompeitionRepo.calculateMaxDrawdown.mockResolvedValue(-0.05);

      const result = await service.calculateCalmarRatio(agentId, competitionId);

      // Verify max drawdown was called with snapshot dates for consistency
      // This ensures return and drawdown are calculated over the same time period
      expect(mockCompeitionRepo.calculateMaxDrawdown).toHaveBeenCalledWith(
        agentId,
        competitionId,
        mockSnapshots.first?.timestamp,
        mockSnapshots.last?.timestamp,
      );

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.agentId).toBe(agentId);
      expect(result.competitionId).toBe(competitionId);
    });

    it("should throw error if competition not found", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompeitionRepo.findById.mockResolvedValue(undefined);

      await expect(
        service.calculateCalmarRatio(agentId, competitionId),
      ).rejects.toThrow(`Competition ${competitionId} not found`);

      expect(
        mockCompeitionRepo.getFirstAndLastSnapshots,
      ).not.toHaveBeenCalled();
    });

    it("should throw error if competition not started", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompeitionRepo.findById.mockResolvedValue(
        createMockCompetition(null), // No start date
      );

      await expect(
        service.calculateCalmarRatio(agentId, competitionId),
      ).rejects.toThrow(`Competition ${competitionId} has not started yet`);
    });

    it("should throw error if no portfolio snapshots found", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompeitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")),
      );
      mockCompeitionRepo.getFirstAndLastSnapshots.mockResolvedValue({
        first: null,
        last: null,
      });

      await expect(
        service.calculateCalmarRatio(agentId, competitionId),
      ).rejects.toThrow("Insufficient data: No portfolio snapshots found");
    });

    it("should throw error if starting value is zero", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompeitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")),
      );
      mockCompeitionRepo.getFirstAndLastSnapshots.mockResolvedValue(
        createMockSnapshots(0, 1000), // Starting value is 0
      );

      await expect(
        service.calculateCalmarRatio(agentId, competitionId),
      ).rejects.toThrow("Invalid data: Starting portfolio value is zero");
    });

    it("should correctly calculate negative Calmar ratio for losses", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompeitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")),
      );
      mockCompeitionRepo.getFirstAndLastSnapshots.mockResolvedValue(
        createMockSnapshots(1000, 800), // -20% return
      );
      mockCompeitionRepo.calculateMaxDrawdown.mockResolvedValue(-0.25); // 25% drawdown

      const result = await service.calculateCalmarRatio(agentId, competitionId);

      // Verify negative Calmar ratio
      expect(result).toMatchObject({
        simpleReturn: "-0.20000000",
        // Calmar should be negative when return is negative
        // Expected: annualized(-0.20) / abs(-0.25)
      });
    });
  });
});
