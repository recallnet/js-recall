import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpotLiveRepository } from "@recallnet/db/repositories/spot-live";
import type {
  SelectSpotLiveCompetitionConfig,
  SelectSpotLiveSelfFundingAlert,
  SelectSpotLiveTransferHistory,
} from "@recallnet/db/schema/trading/types";

import { SpotLiveMonitoringService } from "../spot-live-monitoring.service.js";

// Mock classes
class MockSpotLiveRepository {
  batchGetAgentsSpotLiveSelfFundingAlerts = vi.fn();
  batchCreateSpotLiveSelfFundingAlerts = vi.fn();
  getAgentSpotLiveTransfers = vi.fn();
  getSpotLiveCompetitionConfig = vi.fn();
}

class MockLogger {
  info = vi.fn();
  debug = vi.fn();
  warn = vi.fn();
  error = vi.fn();
}

describe("SpotLiveMonitoringService", () => {
  let service: SpotLiveMonitoringService;
  let mockSpotLiveRepo: MockSpotLiveRepository;
  let mockLogger: MockLogger;

  const competitionStartDate = new Date("2024-01-01");
  const competitionEndDate = new Date("2024-01-07"); // 1 week competition

  // Sample transfer data from database
  const sampleTransfer: SelectSpotLiveTransferHistory = {
    id: "transfer-1",
    agentId: "agent-1",
    competitionId: "comp-1",
    type: "deposit",
    specificChain: "base",
    tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    tokenSymbol: "USDC",
    amount: "500",
    amountUsd: "500",
    fromAddress: "0xexternal",
    toAddress: "0x123",
    txHash: "0xabc123",
    blockNumber: 1000000,
    transferTimestamp: new Date("2024-01-15"),
    capturedAt: new Date(),
  };

  const sampleSpotLiveConfig: SelectSpotLiveCompetitionConfig = {
    competitionId: "comp-1",
    dataSource: "rpc_direct",
    dataSourceConfig: {
      type: "rpc_direct",
      provider: "alchemy",
      chains: ["base"],
    },
    selfFundingThresholdUsd: "100",
    minFundingThreshold: null,
    inactivityHours: 24,
    syncIntervalMinutes: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSpotLiveRepo = new MockSpotLiveRepository();
    mockLogger = new MockLogger();

    // Default repository mocks
    mockSpotLiveRepo.batchGetAgentsSpotLiveSelfFundingAlerts.mockResolvedValue(
      new Map(),
    );
    mockSpotLiveRepo.batchCreateSpotLiveSelfFundingAlerts.mockResolvedValue([]);
    mockSpotLiveRepo.getAgentSpotLiveTransfers.mockResolvedValue([]);
    mockSpotLiveRepo.getSpotLiveCompetitionConfig.mockResolvedValue(
      sampleSpotLiveConfig,
    );

    service = new SpotLiveMonitoringService(
      mockSpotLiveRepo as unknown as SpotLiveRepository,
      mockLogger as unknown as Logger,
    );
  });

  describe("constructor", () => {
    it("should initialize with default thresholds", () => {
      const testService = new SpotLiveMonitoringService(
        mockSpotLiveRepo as unknown as SpotLiveRepository,
        mockLogger as unknown as Logger,
      );
      expect(testService).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            criticalAmountThreshold: 500,
          }),
        }),
        expect.stringContaining("Initialized"),
      );
    });

    it("should accept custom thresholds", () => {
      const customConfig = {
        criticalAmountThreshold: 1000,
      };
      const testService = new SpotLiveMonitoringService(
        mockSpotLiveRepo as unknown as SpotLiveRepository,
        mockLogger as unknown as Logger,
        customConfig,
      );
      expect(testService).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining(customConfig),
        }),
        expect.stringContaining("Initialized"),
      );
    });
  });

  describe("monitorAgents", () => {
    describe("empty agents handling", () => {
      it("should return immediately for empty agents array", async () => {
        const result = await service.monitorAgents(
          [],
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        expect(result).toEqual({
          successful: [],
          failed: [],
          totalAlertsCreated: 0,
        });

        // Should not make any repository calls
        expect(
          mockSpotLiveRepo.batchGetAgentsSpotLiveSelfFundingAlerts,
        ).not.toHaveBeenCalled();
        expect(
          mockSpotLiveRepo.batchCreateSpotLiveSelfFundingAlerts,
        ).not.toHaveBeenCalled();
      });
    });

    describe("existing alerts handling", () => {
      it("should skip agents with unreviewed alerts (reviewed: false)", async () => {
        const unreviewedAlert: SelectSpotLiveSelfFundingAlert = {
          id: "alert-1",
          agentId: "agent-1",
          competitionId: "comp-1",
          detectionMethod: "transfer_history",
          violationType: "deposit",
          detectedValue: "1000",
          thresholdValue: "0",
          specificChain: "base",
          txHash: "0xabc",
          transferSnapshot: {},
          detectedAt: new Date(),
          reviewed: false,
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: null,
          actionTaken: null,
        };

        const alertsMap = new Map<string, SelectSpotLiveSelfFundingAlert[]>();
        alertsMap.set("agent-1", [unreviewedAlert]);
        mockSpotLiveRepo.batchGetAgentsSpotLiveSelfFundingAlerts.mockResolvedValue(
          alertsMap,
        );

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgents(
          agents,
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        // Should not fetch transfers since agent is skipped
        expect(
          mockSpotLiveRepo.getAgentSpotLiveTransfers,
        ).not.toHaveBeenCalled();
        expect(result.successful[0]?.alerts).toHaveLength(0);
      });

      it("should skip agents with unreviewed alerts (reviewed: null)", async () => {
        const unreviewedAlert: SelectSpotLiveSelfFundingAlert = {
          id: "alert-1",
          agentId: "agent-1",
          competitionId: "comp-1",
          detectionMethod: "transfer_history",
          violationType: "deposit",
          detectedValue: "11000",
          thresholdValue: "0",
          specificChain: null,
          txHash: null,
          transferSnapshot: {},
          detectedAt: new Date(),
          reviewed: null,
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: null,
          actionTaken: null,
        };

        const alertsMap = new Map<string, SelectSpotLiveSelfFundingAlert[]>();
        alertsMap.set("agent-1", [unreviewedAlert]);
        mockSpotLiveRepo.batchGetAgentsSpotLiveSelfFundingAlerts.mockResolvedValue(
          alertsMap,
        );

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgents(
          agents,
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        expect(
          mockSpotLiveRepo.getAgentSpotLiveTransfers,
        ).not.toHaveBeenCalled();
        expect(result.successful[0]?.alerts).toHaveLength(0);
      });

      it("should process agents with all reviewed alerts", async () => {
        const reviewedAlert: SelectSpotLiveSelfFundingAlert = {
          id: "alert-1",
          agentId: "agent-1",
          competitionId: "comp-1",
          detectionMethod: "transfer_history",
          violationType: "deposit",
          detectedValue: "1000",
          thresholdValue: "0",
          specificChain: "base",
          txHash: "0xabc",
          transferSnapshot: {},
          detectedAt: new Date(),
          reviewed: true,
          reviewedAt: new Date(),
          reviewedBy: "admin-1",
          reviewNote: "False positive",
          actionTaken: "dismissed",
        };

        const alertsMap = new Map<string, SelectSpotLiveSelfFundingAlert[]>();
        alertsMap.set("agent-1", [reviewedAlert]);
        mockSpotLiveRepo.batchGetAgentsSpotLiveSelfFundingAlerts.mockResolvedValue(
          alertsMap,
        );

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgents(
          agents,
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        // Should process the agent since all alerts are reviewed
        expect(mockSpotLiveRepo.getAgentSpotLiveTransfers).toHaveBeenCalledWith(
          "agent-1",
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );
        expect(result.successful).toHaveLength(1);
      });
    });

    describe("transfer detection", () => {
      it("should detect transfer violations from database", async () => {
        mockSpotLiveRepo.getAgentSpotLiveTransfers.mockResolvedValue([
          sampleTransfer,
        ]);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgents(
          agents,
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        expect(result.totalAlertsCreated).toBe(1);
        expect(
          mockSpotLiveRepo.batchCreateSpotLiveSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              agentId: "agent-1",
              competitionId: "comp-1",
              detectionMethod: "transfer_history",
              violationType: "deposit",
              detectedValue: "500",
              reviewed: false,
            }),
          ]),
        );
      });

      it("should detect ALL transfers as violations regardless of amount", async () => {
        const smallTransfer: SelectSpotLiveTransferHistory = {
          ...sampleTransfer,
          amount: "10",
          amountUsd: "10",
        };

        mockSpotLiveRepo.getAgentSpotLiveTransfers.mockResolvedValue([
          smallTransfer,
        ]);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgents(
          agents,
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        // Even $10 transfer should create alert
        expect(result.totalAlertsCreated).toBe(1);
        expect(result.successful[0]?.alerts[0]?.note).toContain(
          "Mid-competition transfers are PROHIBITED",
        );
      });

      it("should sum multiple transfers correctly", async () => {
        const transfers: SelectSpotLiveTransferHistory[] = [
          { ...sampleTransfer, id: "t1", amount: "200", amountUsd: "200" },
          { ...sampleTransfer, id: "t2", amount: "300", amountUsd: "300" },
        ];

        mockSpotLiveRepo.getAgentSpotLiveTransfers.mockResolvedValue(transfers);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgents(
          agents,
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        expect(result.totalAlertsCreated).toBe(1);
        expect(
          mockSpotLiveRepo.batchCreateSpotLiveSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              detectedValue: "500", // 200 + 300
              detectionMethod: "transfer_history",
            }),
          ]),
        );
      });

      it("should detect withdrawals as violations", async () => {
        const withdrawal: SelectSpotLiveTransferHistory = {
          ...sampleTransfer,
          type: "withdraw",
          fromAddress: "0x123",
          toAddress: "0xexternal",
        };

        mockSpotLiveRepo.getAgentSpotLiveTransfers.mockResolvedValue([
          withdrawal,
        ]);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgents(
          agents,
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        expect(result.totalAlertsCreated).toBe(1);
        expect(
          mockSpotLiveRepo.batchCreateSpotLiveSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              violationType: "withdrawal_exceeds_limit",
              detectionMethod: "transfer_history",
            }),
          ]),
        );
      });

      it("should separate deposits and withdrawals in alert note", async () => {
        const transfers: SelectSpotLiveTransferHistory[] = [
          {
            ...sampleTransfer,
            id: "t1",
            type: "deposit",
            amount: "200",
            amountUsd: "200",
          },
          {
            ...sampleTransfer,
            id: "t2",
            type: "withdraw",
            amount: "100",
            amountUsd: "100",
          },
        ];

        mockSpotLiveRepo.getAgentSpotLiveTransfers.mockResolvedValue(transfers);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgents(
          agents,
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        expect(result.totalAlertsCreated).toBe(1);
        const alert = result.successful[0]?.alerts[0];
        expect(alert?.note).toContain("1 deposit(s) totaling $200.00");
        expect(alert?.note).toContain("1 withdrawal(s) totaling $100.00");
      });

      it("should handle transfers with missing amountUsd gracefully", async () => {
        const transferNoUsd: SelectSpotLiveTransferHistory = {
          ...sampleTransfer,
          amountUsd: null,
        };

        mockSpotLiveRepo.getAgentSpotLiveTransfers.mockResolvedValue([
          transferNoUsd,
        ]);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgents(
          agents,
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        // Should still detect violation with 0 USD value
        expect(result.totalAlertsCreated).toBe(1);
        expect(
          mockSpotLiveRepo.batchCreateSpotLiveSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              detectedValue: "0", // Falls back to 0
            }),
          ]),
        );
      });

      it("should set severity based on critical threshold", async () => {
        // Test warning severity (below $500)
        const smallTransfer: SelectSpotLiveTransferHistory = {
          ...sampleTransfer,
          amount: "100",
          amountUsd: "100",
        };

        mockSpotLiveRepo.getAgentSpotLiveTransfers.mockResolvedValue([
          smallTransfer,
        ]);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        await service.monitorAgents(
          agents,
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        expect(
          mockSpotLiveRepo.batchCreateSpotLiveSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              transferSnapshot: expect.objectContaining({
                severity: "warning", // Below $500
              }),
            }),
          ]),
        );

        // Reset and test critical severity (above $500)
        vi.clearAllMocks();
        mockSpotLiveRepo.batchGetAgentsSpotLiveSelfFundingAlerts.mockResolvedValue(
          new Map(),
        );

        const largeTransfer: SelectSpotLiveTransferHistory = {
          ...sampleTransfer,
          amount: "1000",
          amountUsd: "1000",
        };

        mockSpotLiveRepo.getAgentSpotLiveTransfers.mockResolvedValue([
          largeTransfer,
        ]);

        await service.monitorAgents(
          agents,
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        expect(
          mockSpotLiveRepo.batchCreateSpotLiveSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              transferSnapshot: expect.objectContaining({
                severity: "critical", // Above $500
              }),
            }),
          ]),
        );
      });

      it("should include chain and txHash metadata from first transfer", async () => {
        mockSpotLiveRepo.getAgentSpotLiveTransfers.mockResolvedValue([
          sampleTransfer,
        ]);

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        await service.monitorAgents(
          agents,
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        expect(
          mockSpotLiveRepo.batchCreateSpotLiveSelfFundingAlerts,
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              specificChain: "base",
              txHash: "0xabc123",
            }),
          ]),
        );
      });

      it("should handle transfer fetch error gracefully", async () => {
        mockSpotLiveRepo.getAgentSpotLiveTransfers.mockRejectedValue(
          new Error("Database error"),
        );

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgents(
          agents,
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        // Error is logged but doesn't throw - agent is still processed
        expect(result.successful).toHaveLength(1);
        expect(result.totalAlertsCreated).toBe(0);
      });
    });

    describe("batch processing", () => {
      it("should process multiple agents independently", async () => {
        const agents = [
          { agentId: "agent-1", walletAddress: "0x111" },
          { agentId: "agent-2", walletAddress: "0x222" },
          { agentId: "agent-3", walletAddress: "0x333" },
        ];

        await service.monitorAgents(
          agents,
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        // Should batch fetch alerts for all agents
        expect(
          mockSpotLiveRepo.batchGetAgentsSpotLiveSelfFundingAlerts,
        ).toHaveBeenCalledTimes(1);
        expect(
          mockSpotLiveRepo.batchGetAgentsSpotLiveSelfFundingAlerts,
        ).toHaveBeenCalledWith(["agent-1", "agent-2", "agent-3"], "comp-1");

        // Should process each agent's transfers
        expect(
          mockSpotLiveRepo.getAgentSpotLiveTransfers,
        ).toHaveBeenCalledTimes(3);
      });

      it("should handle graceful degradation when transfer fetch fails", async () => {
        const agents = [
          { agentId: "agent-1", walletAddress: "0x111" },
          { agentId: "agent-2", walletAddress: "0x222" },
          { agentId: "agent-3", walletAddress: "0x333" },
        ];

        // Agent 2's transfer fetch fails, but monitoring continues
        mockSpotLiveRepo.getAgentSpotLiveTransfers
          .mockResolvedValueOnce([]) // agent-1: success
          .mockRejectedValueOnce(new Error("Database timeout")) // agent-2: transfer fails
          .mockResolvedValueOnce([]); // agent-3: success

        const result = await service.monitorAgents(
          agents,
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        // All agents succeed (graceful degradation - transfer error is logged but monitoring continues)
        expect(result.successful).toHaveLength(3);
        expect(result.failed).toHaveLength(0);

        // Transfer error was logged
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.any(Object),
          expect.stringContaining("Error checking transfer history"),
        );
      });

      it("should handle alert batch creation failure", async () => {
        mockSpotLiveRepo.getAgentSpotLiveTransfers.mockResolvedValue([
          sampleTransfer,
        ]);
        mockSpotLiveRepo.batchCreateSpotLiveSelfFundingAlerts.mockRejectedValue(
          new Error("Database error"),
        );

        const agents = [{ agentId: "agent-1", walletAddress: "0x123" }];

        const result = await service.monitorAgents(
          agents,
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        // Should still report success for agent monitoring
        expect(result.successful).toHaveLength(1);
        expect(result.totalAlertsCreated).toBe(0); // Failed to create
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.any(Object),
          expect.stringContaining("Failed to create alerts"),
        );
      });

      it("should handle alert fetch error gracefully", async () => {
        mockSpotLiveRepo.batchGetAgentsSpotLiveSelfFundingAlerts.mockRejectedValue(
          new Error("Database error"),
        );

        const agents = [
          { agentId: "agent-1", walletAddress: "0x111" },
          { agentId: "agent-2", walletAddress: "0x222" },
        ];

        const result = await service.monitorAgents(
          agents,
          "comp-1",
          competitionStartDate,
          competitionEndDate,
        );

        // Should still process all agents (failed fetch = empty alerts)
        expect(
          mockSpotLiveRepo.getAgentSpotLiveTransfers,
        ).toHaveBeenCalledTimes(2);
        expect(result.successful).toHaveLength(2);
      });
    });
  });

  describe("shouldMonitorCompetition", () => {
    it("should return false if no config found", async () => {
      mockSpotLiveRepo.getSpotLiveCompetitionConfig.mockResolvedValue(null);

      const result = await service.shouldMonitorCompetition("comp-1");
      expect(result).toBe(false);
    });

    it("should return true if threshold is zero (monitor for ANY deposits)", async () => {
      const zeroThresholdConfig: SelectSpotLiveCompetitionConfig = {
        ...sampleSpotLiveConfig,
        selfFundingThresholdUsd: "0",
      };
      mockSpotLiveRepo.getSpotLiveCompetitionConfig.mockResolvedValue(
        zeroThresholdConfig,
      );

      const result = await service.shouldMonitorCompetition("comp-1");
      expect(result).toBe(true);
    });

    it("should return false if threshold is missing", async () => {
      const noThresholdConfig: SelectSpotLiveCompetitionConfig = {
        ...sampleSpotLiveConfig,
        selfFundingThresholdUsd: null,
      };
      mockSpotLiveRepo.getSpotLiveCompetitionConfig.mockResolvedValue(
        noThresholdConfig,
      );

      const result = await service.shouldMonitorCompetition("comp-1");
      expect(result).toBe(false);
    });

    it("should return true if threshold is positive", async () => {
      mockSpotLiveRepo.getSpotLiveCompetitionConfig.mockResolvedValue(
        sampleSpotLiveConfig,
      );
      await expect(service.shouldMonitorCompetition("comp-1")).resolves.toBe(
        true,
      );
    });

    it("should handle config fetch error", async () => {
      mockSpotLiveRepo.getSpotLiveCompetitionConfig.mockRejectedValue(
        new Error("Database error"),
      );

      const result = await service.shouldMonitorCompetition("comp-1");
      expect(result).toBe(false);
    });
  });
});
