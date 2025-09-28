import type { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock, mockReset } from "vitest-mock-extended";

import { PerpsRepository } from "@recallnet/db/repositories/perps";
import type {
  SelectPerpsCompetitionConfig,
  SelectPerpsSelfFundingAlert,
} from "@recallnet/db/schema/trading/types";

import { PerpsMonitoringService } from "../perps-monitoring.service.js";
import type {
  IPerpsDataProvider,
  PerpsAccountSummary,
  Transfer,
} from "../types/perps.js";

describe("PerpsMonitoringService", () => {
  let service: PerpsMonitoringService;
  let mockProviderWithTransfers: MockProxy<IPerpsDataProvider>;
  let mockProviderNoTransfers: MockProxy<IPerpsDataProvider>;
  let mockPerpsRepo: MockProxy<PerpsRepository>;
  let mockLogger: MockProxy<Logger>;

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

    // Create service mocks
    mockPerpsRepo = mock<PerpsRepository>();
    mockLogger = mock<Logger>();

    // Provider WITH transfer history support
    mockProviderWithTransfers = mock<IPerpsDataProvider>();
    mockProviderWithTransfers.getName.mockReturnValue(
      "TestProviderWithTransfers",
    );
    mockProviderWithTransfers.getAccountSummary.mockResolvedValue(
      sampleAccountSummary,
    );
    mockProviderWithTransfers.getPositions.mockResolvedValue([]);
    mockProviderWithTransfers.getTransferHistory = vi
      .fn()
      .mockResolvedValue([]); // Method EXISTS

    // Provider WITHOUT transfer history support
    mockProviderNoTransfers = mock<IPerpsDataProvider>();
    mockProviderNoTransfers.getName.mockReturnValue("TestProviderNoTransfers");
    mockProviderNoTransfers.getAccountSummary.mockResolvedValue(
      sampleAccountSummary,
    );
    mockProviderNoTransfers.getPositions.mockResolvedValue([]);
    // NO getTransferHistory method

    // Default repository mocks
    mockPerpsRepo.getPerpsCompetitionConfig.mockResolvedValue(
      mockCompetitionConfig,
    );
    // Mock the new batch method to return an empty Map by default
    mockPerpsRepo.batchGetAgentsSelfFundingAlerts.mockResolvedValue(new Map());
    mockPerpsRepo.batchCreatePerpsSelfFundingAlerts.mockResolvedValue([]);
    // Mock the new batchSaveTransferHistory method
    mockPerpsRepo.batchSaveTransferHistory.mockResolvedValue([]);

    service = new PerpsMonitoringService(
      mockProviderWithTransfers,
      mockPerpsRepo,
      mockLogger,
    );
  });

  afterEach(() => {
    // Reset all mocks
    mockReset(mockProviderWithTransfers);
    mockReset(mockProviderNoTransfers);
    mockReset(mockPerpsRepo);
    mockReset(mockLogger);
  });

  describe("constructor", () => {
    it("should initialize with default thresholds", () => {
      const testService = new PerpsMonitoringService(
        mockProviderWithTransfers,
        mockPerpsRepo,
        mockLogger,
      );
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
        mockPerpsRepo,
        mockLogger,
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
          mockPerpsRepo.batchGetAgentsSelfFundingAlerts,
        ).not.toHaveBeenCalled();
        expect(
          mockPerpsRepo.batchCreatePerpsSelfFundingAlerts,
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

      it("should detect ALL transfers as violations regardless of threshold", async () => {
        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        // Small transfer below threshold - still a violation
        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([
          { ...sampleTransfer, amount: 50 }, // Below threshold but still prohibited
        ]);

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold, // 100 - threshold doesn't matter for violations
        );

        expect(result.successful).toHaveLength(1);
        expect(result.successful[0]?.alerts).toHaveLength(1); // Should detect violation
        expect(result.totalAlertsCreated).toBe(1);

        const alert = result.successful[0]?.alerts[0];
        expect(alert?.note).toContain(
          "Mid-competition transfers are PROHIBITED",
        );
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
          expect(alert.unexplainedAmount).toBe(0.01);
          expect(alert.detectionMethod).toBe("transfer_history");
        }
      });

      it("should ignore transfers before competition start", async () => {
        const oldTransfer: Transfer = {
          type: "deposit",
          amount: 500,
          asset: "USDC",
          from: "0xExternal",
          to: "0x123",
          timestamp: new Date("2023-12-31"), // Before competition start
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

      it("should detect withdrawals as violations", async () => {
        const withdrawal: Transfer = {
          type: "withdraw", // Withdrawals are also violations
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

        expect(result.totalAlertsCreated).toBe(1); // Withdrawals are now violations
        expect(result.successful).toHaveLength(1);
        const alert = result.successful[0]?.alerts[0];
        expect(alert?.note).toContain("withdrawal");
        expect(alert?.note).toContain("PROHIBITED");
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
          mockPerpsRepo.batchCreatePerpsSelfFundingAlerts,
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
          mockPerpsRepo,
          mockLogger,
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

      it("should detect transfers at any amount including threshold", async () => {
        // Transfer at any amount is a violation
        const exactThresholdTransfer: Transfer = {
          type: "deposit",
          amount: 100, // Any amount is prohibited
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

        // Should create alert for any amount
        expect(result.totalAlertsCreated).toBe(1);
        expect(result.successful[0]?.alerts[0]?.note).toContain(
          "Mid-competition transfers are PROHIBITED",
        );
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
          mockPerpsRepo,
          mockLogger,
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
        mockPerpsRepo.getPerpsCompetitionConfig.mockResolvedValueOnce({
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
          0, // Zero threshold - any deposit
        );

        expect(result.totalAlertsCreated).toBe(1);
        expect(result.successful[0]?.alerts[0]?.unexplainedAmount).toBe(0.01);
      });
    });

    describe("balance reconciliation", () => {
      it("should detect equity increases beyond threshold", async () => {
        const highEquitySummary: PerpsAccountSummary = {
          ...sampleAccountSummary,
          totalEquity: 11000, // 11,000 equity
          totalPnl: 500, // 500 PnL from trading
          // expectedEquity = 10000 + 500 = 10,500
          // unexplainedAmount = 11000 - 10500 = 500 (above 100 threshold)
        };

        // Create summaries map
        const summariesMap = new Map([["agent-1", highEquitySummary]]);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          summariesMap,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        expect(result.totalAlertsCreated).toBe(1);
        expect(result.successful[0]?.alerts[0]?.detectionMethod).toBe(
          "balance_reconciliation",
        );
        expect(result.successful[0]?.alerts[0]?.unexplainedAmount).toBe(500); // Fixed calculation
      });

      it("should not flag normal trading gains", async () => {
        const normalGainsSummary: PerpsAccountSummary = {
          ...sampleAccountSummary,
          totalEquity: 10050, // 50 above initial
          totalPnl: 50, // Total PnL matches the gain
        };

        const summariesMap = new Map([["agent-1", normalGainsSummary]]);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          summariesMap,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should not create alert for normal gains (unexplained = 0)
        expect(result.totalAlertsCreated).toBe(0);
      });

      it("should handle agents with losses correctly", async () => {
        const lossSummary: PerpsAccountSummary = {
          ...sampleAccountSummary,
          totalEquity: 8000, // 2000 loss from initial capital
          totalPnl: -2000,
        };

        const summariesMap = new Map([["agent-1", lossSummary]]);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          summariesMap,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should not flag losses as self-funding
        expect(result.totalAlertsCreated).toBe(0);
      });
    });

    describe("error handling", () => {
      it("should handle provider errors gracefully", async () => {
        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockRejectedValue(new Error("Provider API error"));

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Service catches errors internally, so agent appears in successful with no alerts
        expect(result.successful).toHaveLength(1);
        expect(result.failed).toHaveLength(0);
        expect(result.successful[0]?.alerts).toHaveLength(0);
      });

      it("should handle repository errors gracefully", async () => {
        mockPerpsRepo.batchGetAgentsSelfFundingAlerts.mockRejectedValue(
          new Error("Database connection failed"),
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

        // Service catches DB errors internally, so agent appears in successful with no alerts
        expect(result.successful).toHaveLength(1);
        expect(result.failed).toHaveLength(0);
        expect(result.successful[0]?.alerts).toHaveLength(0);
      });

      it("should handle partial failures in batch processing", async () => {
        const agents = [
          { agentId: "agent-1", walletAddress: "0x123" },
          { agentId: "agent-2", walletAddress: "0x456" },
        ];

        // Mock provider to fail for specific agent
        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockImplementation((walletAddress) => {
          if (walletAddress === "0x456") {
            throw new Error("Agent 2 provider error");
          }
          return Promise.resolve([]);
        });

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Both agents appear in successful since errors are caught internally
        expect(result.successful).toHaveLength(2);
        expect(result.failed).toHaveLength(0);
      });
    });

    describe("duplicate alert prevention", () => {
      it("should not create duplicate alerts for existing violations", async () => {
        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        // Mock existing alert
        const existingAlert: SelectPerpsSelfFundingAlert = {
          id: "alert-1",
          agentId: "agent-1",
          competitionId: "comp-1",
          detectionMethod: "transfer_history",
          unexplainedAmount: "150",
          note: "Existing alert",
          evidence: [sampleTransfer],
          accountSnapshot: sampleAccountSummary,
          createdAt: new Date(),
          expectedEquity: "10000",
          actualEquity: "11150",
          detectedAt: new Date(),
          reviewedAt: null,
          reviewedBy: null,
          reviewed: false,
          reviewNote: null,
          actionTaken: null,
        } as SelectPerpsSelfFundingAlert;

        mockPerpsRepo.batchGetAgentsSelfFundingAlerts.mockResolvedValue(
          new Map([["agent-1", [existingAlert]]]),
        );

        // Same transfer as existing alert
        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([{ ...sampleTransfer, amount: 150 }]);

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should not create new alert for existing violation
        expect(result.totalAlertsCreated).toBe(0);
      });

      it("should create new alert when no existing alerts", async () => {
        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        // No existing alerts
        mockPerpsRepo.batchGetAgentsSelfFundingAlerts.mockResolvedValue(
          new Map(),
        );

        // New transfer should trigger alert
        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([{ ...sampleTransfer, amount: 200 }]);

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should create new alert
        expect(result.totalAlertsCreated).toBe(1);
        expect(
          mockPerpsRepo.batchCreatePerpsSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              unexplainedAmount: "200",
              detectionMethod: "transfer_history",
            }),
          ]),
        );
      });
    });

    describe("confidence and severity scoring", () => {
      it("should assign high confidence to transfer history detection", async () => {
        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([{ ...sampleTransfer, amount: 150 }]);

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        expect(result.successful[0]?.alerts[0]?.confidence).toBe("high");
        expect(result.successful[0]?.alerts[0]?.detectionMethod).toBe(
          "transfer_history",
        );
      });

      it("should assign medium confidence to balance reconciliation", async () => {
        const highEquitySummary: PerpsAccountSummary = {
          ...sampleAccountSummary,
          totalEquity: 11000, // 1000 above initial
        };

        const summariesMap = new Map([["agent-1", highEquitySummary]]);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgentsWithData(
          agents,
          summariesMap,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        expect(result.successful[0]?.alerts[0]?.confidence).toBe("medium");
        expect(result.successful[0]?.alerts[0]?.detectionMethod).toBe(
          "balance_reconciliation",
        );
      });

      it("should assign critical severity for large amounts", async () => {
        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        // Large transfer above critical threshold (default: 500)
        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([{ ...sampleTransfer, amount: 1000 }]);

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        expect(result.successful[0]?.alerts[0]?.severity).toBe("critical");
      });

      it("should assign warning severity for smaller amounts", async () => {
        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        // Small transfer below critical threshold
        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([{ ...sampleTransfer, amount: 200 }]);

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        expect(result.successful[0]?.alerts[0]?.severity).toBe("warning");
      });
    });

    describe("batch processing", () => {
      it("should handle multiple agents efficiently", async () => {
        const agents = [
          { agentId: "agent-1", walletAddress: "0x111" },
          { agentId: "agent-2", walletAddress: "0x222" },
          { agentId: "agent-3", walletAddress: "0x333" },
        ];

        // Mock transfers for agents 1 and 3
        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockImplementation((walletAddress) => {
          if (walletAddress === "0x111") {
            return Promise.resolve([
              { ...sampleTransfer, amount: 200, to: "0x111" },
            ]);
          }
          if (walletAddress === "0x333") {
            return Promise.resolve([
              { ...sampleTransfer, amount: 300, to: "0x333" },
            ]);
          }
          return Promise.resolve([]); // No transfers for agent-2
        });

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        expect(result.successful).toHaveLength(3);
        expect(result.totalAlertsCreated).toBe(2); // agents 1 and 3 have violations

        // Check that alerts were created correctly
        const agent1Alerts = result.successful.find(
          (a) => a.agentId === "agent-1",
        )?.alerts;
        const agent3Alerts = result.successful.find(
          (a) => a.agentId === "agent-3",
        )?.alerts;

        expect(agent1Alerts).toHaveLength(1);
        expect(agent3Alerts).toHaveLength(1);
        expect(agent1Alerts?.[0]?.unexplainedAmount).toBe(200);
        expect(agent3Alerts?.[0]?.unexplainedAmount).toBe(300);
      });

      it("should save transfer history for all agents", async () => {
        const agents = [
          { agentId: "agent-1", walletAddress: "0x111" },
          { agentId: "agent-2", walletAddress: "0x222" },
        ];

        const transfer1: Transfer = { ...sampleTransfer, amount: 200 };
        const transfer2: Transfer = {
          ...sampleTransfer,
          amount: 100,
          to: "0x222",
        };

        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockImplementation((walletAddress) => {
          if (walletAddress === "0x111") {
            return Promise.resolve([transfer1]);
          }
          if (walletAddress === "0x222") {
            return Promise.resolve([transfer2]);
          }
          return Promise.resolve([]);
        });

        await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should save all transfer history (called once per agent)
        expect(mockPerpsRepo.batchSaveTransferHistory).toHaveBeenCalledTimes(2);

        // Check the actual format matches what service sends
        expect(mockPerpsRepo.batchSaveTransferHistory).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              agentId: "agent-1",
              type: "deposit", // Note: 'type' not 'transferType'
              amount: "200",
              competitionId: "comp-1",
              asset: "USDC",
              fromAddress: "0xSender",
              toAddress: "0x123",
              chainId: 0,
              txHash: expect.any(String),
              transferTimestamp: expect.any(Date),
            }),
          ]),
        );
      });
    });

    describe("edge cases", () => {
      it("should handle case-insensitive address matching", async () => {
        const agents = [{ agentId: "agent-1", walletAddress: "0x123abc" }];

        // Transfer with different case
        const transferDifferentCase: Transfer = {
          ...sampleTransfer,
          to: "0x123ABC", // Different case
        };

        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([transferDifferentCase]);

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        // Should match despite case difference
        expect(result.totalAlertsCreated).toBe(1);
      });

      it("should handle very large transfer amounts", async () => {
        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const massiveTransfer: Transfer = {
          ...sampleTransfer,
          amount: 1e12, // Trillion dollars
        };

        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([massiveTransfer]);

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
        );

        expect(result.totalAlertsCreated).toBe(1);
        expect(result.successful[0]?.alerts[0]?.severity).toBe("critical");
        expect(result.successful[0]?.alerts[0]?.unexplainedAmount).toBe(1e12);
      });

      it("should handle zero-amount transfers", async () => {
        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const zeroTransfer: Transfer = {
          ...sampleTransfer,
          amount: 0,
        };

        vi.mocked(
          mockProviderWithTransfers.getTransferHistory!,
        ).mockResolvedValue([zeroTransfer]);

        const result = await service.monitorAgentsWithData(
          agents,
          undefined,
          "comp-1",
          competitionStartDate,
          initialCapital,
          0, // Zero threshold
        );

        // Should create alert for zero-amount transfer (ANY transfer is violation)
        expect(result.totalAlertsCreated).toBe(1);
      });
    });
  });
});
