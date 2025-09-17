import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  SelectPerpsCompetitionConfig,
  SelectPerpsSelfFundingAlert,
} from "@recallnet/db-schema/trading/types";

import * as perpsRepo from "@/database/repositories/perps-repository.js";
import { PerpsMonitoringService } from "@/services/perps-monitoring.service.js";
import type {
  IPerpsDataProvider,
  PerpsAccountSummary,
  Transfer,
} from "@/types/perps.js";

// Mock the repository module
vi.mock("@/database/repositories/perps-repository.js");
vi.mock("@/lib/logger.js");

describe("PerpsMonitoringService", () => {
  let service: PerpsMonitoringService;
  let mockProviderWithTransfers: IPerpsDataProvider;
  let mockProviderNoTransfers: IPerpsDataProvider;

  // Sample data matching provider return types (numbers, not strings)
  const sampleAccountSummary: PerpsAccountSummary = {
    totalEquity: 10500,
    initialCapital: 10000,
    totalPnl: 500,
    totalRealizedPnl: 300,
    totalUnrealizedPnl: 200,
    totalVolume: 50000,
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
    rawData: { test: "data" },
  };

  const sampleTransfer: Transfer = {
    type: "deposit",
    amount: 150, // Above default threshold of 10
    asset: "USDC",
    from: "0xSender",
    to: "0x123", // Will be matched case-insensitively
    timestamp: new Date("2024-01-15"), // After competition start
    txHash: "0xabc123",
  };

  const mockCompetitionConfig: SelectPerpsCompetitionConfig = {
    competitionId: "comp-1",
    initialCapital: "10000", // String in DB
    dataSource: "external_api",
    dataSourceConfig: { type: "external_api", provider: "symphony" },
    selfFundingThresholdUsd: "100", // String in DB
    createdAt: new Date(),
    updatedAt: new Date(),
    inactivityHours: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Provider WITH transfer history support
    mockProviderWithTransfers = {
      getName: vi.fn().mockReturnValue("TestProviderWithTransfers"),
      getAccountSummary: vi.fn().mockResolvedValue(sampleAccountSummary),
      getPositions: vi.fn().mockResolvedValue([]),
      getTransferHistory: vi.fn().mockResolvedValue([]), // Method EXISTS
    };

    // Provider WITHOUT transfer history support
    mockProviderNoTransfers = {
      getName: vi.fn().mockReturnValue("TestProviderNoTransfers"),
      getAccountSummary: vi.fn().mockResolvedValue(sampleAccountSummary),
      getPositions: vi.fn().mockResolvedValue([]),
      // NO getTransferHistory method
    };

    // Default repository mocks
    vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
      mockCompetitionConfig,
    );
    // Mock the new batch method to return an empty Map by default
    vi.mocked(perpsRepo.batchGetAgentsSelfFundingAlerts).mockResolvedValue(
      new Map(),
    );
    vi.mocked(perpsRepo.batchCreatePerpsSelfFundingAlerts).mockResolvedValue(
      [],
    );

    service = new PerpsMonitoringService(mockProviderWithTransfers);
  });

  describe("constructor", () => {
    it("should initialize with default thresholds", () => {
      const testService = new PerpsMonitoringService(mockProviderWithTransfers);
      expect(mockProviderWithTransfers.getName).toHaveBeenCalled();
      // Can't directly access private config, but we'll test behavior
      expect(testService).toBeDefined();
    });

    it("should accept custom thresholds", () => {
      const customConfig = {
        transferThreshold: 50,
        reconciliationThreshold: 200,
        criticalAmountThreshold: 1000,
      };
      const testService = new PerpsMonitoringService(
        mockProviderWithTransfers,
        customConfig,
      );
      expect(mockProviderWithTransfers.getName).toHaveBeenCalled();
      // Custom thresholds will be tested through behavior
      expect(testService).toBeDefined();
    });
  });

  describe("monitorAgentsWithData", () => {
    const competitionStartDate = new Date("2024-01-01");
    const initialCapital = 10000;
    const selfFundingThreshold = 100; // Standard test threshold

    describe("empty agents handling", () => {
      it("should return immediately for empty agents array", async () => {
        const result = await service.monitorAgentsWithData(
          [],
          undefined, // No pre-fetched summaries
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        expect(result).toEqual({
          successful: [],
          failed: [],
          totalAlertsCreated: 0,
        });

        // Should not make any repository calls
        expect(
          perpsRepo.batchGetAgentsSelfFundingAlerts,
        ).not.toHaveBeenCalled();
        expect(
          perpsRepo.batchCreatePerpsSelfFundingAlerts,
        ).not.toHaveBeenCalled();
      });
    });

    describe("threshold handling", () => {
      it("should detect transfers above the provided threshold", async () => {
        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        // Set up self-funding alert
        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([
          { ...sampleTransfer, amount: 150 }, // Above threshold (100)
        ]);

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold, // 100
        );

        expect(result.successful).toHaveLength(1);
        expect(result.successful[0]?.alerts).toHaveLength(1);

        const firstAgent = result.successful[0];
        expect(firstAgent).toBeDefined();
        expect(firstAgent?.alerts[0]).toBeDefined();

        const alert = firstAgent?.alerts[0];
        if (alert) {
          // The presence of an alert means it was detected
          expect(alert).toBeDefined();
          expect(alert.detectionMethod).toBe("transfer_history");
          expect(alert.unexplainedAmount).toBe(150);
          expect(alert.evidence).toBeDefined();
          expect(alert.evidence?.[0]?.amount).toBe(150);
        }
      });

      it("should not detect transfers below the provided threshold", async () => {
        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        // Small transfer below threshold
        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([
          { ...sampleTransfer, amount: 50 }, // Below threshold (100)
        ]);

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold, // 100
        );

        expect(result.successful).toHaveLength(1);
        expect(result.successful[0]?.alerts).toHaveLength(0);
        expect(result.totalAlertsCreated).toBe(0);
      });

      it("should handle zero threshold (flag any deposit)", async () => {
        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        // Even tiny transfer should be detected with zero threshold
        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([{ ...sampleTransfer, amount: 0.01 }]);

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          0, // Zero threshold
        );

        expect(result.successful).toHaveLength(1);
        expect(result.successful[0]?.alerts).toHaveLength(1);

        const firstAgent = result.successful[0];
        expect(firstAgent).toBeDefined();
        expect(firstAgent?.alerts[0]).toBeDefined();

        const alert = firstAgent?.alerts[0];
        if (alert) {
          // The presence of an alert means it was detected
          expect(alert).toBeDefined();
          expect(alert.detectionMethod).toBe("transfer_history");
          expect(alert.unexplainedAmount).toBe(0.01);
          expect(alert.evidence).toBeDefined();
          expect(alert.evidence?.[0]?.amount).toBe(0.01);
        }
      });

      it("should handle high threshold values", async () => {
        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        // Transfer below high threshold
        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([
          { ...sampleTransfer, amount: 999 }, // Below threshold (1000)
        ]);

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          1000, // High threshold
        );

        expect(result.successful).toHaveLength(1);
        expect(result.successful[0]?.alerts).toHaveLength(0);
      });

      it("should use pre-fetched account summaries when provided (production use case)", async () => {
        const agents = [
          { agentId: "agent-1", walletAddress: "0x123" },
          { agentId: "agent-2", walletAddress: "0x456" },
        ];

        // Pre-fetched summaries from PerpsDataProcessor
        const preFetchedSummaries = new Map<string, PerpsAccountSummary>();
        preFetchedSummaries.set("agent-1", {
          ...sampleAccountSummary,
          totalEquity: 10050, // 50 unexplained (below threshold of 100)
          totalPnl: 50, // Ensure PnL matches the equity change
        });
        preFetchedSummaries.set("agent-2", {
          ...sampleAccountSummary,
          totalEquity: 11000, // 1000 unexplained (above threshold of 100)
          totalPnl: 0, // No PnL, so all equity increase is unexplained
        });

        const result = await service.monitorAgentsWithData(
          agents,
          preFetchedSummaries, // Providing pre-fetched data
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold, // 100
        );

        // Should not call getAccountSummary since we provided pre-fetched data
        expect(
          mockProviderWithTransfers.getAccountSummary,
        ).not.toHaveBeenCalled();

        // Should still detect issues based on the provided summaries
        expect(result.successful).toHaveLength(2);
        expect(result.totalAlertsCreated).toBe(1); // Only agent-2 has unexplained amount >= threshold
      });
    });

    describe("existing alerts handling", () => {
      it("should skip agents with unreviewed alerts (reviewed: false)", async () => {
        const unreviewedAlert: SelectPerpsSelfFundingAlert = {
          id: "alert-1",
          agentId: "agent-1",
          competitionId: "comp-1",
          expectedEquity: "10000",
          actualEquity: "11000",
          unexplainedAmount: "1000",
          accountSnapshot: {},
          detectionMethod: "transfer_history",
          detectedAt: new Date(),
          reviewed: false, // Explicitly false
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: null,
          actionTaken: null,
        };

        const alertsMap = new Map<string, SelectPerpsSelfFundingAlert[]>();
        alertsMap.set("agent-1", [unreviewedAlert]);
        vi.mocked(perpsRepo.batchGetAgentsSelfFundingAlerts).mockResolvedValue(
          alertsMap,
        );

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should not fetch account summary since agent is skipped
        expect(
          mockProviderWithTransfers.getAccountSummary,
        ).not.toHaveBeenCalled();
        expect(result.successful[0]?.alerts).toHaveLength(0);
      });

      it("should skip agents with unreviewed alerts (reviewed: null)", async () => {
        const unreviewedAlert: SelectPerpsSelfFundingAlert = {
          id: "alert-1",
          agentId: "agent-1",
          competitionId: "comp-1",
          expectedEquity: "10000",
          actualEquity: "11000",
          unexplainedAmount: "1000",
          accountSnapshot: {},
          detectionMethod: "balance_reconciliation",
          detectedAt: new Date(),
          reviewed: null, // Null is also treated as unreviewed
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: null,
          actionTaken: null,
        };

        const alertsMap = new Map<string, SelectPerpsSelfFundingAlert[]>();
        alertsMap.set("agent-1", [unreviewedAlert]);
        vi.mocked(perpsRepo.batchGetAgentsSelfFundingAlerts).mockResolvedValue(
          alertsMap,
        );

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        expect(
          mockProviderWithTransfers.getAccountSummary,
        ).not.toHaveBeenCalled();
        expect(result.successful[0]?.alerts).toHaveLength(0);
      });

      it("should process agents with all reviewed alerts", async () => {
        const reviewedAlert: SelectPerpsSelfFundingAlert = {
          id: "alert-1",
          agentId: "agent-1",
          competitionId: "comp-1",
          expectedEquity: "10000",
          actualEquity: "11000",
          unexplainedAmount: "1000",
          accountSnapshot: {},
          detectionMethod: "transfer_history",
          detectedAt: new Date(),
          reviewed: true, // Reviewed
          reviewedAt: new Date(),
          reviewedBy: "admin-1",
          reviewNote: "False positive",
          actionTaken: "dismissed",
        };

        const alertsMap = new Map<string, SelectPerpsSelfFundingAlert[]>();
        alertsMap.set("agent-1", [reviewedAlert]);
        vi.mocked(perpsRepo.batchGetAgentsSelfFundingAlerts).mockResolvedValue(
          alertsMap,
        );

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should process the agent since all alerts are reviewed
        expect(
          mockProviderWithTransfers.getAccountSummary,
        ).toHaveBeenCalledWith("0x123");
        expect(result.successful).toHaveLength(1);
      });
    });

    describe("transfer history detection", () => {
      it("should detect self-funding via transfer history", async () => {
        const suspiciousTransfer: Transfer = {
          type: "deposit",
          amount: 500,
          asset: "USDC",
          from: "0xExternal",
          to: "0x123", // Agent's wallet
          timestamp: new Date("2024-01-15"), // After competition start
          txHash: "0xabc",
        };

        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([suspiciousTransfer]);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Verify alert creation was called with correct data (strings)
        expect(
          perpsRepo.batchCreatePerpsSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              agentId: "agent-1",
              competitionId: "comp-1",
              expectedEquity: "10000", // String
              actualEquity: "10500", // String
              unexplainedAmount: "500", // String
              detectionMethod: "transfer_history",
              reviewed: false,
            }),
          ]),
        );

        expect(result.totalAlertsCreated).toBe(1);
      });

      it("should handle case-insensitive wallet address matching", async () => {
        const transfer: Transfer = {
          type: "deposit",
          amount: 500,
          asset: "USDC",
          from: "0xExternal",
          to: "0X123", // Different case
          timestamp: new Date("2024-01-15"),
          txHash: "0xabc",
        };

        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([transfer]);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }]; // Lowercase

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should detect the transfer despite case difference
        expect(result.totalAlertsCreated).toBe(1);
      });

      it("should ignore transfers before competition start", async () => {
        const oldTransfer: Transfer = {
          type: "deposit",
          amount: 500,
          asset: "USDC",
          from: "0xExternal",
          to: "0x123",
          timestamp: new Date("2023-12-15"), // Before competition
          txHash: "0xabc",
        };

        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([oldTransfer]);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should not create alert for old transfer
        expect(result.totalAlertsCreated).toBe(0);
        expect(result.successful).toHaveLength(1);
      });

      it("should ignore withdrawals", async () => {
        const withdrawal: Transfer = {
          type: "withdraw", // Not a deposit
          amount: 500,
          asset: "USDC",
          from: "0x123",
          to: "0xExternal",
          timestamp: new Date("2024-01-15"),
          txHash: "0xabc",
        };

        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([withdrawal]);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        expect(result.totalAlertsCreated).toBe(0);
        expect(result.successful).toHaveLength(1);
      });

      it("should sum multiple suspicious deposits", async () => {
        const transfers: Transfer[] = [
          {
            type: "deposit",
            amount: 200,
            asset: "USDC",
            from: "0xExternal1",
            to: "0x123",
            timestamp: new Date("2024-01-15"),
            txHash: "0xabc1",
          },
          {
            type: "deposit",
            amount: 300,
            asset: "USDC",
            from: "0xExternal2",
            to: "0x123",
            timestamp: new Date("2024-01-16"),
            txHash: "0xabc2",
          },
        ];

        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue(transfers);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should create alert with total amount
        expect(result.totalAlertsCreated).toBe(1);
        expect(
          perpsRepo.batchCreatePerpsSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              unexplainedAmount: "500", // 200 + 300
              detectionMethod: "transfer_history",
            }),
          ]),
        );
      });

      it("should not call transfer history if provider doesn't support it", async () => {
        const serviceNoTransfers = new PerpsMonitoringService(
          mockProviderNoTransfers,
        );

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await serviceNoTransfers.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should only check reconciliation, not transfers
        expect(mockProviderNoTransfers.getAccountSummary).toHaveBeenCalled();
        // No getTransferHistory to call
        expect(result.successful).toHaveLength(1);
        expect(result.totalAlertsCreated).toBe(0);
      });

      it("should ignore transfers exactly at threshold", async () => {
        // Transfer exactly at threshold (competition config is 100)
        const exactThresholdTransfer: Transfer = {
          type: "deposit",
          amount: 100, // Exactly at threshold
          asset: "USDC",
          from: "0xExternal",
          to: "0x123",
          timestamp: new Date("2024-01-15"),
          txHash: "0xabc",
        };

        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([exactThresholdTransfer]);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should not create alert (threshold is >, not >=)
        expect(result.totalAlertsCreated).toBe(0);
      });

      it("should ignore transfers to different addresses", async () => {
        const transferToOtherAddress: Transfer = {
          type: "deposit",
          amount: 500,
          asset: "USDC",
          from: "0xExternal",
          to: "0x999", // Different address
          timestamp: new Date("2024-01-15"),
          txHash: "0xabc",
        };

        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([transferToOtherAddress]);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should not detect transfer to different address
        expect(result.totalAlertsCreated).toBe(0);
      });

      it("should allow transfers exactly at competition start", async () => {
        const transferAtStart: Transfer = {
          type: "deposit",
          amount: 500,
          asset: "USDC",
          from: "0xExternal",
          to: "0x123",
          timestamp: new Date("2024-01-01"), // Exactly at competition start
          txHash: "0xabc",
        };

        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([transferAtStart]);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should not detect transfer at exact start time (uses > not >=)
        expect(result.totalAlertsCreated).toBe(0);
      });

      it("should detect ANY deposit when using default threshold of 0", async () => {
        // Create service with no config (uses defaults where threshold = 0)
        const serviceWithDefaults = new PerpsMonitoringService(
          mockProviderWithTransfers,
        );

        // Even a tiny deposit should be flagged
        const tinyDeposit: Transfer = {
          type: "deposit",
          amount: 0.01, // Just 1 cent
          asset: "USDC",
          from: "0xExternal",
          to: "0x123",
          timestamp: new Date("2024-01-15"),
          txHash: "0xabc",
        };

        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([tinyDeposit]);

        // Mock config with null threshold to use default
        vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValueOnce({
          ...mockCompetitionConfig,
          selfFundingThresholdUsd: null, // Will use default of 0
        });

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await serviceWithDefaults.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          0, // Using default threshold for competitions
        );

        // Should detect even $0.01 since default threshold is 0
        expect(result.totalAlertsCreated).toBe(1);
        expect(
          perpsRepo.batchCreatePerpsSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              detectionMethod: "transfer_history",
              unexplainedAmount: "0.01",
            }),
          ]),
        );
      });

      it("should detect structuring - multiple small deposits that sum above threshold", async () => {
        // Competition has threshold of 100
        const smallDeposits: Transfer[] = [
          {
            type: "deposit",
            amount: 30, // Under threshold
            asset: "USDC",
            from: "0xExternal1",
            to: "0x123",
            timestamp: new Date("2024-01-15"),
            txHash: "0xabc1",
          },
          {
            type: "deposit",
            amount: 40, // Under threshold
            asset: "USDC",
            from: "0xExternal2",
            to: "0x123",
            timestamp: new Date("2024-01-16"),
            txHash: "0xabc2",
          },
          {
            type: "deposit",
            amount: 50, // Under threshold
            asset: "USDC",
            from: "0xExternal3",
            to: "0x123",
            timestamp: new Date("2024-01-17"),
            txHash: "0xabc3",
          },
          // Total: 30 + 40 + 50 = 120, which exceeds threshold of 100
        ];

        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue(smallDeposits);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should detect structuring attempt
        expect(result.totalAlertsCreated).toBe(1);
        expect(
          perpsRepo.batchCreatePerpsSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              detectionMethod: "transfer_history",
              unexplainedAmount: "120",
              accountSnapshot: expect.objectContaining({
                confidence: "medium", // Medium confidence for < 5 deposits
                note: expect.stringContaining("Potential structuring"),
              }),
            }),
          ]),
        );
      });

      it("should have high confidence for many small deposits (likely structuring)", async () => {
        // Many small deposits that individually are under threshold
        const manySmallDeposits: Transfer[] = Array.from(
          { length: 10 },
          (_, i) => ({
            type: "deposit" as const,
            amount: 15, // Each under threshold of 100
            asset: "USDC",
            from: `0xExternal${i}`,
            to: "0x123",
            timestamp: new Date(`2024-01-${10 + i}`),
            txHash: `0xabc${i}`,
          }),
        );
        // Total: 10 * 15 = 150, exceeds threshold

        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue(manySmallDeposits);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should detect with HIGH confidence due to many deposits
        expect(result.totalAlertsCreated).toBe(1);
        expect(
          perpsRepo.batchCreatePerpsSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              detectionMethod: "transfer_history",
              unexplainedAmount: "150",
              accountSnapshot: expect.objectContaining({
                confidence: "high", // High confidence for > 5 deposits
                note: expect.stringContaining(
                  "Potential structuring: 10 deposits",
                ),
              }),
            }),
          ]),
        );
      });

      it("should still detect large individual deposits with high confidence", async () => {
        // Mix of large and small deposits
        const mixedDeposits: Transfer[] = [
          {
            type: "deposit",
            amount: 200, // Above threshold
            asset: "USDC",
            from: "0xExternal1",
            to: "0x123",
            timestamp: new Date("2024-01-15"),
            txHash: "0xabc1",
          },
          {
            type: "deposit",
            amount: 50, // Below threshold
            asset: "USDC",
            from: "0xExternal2",
            to: "0x123",
            timestamp: new Date("2024-01-16"),
            txHash: "0xabc2",
          },
        ];

        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue(mixedDeposits);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should detect with HIGH confidence due to large deposit
        expect(result.totalAlertsCreated).toBe(1);
        expect(
          perpsRepo.batchCreatePerpsSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              detectionMethod: "transfer_history",
              unexplainedAmount: "250", // Total of all deposits
              accountSnapshot: expect.objectContaining({
                confidence: "high", // High confidence for large deposits
                note: expect.stringContaining("1 large deposit(s) exceeding"),
              }),
            }),
          ]),
        );
      });
    });

    describe("balance reconciliation detection", () => {
      it("should detect unexplained balance increase", async () => {
        const inflatedSummary: PerpsAccountSummary = {
          ...sampleAccountSummary,
          totalEquity: 11000, // 1000 more than expected
          totalPnl: 500, // Only 500 PnL
          initialCapital: 10000,
        };

        vi.mocked(
          mockProviderWithTransfers.getAccountSummary,
        ).mockResolvedValue(inflatedSummary);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Expected: 10000 + 500 = 10500
        // Actual: 11000
        // Unexplained: 500
        expect(result.totalAlertsCreated).toBe(1);
        expect(
          perpsRepo.batchCreatePerpsSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              expectedEquity: "10500", // String
              actualEquity: "11000", // String
              unexplainedAmount: "500", // String
              detectionMethod: "balance_reconciliation",
            }),
          ]),
        );
      });

      it("should handle negative unexplained amounts (absolute value)", async () => {
        const deflatedSummary: PerpsAccountSummary = {
          ...sampleAccountSummary,
          totalEquity: 9800, // 200 less than expected
          totalPnl: 0,
          initialCapital: 10000,
        };

        vi.mocked(
          mockProviderWithTransfers.getAccountSummary,
        ).mockResolvedValue(deflatedSummary);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Unexplained: -200, but Math.abs used for threshold
        // Default reconciliation threshold is 100, so this triggers
        expect(result.totalAlertsCreated).toBe(1);
        expect(
          perpsRepo.batchCreatePerpsSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              expectedEquity: "10000",
              actualEquity: "9800",
              unexplainedAmount: "-200", // Negative preserved
              detectionMethod: "balance_reconciliation",
            }),
          ]),
        );
      });

      it("should not create alert if within threshold", async () => {
        const slightDiscrepancy: PerpsAccountSummary = {
          ...sampleAccountSummary,
          totalEquity: 10550, // Only 50 more than expected
          totalPnl: 500,
          initialCapital: 10000,
        };

        vi.mocked(
          mockProviderWithTransfers.getAccountSummary,
        ).mockResolvedValue(slightDiscrepancy);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // 50 is below default reconciliation threshold of 100
        expect(result.totalAlertsCreated).toBe(0);
        expect(result.successful).toHaveLength(1);
        expect(result.failed).toHaveLength(0);
      });

      it("should handle missing optional fields with defaults", async () => {
        const minimalSummary: PerpsAccountSummary = {
          totalEquity: 11000,
          // totalPnl undefined
          // initialCapital undefined
          accountStatus: "active",
        };

        vi.mocked(
          mockProviderWithTransfers.getAccountSummary,
        ).mockResolvedValue(minimalSummary);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should use 0 for missing fields
        // Expected: 10000 + 0 = 10000
        // Actual: 11000
        // Unexplained: 1000
        expect(result.totalAlertsCreated).toBe(1);
        expect(
          perpsRepo.batchCreatePerpsSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              expectedEquity: "10000",
              actualEquity: "11000",
              unexplainedAmount: "1000",
            }),
          ]),
        );
      });

      it("should set different confidence levels based on amount", async () => {
        // Test high confidence (> 500 critical threshold)
        const highDiscrepancy: PerpsAccountSummary = {
          ...sampleAccountSummary,
          totalEquity: 11000, // 1000 unexplained (> 500)
          totalPnl: 0,
        };

        vi.mocked(
          mockProviderWithTransfers.getAccountSummary,
        ).mockResolvedValue(highDiscrepancy);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        expect(
          perpsRepo.batchCreatePerpsSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              accountSnapshot: expect.objectContaining({
                confidence: "high", // High confidence for large amount
                severity: "critical",
              }),
            }),
          ]),
        );

        // Reset mock
        vi.mocked(perpsRepo.batchCreatePerpsSelfFundingAlerts).mockClear();

        // Test medium confidence (< 500)
        const mediumDiscrepancy: PerpsAccountSummary = {
          ...sampleAccountSummary,
          totalEquity: 10200, // 200 unexplained (< 500)
          totalPnl: 0,
        };

        vi.mocked(
          mockProviderWithTransfers.getAccountSummary,
        ).mockResolvedValue(mediumDiscrepancy);

        await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        expect(
          perpsRepo.batchCreatePerpsSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              accountSnapshot: expect.objectContaining({
                confidence: "medium", // Medium confidence for smaller amount
                severity: "warning",
              }),
            }),
          ]),
        );
      });

      it("should handle zero balances correctly", async () => {
        const zeroBalanceSummary: PerpsAccountSummary = {
          ...sampleAccountSummary,
          totalEquity: 0, // Legitimate zero
          totalPnl: -10000, // Lost all money
          initialCapital: 10000,
        };

        vi.mocked(
          mockProviderWithTransfers.getAccountSummary,
        ).mockResolvedValue(zeroBalanceSummary);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should detect if discrepancy exists
        // Expected: 10000 + (-10000) = 0
        // Actual: 0
        // No unexplained amount
        expect(result.totalAlertsCreated).toBe(0);
      });

      it("should handle negative balance correctly", async () => {
        const negativeSummary: PerpsAccountSummary = {
          ...sampleAccountSummary,
          totalEquity: -500, // Negative equity (debt)
          totalPnl: -10500,
          initialCapital: 10000,
        };

        vi.mocked(
          mockProviderWithTransfers.getAccountSummary,
        ).mockResolvedValue(negativeSummary);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Expected: 10000 + (-10500) = -500
        // Actual: -500
        // No unexplained amount
        expect(result.totalAlertsCreated).toBe(0);
      });

      it("should detect self-funding even with negative PnL", async () => {
        const suspiciousSummary: PerpsAccountSummary = {
          ...sampleAccountSummary,
          totalEquity: 8000, // Should be 5000
          totalPnl: -5000, // Lost money
          initialCapital: 10000,
        };

        vi.mocked(
          mockProviderWithTransfers.getAccountSummary,
        ).mockResolvedValue(suspiciousSummary);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Expected: 10000 + (-5000) = 5000
        // Actual: 8000
        // Unexplained: 3000
        expect(result.totalAlertsCreated).toBe(1);
        expect(
          perpsRepo.batchCreatePerpsSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              expectedEquity: "5000",
              actualEquity: "8000",
              unexplainedAmount: "3000",
            }),
          ]),
        );
      });
    });

    describe("multiple detection methods", () => {
      it("should create alerts from both detection methods", async () => {
        // Set up transfer detection
        const transfer: Transfer = {
          type: "deposit",
          amount: 300,
          asset: "USDC",
          from: "0xExternal",
          to: "0x123",
          timestamp: new Date("2024-01-15"),
          txHash: "0xabc",
        };
        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([transfer]);

        // Set up reconciliation detection
        const discrepancySummary: PerpsAccountSummary = {
          ...sampleAccountSummary,
          totalEquity: 11000, // Unexplained increase
          totalPnl: 500,
        };
        vi.mocked(
          mockProviderWithTransfers.getAccountSummary,
        ).mockResolvedValue(discrepancySummary);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should create 2 alerts
        expect(result.totalAlertsCreated).toBe(2);
        expect(
          perpsRepo.batchCreatePerpsSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              detectionMethod: "transfer_history",
              unexplainedAmount: "300", // From transfer
            }),
            expect.objectContaining({
              detectionMethod: "balance_reconciliation",
              unexplainedAmount: "500", // From reconciliation
            }),
          ]),
        );
      });
    });

    describe("batch processing and error handling", () => {
      it("should handle mixed success and failure results", async () => {
        const agents = [
          { agentId: "agent-1", walletAddress: "0x111" },
          { agentId: "agent-2", walletAddress: "0x222" },
          { agentId: "agent-3", walletAddress: "0x333" },
        ];

        // Agent 1: Success
        vi.mocked(mockProviderWithTransfers.getAccountSummary)
          .mockResolvedValueOnce(sampleAccountSummary)
          // Agent 2: Failure
          .mockRejectedValueOnce(new Error("Provider timeout"))
          // Agent 3: Success
          .mockResolvedValueOnce(sampleAccountSummary);

        vi.mocked(perpsRepo.batchGetAgentsSelfFundingAlerts).mockImplementation(
          async () => {
            // All agents have no existing alerts
            return new Map();
          },
        );

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        expect(result.successful).toHaveLength(2);
        expect(result.failed).toHaveLength(1);
        expect(result.failed[0]).toEqual({
          agentId: "agent-2",
          walletAddress: "0x222",
          alerts: [],
          error: "Provider timeout",
        });
      });

      it("should continue if alert creation fails", async () => {
        vi.mocked(
          perpsRepo.batchCreatePerpsSelfFundingAlerts,
        ).mockRejectedValue(new Error("Database error"));

        // Set up to trigger an alert
        const discrepancySummary: PerpsAccountSummary = {
          ...sampleAccountSummary,
          totalEquity: 11000,
          totalPnl: 0,
        };
        vi.mocked(
          mockProviderWithTransfers.getAccountSummary,
        ).mockResolvedValue(discrepancySummary);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should still report success for agent monitoring
        expect(result.successful).toHaveLength(1);
        expect(result.totalAlertsCreated).toBe(0); // Failed to create
      });

      it("should batch fetch existing alerts efficiently", async () => {
        const agents = [
          { agentId: "agent-1", walletAddress: "0x111" },
          { agentId: "agent-2", walletAddress: "0x222" },
          { agentId: "agent-3", walletAddress: "0x333" },
        ];

        await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should batch fetch alerts for all agents in one call
        expect(perpsRepo.batchGetAgentsSelfFundingAlerts).toHaveBeenCalledTimes(
          1,
        );
        expect(perpsRepo.batchGetAgentsSelfFundingAlerts).toHaveBeenCalledWith(
          ["agent-1", "agent-2", "agent-3"],
          "comp-1",
        );
      });

      it("should handle alert fetch failures gracefully", async () => {
        vi.mocked(
          perpsRepo.batchGetAgentsSelfFundingAlerts,
        ).mockRejectedValueOnce(new Error("DB error")); // Fail on first call

        const agents = [
          { agentId: "agent-1", walletAddress: "0x111" },
          { agentId: "agent-2", walletAddress: "0x222" },
          { agentId: "agent-3", walletAddress: "0x333" },
        ];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should still process all agents (failed fetch = empty alerts)
        expect(
          mockProviderWithTransfers.getAccountSummary,
        ).toHaveBeenCalledTimes(3);
        expect(result.successful).toHaveLength(3);
      });

      it("should handle mixed existing alerts scenario", async () => {
        // Agent 1: Has unreviewed alert (skip)
        const unreviewedAlert: SelectPerpsSelfFundingAlert = {
          id: "alert-1",
          agentId: "agent-1",
          competitionId: "comp-1",
          expectedEquity: "10000",
          actualEquity: "11000",
          unexplainedAmount: "1000",
          accountSnapshot: {},
          detectionMethod: "transfer_history",
          detectedAt: new Date(),
          reviewed: false,
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: null,
          actionTaken: null,
        };

        // Agent 3: Has reviewed alert (process)
        const reviewedAlert: SelectPerpsSelfFundingAlert = {
          ...unreviewedAlert,
          id: "alert-3",
          agentId: "agent-3",
          reviewed: true,
          reviewedAt: new Date(),
          reviewedBy: "admin-1",
        };

        // Mock batch alerts to return different results for the agents
        const alertsMap = new Map<string, SelectPerpsSelfFundingAlert[]>();
        alertsMap.set("agent-1", [unreviewedAlert]); // agent-1: unreviewed
        alertsMap.set("agent-2", []); // agent-2: no alerts
        alertsMap.set("agent-3", [reviewedAlert]); // agent-3: reviewed
        vi.mocked(perpsRepo.batchGetAgentsSelfFundingAlerts).mockResolvedValue(
          alertsMap,
        );

        const agents = [
          { agentId: "agent-1", walletAddress: "0x111" },
          { agentId: "agent-2", walletAddress: "0x222" },
          { agentId: "agent-3", walletAddress: "0x333" },
        ];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should only process agents 2 and 3 (agent 1 skipped)
        expect(
          mockProviderWithTransfers.getAccountSummary,
        ).toHaveBeenCalledTimes(2);
        expect(
          mockProviderWithTransfers.getAccountSummary,
        ).toHaveBeenCalledWith("0x222");
        expect(
          mockProviderWithTransfers.getAccountSummary,
        ).toHaveBeenCalledWith("0x333");
        expect(
          mockProviderWithTransfers.getAccountSummary,
        ).not.toHaveBeenCalledWith("0x111");
        expect(result.successful).toHaveLength(3);
      });

      it("should handle account summary fetch failure for individual agent", async () => {
        const agents = [
          { agentId: "agent-1", walletAddress: "0x111" },
          { agentId: "agent-2", walletAddress: "0x222" },
        ];

        vi.mocked(mockProviderWithTransfers.getAccountSummary)
          .mockResolvedValueOnce(sampleAccountSummary) // agent-1: success
          .mockRejectedValueOnce(new Error("Provider error")); // agent-2: failure

        vi.mocked(perpsRepo.batchGetAgentsSelfFundingAlerts).mockResolvedValue(
          new Map(),
        );

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        expect(result.successful).toHaveLength(1);
        expect(result.failed).toHaveLength(1);
        expect(result.failed[0]?.agentId).toBe("agent-2");
        expect(result.failed[0]?.error).toBe("Provider error");
      });
    });

    describe("edge cases", () => {
      it("should handle exact threshold boundaries", async () => {
        const exactThresholdSummary: PerpsAccountSummary = {
          ...sampleAccountSummary,
          totalEquity: 10600, // Exactly 100 unexplained (equals threshold)
          totalPnl: 500,
        };

        vi.mocked(
          mockProviderWithTransfers.getAccountSummary,
        ).mockResolvedValue(exactThresholdSummary);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should not create alert (threshold is >, not >=)
        expect(result.totalAlertsCreated).toBe(0);
      });

      it("should handle very large numbers", async () => {
        const largeSummary: PerpsAccountSummary = {
          ...sampleAccountSummary,
          totalEquity: 1e15, // Very large number
          totalPnl: 1e14,
        };

        vi.mocked(
          mockProviderWithTransfers.getAccountSummary,
        ).mockResolvedValue(largeSummary);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should handle large numbers correctly
        expect(result.totalAlertsCreated).toBe(1);
        expect(
          perpsRepo.batchCreatePerpsSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              actualEquity: "1000000000000000", // Converted to string
            }),
          ]),
        );
      });

      it("should handle transfer history fetch error gracefully", async () => {
        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockRejectedValue(new Error("API error"));

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should continue with reconciliation check
        expect(mockProviderWithTransfers.getAccountSummary).toHaveBeenCalled();
        expect(result.successful).toHaveLength(1);
      });
    });
  });

  describe("shouldMonitorCompetition", () => {
    it("should return false if no config found", async () => {
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(null);

      const result = await service.shouldMonitorCompetition("comp-1");
      expect(result).toBe(false);
    });

    it("should return true if threshold is zero (monitor for ANY deposits)", async () => {
      const zeroThresholdConfig: SelectPerpsCompetitionConfig = {
        ...mockCompetitionConfig,
        selfFundingThresholdUsd: "0",
      };
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        zeroThresholdConfig,
      );

      const result = await service.shouldMonitorCompetition("comp-1");
      expect(result).toBe(true); // Zero threshold means monitor for ANY deposits
    });

    it("should return false if threshold is missing", async () => {
      const noThresholdConfig: SelectPerpsCompetitionConfig = {
        ...mockCompetitionConfig,
        selfFundingThresholdUsd: null,
      };
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockResolvedValue(
        noThresholdConfig,
      );

      const result = await service.shouldMonitorCompetition("comp-1");
      expect(result).toBe(false);
    });

    it("should return true if threshold is positive", async () => {
      const result = await service.shouldMonitorCompetition("comp-1");
      expect(result).toBe(true);
    });

    it("should handle config fetch error", async () => {
      vi.mocked(perpsRepo.getPerpsCompetitionConfig).mockRejectedValue(
        new Error("Database error"),
      );

      const result = await service.shouldMonitorCompetition("comp-1");
      expect(result).toBe(false);
    });
  });
});
