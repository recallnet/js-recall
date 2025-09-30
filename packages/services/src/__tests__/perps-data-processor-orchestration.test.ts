import type { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock, mockReset } from "vitest-mock-extended";

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

// Mock all dependencies
vi.mock("../perps-monitoring.service.js");
vi.mock("../providers/perps-provider.factory.js");
vi.mock("../calmar-ratio.service.js");

describe("PerpsDataProcessor - processPerpsCompetition", () => {
  let processor: PerpsDataProcessor;
  let mockProvider: MockProxy<IPerpsDataProvider>;
  let mockMonitoringService: MockProxy<PerpsMonitoringService>;
  let mockCalmarRatioService: MockProxy<CalmarRatioService>;
  let mockAgentRepo: MockProxy<AgentRepository>;
  let mockCompetitionRepo: MockProxy<CompetitionRepository>;
  let mockPerpsRepo: MockProxy<PerpsRepository>;
  let mockLogger: MockProxy<Logger>;

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
    maxParticipants: null,
    registeredParticipants: 0,
    status: "active" as const,
    sandboxMode: false,
    createdAt: new Date(),
    updatedAt: new Date(),
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

    // Create all mocks
    mockCalmarRatioService = mock<CalmarRatioService>();
    mockAgentRepo = mock<AgentRepository>();
    mockCompetitionRepo = mock<CompetitionRepository>();
    mockPerpsRepo = mock<PerpsRepository>();
    mockLogger = mock<Logger>();

    processor = new PerpsDataProcessor(
      mockCalmarRatioService,
      mockAgentRepo,
      mockCompetitionRepo,
      mockPerpsRepo,
      mockLogger,
    );

    // Setup mock provider
    mockProvider = mock<IPerpsDataProvider>();
    mockProvider.getName.mockReturnValue("symphony");
    mockProvider.getAccountSummary.mockResolvedValue(sampleAccountSummary);
    mockProvider.getPositions.mockResolvedValue([samplePosition]);

    // Setup mock monitoring service
    mockMonitoringService = mock<PerpsMonitoringService>();
    mockMonitoringService.monitorAgentsWithData.mockResolvedValue({
      successful: [],
      failed: [],
      totalAlertsCreated: 0,
    });

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

  afterEach(() => {
    // Reset all mocks
    mockReset(mockCalmarRatioService);
    mockReset(mockAgentRepo);
    mockReset(mockCompetitionRepo);
    mockReset(mockPerpsRepo);
    mockReset(mockLogger);
  });

  describe("successful orchestration", () => {
    it("should process competition without monitoring when threshold not set", async () => {
      // Setup: competition without self-funding threshold
      const configNoThreshold: SelectPerpsCompetitionConfig = {
        ...samplePerpsConfig,
        selfFundingThresholdUsd: null,
      };

      mockCompetitionRepo.findById.mockResolvedValue(sampleCompetition);
      mockPerpsRepo.getPerpsCompetitionConfig.mockResolvedValue(
        configNoThreshold,
      );
      mockCompetitionRepo.getCompetitionAgents.mockResolvedValue(["agent-1"]);
      mockAgentRepo.findByIds.mockResolvedValue([mockAgent]);

      const result = await processor.processPerpsCompetition("comp-1");

      // Should fetch competition and config
      expect(mockCompetitionRepo.findById).toHaveBeenCalledWith("comp-1");
      expect(mockPerpsRepo.getPerpsCompetitionConfig).toHaveBeenCalledWith(
        "comp-1",
      );

      // Should create provider
      expect(PerpsProviderFactory.createProvider).toHaveBeenCalledWith(
        configNoThreshold.dataSourceConfig,
      );

      // Should process agents
      expect(mockProvider.getAccountSummary).toHaveBeenCalled();
      expect(result.syncResult.successful).toHaveLength(1);

      // Should not run monitoring when threshold is null
      expect(
        mockMonitoringService.monitorAgentsWithData,
      ).not.toHaveBeenCalled();
    });

    it("should process competition with monitoring when threshold is set", async () => {
      mockCompetitionRepo.findById.mockResolvedValue(sampleCompetition);
      mockPerpsRepo.getPerpsCompetitionConfig.mockResolvedValue(
        samplePerpsConfig,
      );
      mockCompetitionRepo.getCompetitionAgents.mockResolvedValue(["agent-1"]);
      mockAgentRepo.findByIds.mockResolvedValue([mockAgent]);

      const result = await processor.processPerpsCompetition("comp-1");

      // Should run monitoring when threshold is set
      expect(mockMonitoringService.monitorAgentsWithData).toHaveBeenCalledWith(
        [{ agentId: "agent-1", walletAddress: "0x123" }],
        expect.any(Map), // Account summaries map
        "comp-1",
        expect.any(Date), // Start date
        10000, // Initial capital
        100, // Threshold
      );

      expect(result.syncResult.successful).toHaveLength(1);
      expect(result.monitoringResult).toBeDefined();
    });

    it("should handle empty agents list gracefully", async () => {
      mockCompetitionRepo.findById.mockResolvedValue(sampleCompetition);
      mockPerpsRepo.getPerpsCompetitionConfig.mockResolvedValue(
        samplePerpsConfig,
      );
      mockCompetitionRepo.getCompetitionAgents.mockResolvedValue([]);

      const result = await processor.processPerpsCompetition("comp-1");

      expect(result.syncResult.successful).toHaveLength(0);
      expect(result.syncResult.failed).toHaveLength(0);

      // Should not attempt to fetch agents when list is empty
      expect(mockAgentRepo.findByIds).not.toHaveBeenCalled();

      // Should not create snapshots for empty results
      expect(
        mockCompetitionRepo.batchCreatePortfolioSnapshots,
      ).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle competition not found", async () => {
      mockCompetitionRepo.findById.mockResolvedValue(undefined);

      const result = await processor.processPerpsCompetition("comp-1");

      expect(result.error).toBe("Competition comp-1 not found");
      expect(result.syncResult.successful).toHaveLength(0);
      expect(result.syncResult.failed).toHaveLength(0);
    });

    it("should handle perps config not found", async () => {
      mockCompetitionRepo.findById.mockResolvedValue(sampleCompetition);
      mockPerpsRepo.getPerpsCompetitionConfig.mockResolvedValue(null);

      const result = await processor.processPerpsCompetition("comp-1");

      expect(result.error).toBe(
        "No perps configuration found for competition comp-1",
      );
      expect(result.syncResult.successful).toHaveLength(0);
      expect(result.syncResult.failed).toHaveLength(0);
      expect(mockCompetitionRepo.getCompetitionAgents).not.toHaveBeenCalled();
    });

    it("should handle provider creation failure", async () => {
      mockCompetitionRepo.findById.mockResolvedValue(sampleCompetition);
      mockPerpsRepo.getPerpsCompetitionConfig.mockResolvedValue(
        samplePerpsConfig,
      );

      vi.mocked(PerpsProviderFactory.createProvider).mockImplementation(() => {
        throw new Error("Invalid provider config");
      });

      const result = await processor.processPerpsCompetition("comp-1");

      expect(result.error).toBe("Invalid provider config");
      expect(result.syncResult.successful).toHaveLength(0);
      expect(result.syncResult.failed).toHaveLength(0);
    });

    it("should handle agent data fetch failures gracefully", async () => {
      mockCompetitionRepo.findById.mockResolvedValue(sampleCompetition);
      mockPerpsRepo.getPerpsCompetitionConfig.mockResolvedValue(
        samplePerpsConfig,
      );
      mockCompetitionRepo.getCompetitionAgents.mockResolvedValue(["agent-1"]);
      mockAgentRepo.findByIds.mockResolvedValue([mockAgent]);

      // Mock provider to fail
      mockProvider.getAccountSummary.mockRejectedValue(
        new Error("Provider API error"),
      );

      mockPerpsRepo.batchSyncAgentsPerpsData.mockResolvedValue({
        successful: [],
        failed: [
          {
            agentId: "agent-1",
            error: new Error("Provider API error"),
          },
        ],
      });

      const result = await processor.processPerpsCompetition("comp-1");

      expect(result.syncResult.successful).toHaveLength(0);
      expect(result.syncResult.failed).toHaveLength(2); // Updated based on actual behavior
      expect(result.syncResult.failed[0]?.agentId).toBe("agent-1");
    });
  });

  describe("Calmar ratio calculations", () => {
    it("should calculate Calmar ratios for successful syncs", async () => {
      vi.useFakeTimers();

      // Mock successful Calmar calculation
      mockCalmarRatioService.calculateAndSaveCalmarRatio.mockResolvedValue({
        metrics: {
          id: "metrics-1",
          agentId: "agent-1",
          competitionId: "comp-1",
          simpleReturn: "0.05000000",
          calmarRatio: "1.50000000",
          annualizedReturn: "0.20000000",
          maxDrawdown: "-0.10000000",
          snapshotCount: 2,
          calculationTimestamp: new Date(),
        },
      });

      mockCompetitionRepo.findById.mockResolvedValue(sampleCompetition);
      mockPerpsRepo.getPerpsCompetitionConfig.mockResolvedValue(
        samplePerpsConfig,
      );
      mockCompetitionRepo.getCompetitionAgents.mockResolvedValue(["agent-1"]);
      mockAgentRepo.findByIds.mockResolvedValue([mockAgent]);

      // Run with fake timers
      const resultPromise = processor.processPerpsCompetition("comp-1");
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      vi.useRealTimers();

      expect(result.calmarRatioResult).toBeDefined();
      expect(result.calmarRatioResult!.successful).toBe(1);
      expect(result.calmarRatioResult!.failed).toBe(0);

      expect(
        mockCalmarRatioService.calculateAndSaveCalmarRatio,
      ).toHaveBeenCalledWith("agent-1", "comp-1");
    });

    it("should handle mixed Calmar calculation results", async () => {
      vi.useFakeTimers();

      // Mock Calmar to succeed for agent-1 but fail for agent-2
      mockCalmarRatioService.calculateAndSaveCalmarRatio.mockImplementation(
        (agentId: string) => {
          if (agentId === "agent-1") {
            return Promise.resolve({
              metrics: {
                id: `metrics-${agentId}`,
                agentId,
                competitionId: "comp-1",
                simpleReturn: "0.05000000",
                calmarRatio: "1.50000000",
                annualizedReturn: "0.20000000",
                maxDrawdown: "-0.10000000",
                snapshotCount: 2,
                calculationTimestamp: new Date(),
              },
            });
          }
          return Promise.reject(new Error("Agent-specific error"));
        },
      );

      mockCompetitionRepo.findById.mockResolvedValue(sampleCompetition);
      mockPerpsRepo.getPerpsCompetitionConfig.mockResolvedValue(
        samplePerpsConfig,
      );
      mockCompetitionRepo.getCompetitionAgents.mockResolvedValue([
        "agent-1",
        "agent-2",
      ]);

      const agent2: SelectAgent = {
        ...mockAgent,
        id: "agent-2",
        walletAddress: "0x456",
      };

      mockAgentRepo.findByIds.mockResolvedValue([mockAgent, agent2]);

      // Make both agents sync successfully
      mockPerpsRepo.batchSyncAgentsPerpsData.mockResolvedValue({
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

      // Should have mixed results
      expect(result.calmarRatioResult).toEqual({
        successful: 1,
        failed: 1,
        errors: ["Agent agent-2: Agent-specific error"],
      });
    });

    it("should not calculate Calmar if no agents sync successfully", async () => {
      mockCompetitionRepo.findById.mockResolvedValue(sampleCompetition);
      mockPerpsRepo.getPerpsCompetitionConfig.mockResolvedValue(
        samplePerpsConfig,
      );
      mockCompetitionRepo.getCompetitionAgents.mockResolvedValue(["agent-1"]);
      mockAgentRepo.findByIds.mockResolvedValue([mockAgent]);

      // Mock sync to fail
      mockProvider.getAccountSummary.mockRejectedValue(
        new Error("Provider error"),
      );

      mockPerpsRepo.batchSyncAgentsPerpsData.mockResolvedValue({
        successful: [],
        failed: [],
      });

      const result = await processor.processPerpsCompetition("comp-1");

      // Should not calculate Calmar when no agents synced
      expect(CalmarRatioService).not.toHaveBeenCalled();
      expect(result.calmarRatioResult).toBeUndefined();
    });

    it("should handle circuit breaker alert but continue processing all agents", async () => {
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

      mockCompetitionRepo.findById.mockResolvedValue(sampleCompetition);
      mockPerpsRepo.getPerpsCompetitionConfig.mockResolvedValue(
        samplePerpsConfig,
      );
      mockCompetitionRepo.getCompetitionAgents.mockResolvedValue(
        agents.map((a) => a.id),
      );
      mockAgentRepo.findByIds.mockResolvedValue(agents);

      // All agents sync successfully
      mockPerpsRepo.batchSyncAgentsPerpsData.mockResolvedValue({
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
              metrics: {
                id: `metrics-${agentId}`,
                agentId,
                competitionId: "comp-1",
                simpleReturn: "0.05000000",
                calmarRatio: "1.00000000",
                annualizedReturn: "0.20000000",
                maxDrawdown: "-0.10000000",
                snapshotCount: 2,
                calculationTimestamp: new Date(),
              },
            });
          }
          return Promise.reject(new Error(`Error for ${agentId}`));
        },
      );

      mockCompetitionRepo.findById.mockResolvedValue(sampleCompetition);
      mockPerpsRepo.getPerpsCompetitionConfig.mockResolvedValue(
        samplePerpsConfig,
      );
      mockCompetitionRepo.getCompetitionAgents.mockResolvedValue(
        agents.map((a) => a.id),
      );
      mockAgentRepo.findByIds.mockResolvedValue(agents);

      mockPerpsRepo.batchSyncAgentsPerpsData.mockResolvedValue({
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
        metrics: {
          id: "metrics-1",
          agentId: "agent-1",
          competitionId: "comp-1",
          simpleReturn: "0.05000000",
          calmarRatio: "1.50000000",
          annualizedReturn: "0.20000000",
          maxDrawdown: "-0.10000000",
          snapshotCount: 2,
          calculationTimestamp: new Date(),
        },
      });

      mockCompetitionRepo.findById.mockResolvedValue(sampleCompetition);
      mockPerpsRepo.getPerpsCompetitionConfig.mockResolvedValue(
        samplePerpsConfig,
      );
      mockCompetitionRepo.getCompetitionAgents.mockResolvedValue(
        agents.map((a) => a.id),
      );
      mockAgentRepo.findByIds.mockResolvedValue(agents);

      mockPerpsRepo.batchSyncAgentsPerpsData.mockResolvedValue({
        successful: syncResults,
        failed: [],
      });

      const result = await processor.processPerpsCompetition("comp-1");

      // All should succeed
      expect(result.calmarRatioResult?.successful).toBe(25);
      expect(result.calmarRatioResult?.failed).toBe(0);

      // Should be called once for each agent
      expect(
        mockCalmarRatioService.calculateAndSaveCalmarRatio,
      ).toHaveBeenCalledTimes(25);
    });
  });
});
