import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import type { SelectPerpsRiskMetrics } from "@recallnet/db/schema/trading/types";

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
    status: "active" as const,
    sandboxMode: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    creatorId: "creator-123",
    crossChainTradingType: "disallowAll" as const,
    minimumStake: null,
    evaluationMetric: "sortino_ratio" as const,
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

  // Helper to create mock saved metrics result
  const createMockSavedMetrics = (): SelectPerpsRiskMetrics => ({
    id: "metrics-123",
    agentId: "agent-456",
    competitionId: "comp-123",
    simpleReturn: "0.15000000",
    calmarRatio: "0.75000000", // For Calmar: raw return / drawdown = 0.15 / 0.20 = 0.75
    annualizedReturn: "0.00200000", // For Sortino: this is avgReturn (misnomer - not actually annualized)
    maxDrawdown: "-0.20000000",
    sortinoRatio: "0.20000000", // For Sortino: (avgReturn - MAR) / downsideDeviation = (0.002 - 0) / 0.01 = 0.2
    downsideDeviation: "0.01000000",
    snapshotCount: 100,
    calculationTimestamp: new Date(),
  });

  // Helper to create mock existing metrics (for preserving Calmar ratio)
  const createMockExistingMetrics = (): Map<string, SelectPerpsRiskMetrics> => {
    const map = new Map<string, SelectPerpsRiskMetrics>();
    map.set("comp-123", {
      id: "existing-metrics",
      agentId: "agent-456",
      competitionId: "comp-123",
      simpleReturn: "0.10000000",
      calmarRatio: "2.50000000",
      annualizedReturn: "0.00150000",
      maxDrawdown: "-0.15000000",
      sortinoRatio: null,
      downsideDeviation: null,
      snapshotCount: 50,
      calculationTimestamp: new Date(),
    });
    return map;
  };

  let mockCompetitionRepo: MockProxy<CompetitionRepository>;
  let mockPerpsRepo: MockProxy<PerpsRepository>;
  let mockLogger: MockProxy<Logger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCompetitionRepo = mock<CompetitionRepository>();
    mockPerpsRepo = mock<PerpsRepository>();
    mockLogger = mock<Logger>();
    service = new SortinoRatioService(
      mockCompetitionRepo,
      mockPerpsRepo,
      mockLogger,
    );
  });

  describe("calculateAndSaveSortinoRatio", () => {
    it("should calculate and save Sortino ratio using database-level calculations", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";
      const competition = createMockCompetition(
        new Date("2025-01-20"),
        new Date("2025-01-27"),
      );
      const sortinoMetrics = createMockSortinoMetrics();
      const existingMetrics = createMockExistingMetrics();
      const savedMetrics = createMockSavedMetrics();

      mockCompetitionRepo.findById.mockResolvedValue(competition);
      mockCompetitionRepo.calculateSortinoMetricsSQL.mockResolvedValue(
        sortinoMetrics,
      );
      mockPerpsRepo.getBulkAgentRiskMetrics.mockResolvedValue(existingMetrics);
      mockPerpsRepo.upsertRiskMetrics.mockResolvedValue(savedMetrics);

      const result = await service.calculateAndSaveSortinoRatio(
        agentId,
        competitionId,
      );

      expect(result).toBeDefined();
      expect(result.metrics.sortinoRatio).toBe("0.20000000");
      expect(result.metrics.downsideDeviation).toBe("0.01000000");

      // Verify SQL calculation was called with correct parameters
      expect(
        mockCompetitionRepo.calculateSortinoMetricsSQL,
      ).toHaveBeenCalledWith(
        agentId,
        competitionId,
        0, // MAR is always 0 for crypto competitions
      );

      // Verify existing metrics were fetched to preserve Calmar ratio
      expect(mockPerpsRepo.getBulkAgentRiskMetrics).toHaveBeenCalledWith(
        agentId,
        [competitionId],
      );

      // Verify metrics were saved with preserved Calmar ratio
      expect(mockPerpsRepo.upsertRiskMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId,
          competitionId,
          simpleReturn: "0.15000000",
          calmarRatio: "2.50000000", // Preserved from existing
          annualizedReturn: "0.00200000",
          maxDrawdown: "-0.15000000", // Preserved from existing
          sortinoRatio: "0.20000000", // avgReturn (0.002) / downsideDeviation (0.01) = 0.2
          downsideDeviation: "0.01000000",
          snapshotCount: 100,
        }),
      );
    });

    it("should handle zero downside deviation by capping at 100", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")),
      );
      mockCompetitionRepo.calculateSortinoMetricsSQL.mockResolvedValue(
        createMockSortinoMetrics(0.05, 0, 0.5, 100), // Zero downside deviation, positive return
      );
      mockPerpsRepo.getBulkAgentRiskMetrics.mockResolvedValue(new Map());
      mockPerpsRepo.upsertRiskMetrics.mockResolvedValue(
        createMockSavedMetrics(),
      );

      await service.calculateAndSaveSortinoRatio(agentId, competitionId);

      // Should cap at 100 when downside deviation is 0 and return is positive
      expect(mockPerpsRepo.upsertRiskMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          sortinoRatio: "100.00000000",
          downsideDeviation: "0.00000000",
        }),
      );
    });

    it("should handle negative returns with downside deviation", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")),
      );
      mockCompetitionRepo.calculateSortinoMetricsSQL.mockResolvedValue(
        createMockSortinoMetrics(-0.01, 0.02, -0.1, 100), // Negative return, higher downside deviation
      );
      mockPerpsRepo.getBulkAgentRiskMetrics.mockResolvedValue(new Map());
      mockPerpsRepo.upsertRiskMetrics.mockResolvedValue(
        createMockSavedMetrics(),
      );

      await service.calculateAndSaveSortinoRatio(agentId, competitionId);

      // Should calculate negative Sortino: -0.01 / 0.02 = -0.5
      expect(mockPerpsRepo.upsertRiskMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          sortinoRatio: "-0.50000000",
          downsideDeviation: "0.02000000",
        }),
      );
    });

    it("should handle no existing metrics (first calculation)", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")),
      );
      mockCompetitionRepo.calculateSortinoMetricsSQL.mockResolvedValue(
        createMockSortinoMetrics(),
      );
      mockPerpsRepo.getBulkAgentRiskMetrics.mockResolvedValue(new Map()); // No existing metrics
      mockPerpsRepo.upsertRiskMetrics.mockResolvedValue(
        createMockSavedMetrics(),
      );

      await service.calculateAndSaveSortinoRatio(agentId, competitionId);

      // Should use default values for Calmar and max drawdown
      expect(mockPerpsRepo.upsertRiskMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          calmarRatio: "0.00000000", // Default when no existing metrics
          maxDrawdown: "0.00000000", // Default when no existing metrics
        }),
      );
    });

    it("should throw error if competition not found", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(undefined);

      await expect(
        service.calculateAndSaveSortinoRatio(agentId, competitionId),
      ).rejects.toThrow(`Competition ${competitionId} not found`);

      expect(
        mockCompetitionRepo.calculateSortinoMetricsSQL,
      ).not.toHaveBeenCalled();
      expect(mockPerpsRepo.upsertRiskMetrics).not.toHaveBeenCalled();
    });

    it("should throw error if competition not started", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(null), // No start date
      );

      await expect(
        service.calculateAndSaveSortinoRatio(agentId, competitionId),
      ).rejects.toThrow(`Competition ${competitionId} has not started yet`);
    });

    it("should throw error if insufficient snapshots", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")),
      );
      mockCompetitionRepo.calculateSortinoMetricsSQL.mockResolvedValue(
        createMockSortinoMetrics(0, 0, 0, 1), // Only 1 snapshot
      );

      await expect(
        service.calculateAndSaveSortinoRatio(agentId, competitionId),
      ).rejects.toThrow("Insufficient data: Need at least 2 snapshots");
    });

    it("should handle zero return with zero downside deviation", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")),
      );
      mockCompetitionRepo.calculateSortinoMetricsSQL.mockResolvedValue(
        createMockSortinoMetrics(0, 0, 0, 100), // Zero return, zero downside deviation
      );
      mockPerpsRepo.getBulkAgentRiskMetrics.mockResolvedValue(new Map());
      mockPerpsRepo.upsertRiskMetrics.mockResolvedValue(
        createMockSavedMetrics(),
      );

      await service.calculateAndSaveSortinoRatio(agentId, competitionId);

      // Should return 0 when both return and downside deviation are zero
      expect(mockPerpsRepo.upsertRiskMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          sortinoRatio: "0.00000000",
          downsideDeviation: "0.00000000",
        }),
      );
    });

    it("should handle negative return with zero downside deviation", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")),
      );
      mockCompetitionRepo.calculateSortinoMetricsSQL.mockResolvedValue(
        createMockSortinoMetrics(-0.01, 0, -0.1, 100), // Negative return, zero downside deviation (shouldn't happen)
      );
      mockPerpsRepo.getBulkAgentRiskMetrics.mockResolvedValue(new Map());
      mockPerpsRepo.upsertRiskMetrics.mockResolvedValue(
        createMockSavedMetrics(),
      );

      await service.calculateAndSaveSortinoRatio(agentId, competitionId);

      // Should cap at -100 when downside deviation is 0 and return is negative
      expect(mockPerpsRepo.upsertRiskMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          sortinoRatio: "-100.00000000",
          downsideDeviation: "0.00000000",
        }),
      );
    });

    it("should use competition end date for time-series snapshot timestamp", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";
      const endDate = new Date("2025-01-27");

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20"), endDate),
      );
      mockCompetitionRepo.calculateSortinoMetricsSQL.mockResolvedValue(
        createMockSortinoMetrics(),
      );
      mockPerpsRepo.getBulkAgentRiskMetrics.mockResolvedValue(new Map());
      mockPerpsRepo.upsertRiskMetrics.mockResolvedValue(
        createMockSavedMetrics(),
      );

      await service.calculateAndSaveSortinoRatio(agentId, competitionId);
    });

    it("should use current date if competition has no end date", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      mockCompetitionRepo.findById.mockResolvedValue(
        createMockCompetition(new Date("2025-01-20")), // No end date
      );
      mockCompetitionRepo.calculateSortinoMetricsSQL.mockResolvedValue(
        createMockSortinoMetrics(),
      );
      mockPerpsRepo.getBulkAgentRiskMetrics.mockResolvedValue(new Map());
      mockPerpsRepo.upsertRiskMetrics.mockResolvedValue(
        createMockSavedMetrics(),
      );

      await service.calculateAndSaveSortinoRatio(agentId, competitionId);
    });
  });
});
