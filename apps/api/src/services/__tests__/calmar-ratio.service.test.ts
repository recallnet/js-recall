import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  SelectPerpsRiskMetrics,
  SelectPerpsTwrPeriod,
} from "@recallnet/db/schema/trading/types";

import * as competitionRepo from "@/database/repositories/competition-repository.js";
import * as perpsRepo from "@/database/repositories/perps-repository.js";
import { CalmarRatioService } from "@/services/calmar-ratio.service.js";
import type { RiskMetricsResult } from "@/services/calmar-ratio.service.js";
import { TWRCalculatorService } from "@/services/twr-calculator.service.js";
import type { TWRResult } from "@/services/twr-calculator.service.js";

// Mock dependencies
vi.mock("@/database/repositories/competition-repository.js");
vi.mock("@/database/repositories/perps-repository.js");
vi.mock("@/services/twr-calculator.service.js");
vi.mock("@/lib/logger.js");

describe("CalmarRatioService", () => {
  let service: CalmarRatioService;
  let mockTWRCalculator: { calculateTWR: ReturnType<typeof vi.fn> };

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
    votingStartDate: null,
    votingEndDate: null,
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
  });

  // Helper to create mock TWR result
  const createMockTWRResult = (
    twr: number,
    transferCount = 0,
    periodCount = 1,
  ): TWRResult => ({
    timeWeightedReturn: twr,
    periods: Array.from({ length: periodCount }, (_, i) => ({
      periodStart: new Date(`2025-01-20T${String(i).padStart(2, "0")}:00:00Z`),
      periodEnd: new Date(
        `2025-01-20T${String(i + 1).padStart(2, "0")}:00:00Z`,
      ),
      startingEquity: 1000 + i * 100,
      endingEquity: 1100 + i * 100,
      periodReturn: 0.1,
      sequenceNumber: i,
      transferId: i > 0 ? `transfer-${i}` : undefined,
    })),
    transferCount,
    snapshotCount: 2,
  });

  // Helper to create mock saved metrics result
  const createMockSavedMetrics = (): RiskMetricsResult => ({
    metrics: {
      id: "metrics-123",
      agentId: "agent-456",
      competitionId: "comp-123",
      timeWeightedReturn: "0.15000000",
      calmarRatio: "3.00000000",
      annualizedReturn: "2.40000000",
      maxDrawdown: "-0.20000000",
      transferCount: 2,
      periodCount: 3,
      snapshotCount: 2,
      calculationTimestamp: new Date(),
    } as SelectPerpsRiskMetrics,
    periods: [
      {
        id: "period-1",
        metricsId: "metrics-123",
        periodStart: new Date("2025-01-20T00:00:00Z"),
        periodEnd: new Date("2025-01-21T00:00:00Z"),
        periodReturn: "0.05000000",
        startingEquity: "1000.00",
        endingEquity: "1050.00",
        transferId: null,
        sequenceNumber: 0,
      },
    ] as SelectPerpsTwrPeriod[],
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a complete TWR calculator mock
    mockTWRCalculator = {
      calculateTWR: vi.fn(),
    };

    // Mock the TWRCalculatorService constructor to return our mock
    vi.mocked(TWRCalculatorService).mockImplementation(() => {
      return mockTWRCalculator as unknown as TWRCalculatorService;
    });

    service = new CalmarRatioService();
  });

  describe("calculateAndSaveCalmarRatio", () => {
    it("should calculate and save Calmar ratio with all metrics", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";
      const startDate = new Date("2025-01-20");
      const endDate = new Date("2025-01-27");

      // Setup mocks
      vi.mocked(competitionRepo.findById).mockResolvedValueOnce(
        createMockCompetition(startDate, endDate),
      );

      mockTWRCalculator.calculateTWR.mockResolvedValueOnce(
        createMockTWRResult(0.15, 2, 3),
      );

      vi.mocked(competitionRepo.calculateMaxDrawdownSQL).mockResolvedValueOnce(
        -0.2,
      ); // 20% drawdown

      vi.mocked(perpsRepo.saveRiskMetricsWithPeriods).mockResolvedValueOnce(
        createMockSavedMetrics(),
      );

      // Execute
      const result = await service.calculateAndSaveCalmarRatio(
        agentId,
        competitionId,
      );

      // Verify competition lookup
      expect(competitionRepo.findById).toHaveBeenCalledWith(competitionId);

      // Verify TWR calculation
      expect(mockTWRCalculator.calculateTWR).toHaveBeenCalledWith(
        agentId,
        competitionId,
        startDate,
        endDate,
      );

      // Verify max drawdown calculation
      expect(competitionRepo.calculateMaxDrawdownSQL).toHaveBeenCalledWith(
        agentId,
        competitionId,
        startDate,
        endDate,
      );

      // Verify metrics were saved
      expect(perpsRepo.saveRiskMetricsWithPeriods).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId,
          competitionId,
          timeWeightedReturn: "0.15000000",
          calmarRatio: expect.any(String),
          annualizedReturn: expect.any(String),
          maxDrawdown: "-0.20000000",
          transferCount: 2,
          periodCount: 3,
          snapshotCount: 2,
        }),
        expect.arrayContaining([
          expect.objectContaining({
            periodReturn: "0.10000000",
            sequenceNumber: 0,
          }),
        ]),
      );

      // Verify result structure (ignoring exact timestamp)
      expect(result).toMatchObject({
        metrics: expect.objectContaining({
          id: "metrics-123",
          agentId: "agent-456",
          competitionId: "comp-123",
          timeWeightedReturn: "0.15000000",
          calmarRatio: "3.00000000",
          annualizedReturn: "2.40000000",
          maxDrawdown: "-0.20000000",
        }),
        periods: expect.arrayContaining([
          expect.objectContaining({
            periodReturn: "0.05000000",
          }),
        ]),
      });
    });

    it("should handle zero drawdown by capping Calmar ratio", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      vi.mocked(competitionRepo.findById).mockResolvedValueOnce(
        createMockCompetition(new Date("2025-01-20")),
      );

      mockTWRCalculator.calculateTWR.mockResolvedValueOnce(
        createMockTWRResult(0.5, 0, 1), // 50% return
      );

      vi.mocked(competitionRepo.calculateMaxDrawdownSQL).mockResolvedValueOnce(
        0,
      ); // No drawdown

      vi.mocked(perpsRepo.saveRiskMetricsWithPeriods).mockResolvedValueOnce(
        createMockSavedMetrics(),
      );

      await service.calculateAndSaveCalmarRatio(agentId, competitionId);

      // Calmar should be capped at 100 when there's no drawdown
      expect(perpsRepo.saveRiskMetricsWithPeriods).toHaveBeenCalledWith(
        expect.objectContaining({
          calmarRatio: "100.00000000",
        }),
        expect.any(Array),
      );
    });

    it("should handle negative returns with zero drawdown", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      vi.mocked(competitionRepo.findById).mockResolvedValueOnce(
        createMockCompetition(new Date("2025-01-20")),
      );

      mockTWRCalculator.calculateTWR.mockResolvedValueOnce(
        createMockTWRResult(-0.1, 0, 1), // -10% return
      );

      vi.mocked(competitionRepo.calculateMaxDrawdownSQL).mockResolvedValueOnce(
        0,
      ); // No drawdown (weird but possible)

      vi.mocked(perpsRepo.saveRiskMetricsWithPeriods).mockResolvedValueOnce(
        createMockSavedMetrics(),
      );

      await service.calculateAndSaveCalmarRatio(agentId, competitionId);

      // Should cap at -100 for negative return with no drawdown
      expect(perpsRepo.saveRiskMetricsWithPeriods).toHaveBeenCalledWith(
        expect.objectContaining({
          calmarRatio: "-100.00000000",
        }),
        expect.any(Array),
      );
    });

    it("should handle very short competitions (< 1 day)", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";
      const startDate = new Date("2025-01-20T10:00:00Z");
      const endDate = new Date("2025-01-20T14:00:00Z"); // 4 hours

      vi.mocked(competitionRepo.findById).mockResolvedValueOnce(
        createMockCompetition(startDate, endDate),
      );

      mockTWRCalculator.calculateTWR.mockResolvedValueOnce(
        createMockTWRResult(0.01, 0, 1), // 1% in 4 hours
      );

      vi.mocked(competitionRepo.calculateMaxDrawdownSQL).mockResolvedValueOnce(
        -0.005,
      ); // 0.5% drawdown

      vi.mocked(perpsRepo.saveRiskMetricsWithPeriods).mockResolvedValueOnce(
        createMockSavedMetrics(),
      );

      await service.calculateAndSaveCalmarRatio(agentId, competitionId);

      // For very short periods (< 1 day), return should NOT be annualized
      expect(perpsRepo.saveRiskMetricsWithPeriods).toHaveBeenCalledWith(
        expect.objectContaining({
          timeWeightedReturn: "0.01000000",
          annualizedReturn: "0.01000000", // Not annualized for < 1 day
        }),
        expect.any(Array),
      );
    });

    it("should use current time if competition has no end date", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";
      const startDate = new Date("2025-01-20");
      const beforeCall = new Date();

      vi.mocked(competitionRepo.findById).mockResolvedValueOnce(
        createMockCompetition(startDate), // No end date
      );

      mockTWRCalculator.calculateTWR.mockResolvedValueOnce(
        createMockTWRResult(0.1),
      );
      vi.mocked(competitionRepo.calculateMaxDrawdownSQL).mockResolvedValueOnce(
        -0.1,
      );
      vi.mocked(perpsRepo.saveRiskMetricsWithPeriods).mockResolvedValueOnce(
        createMockSavedMetrics(),
      );

      await service.calculateAndSaveCalmarRatio(agentId, competitionId);

      const afterCall = new Date();

      // Verify TWR was called with a date close to now
      expect(mockTWRCalculator.calculateTWR).toHaveBeenCalledWith(
        agentId,
        competitionId,
        startDate,
        expect.any(Date),
      );

      const actualEndDate = mockTWRCalculator.calculateTWR.mock.calls[0]?.[3];
      expect(actualEndDate).toBeDefined();
      expect(actualEndDate!.getTime()).toBeGreaterThanOrEqual(
        beforeCall.getTime(),
      );
      expect(actualEndDate!.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it("should throw if competition not found", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      vi.mocked(competitionRepo.findById).mockResolvedValueOnce(undefined);

      await expect(
        service.calculateAndSaveCalmarRatio(agentId, competitionId),
      ).rejects.toThrow(`Competition ${competitionId} not found`);

      expect(mockTWRCalculator.calculateTWR).not.toHaveBeenCalled();
      expect(competitionRepo.calculateMaxDrawdownSQL).not.toHaveBeenCalled();
      expect(perpsRepo.saveRiskMetricsWithPeriods).not.toHaveBeenCalled();
    });

    it("should throw if competition has not started yet", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      vi.mocked(competitionRepo.findById).mockResolvedValueOnce(
        createMockCompetition(null, null), // No start date
      );

      await expect(
        service.calculateAndSaveCalmarRatio(agentId, competitionId),
      ).rejects.toThrow(`Competition ${competitionId} has not started yet`);

      expect(mockTWRCalculator.calculateTWR).not.toHaveBeenCalled();
      expect(competitionRepo.calculateMaxDrawdownSQL).not.toHaveBeenCalled();
      expect(perpsRepo.saveRiskMetricsWithPeriods).not.toHaveBeenCalled();
    });

    it("should propagate TWR calculator errors", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      vi.mocked(competitionRepo.findById).mockResolvedValueOnce(
        createMockCompetition(new Date()),
      );

      const error = new Error("TWR calculation failed");
      mockTWRCalculator.calculateTWR.mockRejectedValueOnce(error);

      await expect(
        service.calculateAndSaveCalmarRatio(agentId, competitionId),
      ).rejects.toThrow(error);

      expect(competitionRepo.calculateMaxDrawdownSQL).not.toHaveBeenCalled();
      expect(perpsRepo.saveRiskMetricsWithPeriods).not.toHaveBeenCalled();
    });

    it("should propagate max drawdown calculation errors", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      vi.mocked(competitionRepo.findById).mockResolvedValueOnce(
        createMockCompetition(new Date()),
      );

      mockTWRCalculator.calculateTWR.mockResolvedValueOnce(
        createMockTWRResult(0.1),
      );

      const error = new Error("Drawdown calculation failed");
      vi.mocked(competitionRepo.calculateMaxDrawdownSQL).mockRejectedValueOnce(
        error,
      );

      await expect(
        service.calculateAndSaveCalmarRatio(agentId, competitionId),
      ).rejects.toThrow(error);

      expect(perpsRepo.saveRiskMetricsWithPeriods).not.toHaveBeenCalled();
    });

    it("should handle long competitions correctly (> 1 year)", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2025-06-01"); // 1.5 years

      vi.mocked(competitionRepo.findById).mockResolvedValueOnce(
        createMockCompetition(startDate, endDate),
      );

      mockTWRCalculator.calculateTWR.mockResolvedValueOnce(
        createMockTWRResult(0.8, 20, 25), // 80% return over 1.5 years
      );

      vi.mocked(competitionRepo.calculateMaxDrawdownSQL).mockResolvedValueOnce(
        -0.3,
      ); // 30% drawdown

      vi.mocked(perpsRepo.saveRiskMetricsWithPeriods).mockResolvedValueOnce(
        createMockSavedMetrics(),
      );

      await service.calculateAndSaveCalmarRatio(agentId, competitionId);

      // Verify annualization was applied (should be less than 80% annualized)
      expect(perpsRepo.saveRiskMetricsWithPeriods).toHaveBeenCalledWith(
        expect.objectContaining({
          timeWeightedReturn: "0.80000000",
          annualizedReturn: expect.stringMatching(/^0\.[4-6]\d+/), // Should be ~0.48 (roughly)
        }),
        expect.any(Array),
      );
    });

    it("should handle exactly 1 year competition", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2025-01-01"); // Exactly 1 year (365 days)

      vi.mocked(competitionRepo.findById).mockResolvedValueOnce(
        createMockCompetition(startDate, endDate),
      );

      mockTWRCalculator.calculateTWR.mockResolvedValueOnce(
        createMockTWRResult(0.25, 5, 10), // 25% return over 1 year
      );

      vi.mocked(competitionRepo.calculateMaxDrawdownSQL).mockResolvedValueOnce(
        -0.15,
      );

      vi.mocked(perpsRepo.saveRiskMetricsWithPeriods).mockResolvedValueOnce(
        createMockSavedMetrics(),
      );

      await service.calculateAndSaveCalmarRatio(agentId, competitionId);

      // For exactly 1 year, annualized return should approximately equal TWR
      expect(perpsRepo.saveRiskMetricsWithPeriods).toHaveBeenCalledWith(
        expect.objectContaining({
          timeWeightedReturn: "0.25000000",
          annualizedReturn: expect.stringMatching(/^0\.2[4-5]\d+/), // Should be ~0.25 (allowing for rounding)
        }),
        expect.any(Array),
      );
    });

    it("should handle zero return with drawdown (Calmar = 0)", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      vi.mocked(competitionRepo.findById).mockResolvedValueOnce(
        createMockCompetition(new Date("2025-01-20"), new Date("2025-01-27")),
      );

      mockTWRCalculator.calculateTWR.mockResolvedValueOnce(
        createMockTWRResult(0, 0, 1), // 0% return (break-even)
      );

      vi.mocked(competitionRepo.calculateMaxDrawdownSQL).mockResolvedValueOnce(
        -0.1, // 10% drawdown
      );

      vi.mocked(perpsRepo.saveRiskMetricsWithPeriods).mockResolvedValueOnce(
        createMockSavedMetrics(),
      );

      await service.calculateAndSaveCalmarRatio(agentId, competitionId);

      // Zero return divided by any drawdown should be 0
      expect(perpsRepo.saveRiskMetricsWithPeriods).toHaveBeenCalledWith(
        expect.objectContaining({
          timeWeightedReturn: "0.00000000",
          annualizedReturn: "0.00000000",
          calmarRatio: "0.00000000",
        }),
        expect.any(Array),
      );
    });

    it("should propagate repository save errors", async () => {
      const agentId = "agent-456";
      const competitionId = "comp-123";

      vi.mocked(competitionRepo.findById).mockResolvedValueOnce(
        createMockCompetition(new Date("2025-01-20")),
      );

      mockTWRCalculator.calculateTWR.mockResolvedValueOnce(
        createMockTWRResult(0.1),
      );

      vi.mocked(competitionRepo.calculateMaxDrawdownSQL).mockResolvedValueOnce(
        -0.05,
      );

      const error = new Error("Database save failed");
      vi.mocked(perpsRepo.saveRiskMetricsWithPeriods).mockRejectedValueOnce(
        error,
      );

      await expect(
        service.calculateAndSaveCalmarRatio(agentId, competitionId),
      ).rejects.toThrow(error);
    });
  });
});
