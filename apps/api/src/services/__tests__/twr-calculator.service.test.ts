import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  SelectPerpsTransferHistory,
  SelectPortfolioSnapshot,
} from "@recallnet/db/schema/trading/types";

import * as competitionRepo from "@/database/repositories/competition-repository.js";
import * as perpsRepo from "@/database/repositories/perps-repository.js";
import { TWRCalculatorService } from "@/services/twr-calculator.service.js";

// Mock all dependencies
vi.mock("@/database/repositories/competition-repository.js");
vi.mock("@/database/repositories/perps-repository.js");
vi.mock("@/lib/logger.js");

describe("TWRCalculatorService", () => {
  let service: TWRCalculatorService;

  // Sample portfolio snapshots
  const createSnapshot = (
    timestamp: Date,
    totalValue: number,
  ): SelectPortfolioSnapshot => ({
    id: 1,
    agentId: "agent-1",
    competitionId: "comp-1",
    timestamp,
    totalValue,
  });

  // Sample transfer with equity snapshots
  const createTransfer = (
    timestamp: Date,
    type: "deposit" | "withdraw",
    amount: number,
    equityBefore: number,
    equityAfter: number,
  ): SelectPerpsTransferHistory => ({
    id: "transfer-1",
    agentId: "agent-1",
    competitionId: "comp-1",
    type: type as string,
    amount: amount.toString(),
    asset: "USDC",
    fromAddress: "0xfrom",
    toAddress: "0xto",
    txHash: `0x${timestamp.getTime()}`,
    chainId: 1,
    equityBefore: equityBefore.toString(),
    equityAfter: equityAfter.toString(),
    transferTimestamp: timestamp,
    capturedAt: timestamp,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TWRCalculatorService();
  });

  describe("calculateTWR", () => {
    describe("without transfers (simple return)", () => {
      it("should calculate simple return when no transfers exist", async () => {
        const startDate = new Date("2024-01-01");
        const endDate = new Date("2024-01-31");

        // Start: $1000, End: $1200 = 20% return
        const snapshots = [
          createSnapshot(endDate, 1200), // DESC order (newest first)
          createSnapshot(startDate, 1000),
        ];

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshots[snapshots.length - 1] ?? null, // Oldest (snapshots are DESC order)
          last: snapshots[0] ?? null, // Newest
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue([]);

        const result = await service.calculateTWR(
          "agent-1",
          "comp-1",
          startDate,
          endDate,
        );

        expect(result.timeWeightedReturn).toBeCloseTo(0.2); // 20% return
        expect(result.periods).toHaveLength(1);
        expect(result.periods[0]).toMatchObject({
          startingEquity: 1000,
          endingEquity: 1200,
          periodReturn: 0.2,
          sequenceNumber: 0,
        });
        expect(result.transferCount).toBe(0);
        expect(result.snapshotCount).toBe(2);
      });

      it("should handle negative returns", async () => {
        // Start: $1000, End: $800 = -20% return
        const snapshots = [
          createSnapshot(new Date("2024-01-31"), 800),
          createSnapshot(new Date("2024-01-01"), 1000),
        ];

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshots[snapshots.length - 1] ?? null, // Oldest (snapshots are DESC order)
          last: snapshots[0] ?? null, // Newest
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue([]);

        const result = await service.calculateTWR("agent-1", "comp-1");

        expect(result.timeWeightedReturn).toBeCloseTo(-0.2); // -20% return
        expect(result.periods[0]?.periodReturn).toBeCloseTo(-0.2);
      });

      it("should handle zero starting equity", async () => {
        const snapshots = [
          createSnapshot(new Date("2024-01-31"), 1000),
          createSnapshot(new Date("2024-01-01"), 0), // Zero start
        ];

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshots[snapshots.length - 1] ?? null, // Oldest (snapshots are DESC order)
          last: snapshots[0] ?? null, // Newest
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue([]);

        const result = await service.calculateTWR("agent-1", "comp-1");

        expect(result.timeWeightedReturn).toBe(0);
        expect(result.periods).toHaveLength(0); // No valid periods
      });

      it("should handle negative starting equity", async () => {
        const snapshots = [
          createSnapshot(new Date("2024-01-31"), 1000),
          createSnapshot(new Date("2024-01-01"), -500), // Negative (liquidated)
        ];

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshots[snapshots.length - 1] ?? null, // Oldest (snapshots are DESC order)
          last: snapshots[0] ?? null, // Newest
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue([]);

        const result = await service.calculateTWR("agent-1", "comp-1");

        expect(result.timeWeightedReturn).toBe(0);
        expect(result.periods).toHaveLength(0);
      });

      it("should handle single snapshot gracefully", async () => {
        const snapshot = createSnapshot(new Date("2024-01-01"), 1000);

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshot,
          last: snapshot, // Same snapshot for both
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue([]);

        const result = await service.calculateTWR("agent-1", "comp-1");

        // With only one snapshot, return should be 0
        expect(result.timeWeightedReturn).toBe(0);
      });

      it("should throw when no snapshots exist", async () => {
        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: null,
          last: null,
        });

        await expect(service.calculateTWR("agent-1", "comp-1")).rejects.toThrow(
          "Insufficient data: No portfolio snapshots found",
        );
      });
    });

    describe("with transfers (TWR calculation)", () => {
      it("should calculate TWR with a single deposit", async () => {
        const startDate = new Date("2024-01-01");
        const transferDate = new Date("2024-01-15");
        const endDate = new Date("2024-01-31");

        // Scenario:
        // Start: $1000
        // Jan 15: $1100 (10% gain), then deposit $500 -> $1600
        // End: $1760 (10% gain on $1600)
        // TWR = (1.1 * 1.1) - 1 = 0.21 (21%)

        const snapshots = [
          createSnapshot(endDate, 1760),
          createSnapshot(startDate, 1000),
        ];

        const transfers = [
          createTransfer(transferDate, "deposit", 500, 1100, 1600),
        ];

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshots[snapshots.length - 1] ?? null, // Oldest (snapshots are DESC order)
          last: snapshots[0] ?? null, // Newest
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue(
          transfers,
        );

        const result = await service.calculateTWR(
          "agent-1",
          "comp-1",
          startDate,
          endDate,
        );

        expect(result.timeWeightedReturn).toBeCloseTo(0.21); // 21% TWR
        expect(result.periods).toHaveLength(2);

        // First period: $1000 -> $1100 (10%)
        expect(result.periods[0]).toMatchObject({
          startingEquity: 1000,
          endingEquity: 1100,
          periodReturn: 0.1,
          sequenceNumber: 0,
        });

        // Second period: $1600 -> $1760 (10%)
        expect(result.periods[1]).toMatchObject({
          startingEquity: 1600,
          endingEquity: 1760,
          periodReturn: 0.1,
          sequenceNumber: 1,
        });

        expect(result.transferCount).toBe(1);
      });

      it("should calculate TWR with a withdrawal", async () => {
        const startDate = new Date("2024-01-01");
        const transferDate = new Date("2024-01-15");
        const endDate = new Date("2024-01-31");

        // Start: $2000
        // Jan 15: $2200 (10% gain), then withdraw $1000 -> $1200
        // End: $1320 (10% gain on $1200)
        // TWR = (1.1 * 1.1) - 1 = 0.21 (21%)

        const snapshots = [
          createSnapshot(endDate, 1320),
          createSnapshot(startDate, 2000),
        ];

        const transfers = [
          createTransfer(transferDate, "withdraw", 1000, 2200, 1200),
        ];

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshots[snapshots.length - 1] ?? null, // Oldest (snapshots are DESC order)
          last: snapshots[0] ?? null, // Newest
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue(
          transfers,
        );

        const result = await service.calculateTWR(
          "agent-1",
          "comp-1",
          startDate,
          endDate,
        );

        expect(result.timeWeightedReturn).toBeCloseTo(0.21); // 21% TWR
        expect(result.periods).toHaveLength(2);
      });

      it("should handle multiple transfers", async () => {
        const startDate = new Date("2024-01-01");
        const transfer1Date = new Date("2024-01-10");
        const transfer2Date = new Date("2024-01-20");
        const endDate = new Date("2024-01-31");

        // Complex scenario with multiple transfers
        const snapshots = [
          createSnapshot(endDate, 1500),
          createSnapshot(startDate, 1000),
        ];

        const transfers = [
          createTransfer(transfer1Date, "deposit", 200, 1050, 1250), // 5% gain then deposit
          createTransfer(transfer2Date, "withdraw", 100, 1300, 1200), // 4% gain then withdraw
        ];

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshots[snapshots.length - 1] ?? null, // Oldest (snapshots are DESC order)
          last: snapshots[0] ?? null, // Newest
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue(
          transfers,
        );

        const result = await service.calculateTWR(
          "agent-1",
          "comp-1",
          startDate,
          endDate,
        );

        // Period 1: 1000 -> 1050 (5%)
        // Period 2: 1250 -> 1300 (4%)
        // Period 3: 1200 -> 1500 (25%)
        // TWR = (1.05 * 1.04 * 1.25) - 1 = 0.365 (36.5%)
        expect(result.timeWeightedReturn).toBeCloseTo(0.365);
        expect(result.periods).toHaveLength(3);
        expect(result.transferCount).toBe(2);
      });

      it("should filter transfers outside date range", async () => {
        const startDate = new Date("2024-01-10");
        const endDate = new Date("2024-01-20");

        const snapshots = [
          createSnapshot(endDate, 1100),
          createSnapshot(startDate, 1000),
        ];

        const transfers = [
          createTransfer(new Date("2024-01-05"), "deposit", 100, 900, 1000), // Before start
          createTransfer(new Date("2024-01-15"), "deposit", 50, 1050, 1100), // Within range
          createTransfer(new Date("2024-01-25"), "withdraw", 100, 1100, 1000), // After end
        ];

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshots[snapshots.length - 1] ?? null, // Oldest (snapshots are DESC order)
          last: snapshots[0] ?? null, // Newest
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue(
          transfers,
        );

        const result = await service.calculateTWR(
          "agent-1",
          "comp-1",
          startDate,
          endDate,
        );

        // Only the middle transfer should be used
        expect(result.transferCount).toBe(1);
        expect(result.periods).toHaveLength(2);
      });

      it("should handle transfers with negative returns between them", async () => {
        const startDate = new Date("2024-01-01");
        const transferDate = new Date("2024-01-15");
        const endDate = new Date("2024-01-31");

        const snapshots = [
          createSnapshot(endDate, 900),
          createSnapshot(startDate, 1000),
        ];

        const transfers = [
          createTransfer(transferDate, "deposit", 200, 800, 1000), // Lost 20%, then deposit
        ];

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshots[snapshots.length - 1] ?? null, // Oldest (snapshots are DESC order)
          last: snapshots[0] ?? null, // Newest
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue(
          transfers,
        );

        const result = await service.calculateTWR(
          "agent-1",
          "comp-1",
          startDate,
          endDate,
        );

        // Period 1: 1000 -> 800 (-20%)
        // Period 2: 1000 -> 900 (-10%)
        // TWR = (0.8 * 0.9) - 1 = -0.28 (-28%)
        expect(result.timeWeightedReturn).toBeCloseTo(-0.28);
      });

      it("should handle zero equity after losses before transfer", async () => {
        const startDate = new Date("2024-01-01");
        const transferDate = new Date("2024-01-15");
        const endDate = new Date("2024-01-31");

        const snapshots = [
          createSnapshot(endDate, 500),
          createSnapshot(startDate, 1000),
        ];

        const transfers = [
          createTransfer(transferDate, "deposit", 500, 0, 500), // Total loss, then deposit
        ];

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshots[snapshots.length - 1] ?? null, // Oldest (snapshots are DESC order)
          last: snapshots[0] ?? null, // Newest
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue(
          transfers,
        );

        const result = await service.calculateTWR(
          "agent-1",
          "comp-1",
          startDate,
          endDate,
        );

        // Period 1: 1000 -> 0 (-100%)
        // Period 2: 500 -> 500 (0%)
        // TWR = (0 * 1) - 1 = -1 (-100%)
        expect(result.timeWeightedReturn).toBe(-1);
      });

      it("should sort transfers chronologically even if provided out of order", async () => {
        const startDate = new Date("2024-01-01");
        const endDate = new Date("2024-01-31");

        const snapshots = [
          createSnapshot(endDate, 1200),
          createSnapshot(startDate, 1000),
        ];

        // Provide transfers out of order
        const transfers = [
          createTransfer(new Date("2024-01-20"), "withdraw", 100, 1150, 1050),
          createTransfer(new Date("2024-01-10"), "deposit", 100, 1050, 1150),
        ];

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshots[snapshots.length - 1] ?? null, // Oldest (snapshots are DESC order)
          last: snapshots[0] ?? null, // Newest
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue(
          transfers,
        );

        const result = await service.calculateTWR(
          "agent-1",
          "comp-1",
          startDate,
          endDate,
        );

        // Should process in chronological order
        expect(result.periods[0]?.endingEquity).toBe(1050); // First transfer
        expect(result.periods[1]?.endingEquity).toBe(1150); // Second transfer
        expect(result.periods[2]?.endingEquity).toBe(1200); // Final period
      });
    });

    describe("edge cases", () => {
      it("should handle very large numbers", async () => {
        const snapshots = [
          createSnapshot(new Date("2024-01-31"), 1e15), // Quadrillion
          createSnapshot(new Date("2024-01-01"), 1e14), // 100 trillion
        ];

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshots[snapshots.length - 1] ?? null, // Oldest (snapshots are DESC order)
          last: snapshots[0] ?? null, // Newest
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue([]);

        const result = await service.calculateTWR("agent-1", "comp-1");

        // 900% return
        expect(result.timeWeightedReturn).toBeCloseTo(9);
      });

      it("should handle very small numbers", async () => {
        const snapshots = [
          createSnapshot(new Date("2024-01-31"), 0.00002), // 0.00002
          createSnapshot(new Date("2024-01-01"), 0.00001), // 0.00001
        ];

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshots[snapshots.length - 1] ?? null, // Oldest (snapshots are DESC order)
          last: snapshots[0] ?? null, // Newest
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue([]);

        const result = await service.calculateTWR("agent-1", "comp-1");

        // 100% return
        expect(result.timeWeightedReturn).toBeCloseTo(1);
      });

      it("should handle dates not provided (use snapshot dates)", async () => {
        const snapshots = [
          createSnapshot(new Date("2024-02-01"), 1200),
          createSnapshot(new Date("2024-01-01"), 1000),
        ];

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshots[snapshots.length - 1] ?? null, // Oldest (snapshots are DESC order)
          last: snapshots[0] ?? null, // Newest
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue([]);

        // No dates provided
        const result = await service.calculateTWR("agent-1", "comp-1");

        expect(result.timeWeightedReturn).toBeCloseTo(0.2);
        expect(result.periods[0]?.periodStart).toEqual(new Date("2024-01-01"));
        expect(result.periods[0]?.periodEnd).toEqual(new Date("2024-02-01"));
      });

      it("should handle rapid consecutive transfers", async () => {
        const startDate = new Date("2024-01-01T00:00:00");
        const endDate = new Date("2024-01-02T00:00:00");

        const snapshots = [
          createSnapshot(endDate, 1100),
          createSnapshot(startDate, 1000),
        ];

        // Multiple transfers within same day
        const transfers = [
          createTransfer(
            new Date("2024-01-01T10:00:00"),
            "deposit",
            50,
            1000,
            1050,
          ),
          createTransfer(
            new Date("2024-01-01T10:01:00"),
            "deposit",
            25,
            1050,
            1075,
          ),
          createTransfer(
            new Date("2024-01-01T10:02:00"),
            "withdraw",
            10,
            1075,
            1065,
          ),
        ];

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshots[snapshots.length - 1] ?? null, // Oldest (snapshots are DESC order)
          last: snapshots[0] ?? null, // Newest
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue(
          transfers,
        );

        const result = await service.calculateTWR(
          "agent-1",
          "comp-1",
          startDate,
          endDate,
        );

        // Should create 4 periods (start->t1, t1->t2, t2->t3, t3->end)
        expect(result.periods).toHaveLength(4);
        expect(result.transferCount).toBe(3);
      });

      it("should handle competition with no transfers and flat performance", async () => {
        const snapshots = [
          createSnapshot(new Date("2024-01-31"), 1000),
          createSnapshot(new Date("2024-01-01"), 1000), // No change
        ];

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshots[snapshots.length - 1] ?? null, // Oldest (snapshots are DESC order)
          last: snapshots[0] ?? null, // Newest
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue([]);

        const result = await service.calculateTWR("agent-1", "comp-1");

        expect(result.timeWeightedReturn).toBe(0); // 0% return
      });
    });

    describe("formatPeriodsForStorage", () => {
      it("should format periods for database storage", () => {
        const periods = [
          {
            periodStart: new Date("2024-01-01"),
            periodEnd: new Date("2024-01-15"),
            startingEquity: 1000,
            endingEquity: 1100,
            periodReturn: 0.1,
            sequenceNumber: 0,
            transferId: "transfer-1",
          },
          {
            periodStart: new Date("2024-01-15"),
            periodEnd: new Date("2024-01-31"),
            startingEquity: 1600,
            endingEquity: 1760,
            periodReturn: 0.1,
            sequenceNumber: 1,
            transferId: undefined,
          },
        ];

        const formatted = service.formatPeriodsForStorage(periods);

        expect(formatted).toHaveLength(2);
        expect(formatted[0]).toMatchObject({
          periodStart: new Date("2024-01-01"),
          periodEnd: new Date("2024-01-15"),
          periodReturn: "0.1",
          startingEquity: "1000",
          endingEquity: "1100",
          sequenceNumber: 0,
          transferId: "transfer-1",
        });
        expect(formatted[1]).toMatchObject({
          periodReturn: "0.1",
          startingEquity: "1600",
          endingEquity: "1760",
          sequenceNumber: 1,
          transferId: null, // undefined becomes null
        });
      });

      it("should handle empty periods array", () => {
        const formatted = service.formatPeriodsForStorage([]);
        expect(formatted).toEqual([]);
      });

      it("should handle periods with extreme values", () => {
        const periods = [
          {
            periodStart: new Date("2024-01-01"),
            periodEnd: new Date("2024-01-15"),
            startingEquity: 1e15,
            endingEquity: 1e16,
            periodReturn: 9,
            sequenceNumber: 0,
          },
        ];

        const formatted = service.formatPeriodsForStorage(periods);

        expect(formatted[0]).toMatchObject({
          periodReturn: "9",
          startingEquity: "1000000000000000",
          endingEquity: "10000000000000000",
        });
      });
    });

    describe("error handling", () => {
      it("should propagate repository errors", async () => {
        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockRejectedValue(
          new Error("Database connection failed"),
        );

        await expect(service.calculateTWR("agent-1", "comp-1")).rejects.toThrow(
          "Database connection failed",
        );
      });

      it("should handle invalid snapshot data gracefully", async () => {
        const invalidSnapshot = {
          ...createSnapshot(new Date("2024-01-31"), 1000),
          totalValue: NaN, // Invalid value
        };

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: invalidSnapshot,
          last: invalidSnapshot,
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue([]);

        const result = await service.calculateTWR("agent-1", "comp-1");

        // Should handle NaN gracefully
        expect(result.timeWeightedReturn).toBe(0);
      });

      it("should handle missing transfer equity values", async () => {
        const snapshots = [
          createSnapshot(new Date("2024-01-31"), 1200),
          createSnapshot(new Date("2024-01-01"), 1000),
        ];

        const transfers = [
          {
            ...createTransfer(
              new Date("2024-01-15"),
              "deposit",
              100,
              1100,
              1200,
            ),
            equityBefore: null as unknown as string, // Missing value
          },
        ];

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: snapshots[snapshots.length - 1] ?? null, // Oldest (snapshots are DESC order)
          last: snapshots[0] ?? null, // Newest
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue(
          transfers,
        );

        const result = await service.calculateTWR(
          "agent-1",
          "comp-1",
          new Date("2024-01-01"),
          new Date("2024-01-31"),
        );

        // Should handle null as 0
        expect(result.periods[0]?.endingEquity).toBe(0);
      });
    });

    describe("performance characteristics", () => {
      it("should fetch first and last snapshots efficiently", async () => {
        const firstSnapshot = createSnapshot(new Date("2024-01-01"), 1000);
        const lastSnapshot = createSnapshot(new Date("2024-12-31"), 2000);

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: firstSnapshot,
          last: lastSnapshot,
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue([]);

        await service.calculateTWR("agent-1", "comp-1");

        // Should use the optimized method to fetch boundary snapshots
        expect(competitionRepo.getFirstAndLastSnapshots).toHaveBeenCalledWith(
          "comp-1",
          "agent-1",
        );
      });

      it("should handle large number of transfers efficiently", async () => {
        const firstSnapshot = createSnapshot(new Date("2024-01-01"), 1000);
        const lastSnapshot = createSnapshot(new Date("2024-01-31"), 2000);

        // Create 100 transfers
        const transfers = Array.from({ length: 100 }, (_, i) =>
          createTransfer(
            new Date(
              `2024-01-${String(Math.floor(i / 4) + 1).padStart(2, "0")}`,
            ),
            i % 2 === 0 ? "deposit" : "withdraw",
            100,
            1000 + i * 10,
            1000 + i * 10 + 100,
          ),
        );

        vi.mocked(competitionRepo.getFirstAndLastSnapshots).mockResolvedValue({
          first: firstSnapshot,
          last: lastSnapshot,
        });
        vi.mocked(perpsRepo.getAgentTransferHistory).mockResolvedValue(
          transfers,
        );

        const result = await service.calculateTWR(
          "agent-1",
          "comp-1",
          new Date("2024-01-01"),
          new Date("2024-01-31"),
        );

        // Should handle all transfers
        expect(result.transferCount).toBeGreaterThan(0);
        expect(result.periods.length).toBeGreaterThan(0);
      });
    });
  });
});
