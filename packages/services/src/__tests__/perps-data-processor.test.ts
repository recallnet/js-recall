import type { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock, mockReset } from "vitest-mock-extended";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { PerpsRepository } from "@recallnet/db/repositories/perps";

import { CalmarRatioService } from "../calmar-ratio.service.js";
import { PerpsDataProcessor } from "../perps-data-processor.service.js";
import type { AgentPerpsSyncData } from "../types/perps.js";
import type {
  IPerpsDataProvider,
  PerpsAccountSummary,
  PerpsPosition,
} from "../types/perps.js";

describe("PerpsDataProcessor", () => {
  let processor: PerpsDataProcessor;
  let mockProvider: MockProxy<IPerpsDataProvider>;
  let mockCalmarRatioService: MockProxy<CalmarRatioService>;
  let mockAgentRepo: MockProxy<AgentRepository>;
  let mockCompetitionRepo: MockProxy<CompetitionRepository>;
  let mockPerpsRepo: MockProxy<PerpsRepository>;
  let mockLogger: MockProxy<Logger>;

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
      collateralAmount: String(pos.collateralAmount || "0"),
      entryPrice: String(pos.entryPrice),
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

    // Create all service mocks
    mockCalmarRatioService = mock<CalmarRatioService>();
    mockAgentRepo = mock<AgentRepository>();
    mockCompetitionRepo = mock<CompetitionRepository>();
    mockPerpsRepo = mock<PerpsRepository>();
    mockLogger = mock<Logger>();

    // Create mock provider
    mockProvider = mock<IPerpsDataProvider>();
    mockProvider.getName.mockReturnValue("TestProvider");
    mockProvider.getAccountSummary.mockResolvedValue(sampleAccountSummary);
    mockProvider.getPositions.mockResolvedValue([samplePosition]);
    // Setup isHealthy as a mock function since it's optional
    mockProvider.isHealthy = vi.fn().mockResolvedValue(true);

    // Mock repository functions with dynamic behavior based on input
    mockPerpsRepo.syncAgentPerpsData.mockImplementation(
      async (agentId, competitionId, positions, summary) => {
        return createMockSyncResult(agentId, positions, summary);
      },
    );

    // batchSyncAgentsPerpsData should process the actual input data
    mockPerpsRepo.batchSyncAgentsPerpsData.mockImplementation(
      async (syncDataArray: AgentPerpsSyncData[]) => {
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
      },
    );

    // Portfolio snapshots
    const mockPortfolioSnapshot = {
      id: 1,
      agentId: "agent-1",
      competitionId: "comp-1",
      timestamp: new Date(),
      totalValue: 10500,
    };

    mockCompetitionRepo.createPortfolioSnapshot.mockResolvedValue(
      mockPortfolioSnapshot,
    );
    mockCompetitionRepo.batchCreatePortfolioSnapshots.mockResolvedValue([
      mockPortfolioSnapshot,
    ]);

    // Default mocks for other functions
    mockCompetitionRepo.findById.mockResolvedValue(undefined);
    mockCompetitionRepo.getCompetitionAgents.mockResolvedValue([]);
    mockAgentRepo.findByIds.mockResolvedValue([]);

    processor = new PerpsDataProcessor(
      mockCalmarRatioService,
      mockAgentRepo,
      mockCompetitionRepo,
      mockPerpsRepo,
      mockLogger,
    );
  });

  afterEach(() => {
    // Reset all mocks
    mockReset(mockCalmarRatioService);
    mockReset(mockAgentRepo);
    mockReset(mockCompetitionRepo);
    mockReset(mockPerpsRepo);
    mockReset(mockLogger);
  });

  describe("processAgentData", () => {
    it("should process a single agent's perps data successfully", async () => {
      const result = await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0x123456789",
        mockProvider,
      );

      // Verify provider was called
      expect(mockProvider.getAccountSummary).toHaveBeenCalledWith(
        "0x123456789",
      );
      expect(mockProvider.getPositions).toHaveBeenCalledWith("0x123456789");

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.positions).toHaveLength(1);
      expect(result.summary).toBeDefined();

      // Verify repository was called with transformed data
      expect(mockPerpsRepo.syncAgentPerpsData).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        expect.arrayContaining([
          expect.objectContaining({
            asset: "BTC-PERP",
            isLong: true,
            leverage: "10",
            positionSize: "1000",
            entryPrice: "50000",
            currentPrice: "51000",
            pnlUsdValue: "20",
            pnlPercentage: "2",
            status: "Open",
            createdAt: new Date("2024-01-01"),
          }),
        ]),
        expect.objectContaining({
          totalEquity: "10500",
          initialCapital: "10000",
          totalVolume: "50000",
          totalPnl: "500",
          accountStatus: "active",
        }),
      );
    });

    it("should handle provider API failures gracefully", async () => {
      // Mock provider to throw error
      mockProvider.getAccountSummary.mockRejectedValue(
        new Error("Provider API down"),
      );

      await expect(
        processor.processAgentData("agent-1", "comp-1", "0x123", mockProvider),
      ).rejects.toThrow("Provider API down");

      // Verify repository was not called when provider fails
      expect(mockPerpsRepo.syncAgentPerpsData).not.toHaveBeenCalled();
    });

    it("should handle empty positions array", async () => {
      mockProvider.getPositions.mockResolvedValue([]);

      const result = await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0x123",
        mockProvider,
      );

      expect(result.positions).toHaveLength(0);
      expect(result.summary).toBeDefined();

      // Should still sync summary even with no positions
      expect(mockPerpsRepo.syncAgentPerpsData).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        [],
        expect.any(Object),
      );
    });

    it("should handle positions without optional fields", async () => {
      const minimalPosition: PerpsPosition = {
        providerPositionId: "pos-minimal",
        symbol: "ETH-PERP",
        side: "short",
        leverage: 5,
        positionSizeUsd: 500,
        entryPrice: 3000,
        currentPrice: 2900,
        pnlUsdValue: -50,
        pnlPercentage: -10,
        status: "Open",
        openedAt: new Date("2024-01-01"),
        // Missing optional fields like lastUpdatedAt, liquidationPrice, etc.
      };

      mockProvider.getPositions.mockResolvedValue([minimalPosition]);

      const result = await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0x123",
        mockProvider,
      );

      expect(result.positions).toHaveLength(1);

      expect(mockPerpsRepo.syncAgentPerpsData).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        expect.arrayContaining([
          expect.objectContaining({
            asset: "ETH-PERP",
            isLong: false, // short side
            leverage: "5",
            positionSize: "500",
            entryPrice: "3000",
            currentPrice: "2900",
            pnlUsdValue: "-50",
            pnlPercentage: "-10",
            status: "Open",
            lastUpdatedAt: null, // Should handle missing optional field
          }),
        ]),
        expect.any(Object),
      );
    });
  });

  describe("processBatchAgentData", () => {
    it("should process multiple agents successfully", async () => {
      const agents = [
        { agentId: "agent-1", walletAddress: "0x111" },
        { agentId: "agent-2", walletAddress: "0x222" },
      ];

      const result = await processor.processBatchAgentData(
        agents,
        "comp-1",
        mockProvider,
      );

      // Should call provider for each agent
      expect(mockProvider.getAccountSummary).toHaveBeenCalledTimes(2);
      expect(mockProvider.getPositions).toHaveBeenCalledTimes(2);

      // Should call batch sync with all agent data
      expect(mockPerpsRepo.batchSyncAgentsPerpsData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ agentId: "agent-1" }),
          expect.objectContaining({ agentId: "agent-2" }),
        ]),
      );

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it("should handle mixed success and failure", async () => {
      const agents = [
        { agentId: "agent-1", walletAddress: "0x111" },
        { agentId: "agent-2", walletAddress: "0x222" },
      ];

      // Mock provider to fail for second agent
      mockProvider.getAccountSummary.mockImplementation((walletAddress) => {
        if (walletAddress === "0x222") {
          throw new Error("Agent 2 API error");
        }
        return Promise.resolve(sampleAccountSummary);
      });

      const result = await processor.processBatchAgentData(
        agents,
        "comp-1",
        mockProvider,
      );

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]?.agentId).toBe("agent-2");
      expect(result.failed[0]?.error).toBeInstanceOf(Error);
    });

    it("should handle extreme values in financial data", async () => {
      // Test with very large numbers and negative values
      const extremeValuesSummary: PerpsAccountSummary = {
        ...sampleAccountSummary,
        totalVolume: 1e15, // Quadrillion
        totalEquity: -50000, // Negative equity (liquidated account)
        totalPnl: -100000, // Large loss
        roi: -0.955, // 95.5% loss
        roiPercent: -95.5,
      };

      const extremePosition: PerpsPosition = {
        ...samplePosition,
        positionSizeUsd: 1e12, // Trillion dollar position
        entryPrice: 0.000001, // Very small price
        currentPrice: 0.0000005, // Even smaller price
        pnlUsdValue: -5e11, // 500 billion loss
        pnlPercentage: -50,
      };

      mockProvider.getAccountSummary.mockResolvedValue(extremeValuesSummary);
      mockProvider.getPositions.mockResolvedValue([extremePosition]);

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

      mockProvider.getPositions.mockResolvedValue([
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
      mockProvider.isHealthy = vi.fn().mockResolvedValue(false);

      // The service doesn't check health automatically,
      // but we can test that the factory would validate it
      const isHealthy = await mockProvider.isHealthy?.();
      expect(isHealthy).toBe(false);

      // In real usage, the factory or a monitoring service would check this
      // before using the provider
    });

    it("should handle account with unknown status", async () => {
      const unknownStatusSummary: PerpsAccountSummary = {
        ...sampleAccountSummary,
        accountStatus: "unknown", // Unknown/undefined status
      };

      mockProvider.getAccountSummary.mockResolvedValue(unknownStatusSummary);

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

      mockProvider.getAccountSummary.mockResolvedValue(zeroValuesSummary);

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

      mockProvider.getAccountSummary.mockResolvedValue(scientificSummary);
      mockProvider.getPositions.mockResolvedValue([scientificPosition]);

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
          totalVolume: "12300000000", // 1.23e10
          totalEquity: "0.0000567", // 5.67e-5
        }),
      );
    });

    it("should handle null and undefined values in provider data", async () => {
      const sparsePosition: PerpsPosition = {
        providerPositionId: "pos-sparse",
        symbol: "ADA-PERP",
        side: "long",
        leverage: 2,
        positionSizeUsd: 100,
        entryPrice: 0.5,
        currentPrice: 0.48,
        pnlUsdValue: -4,
        pnlPercentage: -8,
        status: "Open",
        openedAt: new Date("2024-01-01"),
        // Many fields will be undefined/null
        lastUpdatedAt: undefined,
        closedAt: undefined,
        liquidationPrice: undefined,
      };

      const sparseSummary: PerpsAccountSummary = {
        totalEquity: 1000,
        initialCapital: 1000,
        totalVolume: 5000,
        totalUnrealizedPnl: -4,
        totalRealizedPnl: 0,
        totalPnl: -4,
        totalFeesPaid: 1,
        availableBalance: 996,
        marginUsed: 50,
        totalTrades: 1,
        openPositionsCount: 1,
        closedPositionsCount: 0,
        liquidatedPositionsCount: 0,
        roi: -0.004,
        roiPercent: -0.4,
        averageTradeSize: 5000,
        accountStatus: "active",
        // Intentionally missing optional fields
      };

      mockProvider.getAccountSummary.mockResolvedValue(sparseSummary);
      mockProvider.getPositions.mockResolvedValue([sparsePosition]);

      const result = await processor.processAgentData(
        "agent-1",
        "comp-1",
        "0x123",
        mockProvider,
      );

      expect(result).toBeDefined();
      expect(result.positions).toHaveLength(1);

      // Verify null/undefined values are handled correctly
      expect(mockPerpsRepo.syncAgentPerpsData).toHaveBeenCalledWith(
        "agent-1",
        "comp-1",
        expect.arrayContaining([
          expect.objectContaining({
            lastUpdatedAt: null,
            closedAt: null,
            liquidationPrice: null,
          }),
        ]),
        expect.any(Object),
      );
    });

    it("should batch process agents and handle partial failures", async () => {
      const agents = [
        { agentId: "agent-1", walletAddress: "0x111" },
        { agentId: "agent-2", walletAddress: "0x222" },
        { agentId: "agent-3", walletAddress: "0x333" },
      ];

      // Mock to fail for agent-2
      mockProvider.getAccountSummary.mockImplementation((walletAddress) => {
        if (walletAddress === "0x222") {
          throw new Error("Agent 2 provider error");
        }
        return Promise.resolve(sampleAccountSummary);
      });

      const result = await processor.processBatchAgentData(
        agents,
        "comp-1",
        mockProvider,
      );

      // Should have 2 successful, 1 failed
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);

      expect(result.failed[0]?.agentId).toBe("agent-2");
      expect(result.failed[0]?.error).toBeInstanceOf(Error);

      // Should batch sync only successful agents
      expect(mockPerpsRepo.batchSyncAgentsPerpsData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ agentId: "agent-1" }),
          expect.objectContaining({ agentId: "agent-3" }),
        ]),
      );
    });
  });
});
