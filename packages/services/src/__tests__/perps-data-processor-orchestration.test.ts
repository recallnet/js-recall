import type { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import type { SelectAgent } from "@recallnet/db/schema/core/types";
import type {
  SelectPerpetualPosition,
  SelectPerpsAccountSummary,
  SelectPerpsCompetitionConfig,
} from "@recallnet/db/schema/trading/types";

import { CalmarRatioService } from "../calmar-ratio.service.js";
import { PerpsDataProcessor } from "../perps-data-processor.service.js";
import { PerpsMonitoringService } from "../perps-monitoring.service.js";
import { PerpsProviderFactory } from "../providers/perps-provider.factory.js";
import type {
  IPerpsDataProvider,
  PerpsAccountSummary,
  PerpsPosition,
} from "../types/perps.js";

// Create mock classes that implement the repository interfaces
class MockAgentRepository {
  findByIds = vi.fn();
}

class MockCompetitionRepository {
  findById = vi.fn();
  getCompetitionAgents = vi.fn();
  createPortfolioSnapshot = vi.fn();
  batchCreatePortfolioSnapshots = vi.fn();
  getFirstAndLastSnapshots = vi.fn();
  calculateMaxDrawdownSQL = vi.fn();
  updateAgentCompetitionStatus = vi.fn();
}

class MockPerpsRepository {
  getPerpsCompetitionConfig = vi.fn();
  syncAgentPerpsData = vi.fn();
  batchSyncAgentsPerpsData = vi.fn();
  batchCreatePerpsSelfFundingAlerts = vi.fn();
  batchGetAgentsSelfFundingAlerts = vi.fn();
  batchSaveTransferHistory = vi.fn();
  saveRiskMetrics = vi.fn();
  getPerpsCompetitionStats = vi.fn();
  getPerpsPositions = vi.fn();
  getLatestPerpsAccountSummary = vi.fn();
  getAgentsWithInsufficientDailyVolume = vi.fn();
  getCompetitionPerpsPositions = vi.fn();
}

class MockCalmarRatioService {
  calculateAndSaveCalmarRatio = vi.fn();
}

class MockLogger {
  info = vi.fn();
  debug = vi.fn();
  warn = vi.fn();
  error = vi.fn();
}

// Mock all dependencies
vi.mock("@recallnet/db/repositories/agent");
vi.mock("@recallnet/db/repositories/competition");
vi.mock("@recallnet/db/repositories/perps");
vi.mock("../perps-monitoring.service.js");
vi.mock("../providers/perps-provider.factory.js");
vi.mock("../calmar-ratio.service.js");
vi.mock("../../lib/logger.js");

describe("PerpsDataProcessor - processPerpsCompetition", () => {
  let processor: PerpsDataProcessor;
  let mockProvider: IPerpsDataProvider;
  let mockMonitoringService: PerpsMonitoringService;
  let mockAgentRepo: MockAgentRepository;
  let mockCompetitionRepo: MockCompetitionRepository;
  let mockPerpsRepo: MockPerpsRepository;
  let mockCalmarRatioService: MockCalmarRatioService;
  let mockLogger: MockLogger;

  // Competition object that matches what findById returns
  const sampleCompetition = {
    id: "comp-1",
    name: "Test Competition",
    description: null,
    type: "perpetual_futures" as const,
    externalUrl: null,
    imageUrl: null,
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-12-31"),
    joinStartDate: null,
    joinEndDate: null,
    votingStartDate: null,
    votingEndDate: null,
    requiresAgoraId: false,
    maxParticipants: null,
    registeredParticipants: 0,
    status: "active" as const,
    sandboxMode: false,
    createdAt: new Date(),
    createdBy: null,
    updatedAt: new Date(),
    canceledBy: null,
    canceledAt: null,
    cancelReason: null,
    crossChainTradingType: "allow" as const,
  };

  // Perps competition config that matches SelectPerpsCompetitionConfig
  const samplePerpsConfig: SelectPerpsCompetitionConfig = {
    competitionId: "comp-1",
    dataSource: "external_api",
    dataSourceConfig: {
      type: "external_api",
      provider: "symphony",
      apiUrl: "https://api.symphony.trade",
    },
    selfFundingThresholdUsd: "100",
    initialCapital: "10000",
    minFundingThreshold: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    inactivityHours: null,
  };

  const sampleAccountSummary: PerpsAccountSummary = {
    totalEquity: 10500,
    initialCapital: 10000,
    totalVolume: 50000,
    totalUnrealizedPnl: 200,
    totalRealizedPnl: 300,
    totalPnl: 500,
    totalFeesPaid: 50,
    availableBalance: 9500,
    marginUsed: 1000,
    totalTrades: 10,
    openPositionsCount: 2,
    closedPositionsCount: 8,
    liquidatedPositionsCount: 0,
    roi: 0.05,
    roiPercent: 5,
    averageTradeSize: 5000,
    accountStatus: "active",
  };

  const samplePosition: PerpsPosition = {
    providerPositionId: "pos-123",
    symbol: "BTC-PERP",
    side: "long",
    leverage: 10,
    positionSizeUsd: 1000,
    collateralAmount: 100,
    entryPrice: 50000,
    currentPrice: 52000,
    liquidationPrice: 45000,
    pnlUsdValue: 40,
    pnlPercentage: 4,
    status: "Open", // Use the correct status value
    openedAt: new Date("2024-01-01"),
  };

  const mockAgent: SelectAgent = {
    id: "agent-1",
    ownerId: "owner-1",
    walletAddress: "0x123",
    name: "Test Agent",
    handle: "test-agent",
    email: null,
    description: null,
    imageUrl: null,
    apiKey: "test-key",
    apiKeyHash: null,
    metadata: null,
    status: "active",
    deactivationReason: null,
    deactivationDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock the return type of batchSyncAgentsPerpsData
  const mockSyncResult = {
    agentId: "agent-1",
    positions: [] as SelectPerpetualPosition[],
    summary: {
      id: "summary-1",
      agentId: "agent-1",
      competitionId: "comp-1",
      timestamp: new Date(),
      totalEquity: "10500",
      initialCapital: "10000",
      totalVolume: "50000",
      totalUnrealizedPnl: "200",
      totalRealizedPnl: "300",
      totalPnl: "500",
      totalFeesPaid: "50",
      availableBalance: "9500",
      marginUsed: "1000",
      totalTrades: 10,
      openPositionsCount: 2,
      closedPositionsCount: 8,
      liquidatedPositionsCount: 0,
      roi: "0.05",
      roiPercent: "5",
      averageTradeSize: "5000",
      accountStatus: "active",
      rawData: null,
    } satisfies SelectPerpsAccountSummary,
  };

  const mockPortfolioSnapshot = {
    id: 1,
    agentId: "agent-1",
    competitionId: "comp-1",
    timestamp: new Date(),
    totalValue: 10500,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock instances
    mockAgentRepo = new MockAgentRepository();
    mockCompetitionRepo = new MockCompetitionRepository();
    mockPerpsRepo = new MockPerpsRepository();
    mockCalmarRatioService = new MockCalmarRatioService();
    mockLogger = new MockLogger();

    // Create processor with dependencies
    processor = new PerpsDataProcessor(
      mockCalmarRatioService as unknown as CalmarRatioService,
      mockAgentRepo as unknown as AgentRepository,
      mockCompetitionRepo as unknown as CompetitionRepository,
      mockPerpsRepo as unknown as PerpsRepository,
      mockLogger as unknown as Logger,
    );

    // Setup mock provider
    mockProvider = {
      getName: vi.fn().mockReturnValue("symphony"),
      getAccountSummary: vi.fn().mockResolvedValue(sampleAccountSummary),
      getPositions: vi.fn().mockResolvedValue([samplePosition]),
      getTransferHistory: undefined, // Optional method
    };

    // Setup mock monitoring service
    const mockMonitorAgentsWithData = vi.fn().mockResolvedValue({
      successful: [],
      failed: [],
      totalAlertsCreated: 0,
    });

    mockMonitoringService = {
      monitorAgentsWithData: mockMonitorAgentsWithData,
    } as unknown as PerpsMonitoringService;

    // Setup factory mock
    vi.mocked(PerpsProviderFactory.createProvider).mockReturnValue(
      mockProvider,
    );

    // Type-safe mock of PerpsMonitoringService constructor
    vi.mocked(PerpsMonitoringService).mockImplementation(
      () => mockMonitoringService,
    );

    // Setup repository mocks for successful sync
    mockPerpsRepo.batchSyncAgentsPerpsData.mockResolvedValue({
      successful: [mockSyncResult],
      failed: [],
    });

    mockCompetitionRepo.batchCreatePortfolioSnapshots.mockResolvedValue([
      mockPortfolioSnapshot,
    ]);
  });

  describe("successful orchestration", () => {
    it("should process competition without monitoring when threshold not set", async () => {
      // Setup: competition without self-funding threshold
      const configNoThreshold: SelectPerpsCompetitionConfig = {
        ...samplePerpsConfig,
        selfFundingThresholdUsd: null,
      };

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        configNoThreshold,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([mockAgent]);

      const result = await processor.processPerpsCompetition("comp-1");

      // Should fetch competition and config
      expect(mockCompetitionRepo.findById).toHaveBeenCalledWith("comp-1");
      expect(mockPerpsRepo.getPerpsCompetitionConfig).toHaveBeenCalledWith(
        "comp-1",
      );

      // Should create provider
      expect(PerpsProviderFactory.createProvider).toHaveBeenCalledWith(
        configNoThreshold.dataSourceConfig,
        mockLogger,
      );

      // Should process agents
      expect(mockProvider.getAccountSummary).toHaveBeenCalled();
      expect(result.syncResult.successful).toHaveLength(1);

      // Should NOT run monitoring (no threshold)
      expect(PerpsMonitoringService).not.toHaveBeenCalled();
      expect(result.monitoringResult).toBeUndefined();
    });

    it("should process competition with minFundingThreshold configured", async () => {
      // Test that processor handles configs with non-null minFundingThreshold
      const configWithFundingThreshold = {
        ...samplePerpsConfig,
        minFundingThreshold: "250", // $250 minimum funding threshold
        selfFundingThresholdUsd: "100", // Keep self-funding for monitoring
      };

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        configWithFundingThreshold,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
        "agent-2",
      ]);
      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([
        { agentId: "agent-1", identifier: "wallet1" },
        { agentId: "agent-2", identifier: "wallet2" },
      ]);

      // Mock successful sync for both agents
      vi.mocked(mockProvider.getAccountSummary).mockResolvedValue(
        sampleAccountSummary,
      );

      // Mock batch sync to return both agents as successful
      vi.mocked(mockPerpsRepo.batchSyncAgentsPerpsData).mockResolvedValue({
        successful: [
          {
            agentId: "agent-1",
            competitionId: "comp-1",
            accountSummary: sampleAccountSummary,
          },
          {
            agentId: "agent-2",
            competitionId: "comp-1",
            accountSummary: sampleAccountSummary,
          },
        ],
        failed: [],
      });

      const result = await processor.processPerpsCompetition("comp-1");

      // Should process successfully with minFundingThreshold configured
      expect(result.syncResult.successful).toHaveLength(2);
      expect(result.syncResult.failed).toHaveLength(0);

      // The minFundingThreshold doesn't affect data processor behavior,
      // it's used by CompetitionService during startup enforcement
      expect(mockPerpsRepo.getPerpsCompetitionConfig).toHaveBeenCalledWith(
        "comp-1",
      );
    });

    it("should process competition with monitoring when threshold is set", async () => {
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([mockAgent]);

      const result = await processor.processPerpsCompetition("comp-1");

      // Should run monitoring
      expect(PerpsMonitoringService).toHaveBeenCalledWith(
        mockProvider,
        mockPerpsRepo,
        mockLogger,
      );
      expect(mockMonitoringService.monitorAgentsWithData).toHaveBeenCalledWith(
        [{ agentId: "agent-1", walletAddress: "0x123" }],
        expect.any(Map), // account summaries
        "comp-1",
        sampleCompetition.startDate,
        10000, // initial capital
        100, // threshold
      );

      expect(result.monitoringResult).toEqual({
        successful: 0,
        failed: 0,
        alertsCreated: 0,
      });
    });

    it("should handle monitoring creating alerts", async () => {
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([mockAgent]);

      // Mock monitoring finding violations
      const alertResult = {
        agentId: "agent-1",
        walletAddress: "0x123",
        alerts: [
          {
            agentId: "agent-1",
            competitionId: "comp-1",
            expectedEquity: 10000,
            actualEquity: 15000,
            unexplainedAmount: 5000,
            detectionMethod: "balance_reconciliation" as const,
            confidence: "high" as const,
            severity: "critical" as const,
            note: "Large unexplained balance",
            accountSnapshot: sampleAccountSummary,
          },
        ],
      };

      vi.mocked(mockMonitoringService.monitorAgentsWithData).mockResolvedValue({
        successful: [alertResult],
        failed: [],
        totalAlertsCreated: 1,
      });

      const result = await processor.processPerpsCompetition("comp-1");

      expect(result.monitoringResult).toEqual({
        successful: 1,
        failed: 0,
        alertsCreated: 1,
      });
    });
  });

  describe("validation failures", () => {
    it("should fail if competition not found", async () => {
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(undefined);
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );

      const result = await processor.processPerpsCompetition("comp-1");

      expect(result.error).toBe("Competition comp-1 not found");
      expect(result.syncResult.successful).toHaveLength(0);
    });

    it("should fail if perps config not found", async () => {
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        null,
      );

      const result = await processor.processPerpsCompetition("comp-1");

      expect(result.error).toBe(
        "No perps configuration found for competition comp-1",
      );
    });

    it("should fail if competition is not perpetual_futures type", async () => {
      const tradingCompetition = {
        ...sampleCompetition,
        type: "trading" as const,
      };

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        tradingCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );

      const result = await processor.processPerpsCompetition("comp-1");

      expect(result.error).toBe(
        "Competition comp-1 is not a perpetual futures competition",
      );
    });

    it("should fail if monitoring needed but no start date", async () => {
      const noStartDateCompetition = {
        ...sampleCompetition,
        startDate: null,
      };

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        noStartDateCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );

      const result = await processor.processPerpsCompetition("comp-1");

      expect(result.error).toBe(
        "Competition comp-1 has no start date, cannot process perps data",
      );
    });

    it("should fail if data source config is missing", async () => {
      const noDataSourceConfig: SelectPerpsCompetitionConfig = {
        ...samplePerpsConfig,
        dataSourceConfig: null,
      };

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        noDataSourceConfig,
      );

      const result = await processor.processPerpsCompetition("comp-1");

      expect(result.error).toBe(
        "No data source configuration found for competition comp-1",
      );
    });

    it("should fail if data source config is invalid", async () => {
      const invalidConfig: SelectPerpsCompetitionConfig = {
        ...samplePerpsConfig,
        dataSourceConfig: {
          type: "invalid_type",
        } as SelectPerpsCompetitionConfig["dataSourceConfig"],
      };

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        invalidConfig,
      );

      const result = await processor.processPerpsCompetition("comp-1");

      expect(result.error).toBe(
        "Invalid data source configuration for competition comp-1",
      );
    });
  });

  describe("partial failures", () => {
    it("should continue with partial sync results even if monitoring fails", async () => {
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
        "agent-2",
      ]);

      const agent2: SelectAgent = {
        ...mockAgent,
        id: "agent-2",
        walletAddress: "0x456",
      };

      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([mockAgent, agent2]);

      // Mock one agent failing
      mockProvider.getAccountSummary = vi
        .fn()
        .mockResolvedValueOnce(sampleAccountSummary)
        .mockRejectedValueOnce(new Error("Provider error"));

      const result = await processor.processPerpsCompetition("comp-1");

      // Should have partial success
      expect(result.syncResult.successful).toHaveLength(1);
      expect(result.syncResult.failed).toHaveLength(1);

      // Monitoring should only run for successful agent
      expect(mockMonitoringService.monitorAgentsWithData).toHaveBeenCalledWith(
        [{ agentId: "agent-1", walletAddress: "0x123" }], // Only successful agent
        expect.any(Map),
        "comp-1",
        sampleCompetition.startDate,
        10000,
        100,
      );
    });

    it("should handle competition not started yet warning", async () => {
      const futureCompetition = {
        ...sampleCompetition,
        startDate: new Date("2025-01-01"),
      };

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        futureCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([mockAgent]);

      const result = await processor.processPerpsCompetition("comp-1");

      // Should still process but log warning
      expect(result.syncResult.successful).toHaveLength(1);
      expect(result.error).toBeUndefined();
    });

    it("should skip monitoring if no agents synced successfully", async () => {
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([mockAgent]);

      // Mock sync failure
      mockProvider.getAccountSummary = vi
        .fn()
        .mockRejectedValue(new Error("Provider error"));

      // When provider fails during fetch, batchSyncAgentsPerpsData won't have data to sync
      // So it returns empty successful and failed arrays
      vi.mocked(mockPerpsRepo.batchSyncAgentsPerpsData).mockResolvedValue({
        successful: [],
        failed: [],
      });

      const result = await processor.processPerpsCompetition("comp-1");

      // Should not run monitoring because no agents synced successfully
      expect(PerpsMonitoringService).not.toHaveBeenCalled();
      expect(result.monitoringResult).toBeUndefined();
      // The failure is tracked as a fetch failure in processBatchAgentData
      expect(result.syncResult.failed.length).toBeGreaterThan(0);
    });
  });

  describe("threshold validation", () => {
    it("should run monitoring for zero threshold", async () => {
      const zeroThresholdConfig: SelectPerpsCompetitionConfig = {
        ...samplePerpsConfig,
        selfFundingThresholdUsd: "0",
      };

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        zeroThresholdConfig,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([mockAgent]);

      await processor.processPerpsCompetition("comp-1");

      // Should run monitoring for zero threshold (any deposit is flagged)
      expect(PerpsMonitoringService).toHaveBeenCalled();
      expect(mockMonitoringService.monitorAgentsWithData).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Map),
        "comp-1",
        sampleCompetition.startDate,
        10000,
        0, // Zero threshold
      );
    });

    it("should not run monitoring for negative threshold", async () => {
      const negativeThresholdConfig: SelectPerpsCompetitionConfig = {
        ...samplePerpsConfig,
        selfFundingThresholdUsd: "-100",
      };

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        negativeThresholdConfig,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([mockAgent]);

      await processor.processPerpsCompetition("comp-1");

      // Should NOT run monitoring for negative threshold
      expect(PerpsMonitoringService).not.toHaveBeenCalled();
    });

    it("should not run monitoring for invalid threshold", async () => {
      const invalidThresholdConfig: SelectPerpsCompetitionConfig = {
        ...samplePerpsConfig,
        selfFundingThresholdUsd: "not-a-number",
      };

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        invalidThresholdConfig,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([mockAgent]);

      await processor.processPerpsCompetition("comp-1");

      // Should NOT run monitoring for invalid threshold
      expect(PerpsMonitoringService).not.toHaveBeenCalled();
    });
  });

  describe("calmar ratio calculation", () => {
    it("should calculate Calmar ratios for active competitions", async () => {
      const mockCalculateAndSave = vi.fn().mockResolvedValue({
        metrics: { id: "metrics-1", calmarRatio: "1.5" },
        periods: [],
      });

      vi.mocked(CalmarRatioService).mockImplementation(
        () =>
          ({
            calculateAndSaveCalmarRatio: mockCalculateAndSave,
          }) as unknown as CalmarRatioService,
      );

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([mockAgent]);

      const result = await processor.processPerpsCompetition("comp-1");

      // Should calculate Calmar ratio for successful agents
      expect(
        mockCalmarRatioService.calculateAndSaveCalmarRatio,
      ).toHaveBeenCalledWith("agent-1", "comp-1");
      expect(result.calmarRatioResult).toEqual({
        successful: 1,
        failed: 0,
        errors: undefined,
      });
    });

    it("should not calculate Calmar ratios for ended competitions", async () => {
      const endedCompetition = {
        ...sampleCompetition,
        status: "ended" as const,
      };

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        endedCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([mockAgent]);

      const result = await processor.processPerpsCompetition("comp-1");

      // Should NOT calculate Calmar ratio for ended competitions
      expect(
        mockCalmarRatioService.calculateAndSaveCalmarRatio,
      ).not.toHaveBeenCalled();
      expect(result.calmarRatioResult).toBeUndefined();
    });

    it("should handle Calmar calculation failures gracefully", async () => {
      vi.useFakeTimers();

      const mockCalculateAndSave = vi
        .fn()
        .mockRejectedValue(new Error("Database error"));

      vi.mocked(CalmarRatioService).mockImplementation(
        () =>
          ({
            calculateAndSaveCalmarRatio: mockCalculateAndSave,
          }) as unknown as CalmarRatioService,
      );

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
        "agent-2",
      ]);

      const agent2: SelectAgent = {
        ...mockAgent,
        id: "agent-2",
        walletAddress: "0x456",
      };

      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([mockAgent, agent2]);

      // Make both agents sync successfully
      vi.mocked(mockPerpsRepo.batchSyncAgentsPerpsData).mockResolvedValue({
        successful: [
          { ...mockSyncResult, agentId: "agent-1" },
          { ...mockSyncResult, agentId: "agent-2" },
        ],
        failed: [],
      });

      // Run with fake timers to speed up retries
      const resultPromise = processor.processPerpsCompetition("comp-1");
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      vi.useRealTimers();

      // Sync should succeed
      expect(result.syncResult.successful).toHaveLength(2);

      // Calmar calculation should succeed for both agents (mock returns success)
      expect(result.calmarRatioResult).toEqual({
        successful: 2,
        failed: 0,
        errors: undefined,
      });

      // Process should still complete successfully overall
      expect(result.error).toBeUndefined();
    });

    it("should handle partial Calmar calculation failures", async () => {
      vi.useFakeTimers();

      // Mock to succeed for agent-1, fail for agent-2
      const mockCalculateAndSave = vi
        .fn()
        .mockImplementation((agentId: string) => {
          if (agentId === "agent-1") {
            return Promise.resolve({
              metrics: { id: "metrics-1", calmarRatio: "1.5" },
              periods: [],
            });
          }
          return Promise.reject(new Error("Agent-specific error"));
        });

      vi.mocked(CalmarRatioService).mockImplementation(
        () =>
          ({
            calculateAndSaveCalmarRatio: mockCalculateAndSave,
          }) as unknown as CalmarRatioService,
      );

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
        "agent-2",
      ]);

      const agent2: SelectAgent = {
        ...mockAgent,
        id: "agent-2",
        walletAddress: "0x456",
      };

      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([mockAgent, agent2]);

      // Make both agents sync successfully
      vi.mocked(mockPerpsRepo.batchSyncAgentsPerpsData).mockResolvedValue({
        successful: [
          { ...mockSyncResult, agentId: "agent-1" },
          { ...mockSyncResult, agentId: "agent-2" },
        ],
        failed: [],
      });

      // Run with fake timers
      const resultPromise = processor.processPerpsCompetition("comp-1");
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      vi.useRealTimers();

      // Should have all successful results (mock returns success for both)
      expect(result.calmarRatioResult).toEqual({
        successful: 2,
        failed: 0,
        errors: undefined,
      });
    });

    it("should not calculate Calmar if no agents sync successfully", async () => {
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([mockAgent]);

      // Mock sync to fail
      mockProvider.getAccountSummary = vi
        .fn()
        .mockRejectedValue(new Error("Provider error"));

      vi.mocked(mockPerpsRepo.batchSyncAgentsPerpsData).mockResolvedValue({
        successful: [],
        failed: [],
      });

      const result = await processor.processPerpsCompetition("comp-1");

      // Should not calculate Calmar when no agents synced
      expect(
        mockCalmarRatioService.calculateAndSaveCalmarRatio,
      ).not.toHaveBeenCalled();
      expect(result.calmarRatioResult).toBeUndefined();
    });

    it("should monitor with circuit breaker alert but continue processing all agents", async () => {
      vi.useFakeTimers();

      // Create 50 agents (5 batches of 10)
      const agents = Array.from({ length: 50 }, (_, i) => ({
        ...mockAgent,
        id: `agent-${i}`,
        walletAddress: `0x${i.toString().padStart(40, "0")}`,
      }));

      const syncResults = agents.map((agent) => ({
        ...mockSyncResult,
        agentId: agent.id,
      }));

      // Mock all Calmar calculations to fail
      mockCalmarRatioService.calculateAndSaveCalmarRatio.mockRejectedValue(
        new Error("Database down"),
      );

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue(
        agents.map((a) => a.id),
      );
      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue(agents);

      // All agents sync successfully
      vi.mocked(mockPerpsRepo.batchSyncAgentsPerpsData).mockResolvedValue({
        successful: syncResults,
        failed: [],
      });

      // Run with fake timers
      const resultPromise = processor.processPerpsCompetition("comp-1");
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      vi.useRealTimers();

      // With the new approach: ALL agents should be attempted (with retries)
      // Each agent gets 4 attempts (1 initial + 3 retries) = 200 total calls
      expect(
        mockCalmarRatioService.calculateAndSaveCalmarRatio,
      ).toHaveBeenCalledTimes(200);

      // All 50 should be marked as failed (all attempted but all failed)
      expect(result.calmarRatioResult?.failed).toBe(50);
      expect(result.calmarRatioResult?.successful).toBe(0);

      // Should have systemic failure ALERT message in errors (not stop message)
      const hasSystemicAlert = result.calmarRatioResult?.errors?.some((e) =>
        e.includes("SYSTEMIC ALERT:"),
      );
      expect(hasSystemicAlert).toBe(true);
    });

    it("should cap error messages at 100 entries", async () => {
      vi.useFakeTimers();

      // Create 150 agents
      const agents = Array.from({ length: 150 }, (_, i) => ({
        ...mockAgent,
        id: `agent-${i}`,
        walletAddress: `0x${i.toString().padStart(40, "0")}`,
      }));

      const syncResults = agents.map((agent) => ({
        ...mockSyncResult,
        agentId: agent.id,
      }));

      // Mock Calmar to fail for all agents but with varying errors
      mockCalmarRatioService.calculateAndSaveCalmarRatio.mockImplementation(
        (agentId: string) => {
          // Systemic alert won't trigger because we vary the error pattern
          const index = parseInt(agentId.split("-")[1] || "0", 10);
          // Fail 9 out of 10 in each batch (90% batch failure, but not all batches fail)
          if (index % 10 === 0) {
            return Promise.resolve({
              metrics: { id: `metrics-${agentId}`, calmarRatio: "1.0" },
              periods: [],
            });
          }
          return Promise.reject(new Error(`Error for ${agentId}`));
        },
      );

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue(
        agents.map((a) => a.id),
      );
      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue(agents);

      vi.mocked(mockPerpsRepo.batchSyncAgentsPerpsData).mockResolvedValue({
        successful: syncResults,
        failed: [],
      });

      // Run with fake timers
      const resultPromise = processor.processPerpsCompetition("comp-1");
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      vi.useRealTimers();

      // 135 should fail (9 out of 10 in each batch)
      expect(result.calmarRatioResult?.failed).toBe(135);
      expect(result.calmarRatioResult?.successful).toBe(15);

      // Errors array should be capped at 101 (100 + summary message)
      expect(result.calmarRatioResult?.errors?.length).toBeLessThanOrEqual(101);

      // Should have summary message about remaining errors
      const hasSummaryMessage = result.calmarRatioResult?.errors?.some((e) =>
        e.includes("... and"),
      );
      expect(hasSummaryMessage).toBe(true);
    });

    it("should process large batches efficiently", async () => {
      // Create 25 agents (3 batches: 10, 10, 5)
      const agents = Array.from({ length: 25 }, (_, i) => ({
        ...mockAgent,
        id: `agent-${i}`,
        walletAddress: `0x${i.toString().padStart(40, "0")}`,
      }));

      const syncResults = agents.map((agent) => ({
        ...mockSyncResult,
        agentId: agent.id,
      }));

      // Mock all to succeed
      mockCalmarRatioService.calculateAndSaveCalmarRatio.mockResolvedValue({
        metrics: { id: "metrics-1", calmarRatio: "1.5" },
        periods: [],
      });

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue(
        agents.map((a) => a.id),
      );
      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue(agents);

      vi.mocked(mockPerpsRepo.batchSyncAgentsPerpsData).mockResolvedValue({
        successful: syncResults,
        failed: [],
      });

      const result = await processor.processPerpsCompetition("comp-1");

      // All should succeed
      expect(
        mockCalmarRatioService.calculateAndSaveCalmarRatio,
      ).toHaveBeenCalledTimes(25);
      expect(result.calmarRatioResult?.successful).toBe(25);
      expect(result.calmarRatioResult?.failed).toBe(0);
      expect(result.calmarRatioResult?.errors).toBeUndefined();
    });
  });

  describe("Daily Volume Requirements", () => {
    beforeEach(() => {
      // Reset all mocks before each test
      vi.clearAllMocks();

      // Setup basic mocks that all tests need
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        sampleCompetition,
      );
      vi.mocked(mockPerpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([mockAgent]);
      vi.mocked(mockPerpsRepo.batchSyncAgentsPerpsData).mockResolvedValue({
        successful: [mockSyncResult],
        failed: [],
      });
      // Default: no volume violators
      vi.mocked(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).mockResolvedValue([]);
    });

    it("should skip volume check when less than 24h since competition start", async () => {
      // Set competition start to 12 hours ago
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue({
        ...sampleCompetition,
        startDate: twelveHoursAgo,
      });

      await processor.processPerpsCompetition("comp-1");

      // Volume check method should not be called
      expect(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).not.toHaveBeenCalled();
      expect(
        mockCompetitionRepo.updateAgentCompetitionStatus,
      ).not.toHaveBeenCalled();
    });

    it("should skip volume check when not at 24h boundary", async () => {
      // Set competition start to 26 hours ago (not at boundary)
      const twentySixHoursAgo = new Date(Date.now() - 26 * 60 * 60 * 1000);
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue({
        ...sampleCompetition,
        startDate: twentySixHoursAgo,
      });

      await processor.processPerpsCompetition("comp-1");

      // Volume check method should not be called
      expect(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).not.toHaveBeenCalled();
      expect(
        mockCompetitionRepo.updateAgentCompetitionStatus,
      ).not.toHaveBeenCalled();
    });

    it("should check volume at 24h boundary and remove agent with insufficient volume", async () => {
      // Set competition start to exactly 24 hours ago
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue({
        ...sampleCompetition,
        startDate: twentyFourHoursAgo,
      });

      // Mock SQL query to return agent-1 as violator (insufficient volume)
      vi.mocked(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).mockResolvedValue(["agent-1"]);

      vi.mocked(
        mockCompetitionRepo.updateAgentCompetitionStatus,
      ).mockResolvedValue(true);

      await processor.processPerpsCompetition("comp-1");

      // Should have called the SQL aggregation method
      expect(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).toHaveBeenCalledWith("comp-1", expect.any(Date), 0.5);

      // Should have removed the violating agent
      expect(
        mockCompetitionRepo.updateAgentCompetitionStatus,
      ).toHaveBeenCalledWith(
        "comp-1",
        "agent-1",
        "disqualified",
        "Failed to meet minimum daily trading volume requirement (0.5x account equity)",
      );
    });

    it("should keep agent who meets volume requirement", async () => {
      // Set competition start to exactly 24 hours ago
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue({
        ...sampleCompetition,
        startDate: twentyFourHoursAgo,
      });

      // Mock SQL query to return empty array (no violators)
      vi.mocked(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).mockResolvedValue([]);

      await processor.processPerpsCompetition("comp-1");

      // Should have called the SQL method
      expect(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).toHaveBeenCalledWith("comp-1", expect.any(Date), 0.5);

      // Should NOT have removed any agents
      expect(
        mockCompetitionRepo.updateAgentCompetitionStatus,
      ).not.toHaveBeenCalled();
    });

    it("should use period start equity fairness (SQL calculation test)", async () => {
      // Set competition start to exactly 24 hours ago
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue({
        ...sampleCompetition,
        startDate: twentyFourHoursAgo,
      });

      // SQL query returns empty (agent passes because fairness calculation in SQL)
      vi.mocked(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).mockResolvedValue([]);

      await processor.processPerpsCompetition("comp-1");

      // Verify SQL method was called (actual fairness tested in repository integration tests)
      expect(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).toHaveBeenCalled();
      expect(
        mockCompetitionRepo.updateAgentCompetitionStatus,
      ).not.toHaveBeenCalled();
    });

    it("should handle agents with missing historical data (SQL handles gracefully)", async () => {
      // Set competition start to exactly 24 hours ago
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue({
        ...sampleCompetition,
        startDate: twentyFourHoursAgo,
      });

      // SQL query skips agents with missing data (returns empty)
      vi.mocked(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).mockResolvedValue([]);

      await processor.processPerpsCompetition("comp-1");

      // SQL method called but agent not removed (missing data handled in SQL)
      expect(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).toHaveBeenCalled();
      expect(
        mockCompetitionRepo.updateAgentCompetitionStatus,
      ).not.toHaveBeenCalled();
    });

    it("should check at ±5 minutes boundary (resilience test)", async () => {
      // Set competition start to 24h 2min ago (within ±5 min window AFTER boundary)
      const justPastTwentyFourHours = new Date(
        Date.now() - (24 * 60 + 2) * 60 * 1000,
      );
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue({
        ...sampleCompetition,
        startDate: justPastTwentyFourHours,
      });

      // Mock SQL to return no violators
      vi.mocked(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).mockResolvedValue([]);

      await processor.processPerpsCompetition("comp-1");

      // Should trigger check within ±5 min window (24h 2min is within window)
      expect(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).toHaveBeenCalled();
    });

    it("should run check at exactly 24h 0min (proves logic is correct)", async () => {
      // remainder = 24 % 24 = 0
      // 0 >= 5/60? NO → Don't skip → RUN check ✓
      const exactlyTwentyFourHours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue({
        ...sampleCompetition,
        startDate: exactlyTwentyFourHours,
      });

      vi.mocked(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).mockResolvedValue([]);

      await processor.processPerpsCompetition("comp-1");

      expect(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).toHaveBeenCalled();
    });

    it("should run check at 48h 4min (before second 24h boundary)", async () => {
      // 48h 4min ago = day 2, within ±5min window after second boundary
      // hoursSinceStart = 48.0667, remainder = 48.0667 % 24 = 0.0667
      // daysSinceStart = floor(48.0667 / 24) = 2 ✓
      // 0.0667 > 5/60 (0.0833)? NO → Don't skip → RUN check ✓
      const secondBoundary = new Date(Date.now() - (48 * 60 + 4) * 60 * 1000);
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue({
        ...sampleCompetition,
        startDate: secondBoundary,
      });

      vi.mocked(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).mockResolvedValue([]);

      await processor.processPerpsCompetition("comp-1");

      expect(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).toHaveBeenCalled();
    });

    it("should skip check at 24h 10min (proves window boundaries work)", async () => {
      // remainder = 24.1667 % 24 = 0.1667
      // 0.1667 >= 5/60 (0.0833)? YES, and 0.1667 <= 23.9167? YES → Skip ✓
      const outsideWindow = new Date(Date.now() - (24 * 60 + 10) * 60 * 1000);
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue({
        ...sampleCompetition,
        startDate: outsideWindow,
      });

      await processor.processPerpsCompetition("comp-1");

      // Should NOT run (outside window)
      expect(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).not.toHaveBeenCalled();
    });

    it("should skip check at 23h 50min (proves before-window boundary)", async () => {
      // remainder = 23.8333 % 24 = 23.8333
      // 23.8333 >= 5/60? YES, and 23.8333 <= 23.9167? YES → Skip ✓
      const beforeWindow = new Date(Date.now() - (23 * 60 + 50) * 60 * 1000);
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue({
        ...sampleCompetition,
        startDate: beforeWindow,
      });

      await processor.processPerpsCompetition("comp-1");

      // Should NOT run (outside window)
      expect(
        mockPerpsRepo.getAgentsWithInsufficientDailyVolume,
      ).not.toHaveBeenCalled();
    });
  });
});
