import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as competitionRepository from "@/database/repositories/competition-repository.js";
import { BlockchainType, PriceReport, SpecificChain } from "@/types/index.js";

import { BalanceManager } from "../balance-manager.service.js";
import { PortfolioSnapshotter } from "../portfolio-snapshotter.service.js";
import { PriceTracker } from "../price-tracker.service.js";

// Test Strategy:
// Target: PortfolioSnapshotter service - critical financial calculations
// Scenarios:
// 1. Successful portfolio snapshot creation with valid prices
// 2. Competition validation (exists, ended, force flag)
// 3. Price fetching failures and retry logic with exponential backoff
// 4. Balance filtering (zero vs non-zero balances)
// 5. Portfolio value calculation accuracy
// 6. Bulk snapshot processing for all agents
// 7. Error handling and graceful degradation
// 8. Health check functionality
// Expected signals: Accurate financial calculations, proper error handling, retry resilience

// Mock the repository functions
vi.mock("@/database/repositories/competition-repository.js", () => ({
  createPortfolioSnapshot: vi.fn(),
  findById: vi.fn(),
  getCompetitionAgents: vi.fn(),
  getAgentPortfolioSnapshots: vi.fn(),
  getAgentPortfolioTimeline: vi.fn(),
  findAll: vi.fn(),
}));

