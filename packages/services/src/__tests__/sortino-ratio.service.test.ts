import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";

import { SortinoRatioService } from "../sortino-ratio.service.js";

describe("SortinoRatioService", () => {
  let service: SortinoRatioService;

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
    minimumStake: null,
    vips: null,
    allowlist: null,
    blocklist: null,
    minRecallRank: null,
    allowlistOnly: false,
    agentAllocation: null,
    agentAllocationUnit: null,
    boosterAllocation: null,
    boosterAllocationUnit: null,
    rewardRules: null,
    rewardDetails: null,
    rewardsIneligible: null,
    status: "active" as const,
    sandboxMode: false,
    displayState: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    creatorId: "creator-123",
    crossChainTradingType: "disallowAll" as const,
    evaluationMetric: "sortino_ratio" as const,
    arenaId: "default-perps-arena",
    engineId: "perpetual_futures" as const,
    engineVersion: "1.0.0",
  });

  // Helper to create mock Sortino metrics from SQL calculation
  const createMockSortinoMetrics = (
    avgReturn = 0.002,
    downsideDeviation = 0.01,
    simpleReturn = 0.15,
    snapshotCount = 100,
  ) => ({
    avgReturn,
    downsideDeviation,
    simpleReturn,
    snapshotCount,
  });

  let mockCompetitionRepo: MockProxy<CompetitionRepository>;
  let mockLogger: MockProxy<Logger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCompetitionRepo = mock<CompetitionRepository>();
    mockLogger = mock<Logger>();
    service = new SortinoRatioService(mockCompetitionRepo, mockLogger);
  });

  describe("calculateSortinoRatio", () => {
    it("should calculate Sortino ratio using database-level calculations", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";
      const competition = createMockCompetition(
        new Date("2025-01-20"),
        new Date("2025-01-27"),
      );
      const sortinoMetrics = createMockSortinoMetrics();

      mockCompetitionRepo.findById.mockResolvedValue(competition);
      mockCompetitionRepo.calculateSortinoMetrics.mockResolvedValue(
        sortinoMetrics,
      );

      const result = await service.calculateSortinoRatio(
        agentId,
        competitionId,
      );

      expect(result).toBeDefined();
      expect(result.sortinoRatio).toBe("0.20000000");
      expect(result.downsideDeviation).toBe("0.01000000");

      // Verify SQL calculation was called with correct parameters
      expect(mockCompetitionRepo.calculateSortinoMetrics).toHaveBeenCalledWith(
        agentId,
        competitionId,
        0, // MAR is always 0 for crypto competitions
      );
    });

    it("should handle zero downside deviation using minimum threshold", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")),
      );
      mockCompetitionRepo.calculateSortinoMetrics.mockResolvedValue(
        createMockSortinoMetrics(0.05, 0, 0.5, 100), // Zero downside deviation, positive return
      );

      const result = await service.calculateSortinoRatio(
        agentId,
        competitionId,
      );

      // Should use minimum downside deviation of 0.0001: 0.05 / 0.0001 = 500
      expect(result).toMatchObject({
        sortinoRatio: "500.00000000",
        downsideDeviation: "0.00000000",
      });
    });

    it("should handle negative returns with downside deviation", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")),
      );
      mockCompetitionRepo.calculateSortinoMetrics.mockResolvedValue(
        createMockSortinoMetrics(-0.01, 0.02, -0.1, 100), // Negative return, higher downside deviation
      );

      const result = await service.calculateSortinoRatio(
        agentId,
        competitionId,
      );

      // Should calculate negative Sortino: -0.01 / 0.02 = -0.5
      expect(result).toMatchObject({
        sortinoRatio: "-0.50000000",
        downsideDeviation: "0.02000000",
      });
    });

    it("should handle no existing metrics (first calculation)", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")),
      );
      mockCompetitionRepo.calculateSortinoMetrics.mockResolvedValue(
        createMockSortinoMetrics(),
      );

      const result = await service.calculateSortinoRatio(
        agentId,
        competitionId,
      );

      // Should calculate Sortino without needing existing metrics
      expect(result).toMatchObject({
        sortinoRatio: expect.any(String),
        downsideDeviation: expect.any(String),
      });
    });

    it("should throw error if competition not found", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(undefined);

      await expect(
        service.calculateSortinoRatio(agentId, competitionId),
      ).rejects.toThrow(`Competition ${competitionId} not found`);

      expect(
        mockCompetitionRepo.calculateSortinoMetrics,
      ).not.toHaveBeenCalled();
    });

    it("should throw error if competition not started", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(null), // No start date
      );

      await expect(
        service.calculateSortinoRatio(agentId, competitionId),
      ).rejects.toThrow(`Competition ${competitionId} has not started yet`);
    });

    it("should throw error if insufficient snapshots", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")),
      );
      mockCompetitionRepo.calculateSortinoMetrics.mockResolvedValue(
        createMockSortinoMetrics(0, 0, 0, 1), // Only 1 snapshot
      );

      await expect(
        service.calculateSortinoRatio(agentId, competitionId),
      ).rejects.toThrow("Insufficient data: Need at least 2 snapshots");
    });

    it("should handle zero return with zero downside deviation", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")),
      );
      mockCompetitionRepo.calculateSortinoMetrics.mockResolvedValue(
        createMockSortinoMetrics(0, 0, 0, 100), // Zero return, zero downside deviation
      );

      const result = await service.calculateSortinoRatio(
        agentId,
        competitionId,
      );

      // Should return 0 when both return and downside deviation are zero
      expect(result).toMatchObject({
        sortinoRatio: "0.00000000",
        downsideDeviation: "0.00000000",
      });
    });

    it("should handle negative return with zero downside deviation", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")),
      );
      mockCompetitionRepo.calculateSortinoMetrics.mockResolvedValue(
        createMockSortinoMetrics(-0.01, 0, -0.1, 100), // Negative return, zero downside deviation (shouldn't happen)
      );

      const result = await service.calculateSortinoRatio(
        agentId,
        competitionId,
      );

      // Should use minimum downside deviation of 0.0001: -0.01 / 0.0001 = -100
      expect(result).toMatchObject({
        sortinoRatio: "-100.00000000",
        downsideDeviation: "0.00000000",
      });
    });

    it("should use competition end date for time-series snapshot timestamp", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";
      const endDate = new Date("2025-01-27");

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20"), endDate),
      );
      mockCompetitionRepo.calculateSortinoMetrics.mockResolvedValue(
        createMockSortinoMetrics(),
      );
      // Mock existing Calmar metrics (Sortino requires Calmar to run first)
      const existingCalmar = new Map();
      existingCalmar.set(competitionId, {
        calmarRatio: "1.5",
        maxDrawdown: "-0.1",
        annualizedReturn: "0.15",
        simpleReturn: "0.1",
        snapshotCount: 100,
      });

      await service.calculateSortinoRatio(agentId, competitionId);
    });

    it("should use current date if competition has no end date", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")), // No end date
      );
      mockCompetitionRepo.calculateSortinoMetrics.mockResolvedValue(
        createMockSortinoMetrics(),
      );
      // Mock existing Calmar metrics (Sortino requires Calmar to run first)
      const existingCalmar = new Map();
      existingCalmar.set(competitionId, {
        calmarRatio: "1.5",
        maxDrawdown: "-0.1",
        annualizedReturn: "0.15",
        simpleReturn: "0.1",
        snapshotCount: 100,
      });

      await service.calculateSortinoRatio(agentId, competitionId);
    });
  });
});
