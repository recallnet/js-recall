import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SelectAgent } from "@recallnet/db/schema/core/types";
import type {
  SelectPerpetualPosition,
  SelectPerpsAccountSummary,
  SelectPerpsCompetitionConfig,
} from "@recallnet/db/schema/trading/types";

import * as agentRepo from "@/database/repositories/agent-repository.js";
import * as competitionRepo from "@/database/repositories/competition-repository.js";
import * as perpsRepo from "@/database/repositories/perps-repository.js";
import { PerpsDataProcessor } from "@/services/perps-data-processor.service.js";
import { PerpsMonitoringService } from "@/services/perps-monitoring.service.js";
import { PerpsProviderFactory } from "@/services/providers/perps-provider.factory.js";
import type {
  IPerpsDataProvider,
  PerpsAccountSummary,
  PerpsPosition,
} from "@/types/perps.js";

// Mock all dependencies
vi.mock("@/database/repositories/agent-repository.js");
vi.mock("@/database/repositories/competition-repository.js");
vi.mock("@/database/repositories/perps-repository.js");
vi.mock("@/services/perps-monitoring.service.js");
vi.mock("@/services/providers/perps-provider.factory.js");
vi.mock("@/lib/logger.js");

describe("PerpsDataProcessor - processPerpsCompetition", () => {
  let processor: PerpsDataProcessor;
  let mockProvider: IPerpsDataProvider;
  let mockMonitoringService: PerpsMonitoringService;

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
    processor = new PerpsDataProcessor();

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
    vi.mocked(perpsRepo.batchSyncAgentsPerpsData).mockResolvedValue({
      successful: [mockSyncResult],
      failed: [],
    });

    vi.mocked(competitionRepo.batchCreatePortfolioSnapshots).mockResolvedValue([
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

      vi.mocked(competitionRepo.findById).mockResolvedValue(sampleCompetition);
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        configNoThreshold,
      );
      vi.mocked(competitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(agentRepo.findByIds).mockResolvedValue([mockAgent]);

      const result = await processor.processPerpsCompetition("comp-1");

      // Should fetch competition and config
      expect(competitionRepo.findById).toHaveBeenCalledWith("comp-1");
      expect(perpsRepo.getPerpsCompetitionConfig).toHaveBeenCalledWith(
        "comp-1",
      );

      // Should create provider
      expect(PerpsProviderFactory.createProvider).toHaveBeenCalledWith(
        configNoThreshold.dataSourceConfig,
      );

      // Should process agents
      expect(mockProvider.getAccountSummary).toHaveBeenCalled();
      expect(result.syncResult.successful).toHaveLength(1);

      // Should NOT run monitoring (no threshold)
      expect(PerpsMonitoringService).not.toHaveBeenCalled();
      expect(result.monitoringResult).toBeUndefined();
    });

    it("should process competition with monitoring when threshold is set", async () => {
      vi.mocked(competitionRepo.findById).mockResolvedValue(sampleCompetition);
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(competitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(agentRepo.findByIds).mockResolvedValue([mockAgent]);

      const result = await processor.processPerpsCompetition("comp-1");

      // Should run monitoring
      expect(PerpsMonitoringService).toHaveBeenCalledWith(mockProvider);
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
      vi.mocked(competitionRepo.findById).mockResolvedValue(sampleCompetition);
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(competitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(agentRepo.findByIds).mockResolvedValue([mockAgent]);

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
      vi.mocked(competitionRepo.findById).mockResolvedValue(undefined);
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );

      const result = await processor.processPerpsCompetition("comp-1");

      expect(result.error).toBe("Competition comp-1 not found");
      expect(result.syncResult.successful).toHaveLength(0);
    });

    it("should fail if perps config not found", async () => {
      vi.mocked(competitionRepo.findById).mockResolvedValue(sampleCompetition);
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(null);

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

      vi.mocked(competitionRepo.findById).mockResolvedValue(tradingCompetition);
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
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

      vi.mocked(competitionRepo.findById).mockResolvedValue(
        noStartDateCompetition,
      );
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
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

      vi.mocked(competitionRepo.findById).mockResolvedValue(sampleCompetition);
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
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

      vi.mocked(competitionRepo.findById).mockResolvedValue(sampleCompetition);
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
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
      vi.mocked(competitionRepo.findById).mockResolvedValue(sampleCompetition);
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(competitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
        "agent-2",
      ]);

      const agent2: SelectAgent = {
        ...mockAgent,
        id: "agent-2",
        walletAddress: "0x456",
      };

      vi.mocked(agentRepo.findByIds).mockResolvedValue([mockAgent, agent2]);

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

      vi.mocked(competitionRepo.findById).mockResolvedValue(futureCompetition);
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(competitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(agentRepo.findByIds).mockResolvedValue([mockAgent]);

      const result = await processor.processPerpsCompetition("comp-1");

      // Should still process but log warning
      expect(result.syncResult.successful).toHaveLength(1);
      expect(result.error).toBeUndefined();
    });

    it("should skip monitoring if no agents synced successfully", async () => {
      vi.mocked(competitionRepo.findById).mockResolvedValue(sampleCompetition);
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        samplePerpsConfig,
      );
      vi.mocked(competitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(agentRepo.findByIds).mockResolvedValue([mockAgent]);

      // Mock sync failure
      mockProvider.getAccountSummary = vi
        .fn()
        .mockRejectedValue(new Error("Provider error"));

      // When provider fails during fetch, batchSyncAgentsPerpsData won't have data to sync
      // So it returns empty successful and failed arrays
      vi.mocked(perpsRepo.batchSyncAgentsPerpsData).mockResolvedValue({
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

      vi.mocked(competitionRepo.findById).mockResolvedValue(sampleCompetition);
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        zeroThresholdConfig,
      );
      vi.mocked(competitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(agentRepo.findByIds).mockResolvedValue([mockAgent]);

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

      vi.mocked(competitionRepo.findById).mockResolvedValue(sampleCompetition);
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        negativeThresholdConfig,
      );
      vi.mocked(competitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(agentRepo.findByIds).mockResolvedValue([mockAgent]);

      await processor.processPerpsCompetition("comp-1");

      // Should NOT run monitoring for negative threshold
      expect(PerpsMonitoringService).not.toHaveBeenCalled();
    });

    it("should not run monitoring for invalid threshold", async () => {
      const invalidThresholdConfig: SelectPerpsCompetitionConfig = {
        ...samplePerpsConfig,
        selfFundingThresholdUsd: "not-a-number",
      };

      vi.mocked(competitionRepo.findById).mockResolvedValue(sampleCompetition);
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        invalidThresholdConfig,
      );
      vi.mocked(competitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);
      vi.mocked(agentRepo.findByIds).mockResolvedValue([mockAgent]);

      await processor.processPerpsCompetition("comp-1");

      // Should NOT run monitoring for invalid threshold
      expect(PerpsMonitoringService).not.toHaveBeenCalled();
    });
  });
});
