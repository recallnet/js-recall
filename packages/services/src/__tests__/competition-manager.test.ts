import { randomUUID } from "crypto";
import { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import { StakesRepository } from "@recallnet/db/repositories/stakes";
import { CompetitionAgentStatus } from "@recallnet/db/repositories/types";
import { UserRepository } from "@recallnet/db/repositories/user";
import {
  SelectAgentWithCompetitionStatus,
  SelectCompetition,
  SelectCompetitionReward,
  UpdateCompetition,
} from "@recallnet/db/schema/core/types";
import {
  InsertTradingConstraints,
  SelectTradingCompetition,
  SelectTradingConstraints,
} from "@recallnet/db/schema/trading/types";
import { Database, Transaction } from "@recallnet/db/types";

import type { AgentService } from "../agent.service.js";
import type { AgentRankService } from "../agentrank.service.js";
import type { BalanceService } from "../balance.service.js";
import type { CompetitionRewardService } from "../competition-reward.service.js";
import { CompetitionService } from "../competition.service.js";
import type { PerpsDataProcessor } from "../perps-data-processor.service.js";
import type { PortfolioSnapshotterService } from "../portfolio-snapshotter.service.js";
import { RewardsService } from "../rewards.service.js";
import type { TradeSimulatorService } from "../trade-simulator.service.js";
import type { TradingConstraintsService } from "../trading-constraints.service.js";

/**
 * Mock an agent with competition status and deactivation reason
 * @param id - Agent ID
 * @param name - Agent name
 * @param handle - Agent handle
 * @param competitionStatus - Competition status
 * @param competitionDeactivationReason - Competition deactivation reason
 * @returns Mocked agent
 */
function mockAgent({
  id = randomUUID(),
  name,
  handle,
  competitionStatus = "active",
  competitionDeactivationReason = null,
}: {
  id?: string;
  name: string;
  handle: string;
  competitionStatus?: CompetitionAgentStatus;
  competitionDeactivationReason?: string | null;
}): SelectAgentWithCompetitionStatus {
  return {
    id,
    name,
    email: null,
    metadata: null,
    handle,
    description: null,
    imageUrl: null,
    status: "active" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    walletAddress: null,
    ownerId: randomUUID(),
    apiKey: "mock-api-key-1",
    apiKeyHash: null,
    deactivationReason: null,
    deactivationDate: null,
    competitionStatus,
    competitionDeactivationReason,
  };
}

describe("CompetitionService", () => {
  let competitionService: CompetitionService;
  let balanceService: MockProxy<BalanceService>;
  let tradeSimulatorService: MockProxy<TradeSimulatorService>;
  let portfolioSnapshotterService: MockProxy<PortfolioSnapshotterService>;
  let agentService: MockProxy<AgentService>;
  let agentRankService: MockProxy<AgentRankService>;
  let tradingConstraintsService: MockProxy<TradingConstraintsService>;
  let competitionRewardService: MockProxy<CompetitionRewardService>;
  let rewardsService: MockProxy<RewardsService>;
  let perpsDataProcessor: MockProxy<PerpsDataProcessor>;
  let agentRepo: MockProxy<AgentRepository>;
  let agentScoreRepo: MockProxy<AgentScoreRepository>;
  let perpsRepo: MockProxy<PerpsRepository>;
  let competitionRepo: MockProxy<CompetitionRepository>;
  let stakesRepo: MockProxy<StakesRepository>;
  let userRepo: MockProxy<UserRepository>;
  let mockDb: MockProxy<Database>;
  let logger: MockProxy<Logger>;

  const mockTx = mock<Transaction>();

  const mockCompeitionId = randomUUID();
  const mockCompetition: SelectCompetition & SelectTradingCompetition = {
    id: mockCompeitionId,
    name: "Test Competition",
    description: "Test Description",
    type: "trading",
    status: "active",
    startDate: new Date(),
    endDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    imageUrl: null,
    externalUrl: null,
    boostStartDate: null,
    boostEndDate: null,
    joinStartDate: null,
    joinEndDate: null,
    maxParticipants: null,
    registeredParticipants: 0,
    minimumStake: null,
    sandboxMode: false,
    competitionId: mockCompeitionId,
    crossChainTradingType: "allow",
  };

  const mockRewards: SelectCompetitionReward[] = [
    {
      id: randomUUID(),
      competitionId: mockCompetition.id,
      rank: 1,
      reward: 1000,
      agentId: null,
    },
    {
      id: randomUUID(),
      competitionId: mockCompetition.id,
      rank: 2,
      reward: 500,
      agentId: null,
    },
  ];

  const mockConstraints: SelectTradingConstraints = {
    competitionId: mockCompetition.id,
    minimumPairAgeHours: 24,
    minimum24hVolumeUsd: 10000,
    minimumLiquidityUsd: 50000,
    minimumFdvUsd: 100000,
    minTradesPerDay: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    balanceService = mock<BalanceService>();
    tradeSimulatorService = mock<TradeSimulatorService>();
    portfolioSnapshotterService = mock<PortfolioSnapshotterService>();
    agentService = mock<AgentService>();
    agentRankService = mock<AgentRankService>();
    tradingConstraintsService = mock<TradingConstraintsService>();
    competitionRewardService = mock<CompetitionRewardService>();
    rewardsService = mock<RewardsService>();
    perpsDataProcessor = mock<PerpsDataProcessor>();
    agentRepo = mock<AgentRepository>();
    agentScoreRepo = mock<AgentScoreRepository>();
    perpsRepo = mock<PerpsRepository>();
    competitionRepo = mock<CompetitionRepository>();
    stakesRepo = mock<StakesRepository>();
    userRepo = mock<UserRepository>();
    mockDb = mock<Database>();
    logger = mock<Logger>();

    // Setup default mock return values
    competitionRewardService.replaceRewards.mockResolvedValue(mockRewards);
    tradingConstraintsService.updateConstraints.mockResolvedValue(
      mockConstraints,
    );
    competitionRepo.findById.mockResolvedValue(mockCompetition);
    competitionRepo.updateOne.mockResolvedValue(mockCompetition);

    // Create competition service instance with all mocked dependencies
    competitionService = new CompetitionService(
      balanceService,
      tradeSimulatorService,
      portfolioSnapshotterService,
      agentService,
      agentRankService,
      tradingConstraintsService,
      competitionRewardService,
      rewardsService,
      perpsDataProcessor,
      agentRepo,
      agentScoreRepo,
      perpsRepo,
      competitionRepo,
      stakesRepo,
      userRepo,
      mockDb,
      {
        evmChains: [
          "eth",
          "polygon",
          "bsc",
          "arbitrum",
          "base",
          "optimism",
          "avalanche",
          "linea",
        ],
        maxTradePercentage: 25,
        rateLimiting: { windowMs: 60000, maxRequests: 100 },
        specificChainBalances: { eth: { eth: 1 } },
      },
      logger,
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("updateCompetition", () => {
    it("should update competition atomically with all components", async () => {
      const competitionId = mockCompetition.id;
      const updates: UpdateCompetition = {
        name: "Updated Competition",
        description: "Updated Description",
      };
      const tradingConstraints: Partial<InsertTradingConstraints> = {
        minimumPairAgeHours: 48,
        minimum24hVolumeUsd: 20000,
      };
      const rewards = {
        1: 2000,
        2: 1000,
        3: 500,
      };

      // Mock transaction to execute the callback immediately
      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockTx);
      });

      const result = await competitionService.updateCompetition(
        competitionId,
        updates,
        tradingConstraints,
        rewards,
      );

      // Verify transaction was called
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);

      // Verify all operations were called with transaction
      expect(competitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        updates,
        mockTx,
      );

      expect(tradingConstraintsService.updateConstraints).toHaveBeenCalledWith(
        competitionId,
        tradingConstraints,
        mockTx,
      );

      expect(competitionRewardService.replaceRewards).toHaveBeenCalledWith(
        competitionId,
        rewards,
        mockTx,
      );

      // Verify result
      expect(result).toEqual({
        competition: mockCompetition,
        updatedRewards: mockRewards,
      });
    });

    it("should update only competition details when no constraints or rewards provided", async () => {
      const competitionId = mockCompetition.id;
      const updates: UpdateCompetition = {
        name: "Updated Competition Only",
      };

      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockTx);
      });

      const result = await competitionService.updateCompetition(
        competitionId,
        updates,
      );

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(competitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        updates,
        mockTx,
      );

      // Verify constraints and rewards services were not called
      expect(
        tradingConstraintsService.updateConstraints,
      ).not.toHaveBeenCalled();
      expect(competitionRewardService.replaceRewards).not.toHaveBeenCalled();

      expect(result).toEqual({
        competition: mockCompetition,
        updatedRewards: [],
      });
    });

    it("should update only rewards when provided", async () => {
      const competitionId = mockCompetition.id;
      const rewards = {
        1: 5000,
        2: 2500,
      };

      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockTx);
      });

      const result = await competitionService.updateCompetition(
        competitionId,
        {},
        undefined,
        rewards,
      );

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);

      // Competition should still be updated (even with empty updates for updatedAt)
      expect(competitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        {},
        mockTx,
      );

      expect(competitionRewardService.replaceRewards).toHaveBeenCalledWith(
        competitionId,
        rewards,
        mockTx,
      );

      expect(
        tradingConstraintsService.updateConstraints,
      ).not.toHaveBeenCalled();

      expect(result.updatedRewards).toEqual(mockRewards);
    });

    it("should rollback transaction when competition update fails", async () => {
      const competitionId = mockCompetition.id;
      const updates: UpdateCompetition = {
        name: "Updated Competition",
      };

      const updateError = new Error("Database update failed");
      competitionRepo.updateOne.mockRejectedValue(updateError);

      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockTx);
      });

      await expect(
        competitionService.updateCompetition(competitionId, updates),
      ).rejects.toThrow("Database update failed");

      // Verify transaction was attempted
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);

      // Verify other services were not called due to early failure
      expect(
        tradingConstraintsService.updateConstraints,
      ).not.toHaveBeenCalled();
      expect(competitionRewardService.replaceRewards).not.toHaveBeenCalled();
    });

    it("should rollback transaction when rewards update fails", async () => {
      const competitionId = mockCompetition.id;
      const updates: UpdateCompetition = {
        name: "Updated Competition",
      };
      const rewards = {
        1: 1000,
        2: 500,
      };

      const rewardsError = new Error("Rewards update failed");
      competitionRewardService.replaceRewards.mockRejectedValue(rewardsError);

      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockTx);
      });

      await expect(
        competitionService.updateCompetition(
          competitionId,
          updates,
          undefined,
          rewards,
        ),
      ).rejects.toThrow("Rewards update failed");

      // Verify all operations up to the failure were called
      expect(competitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        updates,
        mockTx,
      );

      expect(competitionRewardService.replaceRewards).toHaveBeenCalledWith(
        competitionId,
        rewards,
        mockTx,
      );
    });

    it("should rollback transaction when trading constraints update fails", async () => {
      const competitionId = mockCompetition.id;
      const updates: UpdateCompetition = {
        name: "Updated Competition",
      };
      const tradingConstraints: Partial<InsertTradingConstraints> = {
        minimumPairAgeHours: 48,
      };

      const constraintsError = new Error("Constraints update failed");
      tradingConstraintsService.updateConstraints.mockRejectedValue(
        constraintsError,
      );

      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockTx);
      });

      await expect(
        competitionService.updateCompetition(
          competitionId,
          updates,
          tradingConstraints,
        ),
      ).rejects.toThrow("Constraints update failed");

      // Verify operations were called before failure
      expect(competitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        updates,
        mockTx,
      );

      expect(tradingConstraintsService.updateConstraints).toHaveBeenCalledWith(
        competitionId,
        tradingConstraints,
        mockTx,
      );

      // Rewards should not be called since constraints failed first
      expect(competitionRewardService.replaceRewards).not.toHaveBeenCalled();
    });

    it("should handle competition not found error", async () => {
      const competitionId = "non-existent-id";
      competitionRepo.findById.mockResolvedValue(undefined);

      await expect(
        competitionService.updateCompetition(competitionId, { name: "Test" }),
      ).rejects.toThrow(`Competition not found: ${competitionId}`);

      // Transaction should not be started if competition doesn't exist
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("should handle empty updates gracefully", async () => {
      const competitionId = mockCompetition.id;

      mockDb.transaction.mockImplementation(async (callback) => {
        return await callback(mockTx);
      });

      const result = await competitionService.updateCompetition(
        competitionId,
        {}, // Empty updates
      );

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(competitionRepo.updateOne).toHaveBeenCalledWith(
        competitionId,
        {},
        mockTx,
      );

      expect(result).toEqual({
        competition: mockCompetition,
        updatedRewards: [],
      });
    });
  });

  describe("getCompetitionAgentsWithMetrics", () => {
    it("should assign last-place rank to inactive agents", async () => {
      const competitionId = mockCompetition.id;

      // Create mock agents - 3 active, 2 inactive
      const mockAgents: SelectAgentWithCompetitionStatus[] = [
        mockAgent({ id: "agent-1", name: "Agent 1", handle: "agent1" }),
        mockAgent({ id: "agent-2", name: "Agent 2", handle: "agent2" }),
        mockAgent({ id: "agent-3", name: "Agent 3", handle: "agent3" }),
        mockAgent({
          id: "agent-4",
          name: "Agent 4",
          handle: "agent4",
          competitionStatus: "disqualified",
          competitionDeactivationReason: "Disqualified",
        }),
        mockAgent({
          id: "agent-5",
          name: "Agent 5",
          handle: "agent5",
          competitionStatus: "withdrawn",
          competitionDeactivationReason: "Withdrawn",
        }),
      ];

      // Mock leaderboard - only active agents appear with scores
      const mockLeaderboard = [
        {
          agentId: "agent-1",
          value: 150000,
          calmarRatio: null,
          sortinoRatio: null,
          simpleReturn: null,
          maxDrawdown: null,
          downsideDeviation: null,
          hasRiskMetrics: false,
        },
        {
          agentId: "agent-2",
          value: 125000,
          calmarRatio: null,
          sortinoRatio: null,
          simpleReturn: null,
          maxDrawdown: null,
          downsideDeviation: null,
          hasRiskMetrics: false,
        },
        {
          agentId: "agent-3",
          value: 110000,
          calmarRatio: null,
          sortinoRatio: null,
          simpleReturn: null,
          maxDrawdown: null,
          downsideDeviation: null,
          hasRiskMetrics: false,
        },
      ];

      agentRepo.findByCompetition.mockResolvedValue({
        agents: mockAgents,
        total: 5,
      });

      vi.spyOn(
        competitionService as unknown as {
          getLeaderboard: (
            competitionId: string,
          ) => Promise<typeof mockLeaderboard>;
        },
        "getLeaderboard",
      ).mockResolvedValue(mockLeaderboard);

      vi.spyOn(
        competitionService as unknown as {
          calculateBulkAgentMetrics: (
            competitionId: string,
            agentIds: string[],
            currentValues: Map<string, number>,
          ) => Promise<
            Map<
              string,
              {
                pnl: number;
                pnlPercent: number;
                change24h: number;
                change24hPercent: number;
              }
            >
          >;
        },
        "calculateBulkAgentMetrics",
      ).mockResolvedValue(
        new Map([
          [
            "agent-1",
            {
              pnl: 50000,
              pnlPercent: 50,
              change24h: 1000,
              change24hPercent: 0.67,
            },
          ],
          [
            "agent-2",
            {
              pnl: 25000,
              pnlPercent: 25,
              change24h: 500,
              change24hPercent: 0.4,
            },
          ],
          [
            "agent-3",
            {
              pnl: 10000,
              pnlPercent: 10,
              change24h: 200,
              change24hPercent: 0.18,
            },
          ],
          [
            "agent-4",
            { pnl: 0, pnlPercent: 0, change24h: 0, change24hPercent: 0 },
          ],
          [
            "agent-5",
            { pnl: 0, pnlPercent: 0, change24h: 0, change24hPercent: 0 },
          ],
        ]),
      );

      const result = await competitionService.getCompetitionAgentsWithMetrics(
        competitionId,
        {
          sort: "rank",
          limit: 10,
          offset: 0,
          includeInactive: true,
        },
      );
      expect(result.agents).toHaveLength(5);
      expect(result.total).toBe(5);

      // Verify rankings
      const activeAgents = result.agents.filter((a) => a.active);
      const inactiveAgents = result.agents.filter((a) => !a.active);
      expect(activeAgents).toHaveLength(3);
      expect(inactiveAgents).toHaveLength(2);
      const activeRanks = activeAgents.map((a) => a.rank).sort((a, b) => a - b);
      expect(activeRanks).toEqual([1, 2, 3]);
      for (const inactiveAgent of inactiveAgents) {
        expect(inactiveAgent.rank).toBe(5);
        expect(inactiveAgent.active).toBe(false);
        expect(inactiveAgent.deactivationReason).toBeTruthy();
      }
    });

    it("should handle all agents being inactive", async () => {
      const competitionId = mockCompetition.id;

      const mockAgents: SelectAgentWithCompetitionStatus[] = [
        mockAgent({
          name: "Agent 1",
          handle: "agent1",
          competitionStatus: "withdrawn",
        }),
        mockAgent({
          name: "Agent 2",
          handle: "agent2",
          competitionStatus: "disqualified",
        }),
      ];

      agentRepo.findByCompetition.mockResolvedValue({
        agents: mockAgents,
        total: 2,
      });

      vi.spyOn(
        competitionService as unknown as {
          getLeaderboard: (competitionId: string) => Promise<[]>;
        },
        "getLeaderboard",
      ).mockResolvedValue([]);
      vi.spyOn(
        competitionService as unknown as {
          calculateBulkAgentMetrics: (
            competitionId: string,
            agentIds: string[],
            currentValues: Map<string, number>,
          ) => Promise<Map<string, unknown>>;
        },
        "calculateBulkAgentMetrics",
      ).mockResolvedValue(new Map());

      const result = await competitionService.getCompetitionAgentsWithMetrics(
        competitionId,
        {
          sort: "rank",
          limit: 10,
          offset: 0,
          includeInactive: true,
        },
      );

      // All agents should have last-place rank
      expect(result.agents).toHaveLength(2);
      for (const agent of result.agents) {
        expect(agent.rank).toBe(2); // Total number of agents
        expect(agent.active).toBe(false);
      }
    });

    it("should handle all agents being active", async () => {
      const competitionId = mockCompetition.id;

      const mockAgents: SelectAgentWithCompetitionStatus[] = [
        mockAgent({
          id: "agent-1",
          name: "Agent 1",
          handle: "agent1",
          competitionStatus: "active",
        }),
        mockAgent({
          id: "agent-2",
          name: "Agent 2",
          handle: "agent2",
          competitionStatus: "active",
        }),
      ];

      const mockLeaderboard = [
        {
          agentId: "agent-1",
          value: 125000,
          calmarRatio: null,
          sortinoRatio: null,
          simpleReturn: null,
          maxDrawdown: null,
          downsideDeviation: null,
          hasRiskMetrics: false,
        },
        {
          agentId: "agent-2",
          value: 110000,
          calmarRatio: null,
          sortinoRatio: null,
          simpleReturn: null,
          maxDrawdown: null,
          downsideDeviation: null,
          hasRiskMetrics: false,
        },
      ];

      agentRepo.findByCompetition.mockResolvedValue({
        agents: mockAgents,
        total: 2,
      });

      vi.spyOn(
        competitionService as unknown as {
          getLeaderboard: (
            competitionId: string,
          ) => Promise<typeof mockLeaderboard>;
        },
        "getLeaderboard",
      ).mockResolvedValue(mockLeaderboard);
      vi.spyOn(
        competitionService as unknown as {
          calculateBulkAgentMetrics: (
            competitionId: string,
            agentIds: string[],
            currentValues: Map<string, number>,
          ) => Promise<Map<string, unknown>>;
        },
        "calculateBulkAgentMetrics",
      ).mockResolvedValue(new Map());

      const result = await competitionService.getCompetitionAgentsWithMetrics(
        competitionId,
        {
          sort: "rank",
          limit: 10,
          offset: 0,
          includeInactive: false,
        },
      );

      expect(result.agents).toHaveLength(2);
      expect(result.agents[0]?.rank).toBe(1);
      expect(result.agents[1]?.rank).toBe(2);
      expect(result.agents[0]?.active).toBe(true);
      expect(result.agents[1]?.active).toBe(true);
    });
  });
});
