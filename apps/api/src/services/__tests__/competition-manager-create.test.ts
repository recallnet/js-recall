import { v4 as uuidv4 } from "uuid";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { SelectTradingConstraints } from "@recallnet/db/schema/trading/types";

import { db } from "@/database/db.js";
import * as competitionRepository from "@/database/repositories/competition-repository.js";
import type { AgentService } from "@/services/agent.service.js";
import type { AgentRankService } from "@/services/agentrank.service.js";
import type { BalanceService } from "@/services/balance.service.js";
import type { CompetitionRewardService } from "@/services/competition-reward.service.js";
import { CompetitionService } from "@/services/competition.service.js";
import type { ConfigurationService } from "@/services/configuration.service.js";
import type { PortfolioSnapshotterService } from "@/services/portfolio-snapshotter.service.js";
import type { TradeSimulatorService } from "@/services/trade-simulator.service.js";
import type { TradingConstraintsService } from "@/services/trading-constraints.service.js";
import type { VoteService } from "@/services/vote.service.js";

// Mock logger first to prevent db initialization
vi.mock("@/lib/logger.js", () => ({
  serviceLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
  dbLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  repositoryLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  competitionRewardsLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock all dependencies
vi.mock("@/database/db.js", () => ({
  db: {
    transaction: vi.fn(),
  },
  dbRead: {
    transaction: vi.fn(),
  },
}));
vi.mock("@/database/repositories/competition-repository.js");
vi.mock("@/services/competition-reward.service.js");
vi.mock("@/services/trading-constraints.service.js");

describe("CompetitionService - createCompetition", () => {
  let competitionService: CompetitionService;
  let mockCompetitionRewardService: Partial<CompetitionRewardService>;
  let mockTradingConstraintsService: Partial<TradingConstraintsService>;
  let mockDb: { transaction: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock services
    mockCompetitionRewardService = {
      createRewards: vi.fn().mockResolvedValue([
        {
          id: uuidv4(),
          competitionId: "",
          rank: 1,
          reward: 1000,
          agentId: null,
        },
      ]),
    };

    mockTradingConstraintsService = {
      createConstraints: vi.fn().mockResolvedValue({
        competitionId: "",
        minimumPairAgeHours: 24,
        minimum24hVolumeUsd: 10000,
        minimumLiquidityUsd: 50000,
        minimumFdvUsd: 100000,
        minTradesPerDay: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as SelectTradingConstraints),
    };

    // Get the mocked db transaction
    mockDb = { transaction: vi.mocked(db.transaction) };

    // Mock the repository functions
    vi.mocked(competitionRepository.create).mockImplementation(async () => ({
      competitionId: uuidv4(),
      id: uuidv4(),
      name: "Test Competition",
      description: "Test Description",
      type: "trading",
      status: "pending",
      startDate: null,
      endDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      imageUrl: null,
      externalUrl: null,
      votingStartDate: null,
      votingEndDate: null,
      joinStartDate: null,
      joinEndDate: null,
      maxParticipants: null,
      registeredParticipants: 0,
      sandboxMode: false,
      crossChainTradingType: "disallowAll",
    }));

    // Create mock services for all dependencies
    const mockBalanceService = {} as unknown as BalanceService;
    const mockTradeSimulatorService = {} as unknown as TradeSimulatorService;
    const mockPortfolioSnapshotterService =
      {} as unknown as PortfolioSnapshotterService;
    const mockAgentService = {} as unknown as AgentService;
    const mockConfigurationService = {} as unknown as ConfigurationService;
    const mockAgentRankService = {} as unknown as AgentRankService;
    const mockVoteService = {} as unknown as VoteService;

    // Create competition manager instance with all mocked dependencies
    competitionService = new CompetitionService(
      mockBalanceService,
      mockTradeSimulatorService,
      mockPortfolioSnapshotterService,
      mockAgentService,
      mockConfigurationService,
      mockAgentRankService,
      mockVoteService,
      mockTradingConstraintsService as unknown as TradingConstraintsService,
      mockCompetitionRewardService as unknown as CompetitionRewardService,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should create competition atomically with all components", async () => {
    // Setup the transaction mock to execute the callback
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = {};
      return await callback(mockTx);
    });

    const result = await competitionService.createCompetition({
      name: "New Competition",
      description: "Test Description",
      tradingType: "disallowAll",
      sandboxMode: false,
      type: "trading",
      tradingConstraints: {
        minimumPairAgeHours: 48,
        minimum24hVolumeUsd: 20000,
        minimumLiquidityUsd: 100000,
        minimumFdvUsd: 200000,
      },
      rewards: {
        1: 5000,
        2: 2500,
        3: 1000,
      },
    });

    // Verify transaction was called
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // Verify competition was created with transaction
    expect(competitionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New Competition",
        description: "Test Description",
        crossChainTradingType: "disallowAll",
        sandboxMode: false,
        type: "trading",
        status: "pending",
      }),
      expect.any(Object), // The transaction object
    );

    // Verify rewards were created with transaction
    expect(mockCompetitionRewardService.createRewards).toHaveBeenCalledWith(
      expect.any(String), // Competition ID
      {
        1: 5000,
        2: 2500,
        3: 1000,
      },
      expect.any(Object), // The transaction object
    );

    // Verify constraints were created with transaction
    expect(
      mockTradingConstraintsService.createConstraints,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionId: expect.any(String),
        minimumPairAgeHours: 48,
        minimum24hVolumeUsd: 20000,
        minimumLiquidityUsd: 100000,
        minimumFdvUsd: 200000,
      }),
      expect.any(Object), // The transaction object
    );

    // Verify result structure
    expect(result).toMatchObject({
      name: "New Competition",
      rewards: expect.any(Array),
      tradingConstraints: expect.any(Object),
    });
  });

  test("should create competition without rewards", async () => {
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = {};
      return await callback(mockTx);
    });

    const result = await competitionService.createCompetition({
      name: "No Rewards Competition",
      description: "Test without rewards",
      tradingType: "disallowAll",
    });

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(competitionRepository.create).toHaveBeenCalled();
    expect(mockCompetitionRewardService.createRewards).not.toHaveBeenCalled();
    expect(mockTradingConstraintsService.createConstraints).toHaveBeenCalled();

    expect(result.rewards).toEqual([]);
  });

  test("should rollback transaction when competition creation fails", async () => {
    // Setup the transaction mock to execute the callback
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = {};
      return await callback(mockTx);
    });

    // Make competition creation fail
    vi.mocked(competitionRepository.create).mockRejectedValue(
      new Error("Database error"),
    );

    await expect(
      competitionService.createCompetition({
        name: "Failing Competition",
        description: "This should fail",
      }),
    ).rejects.toThrow("Database error");

    // Verify transaction was attempted
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // Verify that rewards and constraints were not created
    expect(mockCompetitionRewardService.createRewards).not.toHaveBeenCalled();
    expect(
      mockTradingConstraintsService.createConstraints,
    ).not.toHaveBeenCalled();
  });

  test("should rollback transaction when rewards creation fails", async () => {
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = {};
      return await callback(mockTx);
    });

    // Make rewards creation fail
    vi.mocked(mockCompetitionRewardService.createRewards!).mockRejectedValue(
      new Error("Invalid reward rank"),
    );

    await expect(
      competitionService.createCompetition({
        name: "Competition with Bad Rewards",
        description: "Rewards will fail",
        rewards: {
          1: 1000,
          "-1": 500, // Invalid rank
        },
      }),
    ).rejects.toThrow("Invalid reward rank");

    // Verify transaction was attempted
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // Verify competition was created but the whole transaction should roll back
    expect(competitionRepository.create).toHaveBeenCalled();
    expect(mockCompetitionRewardService.createRewards).toHaveBeenCalled();
  });

  test("should rollback transaction when constraints creation fails", async () => {
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = {};
      return await callback(mockTx);
    });

    // Make constraints creation fail
    vi.mocked(
      mockTradingConstraintsService.createConstraints!,
    ).mockRejectedValue(new Error("Invalid constraints"));

    await expect(
      competitionService.createCompetition({
        name: "Competition with Bad Constraints",
        description: "Constraints will fail",
        tradingConstraints: {
          minimumPairAgeHours: -1, // Invalid value
        },
      }),
    ).rejects.toThrow("Invalid constraints");

    // Verify transaction was attempted
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // Verify competition and rewards were created but the whole transaction should roll back
    expect(competitionRepository.create).toHaveBeenCalled();
    expect(mockTradingConstraintsService.createConstraints).toHaveBeenCalled();
  });
});