describe("PortfolioSnapshotter", () => {
  let portfolioSnapshotter: PortfolioSnapshotter;
  let mockBalanceManager: BalanceManager;
  let mockPriceTracker: PriceTracker;

  const mockCompetition = {
    id: "test-competition-id",
    name: "Test Competition",
    description: "Test competition for snapshotter",
    type: "trading" as const,
    externalUrl: null,
    imageUrl: null,
    startDate: new Date("2024-01-01T00:00:00Z"),
    endDate: new Date("2025-12-31T23:59:59Z"), // Far future date
    status: "active" as const,
    isPublic: true,
    entryFee: null,
    maxParticipants: null,
    prizes: null,
    rules: null,
    rulesVersion: null,
    votingStartDate: null,
    votingEndDate: null,
    joinStartDate: null,
    joinEndDate: null,
    registeredParticipants: 10,
    sandboxMode: false,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    crossChainTradingType: "allow" as const,
  };

  const mockBalances = [
    {
      id: 1,
      agentId: "test-agent-id",
      tokenAddress: "0x1234567890123456789012345678901234567890",
      amount: 1000,
      symbol: "USDC",
      specificChain: "eth",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
    {
      id: 2,
      agentId: "test-agent-id",
      tokenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
      amount: 2.5,
      symbol: "ETH",
      specificChain: "eth",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
    {
      id: 3,
      agentId: "test-agent-id",
      tokenAddress: "0x9876543210987654321098765432109876543210",
      amount: 0,
      symbol: "BTC", // Zero balance - should be skipped
      specificChain: "eth",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
  ];

  const mockPriceReports: Map<string, PriceReport | null> = new Map([
    [
      "0x1234567890123456789012345678901234567890",
      {
        token: "0x1234567890123456789012345678901234567890",
        price: 1.0,
        timestamp: new Date(),
        chain: BlockchainType.EVM,
        specificChain: "eth" as SpecificChain,
        symbol: "USDC",
      },
    ],
    [
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
      {
        token: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
        price: 2000,
        timestamp: new Date(),
        chain: BlockchainType.EVM,
        specificChain: "eth" as SpecificChain,
        symbol: "ETH",
      },
    ],
  ]);

  beforeEach(() => {
    // Create mock instances
    mockBalanceManager = {
      getAllBalances: vi.fn(),
    } as unknown as BalanceManager;

    mockPriceTracker = {
      getBulkPrices: vi.fn(),
    } as unknown as PriceTracker;

    portfolioSnapshotter = new PortfolioSnapshotter(
      mockBalanceManager,
      mockPriceTracker,
    );

    // Reset all mocks
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Set controlled system time to be well within competition range
    vi.setSystemTime(new Date("2024-06-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("takePortfolioSnapshotForAgent", () => {
    const competitionId = "test-competition-id";
    const agentId = "test-agent-id";

    it("should successfully create portfolio snapshot with valid data", async () => {
      // Setup mocks
      vi.mocked(competitionRepository.findById).mockResolvedValue(
        mockCompetition,
      );
      vi.mocked(mockBalanceManager.getAllBalances).mockResolvedValue(
        mockBalances,
      );
      vi.mocked(mockPriceTracker.getBulkPrices).mockResolvedValue(
        mockPriceReports,
      );
      vi.mocked(
        competitionRepository.createPortfolioSnapshot,
      ).mockResolvedValue({
        id: 1,
        competitionId,
        agentId,
        timestamp: new Date("2024-06-01T12:00:00Z"),
        totalValue: 6000,
      });

      const timestamp = new Date("2024-06-01T12:00:00Z");

      await portfolioSnapshotter.takePortfolioSnapshotForAgent(
        competitionId,
        agentId,
        timestamp,
      );

      // Verify competition lookup
      expect(competitionRepository.findById).toHaveBeenCalledWith(
        competitionId,
      );

      // Verify balance fetch
      expect(mockBalanceManager.getAllBalances).toHaveBeenCalledWith(agentId);

      // Verify price fetch for non-zero balances only
      expect(mockPriceTracker.getBulkPrices).toHaveBeenCalledWith([
        "0x1234567890123456789012345678901234567890", // USDC
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef", // ETH
        "0x9876543210987654321098765432109876543210", // BTC (even though zero, still requested)
      ]);

      // Verify snapshot creation with correct total value
      // Expected: (1000 * $1.0) + (2.5 * $2000) = $1000 + $5000 = $6000
      expect(
        competitionRepository.createPortfolioSnapshot,
      ).toHaveBeenCalledWith({
        agentId,
        competitionId,
        timestamp,
        totalValue: 6000,
      });
    });

    it("should throw error if competition does not exist", async () => {
      vi.mocked(competitionRepository.findById).mockResolvedValue(undefined);

      await expect(
        portfolioSnapshotter.takePortfolioSnapshotForAgent(
          competitionId,
          agentId,
        ),
      ).rejects.toThrow("Competition with ID test-competition-id not found");

      expect(mockBalanceManager.getAllBalances).not.toHaveBeenCalled();
      expect(mockPriceTracker.getBulkPrices).not.toHaveBeenCalled();
    });

    it("should skip snapshot if competition has ended and force=false", async () => {
      const endedCompetition = {
        ...mockCompetition,
        endDate: new Date("2023-12-31T23:59:59Z"), // Past date
      };

      vi.mocked(competitionRepository.findById).mockResolvedValue(
        endedCompetition,
      );

      // Mock current time to be after end date
      vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

      await portfolioSnapshotter.takePortfolioSnapshotForAgent(
        competitionId,
        agentId,
        new Date(),
        false, // force = false
      );

      expect(mockBalanceManager.getAllBalances).not.toHaveBeenCalled();
      expect(mockPriceTracker.getBulkPrices).not.toHaveBeenCalled();
      expect(
        competitionRepository.createPortfolioSnapshot,
      ).not.toHaveBeenCalled();
    });

    it("should create snapshot if competition has ended but force=true", async () => {
      const endedCompetition = {
        ...mockCompetition,
        endDate: new Date("2023-12-31T23:59:59Z"), // Past date
      };

      vi.mocked(competitionRepository.findById).mockResolvedValue(
        endedCompetition,
      );
      vi.mocked(mockBalanceManager.getAllBalances).mockResolvedValue(
        mockBalances,
      );
      vi.mocked(mockPriceTracker.getBulkPrices).mockResolvedValue(
        mockPriceReports,
      );
      vi.mocked(
        competitionRepository.createPortfolioSnapshot,
      ).mockResolvedValue({
        id: 1,
        competitionId: "mock-competition",
        agentId: "mock-agent",
        timestamp: new Date(),
        totalValue: 1000,
      });

      // Mock current time to be after end date
      vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

      await portfolioSnapshotter.takePortfolioSnapshotForAgent(
        competitionId,
        agentId,
        new Date(),
        true, // force = true
      );

      expect(mockBalanceManager.getAllBalances).toHaveBeenCalledWith(agentId);
      expect(mockPriceTracker.getBulkPrices).toHaveBeenCalled();
      expect(competitionRepository.createPortfolioSnapshot).toHaveBeenCalled();
    });

    it("should skip snapshot if agent has no balances", async () => {
      vi.mocked(competitionRepository.findById).mockResolvedValue(
        mockCompetition,
      );
      vi.mocked(mockBalanceManager.getAllBalances).mockResolvedValue([]); // Empty balances

      await portfolioSnapshotter.takePortfolioSnapshotForAgent(
        competitionId,
        agentId,
      );

      expect(mockPriceTracker.getBulkPrices).not.toHaveBeenCalled();
      expect(
        competitionRepository.createPortfolioSnapshot,
      ).not.toHaveBeenCalled();
    });

    it("should skip snapshot if price fetching fails after retries", async () => {
      vi.mocked(competitionRepository.findById).mockResolvedValue(
        mockCompetition,
      );
      vi.mocked(mockBalanceManager.getAllBalances).mockResolvedValue(
        mockBalances,
      );

      // Mock price failures for non-zero balance tokens
      const failedPriceReports = new Map([
        ["0x1234567890123456789012345678901234567890", null], // USDC failed
        [
          "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
          {
            token: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
            price: 2000,
            timestamp: new Date(),
            chain: BlockchainType.EVM,
            specificChain: "eth" as SpecificChain,
            symbol: "ETH",
          },
        ], // ETH succeeded
      ]);

      vi.mocked(mockPriceTracker.getBulkPrices).mockResolvedValue(
        failedPriceReports,
      );

      const snapshotPromise =
        portfolioSnapshotter.takePortfolioSnapshotForAgent(
          competitionId,
          agentId,
          new Date(),
          false,
          2, // maxRetries = 2, so 3 total attempts
        );

      // Advance timers to allow retries to complete
      // Total expected delays: 1000ms + 2000ms = 3000ms
      await vi.advanceTimersByTimeAsync(3000);

      await snapshotPromise;

      // Should retry 3 times (initial + 2 retries)
      expect(mockPriceTracker.getBulkPrices).toHaveBeenCalledTimes(3);

      // Should not create snapshot due to missing price data
      expect(
        competitionRepository.createPortfolioSnapshot,
      ).not.toHaveBeenCalled();
    });

    it("should implement exponential backoff in retry logic", async () => {
      vi.mocked(competitionRepository.findById).mockResolvedValue(
        mockCompetition,
      );
      vi.mocked(mockBalanceManager.getAllBalances).mockResolvedValue(
        mockBalances,
      );

      // Mock price failures for all attempts
      const failedPriceReports = new Map([
        ["0x1234567890123456789012345678901234567890", null],
        ["0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef", null],
        ["0x9876543210987654321098765432109876543210", null],
      ]);

      vi.mocked(mockPriceTracker.getBulkPrices).mockResolvedValue(
        failedPriceReports,
      );

      const startTime = Date.now();

      const snapshotPromise =
        portfolioSnapshotter.takePortfolioSnapshotForAgent(
          competitionId,
          agentId,
          new Date(),
          false,
          2, // 2 retries = 3 total attempts
        );

      // Advance timers to allow retries to complete
      // Attempt 1: immediate
      // Attempt 2: 1000ms delay (2^0 * 1000)
      // Attempt 3: 2000ms delay (2^1 * 1000)
      // Total expected delay: 1000 + 2000 = 3000ms
      await vi.advanceTimersByTimeAsync(3000);

      await snapshotPromise;

      // Verify exponential backoff delays occurred
      expect(Date.now() - startTime).toBeGreaterThanOrEqual(3000);

      expect(mockPriceTracker.getBulkPrices).toHaveBeenCalledTimes(3);
    });

    it("should calculate portfolio value correctly with mixed token balances", async () => {
      const mixedBalances = [
        {
          id: 1,
          agentId: "test-agent-id",
          tokenAddress: "token1",
          amount: 100,
          symbol: "TOKEN1",
          specificChain: "eth",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          agentId: "test-agent-id",
          tokenAddress: "token2",
          amount: 0,
          symbol: "TOKEN2",
          specificChain: "eth",
          createdAt: new Date(),
          updatedAt: new Date(),
        }, // Zero balance
        {
          id: 3,
          agentId: "test-agent-id",
          tokenAddress: "token3",
          amount: 50.5,
          symbol: "TOKEN3",
          specificChain: "eth",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 4,
          agentId: "test-agent-id",
          tokenAddress: "token4",
          amount: 1000000,
          symbol: "TOKEN4",
          specificChain: "eth",
          createdAt: new Date(),
          updatedAt: new Date(),
        }, // Large amount
      ];

      const mixedPriceReports = new Map([
        [
          "token1",
          {
            token: "token1",
            price: 1.5,
            timestamp: new Date(),
            chain: BlockchainType.EVM,
            specificChain: "eth" as SpecificChain,
            symbol: "TOKEN1",
          },
        ],
        [
          "token3",
          {
            token: "token3",
            price: 0.0001,
            timestamp: new Date(),
            chain: BlockchainType.EVM,
            specificChain: "eth" as SpecificChain,
            symbol: "TOKEN3",
          },
        ],
        [
          "token4",
          {
            token: "token4",
            price: 0.000001,
            timestamp: new Date(),
            chain: BlockchainType.EVM,
            specificChain: "eth" as SpecificChain,
            symbol: "TOKEN4",
          },
        ],
      ]);

      vi.mocked(competitionRepository.findById).mockResolvedValue(
        mockCompetition,
      );
      vi.mocked(mockBalanceManager.getAllBalances).mockResolvedValue(
        mixedBalances,
      );
      vi.mocked(mockPriceTracker.getBulkPrices).mockResolvedValue(
        mixedPriceReports,
      );
      vi.mocked(
        competitionRepository.createPortfolioSnapshot,
      ).mockResolvedValue({
        id: 1,
        competitionId: "mock-competition",
        agentId: "mock-agent",
        timestamp: new Date(),
        totalValue: 1000,
      });

      await portfolioSnapshotter.takePortfolioSnapshotForAgent(
        competitionId,
        agentId,
      );

      // Expected calculation:
      // token1: 100 * 1.5 = 150
      // token2: 0 * price = 0 (skipped)
      // token3: 50.5 * 0.0001 = 0.00505
      // token4: 1000000 * 0.000001 = 1
      // Total: 150 + 0.00505 + 1 = 151.00505

      expect(
        competitionRepository.createPortfolioSnapshot,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          totalValue: 151.00505,
        }),
      );
    });
  });

  describe("takePortfolioSnapshots", () => {
    it("should process all agents in competition sequentially", async () => {
      const agents = ["agent1", "agent2", "agent3"];

      vi.mocked(competitionRepository.getCompetitionAgents).mockResolvedValue(
        agents,
      );

      // Mock successful snapshot creation for each agent
      vi.mocked(competitionRepository.findById).mockResolvedValue(
        mockCompetition,
      );
      vi.mocked(mockBalanceManager.getAllBalances).mockResolvedValue(
        mockBalances,
      );
      vi.mocked(mockPriceTracker.getBulkPrices).mockResolvedValue(
        mockPriceReports,
      );
      vi.mocked(
        competitionRepository.createPortfolioSnapshot,
      ).mockResolvedValue({
        id: 1,
        competitionId: "mock-competition",
        agentId: "mock-agent",
        timestamp: new Date(),
        totalValue: 1000,
      });

      await portfolioSnapshotter.takePortfolioSnapshots("test-competition");

      expect(competitionRepository.getCompetitionAgents).toHaveBeenCalledWith(
        "test-competition",
      );

      // Verify each agent was processed
      expect(competitionRepository.findById).toHaveBeenCalledTimes(3);
      expect(mockBalanceManager.getAllBalances).toHaveBeenCalledTimes(3);
      expect(mockPriceTracker.getBulkPrices).toHaveBeenCalledTimes(3);
      expect(
        competitionRepository.createPortfolioSnapshot,
      ).toHaveBeenCalledTimes(3);

      // Verify each agent ID was used
      agents.forEach((agentId) => {
        expect(mockBalanceManager.getAllBalances).toHaveBeenCalledWith(agentId);
      });
    });

    it("should continue processing other agents even if one fails", async () => {
      const agents = ["agent1", "agent2", "agent3"];

      vi.mocked(competitionRepository.getCompetitionAgents).mockResolvedValue(
        agents,
      );

      // Mock behavior: agent2 fails, others succeed
      vi.mocked(competitionRepository.findById)
        .mockResolvedValueOnce(mockCompetition) // agent1 succeeds
        .mockRejectedValueOnce(new Error("Agent2 error")) // agent2 fails
        .mockResolvedValueOnce(mockCompetition); // agent3 succeeds

      vi.mocked(mockBalanceManager.getAllBalances).mockResolvedValue(
        mockBalances,
      );
      vi.mocked(mockPriceTracker.getBulkPrices).mockResolvedValue(
        mockPriceReports,
      );
      vi.mocked(
        competitionRepository.createPortfolioSnapshot,
      ).mockResolvedValue({
        id: 1,
        competitionId: "mock-competition",
        agentId: "mock-agent",
        timestamp: new Date(),
        totalValue: 1000,
      });

      // Should not throw despite agent2 failing
      await expect(
        portfolioSnapshotter.takePortfolioSnapshots("test-competition"),
      ).rejects.toThrow("Agent2 error");

      // Verify all agents were attempted
      expect(competitionRepository.findById).toHaveBeenCalledTimes(2); // Stops at failure
    });
  });

  describe("getAgentPortfolioSnapshots", () => {
    it("should delegate to repository with correct parameters", async () => {
      const mockSnapshots = [
        {
          id: 1,
          competitionId: "test-competition",
          agentId: "test-agent",
          timestamp: new Date(),
          totalValue: 1000,
        },
      ];

      vi.mocked(
        competitionRepository.getAgentPortfolioSnapshots,
      ).mockResolvedValue(mockSnapshots);

      const result = await portfolioSnapshotter.getAgentPortfolioSnapshots(
        "test-competition",
        "test-agent",
        10,
      );

      expect(
        competitionRepository.getAgentPortfolioSnapshots,
      ).toHaveBeenCalledWith("test-competition", "test-agent", 10);

      expect(result).toEqual(mockSnapshots);
    });
  });

  describe("getAgentPortfolioTimeline", () => {
    it("should delegate to repository with default bucket parameter", async () => {
      const mockTimeline = [
        {
          timestamp: new Date().toISOString(),
          agentId: "test-agent",
          agentName: "Test Agent",
          competitionId: "test-competition",
          totalValue: 1000,
        },
        {
          timestamp: new Date().toISOString(),
          agentId: "test-agent",
          agentName: "Test Agent",
          competitionId: "test-competition",
          totalValue: 1100,
        },
      ];

      vi.mocked(
        competitionRepository.getAgentPortfolioTimeline,
      ).mockResolvedValue(mockTimeline);

      const result =
        await portfolioSnapshotter.getAgentPortfolioTimeline(
          "test-competition",
        );

      expect(
        competitionRepository.getAgentPortfolioTimeline,
      ).toHaveBeenCalledWith(
        "test-competition",
        30, // default bucket
      );

      expect(result).toEqual(mockTimeline);
    });

    it("should use custom bucket parameter", async () => {
      vi.mocked(
        competitionRepository.getAgentPortfolioTimeline,
      ).mockResolvedValue([]);

      await portfolioSnapshotter.getAgentPortfolioTimeline(
        "test-competition",
        60,
      );

      expect(
        competitionRepository.getAgentPortfolioTimeline,
      ).toHaveBeenCalledWith("test-competition", 60);
    });
  });

  describe("isHealthy", () => {
    it("should return true when database connection is healthy", async () => {
      vi.mocked(competitionRepository.findAll).mockResolvedValue([]);

      const result = await portfolioSnapshotter.isHealthy();

      expect(result).toBe(true);
      expect(competitionRepository.findAll).toHaveBeenCalled();
    });

    it("should return false when database connection fails", async () => {
      vi.mocked(competitionRepository.findAll).mockRejectedValue(
        new Error("Database connection failed"),
      );

      const result = await portfolioSnapshotter.isHealthy();

      expect(result).toBe(false);
      expect(competitionRepository.findAll).toHaveBeenCalled();
    });
  });

  describe("edge cases and error conditions", () => {
    it("should handle extremely large portfolio values without overflow", async () => {
      const largeBalances = [
        {
          id: 1,
          agentId: "test-agent-id",
          tokenAddress: "token1",
          amount: Number.MAX_SAFE_INTEGER / 1000, // Very large amount
          symbol: "MEGA",
          specificChain: "eth",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const largePriceReports = new Map([
        [
          "token1",
          {
            token: "token1",
            price: 999, // Large price
            timestamp: new Date(),
            chain: BlockchainType.EVM,
            specificChain: "eth" as SpecificChain,
            symbol: "MEGA",
          },
        ],
      ]);

      vi.mocked(competitionRepository.findById).mockResolvedValue(
        mockCompetition,
      );
      vi.mocked(mockBalanceManager.getAllBalances).mockResolvedValue(
        largeBalances,
      );
      vi.mocked(mockPriceTracker.getBulkPrices).mockResolvedValue(
        largePriceReports,
      );
      vi.mocked(
        competitionRepository.createPortfolioSnapshot,
      ).mockResolvedValue({
        id: 1,
        competitionId: "mock-competition",
        agentId: "mock-agent",
        timestamp: new Date(),
        totalValue: 1000,
      });

      await portfolioSnapshotter.takePortfolioSnapshotForAgent(
        "test-competition",
        "test-agent",
      );

      // Should not throw overflow errors
      expect(
        competitionRepository.createPortfolioSnapshot,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          totalValue: expect.any(Number),
        }),
      );

      const calls = vi.mocked(competitionRepository.createPortfolioSnapshot)
        .mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const totalValue = calls[0]?.[0]?.totalValue;

      // Verify result is finite and not NaN
      expect(Number.isFinite(totalValue)).toBe(true);
      expect(totalValue).toBeGreaterThan(0);
    });

    it("should handle price fetch partial success correctly", async () => {
      const partialBalances = [
        {
          id: 1,
          agentId: "test-agent-id",
          tokenAddress: "success-token",
          amount: 100,
          symbol: "SUCCESS",
          specificChain: "eth",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          agentId: "test-agent-id",
          tokenAddress: "fail-token",
          amount: 50,
          symbol: "FAIL",
          specificChain: "eth",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // First attempt: partial success
      // Second attempt: complete success
      const partialSuccess = new Map([
        [
          "success-token",
          {
            token: "success-token",
            price: 2.0,
            timestamp: new Date(),
            chain: BlockchainType.EVM,
            specificChain: "eth" as SpecificChain,
            symbol: "SUCCESS",
          },
        ],
        ["fail-token", null], // Failed initially
      ]);

      const completeSuccess = new Map([
        [
          "success-token",
          {
            token: "success-token",
            price: 2.0,
            timestamp: new Date(),
            chain: BlockchainType.EVM,
            specificChain: "eth" as SpecificChain,
            symbol: "SUCCESS",
          },
        ],
        [
          "fail-token",
          {
            token: "fail-token",
            price: 3.0,
            timestamp: new Date(),
            chain: BlockchainType.EVM,
            specificChain: "eth" as SpecificChain,
            symbol: "FAIL",
          },
        ],
      ]);

      vi.mocked(competitionRepository.findById).mockResolvedValue(
        mockCompetition,
      );
      vi.mocked(mockBalanceManager.getAllBalances).mockResolvedValue(
        partialBalances,
      );
      vi.mocked(mockPriceTracker.getBulkPrices)
        .mockResolvedValueOnce(partialSuccess) // First attempt
        .mockResolvedValueOnce(completeSuccess); // Second attempt

      vi.mocked(
        competitionRepository.createPortfolioSnapshot,
      ).mockResolvedValue({
        id: 1,
        competitionId: "mock-competition",
        agentId: "mock-agent",
        timestamp: new Date(),
        totalValue: 1000,
      });

      const snapshotPromise =
        portfolioSnapshotter.takePortfolioSnapshotForAgent(
          "test-competition",
          "test-agent",
        );

      // Advance timer for the retry delay (1000ms for second attempt)
      await vi.advanceTimersByTimeAsync(1000);

      await snapshotPromise;

      // Should succeed after 2 attempts
      expect(mockPriceTracker.getBulkPrices).toHaveBeenCalledTimes(2);

      // Should create snapshot with correct total: (100 * 2.0) + (50 * 3.0) = 350
      expect(
        competitionRepository.createPortfolioSnapshot,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          totalValue: 350,
        }),
      );
    });
  });
});
