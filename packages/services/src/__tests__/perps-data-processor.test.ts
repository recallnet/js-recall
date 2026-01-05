import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import type { SelectAgent } from "@recallnet/db/schema/core/types";
import type {
  InsertPerpetualPosition,
  InsertPerpsAccountSummary,
  SelectPerpetualPosition,
  SelectPerpsAccountSummary,
} from "@recallnet/db/schema/trading/types";

import { PerpsDataProcessor } from "../perps-data-processor.service.js";
import { RiskMetricsService } from "../risk-metrics.service.js";
import type { AgentPerpsSyncData } from "../types/perps.js";
import type {
  ClosedPositionFill,
  IPerpsDataProvider,
  PerpsAccountSummary,
  PerpsPosition,
} from "../types/perps.js";

// Mock all repository modules
vi.mock("@recallnet/db/repositories/agent");
vi.mock("@recallnet/db/repositories/competition");
vi.mock("@recallnet/db/repositories/perps");
vi.mock("../risk-metrics.service.js");

describe("PerpsDataProcessor", () => {
  let processor: PerpsDataProcessor;
  let mockProvider: IPerpsDataProvider;
  let mockAgentRepo: AgentRepository;
  let mockCompetitionRepo: CompetitionRepository;
  let mockPerpsRepo: PerpsRepository;
  let mockRiskMetricsService: RiskMetricsService;
  let mockLogger: Logger;

  // Sample data that matches what the provider returns
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
    // rawData is optional - test both with and without
  };

  const samplePosition: PerpsPosition = {
    providerPositionId: "pos-123",
    symbol: "BTC-PERP",
    side: "long",
    leverage: 10,
    positionSizeUsd: 1000,
    entryPrice: 50000,
    currentPrice: 51000,
    pnlUsdValue: 20,
    pnlPercentage: 2,
    status: "Open",
    openedAt: new Date("2024-01-01"),
    lastUpdatedAt: new Date("2024-01-02"),
  };

  // Sample closed position fill that matches what provider.getClosedPositionFills returns
  // This represents a position that closed between sync cycles and was recovered from fills
  const sampleClosedFill: ClosedPositionFill = {
    providerFillId: "fill-abc123-456",
    symbol: "ETH",
    side: "short",
    positionSizeUsd: 5000,
    closePrice: 2500,
    closedPnl: -150,
    closedAt: new Date("2024-01-15T10:30:00Z"),
    fee: 5,
  };

  // Helper function to create a mock sync result that matches what the repository would return
  // This simulates the database layer returning the stored data with all fields as strings
  const createMockSyncResult = (
    agentId: string,
    positions: Array<Record<string, unknown>>,
    summary: Record<string, unknown>,
  ) => ({
    positions: positions.map((pos, idx) => ({
      id: `pos-${idx + 1}`,
      agentId,
      competitionId: "comp-1",
      providerPositionId: (pos.providerPositionId as string) || null,
      providerTradeId: (pos.providerTradeId as string) || null,
      asset: pos.asset as string,
      isLong: pos.isLong as boolean,
      leverage: pos.leverage ? String(pos.leverage) : null,
      positionSize: String(pos.positionSize),
      // collateralAmount and entryPrice can be null for positions recovered from fills
      collateralAmount:
        pos.collateralAmount !== undefined && pos.collateralAmount !== null
          ? String(pos.collateralAmount)
          : null,
      entryPrice:
        pos.entryPrice !== undefined && pos.entryPrice !== null
          ? String(pos.entryPrice)
          : null,
      currentPrice: pos.currentPrice ? String(pos.currentPrice) : null,
      liquidationPrice: pos.liquidationPrice
        ? String(pos.liquidationPrice)
        : null,
      pnlUsdValue: pos.pnlUsdValue ? String(pos.pnlUsdValue) : null,
      pnlPercentage: pos.pnlPercentage ? String(pos.pnlPercentage) : null,
      status: (pos.status as string) || "Open",
      createdAt: pos.createdAt as Date,
      lastUpdatedAt: (pos.lastUpdatedAt as Date) || null,
      closedAt: (pos.closedAt as Date) || null,
      capturedAt: new Date(),
    })),
    summary: {
      id: "summary-1",
      agentId,
      competitionId: "comp-1",
      timestamp: new Date(),
      totalEquity: String(summary.totalEquity || "0"),
      initialCapital: summary.initialCapital
        ? String(summary.initialCapital)
        : null,
      totalVolume: summary.totalVolume ? String(summary.totalVolume) : null,
      totalUnrealizedPnl: summary.totalUnrealizedPnl
        ? String(summary.totalUnrealizedPnl)
        : null,
      totalRealizedPnl: summary.totalRealizedPnl
        ? String(summary.totalRealizedPnl)
        : null,
      totalPnl: summary.totalPnl ? String(summary.totalPnl) : null,
      totalFeesPaid: summary.totalFeesPaid
        ? String(summary.totalFeesPaid)
        : null,
      availableBalance: summary.availableBalance
        ? String(summary.availableBalance)
        : null,
      marginUsed: summary.marginUsed ? String(summary.marginUsed) : null,
      totalTrades: (summary.totalTrades as number) || null,
      openPositionsCount: (summary.openPositionsCount as number) || null,
      closedPositionsCount: (summary.closedPositionsCount as number) || null,
      liquidatedPositionsCount:
        (summary.liquidatedPositionsCount as number) || null,
      roi: summary.roi ? String(summary.roi) : null,
      roiPercent: summary.roiPercent ? String(summary.roiPercent) : null,
      averageTradeSize: summary.averageTradeSize
        ? String(summary.averageTradeSize)
        : null,
      accountStatus: (summary.accountStatus as string) || "unknown",
      rawData: summary.rawData || null,
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock instances
    mockAgentRepo = {} as AgentRepository;
    mockCompetitionRepo = {} as CompetitionRepository;
    mockPerpsRepo = {} as PerpsRepository;
    mockRiskMetricsService = {} as RiskMetricsService;
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger;

    // Create mock provider
    mockProvider = {
      getName: vi.fn().mockReturnValue("TestProvider"),
      getAccountSummary: vi.fn().mockResolvedValue(sampleAccountSummary),
      getPositions: vi.fn().mockResolvedValue([samplePosition]),
      isHealthy: vi.fn().mockResolvedValue(true),
    };

    // Mock repository functions with dynamic behavior based on input
    mockPerpsRepo.syncAgentPerpsData = vi.fn().mockImplementation(
      async (
        agentId: string,
        competitionId: string,
        positions: InsertPerpetualPosition[],
        summary: InsertPerpsAccountSummary,
      ): Promise<{
        positions: SelectPerpetualPosition[];
        summary: SelectPerpsAccountSummary;
      }> => {
        return createMockSyncResult(agentId, positions, summary);
      },
    );

    // batchSyncAgentsPerpsData should process the actual input data
    mockPerpsRepo.batchSyncAgentsPerpsData = vi
      .fn()
      .mockImplementation(async (syncDataArray: AgentPerpsSyncData[]) => {
        // Return successful sync results based on actual input
        return {
          successful: syncDataArray.map((data) => ({
            agentId: data.agentId,
            positions: data.positions.map((pos, idx) => ({
              id: `pos-${idx + 1}`,
              agentId: data.agentId,
              competitionId: data.competitionId,
              providerPositionId: pos.providerPositionId || null,
              providerTradeId: pos.providerTradeId || null,
              asset: pos.asset,
              isLong: pos.isLong,
              leverage: pos.leverage || null,
              positionSize: pos.positionSize,
              collateralAmount: pos.collateralAmount || "0",
              entryPrice: pos.entryPrice,
              currentPrice: pos.currentPrice || null,
              liquidationPrice: pos.liquidationPrice || null,
              pnlUsdValue: pos.pnlUsdValue || null,
              pnlPercentage: pos.pnlPercentage || null,
              status: pos.status || "Open",
              createdAt: pos.createdAt,
              lastUpdatedAt: pos.lastUpdatedAt || null,
              closedAt: pos.closedAt || null,
              capturedAt: new Date(),
            })),
            summary: {
              id: `summary-${data.agentId}`,
              agentId: data.agentId,
              competitionId: data.competitionId,
              timestamp: new Date(),
              totalEquity: data.accountSummary.totalEquity || "0",
              initialCapital: data.accountSummary.initialCapital || null,
              totalVolume: data.accountSummary.totalVolume || null,
              totalUnrealizedPnl:
                data.accountSummary.totalUnrealizedPnl || null,
              totalRealizedPnl: data.accountSummary.totalRealizedPnl || null,
              totalPnl: data.accountSummary.totalPnl || null,
              totalFeesPaid: data.accountSummary.totalFeesPaid || null,
              availableBalance: data.accountSummary.availableBalance || null,
              marginUsed: data.accountSummary.marginUsed || null,
              totalTrades: data.accountSummary.totalTrades || null,
              openPositionsCount:
                data.accountSummary.openPositionsCount || null,
              closedPositionsCount:
                data.accountSummary.closedPositionsCount || null,
              liquidatedPositionsCount:
                data.accountSummary.liquidatedPositionsCount || null,
              roi: data.accountSummary.roi || null,
              roiPercent: data.accountSummary.roiPercent || null,
              averageTradeSize: data.accountSummary.averageTradeSize || null,
              accountStatus: data.accountSummary.accountStatus || "unknown",
              rawData: data.accountSummary.rawData || null,
            },
          })),
          failed: [],
        };
      });

    // Portfolio snapshots
    const mockPortfolioSnapshot = {
      id: 1,
      agentId: "agent-1",
      competitionId: "comp-1",
      timestamp: new Date(),
      totalValue: 10500,
    };

    mockCompetitionRepo.createPortfolioSnapshot = vi
      .fn()
      .mockResolvedValue(mockPortfolioSnapshot);
    mockCompetitionRepo.batchCreatePortfolioSnapshots = vi
      .fn()
      .mockResolvedValue([mockPortfolioSnapshot]);

    // Default mocks for other functions
    mockCompetitionRepo.findById = vi.fn().mockResolvedValue(undefined);
    mockCompetitionRepo.getCompetitionAgents = vi.fn().mockResolvedValue([]);
    mockAgentRepo.findByIds = vi.fn().mockResolvedValue([]);

    processor = new PerpsDataProcessor(
      mockRiskMetricsService,
      mockAgentRepo,
      mockCompetitionRepo,
      mockPerpsRepo,
      mockLogger,
    );
  });

  describe("processAgentData", () => {
    it("should process a single agent's perps data successfully", async () => {
      const result = await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0x123456789",
        mockProvider,
      );

      // Verify provider was called (with undefined initialCapital since no snapshots exist)
      expect(mockProvider.getAccountSummary).toHaveBeenCalledWith(
        "0x123456789",
        undefined,
      );
      expect(mockProvider.getPositions).toHaveBeenCalledWith("0x123456789");

      // Verify repository sync was called with TRANSFORMED data
      expect(mockPerpsRepo.syncAgentPerpsData).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        expect.arrayContaining([
          expect.objectContaining({
            agentId: "agent-1",
            competitionId: "comp-1",
            asset: "BTC-PERP",
            isLong: true,
            positionSize: "1000", // Note: transformed to string
            leverage: "10", // Note: transformed to string
            entryPrice: "50000", // Note: transformed to string
          }),
        ]),
        expect.objectContaining({
          agentId: "agent-1",
          competitionId: "comp-1",
          totalEquity: "10500", // Note: transformed to string
          initialCapital: "10000", // Note: transformed to string
        }),
      );

      // Verify portfolio snapshot was created with numeric value
      expect(mockCompetitionRepo.createPortfolioSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: "agent-1",
          competitionId: "comp-1",
          totalValue: 10500, // Note: stays as number for snapshot
        }),
      );

      // Result should reflect the actual transformed data
      expect(result).toBeDefined();
      expect(result.positions).toHaveLength(1);
      expect(result.summary.totalEquity).toBe("10500");
    });

    it("should throw error if provider is not provided", async () => {
      await expect(
        processor.processAgentData(
          "agent-1",
          "comp-1",
          "0x123",
          null as unknown as IPerpsDataProvider,
        ),
      ).rejects.toThrow("[PerpsDataProcessor] Provider is required");
    });

    it("should handle provider errors gracefully", async () => {
      mockProvider.getAccountSummary = vi
        .fn()
        .mockRejectedValue(new Error("API Error"));

      await expect(
        processor.processAgentData("agent-1", "comp-1", "0x123", mockProvider),
      ).rejects.toThrow("API Error");
    });

    it("should handle empty positions array", async () => {
      mockProvider.getPositions = vi.fn().mockResolvedValue([]);

      const result = await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0x123",
        mockProvider,
      );

      expect(mockPerpsRepo.syncAgentPerpsData).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        [], // Empty positions array
        expect.objectContaining({
          agentId: "agent-1",
          competitionId: "comp-1",
        }),
      );

      // Verify result is returned
      expect(result).toBeDefined();
      expect(result.positions).toHaveLength(0);
    });

    it("should handle NaN totalEquity from provider", async () => {
      const nanSummary: PerpsAccountSummary = {
        ...sampleAccountSummary,
        totalEquity: NaN,
      };

      mockProvider.getAccountSummary = vi.fn().mockResolvedValue(nanSummary);

      await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0x123",
        mockProvider,
      );

      // Should transform NaN to "0" in database
      expect(mockPerpsRepo.syncAgentPerpsData).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        expect.any(Array),
        expect.objectContaining({
          totalEquity: "0", // NaN becomes "0"
        }),
      );

      // Portfolio snapshot should use 0 for NaN
      expect(mockCompetitionRepo.createPortfolioSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          totalValue: 0,
        }),
      );
    });

    it("should handle null/undefined totalEquity from provider", async () => {
      const nullSummary: PerpsAccountSummary = {
        ...sampleAccountSummary,
        totalEquity: null as unknown as number,
      };

      mockProvider.getAccountSummary = vi.fn().mockResolvedValue(nullSummary);

      await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0x123",
        mockProvider,
      );

      // Should transform null to "0" in database
      expect(mockPerpsRepo.syncAgentPerpsData).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        expect.any(Array),
        expect.objectContaining({
          totalEquity: "0", // null becomes "0"
        }),
      );

      // Portfolio snapshot should use 0 for null
      expect(mockCompetitionRepo.createPortfolioSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          totalValue: 0,
        }),
      );
    });

    it("should handle both presence and absence of rawData", async () => {
      // Test with rawData
      const summaryWithRaw: PerpsAccountSummary = {
        ...sampleAccountSummary,
        rawData: { provider: "test", originalData: { foo: "bar" } },
      };

      mockProvider.getAccountSummary = vi
        .fn()
        .mockResolvedValueOnce(summaryWithRaw);

      await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0x123",
        mockProvider,
      );

      expect(mockPerpsRepo.syncAgentPerpsData).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        expect.any(Array),
        expect.objectContaining({
          rawData: { provider: "test", originalData: { foo: "bar" } },
        }),
      );

      // Test without rawData
      const summaryWithoutRaw: PerpsAccountSummary = {
        ...sampleAccountSummary,
        rawData: undefined,
      };

      mockProvider.getAccountSummary = vi
        .fn()
        .mockResolvedValueOnce(summaryWithoutRaw);

      await processor.processAgentData(
        "agent-2",
        "comp-1",
        "0x456",
        mockProvider,
      );

      expect(mockPerpsRepo.syncAgentPerpsData).toHaveBeenCalledWith(
        "agent-2",
        "comp-1",
        expect.any(Array),
        expect.objectContaining({
          rawData: undefined,
        }),
      );
    });
  });

  describe("processBatchAgentData", () => {
    it("should process agents in batches of 10", async () => {
      // Create 25 agents to test batching (should be 3 batches: 10, 10, 5)
      const agents = Array.from({ length: 25 }, (_, i) => ({
        agentId: `agent-${i}`,
        walletAddress: `0x${i.toString().padStart(40, "0")}`,
      }));

      const result = await processor.processBatchAgentData(
        agents,
        "comp-1",
        mockProvider,
      );

      // Should call provider 25 times for each method (once per agent)
      expect(mockProvider.getAccountSummary).toHaveBeenCalledTimes(25);
      expect(mockProvider.getPositions).toHaveBeenCalledTimes(25);

      // Should call batchSyncAgentsPerpsData with ALL transformed data at once
      expect(mockPerpsRepo.batchSyncAgentsPerpsData).toHaveBeenCalledTimes(1);
      expect(mockPerpsRepo.batchSyncAgentsPerpsData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            agentId: "agent-0",
            competitionId: "comp-1",
            positions: expect.any(Array),
            accountSummary: expect.objectContaining({
              agentId: "agent-0",
              competitionId: "comp-1",
            }),
          }),
        ]),
      );

      // The mock call should have all 25 agents' data
      const callArgs = vi.mocked(mockPerpsRepo.batchSyncAgentsPerpsData).mock
        .calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs).toHaveLength(25);

      expect(result.successful).toHaveLength(25);
      expect(result.failed).toHaveLength(0);
    });

    it("should handle individual agent fetch failures without stopping the batch", async () => {
      const agents = [
        { agentId: "agent-1", walletAddress: "0x111" },
        { agentId: "agent-2", walletAddress: "0x222" },
        { agentId: "agent-3", walletAddress: "0x333" },
      ];

      // Make agent-2 fail during fetch based on wallet address (more robust than call count)
      mockProvider.getAccountSummary = vi.fn().mockImplementation((wallet) => {
        if (wallet === "0x222") {
          return Promise.reject(new Error("Agent 2 API Error"));
        }
        return Promise.resolve(sampleAccountSummary);
      });

      const result = await processor.processBatchAgentData(
        agents,
        "comp-1",
        mockProvider,
      );

      // Should only sync data for agents 1 and 3 (agent 2 failed during fetch)
      expect(mockPerpsRepo.batchSyncAgentsPerpsData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ agentId: "agent-1" }),
          expect.objectContaining({ agentId: "agent-3" }),
        ]),
      );

      // The call should NOT include agent-2
      const callArgs = vi.mocked(mockPerpsRepo.batchSyncAgentsPerpsData).mock
        .calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs).toHaveLength(2);
      expect(callArgs?.find((a) => a.agentId === "agent-2")).toBeUndefined();

      // Result should show 2 successful and 1 failed
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toEqual({
        agentId: "agent-2",
        error: expect.objectContaining({ message: "Agent 2 API Error" }),
      });
    });

    it("should handle sync failures separately from fetch failures", async () => {
      const agents = [
        { agentId: "agent-1", walletAddress: "0x111" },
        { agentId: "agent-2", walletAddress: "0x222" },
      ];

      // Mock sync to fail for agent-1
      vi.mocked(mockPerpsRepo.batchSyncAgentsPerpsData).mockResolvedValue({
        successful: [
          {
            agentId: "agent-2",
            positions: [],
            summary: {
              id: "summary-2",
              agentId: "agent-2",
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
              rawData: { test: "data" },
            },
          },
        ],
        failed: [
          {
            agentId: "agent-1",
            error: new Error("Database constraint violation"),
          },
        ],
      });

      const result = await processor.processBatchAgentData(
        agents,
        "comp-1",
        mockProvider,
      );

      // Both agents' data should be fetched successfully
      expect(mockProvider.getAccountSummary).toHaveBeenCalledTimes(2);

      // Sync should be attempted for both
      expect(mockPerpsRepo.batchSyncAgentsPerpsData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ agentId: "agent-1" }),
          expect.objectContaining({ agentId: "agent-2" }),
        ]),
      );

      // Result should show 1 successful and 1 failed (from sync)
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]?.agentId).toBe("agent-1");
    });

    it("should continue processing if portfolio snapshot creation fails", async () => {
      const agents = [{ agentId: "agent-1", walletAddress: "0x111" }];

      // Make portfolio snapshot creation fail
      vi.mocked(
        mockCompetitionRepo.batchCreatePortfolioSnapshots,
      ).mockRejectedValue(new Error("Snapshot creation failed"));

      const result = await processor.processBatchAgentData(
        agents,
        "comp-1",
        mockProvider,
      );

      // Should still report success even if snapshot failed
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(0);
    });

    it("should handle empty agent list correctly", async () => {
      const result = await processor.processBatchAgentData(
        [],
        "comp-1",
        mockProvider,
      );

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(mockProvider.getAccountSummary).not.toHaveBeenCalled();

      // The service DOES call batchSync even with empty array - this is correct behavior
      expect(mockPerpsRepo.batchSyncAgentsPerpsData).toHaveBeenCalledWith([]);
    });

    it("should throw error if provider is not provided", async () => {
      await expect(
        processor.processBatchAgentData(
          [{ agentId: "agent-1", walletAddress: "0x111" }],
          "comp-1",
          null as unknown as IPerpsDataProvider,
        ),
      ).rejects.toThrow("[PerpsDataProcessor] Provider is required");
    });

    it("should handle complete batch sync failure", async () => {
      const agents = [
        { agentId: "agent-1", walletAddress: "0x111" },
        { agentId: "agent-2", walletAddress: "0x222" },
      ];

      // Make the entire batch sync fail
      vi.mocked(mockPerpsRepo.batchSyncAgentsPerpsData).mockRejectedValue(
        new Error("Database connection lost"),
      );

      const result = await processor.processBatchAgentData(
        agents,
        "comp-1",
        mockProvider,
      );

      // All agents should be marked as failed
      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(2);
      result.failed.forEach((failure) => {
        expect(failure.error.message).toBe("Database connection lost");
      });
    });

    it("should handle missing optional fields from provider", async () => {
      const incompleteAccountSummary: PerpsAccountSummary = {
        ...sampleAccountSummary,
        roi: undefined,
        roiPercent: undefined,
        averageTradeSize: undefined,
      };

      mockProvider.getAccountSummary = vi
        .fn()
        .mockResolvedValue(incompleteAccountSummary);

      const agents = [{ agentId: "agent-1", walletAddress: "0x111" }];

      const result = await processor.processBatchAgentData(
        agents,
        "comp-1",
        mockProvider,
      );

      // Should still process successfully with undefined optional fields
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(0);

      // Verify the sync was called with null values (undefined gets converted to null)
      expect(mockPerpsRepo.batchSyncAgentsPerpsData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            accountSummary: expect.objectContaining({
              roi: null, // undefined becomes null
              roiPercent: null, // undefined becomes null
              averageTradeSize: null, // undefined becomes null
            }),
          }),
        ]),
      );
    });

    it("should handle very large and negative numeric values", async () => {
      const extremeValuesSummary: PerpsAccountSummary = {
        ...sampleAccountSummary,
        totalVolume: 1e15, // Very large number
        totalEquity: -50000, // Negative equity (liquidated account)
        totalPnl: -100000, // Large loss
        roi: -0.955, // Negative ROI
        roiPercent: -95.5, // Negative ROI percent
      };

      const extremePosition: PerpsPosition = {
        ...samplePosition,
        positionSizeUsd: 1e12, // Trillion dollar position
        entryPrice: 0.000001, // Very small price
        currentPrice: 0.0000005, // Even smaller price
        pnlUsdValue: -5e11, // 500 billion loss
        pnlPercentage: -50,
      };

      mockProvider.getAccountSummary = vi
        .fn()
        .mockResolvedValue(extremeValuesSummary);
      mockProvider.getPositions = vi.fn().mockResolvedValue([extremePosition]);

      const agents = [{ agentId: "agent-1", walletAddress: "0x111" }];

      const result = await processor.processBatchAgentData(
        agents,
        "comp-1",
        mockProvider,
      );

      expect(result.successful).toHaveLength(1);

      // Verify large numbers are correctly converted to strings
      expect(mockPerpsRepo.batchSyncAgentsPerpsData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            accountSummary: expect.objectContaining({
              totalVolume: "1000000000000000", // 1e15 as string
              totalEquity: "-50000",
              totalPnl: "-100000",
              roi: "-0.955",
              roiPercent: "-95.5",
            }),
            positions: expect.arrayContaining([
              expect.objectContaining({
                positionSize: "1000000000000", // 1e12 as string
                entryPrice: "0.000001",
                currentPrice: "0.0000005", // Properly formatted
                pnlUsdValue: "-500000000000", // -5e11 as string
                pnlPercentage: "-50",
              }),
            ]),
          }),
        ]),
      );
    });

    it("should handle positions with different statuses", async () => {
      const closedPosition: PerpsPosition = {
        ...samplePosition,
        providerPositionId: "pos-closed",
        status: "Closed",
        closedAt: new Date("2024-01-03"),
      };

      const liquidatedPosition: PerpsPosition = {
        ...samplePosition,
        providerPositionId: "pos-liquidated",
        status: "Liquidated",
        closedAt: new Date("2024-01-04"),
        pnlUsdValue: -1000, // Lost everything
        pnlPercentage: -100,
      };

      mockProvider.getPositions = vi.fn().mockResolvedValue([
        samplePosition, // Open
        closedPosition, // Closed
        liquidatedPosition, // Liquidated
      ]);

      const result = await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0x123",
        mockProvider,
      );

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.positions).toHaveLength(3);

      expect(mockPerpsRepo.syncAgentPerpsData).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        expect.arrayContaining([
          expect.objectContaining({
            status: "Open",
            providerPositionId: "pos-123",
          }),
          expect.objectContaining({
            status: "Closed",
            providerPositionId: "pos-closed",
            closedAt: new Date("2024-01-03"),
          }),
          expect.objectContaining({
            status: "Liquidated",
            providerPositionId: "pos-liquidated",
            closedAt: new Date("2024-01-04"),
          }),
        ]),
        expect.any(Object),
      );
    });

    it("should handle provider health check failures", async () => {
      // Create a provider that reports as unhealthy
      const unhealthyProvider: IPerpsDataProvider = {
        ...mockProvider,
        isHealthy: vi.fn().mockResolvedValue(false),
      };

      // The service doesn't check health automatically,
      // but we can test that the factory would validate it
      const isHealthy = await unhealthyProvider.isHealthy?.();
      expect(isHealthy).toBe(false);

      // In real usage, the factory or a monitoring service would check this
      // before using the provider
    });

    it("should handle account with unknown status", async () => {
      const unknownStatusSummary: PerpsAccountSummary = {
        ...sampleAccountSummary,
        accountStatus: "unknown", // Unknown/undefined status
      };

      mockProvider.getAccountSummary = vi
        .fn()
        .mockResolvedValue(unknownStatusSummary);

      const result = await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0x123",
        mockProvider,
      );

      // Verify processing succeeded
      expect(result).toBeDefined();
      expect(result.summary.accountStatus).toBe("unknown");

      expect(mockPerpsRepo.syncAgentPerpsData).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        expect.any(Array),
        expect.objectContaining({
          accountStatus: "unknown",
        }),
      );
    });

    it("should handle zero values correctly", async () => {
      const zeroValuesSummary: PerpsAccountSummary = {
        ...sampleAccountSummary,
        totalPnl: 0,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 0,
        availableBalance: 0,
        marginUsed: 0,
        totalVolume: 0,
        totalTrades: 0,
        openPositionsCount: 0,
        closedPositionsCount: 0,
        liquidatedPositionsCount: 0,
        roi: 0,
        roiPercent: 0,
        averageTradeSize: 0,
        totalFeesPaid: 0,
      };

      mockProvider.getAccountSummary = vi
        .fn()
        .mockResolvedValue(zeroValuesSummary);

      const result = await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0x123",
        mockProvider,
      );

      // Verify processing succeeded with zeros
      expect(result).toBeDefined();
      expect(result.summary.totalPnl).toBe("0");

      // All zero values should be preserved as "0" strings
      expect(mockPerpsRepo.syncAgentPerpsData).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        expect.any(Array),
        expect.objectContaining({
          totalPnl: "0",
          totalRealizedPnl: "0",
          totalUnrealizedPnl: "0",
          availableBalance: "0",
          marginUsed: "0",
          totalVolume: "0",
          totalTrades: 0, // Integer stays as number
          openPositionsCount: 0,
          closedPositionsCount: 0,
          liquidatedPositionsCount: 0,
          roi: "0",
          roiPercent: "0",
          averageTradeSize: "0",
          totalFeesPaid: "0",
        }),
      );
    });

    it("should handle scientific notation in numbers", async () => {
      const scientificSummary: PerpsAccountSummary = {
        ...sampleAccountSummary,
        totalVolume: 1.23e10, // Scientific notation
        totalEquity: 5.67e-5, // Very small scientific notation
      };

      const scientificPosition: PerpsPosition = {
        ...samplePosition,
        entryPrice: 1.5e-8, // Satoshi-level pricing
        currentPrice: 2.1e-8,
      };

      mockProvider.getAccountSummary = vi
        .fn()
        .mockResolvedValue(scientificSummary);
      mockProvider.getPositions = vi
        .fn()
        .mockResolvedValue([scientificPosition]);

      const result = await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0x123",
        mockProvider,
      );

      // Verify scientific notation was properly converted
      expect(result).toBeDefined();
      expect(result.summary.totalVolume).toBe("12300000000");

      expect(mockPerpsRepo.syncAgentPerpsData).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        expect.arrayContaining([
          expect.objectContaining({
            entryPrice: "0.000000015", // Converted from scientific
            currentPrice: "0.000000021",
          }),
        ]),
        expect.objectContaining({
          totalVolume: "12300000000", // 1.23e10 as string
          totalEquity: "0.0000567", // 5.67e-5 as string
        }),
      );
    });

    it("should handle batch with duplicate agent IDs gracefully", async () => {
      // This tests the Map behavior with duplicate keys
      // In reality, duplicate agent IDs indicate a data integrity issue that should be prevented upstream
      const agents = [
        { agentId: "agent-1", walletAddress: "0x111" },
        { agentId: "agent-1", walletAddress: "0x222" }, // Duplicate ID, different wallet
        { agentId: "agent-2", walletAddress: "0x333" },
      ];

      const result = await processor.processBatchAgentData(
        agents,
        "comp-1",
        mockProvider,
      );

      // All 3 agents will be fetched from the provider
      expect(mockProvider.getAccountSummary).toHaveBeenCalledTimes(3);

      // The service will process all 3, but the Map used for portfolio snapshots
      // will only keep the last occurrence of agent-1. This is a data integrity
      // issue that should ideally be caught and logged as a warning.
      expect(result.successful).toHaveLength(3);

      // Verify that all 3 were passed to batchSync
      expect(mockPerpsRepo.batchSyncAgentsPerpsData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ agentId: "agent-1" }),
          expect.objectContaining({ agentId: "agent-1" }),
          expect.objectContaining({ agentId: "agent-2" }),
        ]),
      );
    });

    it("should transform closed position fills to database format when provider supports getClosedPositionFills", async () => {
      // Create a provider that supports closed fills
      const providerWithClosedFills: IPerpsDataProvider = {
        ...mockProvider,
        getClosedPositionFills: vi.fn().mockResolvedValue([sampleClosedFill]),
      };

      const agents = [{ agentId: "agent-1", walletAddress: "0x111" }];

      // Competition dates are required for closed fills to be fetched
      const competitionStartDate = new Date("2024-01-01");
      const competitionEndDate = new Date("2024-01-31");

      // Mock repository methods that are called before getClosedPositionFills
      // These simulate a first sync scenario (no existing snapshots or summaries)
      mockCompetitionRepo.getFirstAndLastSnapshots = vi
        .fn()
        .mockResolvedValue({ first: null, last: null });
      mockPerpsRepo.getLatestPerpsAccountSummary = vi
        .fn()
        .mockResolvedValue(null);

      await processor.processBatchAgentData(
        agents,
        "comp-1",
        providerWithClosedFills,
        competitionStartDate,
        competitionEndDate,
      );

      // Verify getClosedPositionFills was called with correct parameters
      // On first sync (no lastSyncTime), fillsStartDate equals competitionStartDate
      expect(
        providerWithClosedFills.getClosedPositionFills,
      ).toHaveBeenCalledWith("0x111", competitionStartDate, competitionEndDate);

      // Verify the closed fill was transformed correctly and included in positions
      expect(mockPerpsRepo.batchSyncAgentsPerpsData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            agentId: "agent-1",
            competitionId: "comp-1",
            positions: expect.arrayContaining([
              // Open position from getPositions (already tested elsewhere)
              expect.objectContaining({
                providerPositionId: "pos-123",
                status: "Open",
              }),
              // Closed fill transformed to database format
              expect.objectContaining({
                agentId: "agent-1",
                competitionId: "comp-1",
                providerPositionId: "fill-abc123-456", // Maps from providerFillId
                providerTradeId: null,
                asset: "ETH", // Maps from symbol
                isLong: false, // side === "short" -> isLong = false
                leverage: null, // Not available from fills
                positionSize: "5000", // positionSizeUsd transformed to string
                collateralAmount: null, // Not available from fills
                entryPrice: null, // Not available from fills (only close price)
                currentPrice: "2500", // Maps from closePrice
                liquidationPrice: null,
                pnlUsdValue: "-150", // Maps from closedPnl
                pnlPercentage: null, // Cannot calculate without entry price
                status: "Closed",
                createdAt: sampleClosedFill.closedAt, // Uses closedAt as best approximation
                lastUpdatedAt: sampleClosedFill.closedAt,
                closedAt: sampleClosedFill.closedAt,
              }),
            ]),
          }),
        ]),
      );
    });

    it("should correctly transform closed fill with long side to isLong: true", async () => {
      const longClosedFill: ClosedPositionFill = {
        ...sampleClosedFill,
        side: "long",
        closedPnl: 250, // Profitable long position
      };

      const providerWithLongFill: IPerpsDataProvider = {
        ...mockProvider,
        getClosedPositionFills: vi.fn().mockResolvedValue([longClosedFill]),
      };

      const agents = [{ agentId: "agent-1", walletAddress: "0x111" }];

      // Mock repository methods for first sync scenario
      mockCompetitionRepo.getFirstAndLastSnapshots = vi
        .fn()
        .mockResolvedValue({ first: null, last: null });
      mockPerpsRepo.getLatestPerpsAccountSummary = vi
        .fn()
        .mockResolvedValue(null);

      await processor.processBatchAgentData(
        agents,
        "comp-1",
        providerWithLongFill,
        new Date("2024-01-01"),
        new Date("2024-01-31"),
      );

      expect(mockPerpsRepo.batchSyncAgentsPerpsData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            positions: expect.arrayContaining([
              expect.objectContaining({
                isLong: true, // side === "long" -> isLong = true
                pnlUsdValue: "250",
              }),
            ]),
          }),
        ]),
      );
    });

    it("should not fetch closed fills when provider does not support getClosedPositionFills", async () => {
      // Provider without getClosedPositionFills method (like Symphony)
      const providerWithoutClosedFills: IPerpsDataProvider = {
        getName: vi.fn().mockReturnValue("SymphonyProvider"),
        getAccountSummary: vi.fn().mockResolvedValue(sampleAccountSummary),
        getPositions: vi.fn().mockResolvedValue([samplePosition]),
        isHealthy: vi.fn().mockResolvedValue(true),
        // Note: no getClosedPositionFills method
      };

      const agents = [{ agentId: "agent-1", walletAddress: "0x111" }];

      // Mock repository methods for first sync scenario
      mockCompetitionRepo.getFirstAndLastSnapshots = vi
        .fn()
        .mockResolvedValue({ first: null, last: null });
      mockPerpsRepo.getLatestPerpsAccountSummary = vi
        .fn()
        .mockResolvedValue(null);

      await processor.processBatchAgentData(
        agents,
        "comp-1",
        providerWithoutClosedFills,
        new Date("2024-01-01"),
        new Date("2024-01-31"),
      );

      // Should only have the open position, no closed fills
      expect(mockPerpsRepo.batchSyncAgentsPerpsData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            positions: expect.arrayContaining([
              expect.objectContaining({
                providerPositionId: "pos-123",
                status: "Open",
              }),
            ]),
          }),
        ]),
      );

      // Verify no closed fill positions were added
      const callArgs = vi.mocked(mockPerpsRepo.batchSyncAgentsPerpsData).mock
        .calls[0]?.[0];
      expect(callArgs).toBeDefined();
      const positions = callArgs?.[0]?.positions;
      expect(positions).toHaveLength(1); // Only the open position
    });

    it("should not fetch closed fills when competitionStartDate is not provided", async () => {
      const providerWithClosedFills: IPerpsDataProvider = {
        ...mockProvider,
        getClosedPositionFills: vi.fn().mockResolvedValue([sampleClosedFill]),
      };

      const agents = [{ agentId: "agent-1", walletAddress: "0x111" }];

      // Mock repository methods
      mockCompetitionRepo.getFirstAndLastSnapshots = vi
        .fn()
        .mockResolvedValue({ first: null, last: null });
      mockPerpsRepo.getLatestPerpsAccountSummary = vi
        .fn()
        .mockResolvedValue(null);

      // Call without competitionStartDate - the condition `if (competitionStartDate && ...)` is false
      await processor.processBatchAgentData(
        agents,
        "comp-1",
        providerWithClosedFills,
        // No competitionStartDate or competitionEndDate
      );

      // getClosedPositionFills should NOT be called without competition dates
      expect(
        providerWithClosedFills.getClosedPositionFills,
      ).not.toHaveBeenCalled();
    });

    it("should use lastSyncTime for closed fills optimization on subsequent syncs", async () => {
      const providerWithClosedFills: IPerpsDataProvider = {
        ...mockProvider,
        getClosedPositionFills: vi.fn().mockResolvedValue([sampleClosedFill]),
      };

      const agents = [{ agentId: "agent-1", walletAddress: "0x111" }];

      // Competition dates
      const competitionStartDate = new Date("2024-01-01T00:00:00Z");
      const competitionEndDate = new Date("2024-01-31T00:00:00Z");

      // Simulate a subsequent sync where we have a previous sync timestamp
      // The lastSyncTime is AFTER competition start, so it should be used
      const lastSyncTime = new Date("2024-01-15T12:00:00Z");

      mockCompetitionRepo.getFirstAndLastSnapshots = vi
        .fn()
        .mockResolvedValue({ first: null, last: null });
      mockPerpsRepo.getLatestPerpsAccountSummary = vi.fn().mockResolvedValue({
        timestamp: lastSyncTime,
        totalEquity: "10500",
      });

      await processor.processBatchAgentData(
        agents,
        "comp-1",
        providerWithClosedFills,
        competitionStartDate,
        competitionEndDate,
      );

      // Verify getClosedPositionFills was called with lastSyncTime (the later date)
      // instead of competitionStartDate, optimizing to only fetch recent fills
      expect(
        providerWithClosedFills.getClosedPositionFills,
      ).toHaveBeenCalledWith(
        "0x111",
        lastSyncTime, // Uses lastSyncTime since it's after competitionStartDate
        competitionEndDate,
      );
    });

    it("should handle closed fill with zero positionSizeUsd by falling back to '0'", async () => {
      const zeroSizeFill: ClosedPositionFill = {
        ...sampleClosedFill,
        positionSizeUsd: 0,
      };

      const providerWithZeroFill: IPerpsDataProvider = {
        ...mockProvider,
        getClosedPositionFills: vi.fn().mockResolvedValue([zeroSizeFill]),
      };

      // Mock repository methods for first sync scenario
      mockCompetitionRepo.getFirstAndLastSnapshots = vi
        .fn()
        .mockResolvedValue({ first: null, last: null });
      mockPerpsRepo.getLatestPerpsAccountSummary = vi
        .fn()
        .mockResolvedValue(null);

      await processor.processBatchAgentData(
        [{ agentId: "agent-1", walletAddress: "0x111" }],
        "comp-1",
        providerWithZeroFill,
        new Date("2024-01-01"),
        new Date("2024-01-31"),
      );

      expect(mockPerpsRepo.batchSyncAgentsPerpsData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            positions: expect.arrayContaining([
              expect.objectContaining({
                positionSize: "0", // Zero is correctly transformed to "0"
              }),
            ]),
          }),
        ]),
      );
    });
  });

  describe("processCompetitionAgents", () => {
    it("should process all agents in a competition", async () => {
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
      ]);

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
        isRewardsIneligible: false,
        rewardsIneligibilityReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([mockAgent]);

      const result = await processor.processCompetitionAgents(
        "comp-1",
        mockProvider,
      );

      expect(mockCompetitionRepo.getCompetitionAgents).toHaveBeenCalledWith(
        "comp-1",
      );
      expect(mockAgentRepo.findByIds).toHaveBeenCalledWith(["agent-1"]);

      // Should process the agent (with undefined initialCapital)
      expect(mockProvider.getAccountSummary).toHaveBeenCalledWith(
        "0x123",
        undefined,
      );
      expect(result.successful).toHaveLength(1);
    });

    it("should handle competitions with no agents", async () => {
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([]);

      const result = await processor.processCompetitionAgents(
        "comp-1",
        mockProvider,
      );

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(mockProvider.getAccountSummary).not.toHaveBeenCalled();
    });

    it("should filter out agents without wallet addresses", async () => {
      vi.mocked(mockCompetitionRepo.getCompetitionAgents).mockResolvedValue([
        "agent-1",
        "agent-2",
      ]);

      const mockAgentWithWallet: SelectAgent = {
        id: "agent-1",
        ownerId: "owner-1",
        walletAddress: "0x123",
        name: "Test Agent 1",
        handle: "test-agent-1",
        email: null,
        description: null,
        imageUrl: null,
        apiKey: "test-key-1",
        apiKeyHash: null,
        metadata: null,
        status: "active",
        deactivationReason: null,
        deactivationDate: null,
        isRewardsIneligible: false,
        rewardsIneligibilityReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAgentWithoutWallet: SelectAgent = {
        id: "agent-2",
        ownerId: "owner-2",
        walletAddress: null,
        name: "Test Agent 2",
        handle: "test-agent-2",
        email: null,
        description: null,
        imageUrl: null,
        apiKey: "test-key-2",
        apiKeyHash: null,
        metadata: null,
        status: "active",
        deactivationReason: null,
        deactivationDate: null,
        isRewardsIneligible: false,
        rewardsIneligibilityReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockAgentRepo.findByIds).mockResolvedValue([
        mockAgentWithWallet,
        mockAgentWithoutWallet,
      ]);

      const result = await processor.processCompetitionAgents(
        "comp-1",
        mockProvider,
      );

      // Only agent-1 should be processed
      expect(mockProvider.getAccountSummary).toHaveBeenCalledTimes(1);
      expect(mockProvider.getAccountSummary).toHaveBeenCalledWith(
        "0x123",
        undefined,
      );
      expect(result.successful).toHaveLength(1);
    });

    it("should throw error if provider is not provided", async () => {
      await expect(
        processor.processCompetitionAgents(
          "comp-1",
          null as unknown as IPerpsDataProvider,
        ),
      ).rejects.toThrow("[PerpsDataProcessor] Provider is required");
    });
  });

  describe("isPerpsCompetition", () => {
    it("should return true for perpetual_futures competitions", async () => {
      const mockCompetition = {
        id: "comp-1",
        name: "Test Competition",
        description: null,
        type: "perpetual_futures" as const,
        externalUrl: null,
        imageUrl: null,
        startDate: new Date(),
        endDate: new Date(),
        joinStartDate: null,
        joinEndDate: null,
        boostStartDate: null,
        boostEndDate: null,
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
        minimumStake: null,
        evaluationMetric: "calmar_ratio" as const,
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
        displayState: null,
        arenaId: "default-perps-arena",
        engineId: "perpetual_futures" as const,
        engineVersion: "1.0.0",
        boostTimeDecayRate: null,
      };

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        mockCompetition,
      );

      const result = await processor.isPerpsCompetition("comp-1");
      expect(result).toBe(true);
    });

    it("should return false for trading competitions", async () => {
      const mockCompetition = {
        id: "comp-1",
        name: "Test Competition",
        description: null,
        type: "trading" as const,
        externalUrl: null,
        imageUrl: null,
        startDate: new Date(),
        endDate: new Date(),
        joinStartDate: null,
        joinEndDate: null,
        boostStartDate: null,
        boostEndDate: null,
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
        displayState: null,
        arenaId: "default-paper-arena",
        engineId: "spot_paper_trading" as const,
        engineVersion: "1.0.0",
        crossChainTradingType: "allow" as const,
        minimumStake: null,
        evaluationMetric: "calmar_ratio" as const,
        boostTimeDecayRate: null,
      };

      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(
        mockCompetition,
      );

      const result = await processor.isPerpsCompetition("comp-1");
      expect(result).toBe(false);
    });

    it("should return false for non-existent competitions", async () => {
      vi.mocked(mockCompetitionRepo.findById).mockResolvedValue(undefined);

      const result = await processor.isPerpsCompetition("comp-1");
      expect(result).toBe(false);
    });
  });

  describe("getCompetitionConfig", () => {
    it("should retrieve competition configuration", async () => {
      const mockConfig = {
        competitionId: "comp-1",
        initialCapital: "10000",
        dataSource: "external_api" as const,
        dataSourceConfig: { type: "external_api", provider: "symphony" },
        selfFundingThresholdUsd: "100",
        createdAt: new Date(),
        updatedAt: new Date(),
        inactivityHours: null,
      };

      mockPerpsRepo.getPerpsCompetitionConfig = vi
        .fn()
        .mockResolvedValue(mockConfig);

      const result = await processor.getCompetitionConfig("comp-1");
      expect(result).toEqual(mockConfig);
      expect(mockPerpsRepo.getPerpsCompetitionConfig).toHaveBeenCalledWith(
        "comp-1",
      );
    });

    it("should return null if config not found", async () => {
      mockPerpsRepo.getPerpsCompetitionConfig = vi.fn().mockResolvedValue(null);

      const result = await processor.getCompetitionConfig("comp-1");
      expect(result).toBeNull();
    });
  });
});
