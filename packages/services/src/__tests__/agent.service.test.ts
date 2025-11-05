import { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { AgentNonceRepository } from "@recallnet/db/repositories/agent-nonce";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { LeaderboardRepository } from "@recallnet/db/repositories/leaderboard";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import { TradeRepository } from "@recallnet/db/repositories/trade";
import { UserRepository } from "@recallnet/db/repositories/user";
import {
  SelectAgent,
  SelectCompetition,
} from "@recallnet/db/schema/core/types";
import { SelectPortfolioSnapshot } from "@recallnet/db/schema/trading/types";

import { AgentService } from "../agent.service.js";
import { BalanceService } from "../balance.service.js";
import { EmailService } from "../email.service.js";
import { PriceTrackerService } from "../price-tracker.service.js";
import { AgentCompetitionsFilters, PagingParams } from "../types/index.js";
import { UserService } from "../user.service.js";

function createMockCompetition(
  overrides: Partial<SelectCompetition>,
): SelectCompetition {
  const baseCompetition = {
    id: "test-comp-id",
    name: "Test Competition",
    type: "trading" as const,
    status: "active" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    description: null,
    externalUrl: null,
    imageUrl: null,
    startDate: null,
    endDate: null,
    boostStartDate: null,
    boostEndDate: null,
    joinStartDate: null,
    joinEndDate: null,
    sandboxMode: false,
    maxParticipants: null,
    registeredParticipants: 0,
    minimumStake: null,
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
    displayState: null,
    ...overrides,
  };

  // Add engine config and arena based on competition type
  const competitionType = baseCompetition.type;
  if (competitionType === "trading") {
    return {
      ...baseCompetition,
      arenaId: "default-paper-arena",
      engineId: "spot_paper_trading" as const,
      engineVersion: "1.0.0",
    };
  } else if (competitionType === "perpetual_futures") {
    return {
      ...baseCompetition,
      arenaId: "default-perps-arena",
      engineId: "perpetual_futures" as const,
      engineVersion: "1.0.0",
    };
  }

  // Default for any other type
  return {
    ...baseCompetition,
    arenaId: null,
    engineId: null,
    engineVersion: null,
  };
}

describe("AgentService", () => {
  let agentService: AgentService;
  let mockAgentRepo: AgentRepository;
  let mockCompetitionRepo: CompetitionRepository;
  let mockPerpsRepo: PerpsRepository;
  let mockTradeRepo: TradeRepository;
  let mockLogger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAgentRepo = mock<AgentRepository>();
    mockCompetitionRepo = mock<CompetitionRepository>();
    mockPerpsRepo = mock<PerpsRepository>();
    mockTradeRepo = mock<TradeRepository>();
    mockLogger = mockDeep<Logger>();

    agentService = new AgentService(
      mock<EmailService>(),
      mock<BalanceService>(),
      mock<PriceTrackerService>(),
      mock<UserService>(),
      mockAgentRepo,
      mock<AgentNonceRepository>(),
      mockCompetitionRepo,
      mock<LeaderboardRepository>(),
      mockPerpsRepo,
      mockTradeRepo,
      mock<UserRepository>(),
      {
        security: { rootEncryptionKey: "test-key" },
        api: { domain: "test.com" },
      },
      mockLogger,
    );
  });

  describe("getCompetitionsForAgent", () => {
    it("should sort perps competitions by totalPositions", async () => {
      const agentId = "test-agent-id";
      const perpsComp1 = createMockCompetition({
        id: "perps-1",
        name: "Perps Comp 1",
        type: "perpetual_futures",
      });
      const perpsComp2 = createMockCompetition({
        id: "perps-2",
        name: "Perps Comp 2",
        type: "perpetual_futures",
      });

      vi.mocked(mockAgentRepo.findAgentCompetitions).mockResolvedValue({
        competitions: [perpsComp1, perpsComp2],
        total: 2,
        isComputedSort: true,
      });
      vi.mocked(mockCompetitionRepo.getBulkBoundedSnapshots).mockResolvedValue(
        new Map([
          [
            "perps-1",
            {
              oldest: {
                totalValue: "1000",
              } as unknown as SelectPortfolioSnapshot,
              newest: {
                totalValue: "1200",
              } as unknown as SelectPortfolioSnapshot,
            },
          ],
          [
            "perps-2",
            {
              oldest: {
                totalValue: "1000",
              } as unknown as SelectPortfolioSnapshot,
              newest: {
                totalValue: "1100",
              } as unknown as SelectPortfolioSnapshot,
            },
          ],
        ]),
      );
      vi.mocked(
        mockPerpsRepo.countBulkAgentPositionsInCompetitions,
      ).mockResolvedValue(
        new Map([
          ["perps-1", 10],
          ["perps-2", 5],
        ]),
      );
      vi.mocked(
        mockCompetitionRepo.getAgentRankingsInCompetitions,
      ).mockResolvedValue(new Map());
      vi.mocked(mockPerpsRepo.getBulkAgentRiskMetrics).mockResolvedValue(
        new Map(),
      );

      const filters: AgentCompetitionsFilters = {};
      const paging: PagingParams = {
        sort: "-totalPositions",
        limit: 10,
        offset: 0,
      };

      const result = await agentService.getCompetitionsForAgent(
        agentId,
        filters,
        paging,
      );

      expect(result.competitions).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.competitions[0]!.id).toBe("perps-1");
      expect(result.competitions[1]!.id).toBe("perps-2");

      for (const comp of result.competitions) {
        expect(comp.totalPositions).toBeDefined();
        expect(comp.totalTrades).toBe(0);
      }
    });

    it("should sort paper trading competitions by totalTrades", async () => {
      const agentId = "test-agent-id";
      const paperComp1 = createMockCompetition({
        id: "paper-1",
        name: "Paper Comp 1",
        type: "trading",
      });
      const paperComp2 = createMockCompetition({
        id: "paper-2",
        name: "Paper Comp 2",
        type: "trading",
      });

      vi.mocked(mockAgentRepo.findAgentCompetitions).mockResolvedValue({
        competitions: [paperComp1, paperComp2],
        total: 2,
        isComputedSort: true,
      });

      vi.mocked(mockCompetitionRepo.getBulkBoundedSnapshots).mockResolvedValue(
        new Map([
          [
            "paper-1",
            {
              oldest: {
                totalValue: "1000",
              } as unknown as SelectPortfolioSnapshot,
              newest: {
                totalValue: "1500",
              } as unknown as SelectPortfolioSnapshot,
            },
          ],
          [
            "paper-2",
            {
              oldest: {
                totalValue: "1000",
              } as unknown as SelectPortfolioSnapshot,
              newest: {
                totalValue: "1300",
              } as unknown as SelectPortfolioSnapshot,
            },
          ],
        ]),
      );
      vi.mocked(
        mockTradeRepo.countBulkAgentTradesInCompetitions,
      ).mockResolvedValue(
        new Map([
          ["paper-1", 25],
          ["paper-2", 15],
        ]),
      );
      vi.mocked(
        mockCompetitionRepo.getAgentRankingsInCompetitions,
      ).mockResolvedValue(new Map());

      const filters: AgentCompetitionsFilters = {};
      const paging: PagingParams = {
        sort: "-totalTrades",
        limit: 10,
        offset: 0,
      };

      const result = await agentService.getCompetitionsForAgent(
        agentId,
        filters,
        paging,
      );

      expect(result.competitions).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.competitions[0]!.id).toBe("paper-1");
      expect(result.competitions[1]!.id).toBe("paper-2");

      for (const comp of result.competitions) {
        expect(comp.totalTrades).toBeDefined();
        expect(comp.totalPositions).toBe(0);
      }
    });

    it("should sort mixed competitions by totalPositions", async () => {
      const agentId = "test-agent-id";
      const perpsComp1 = createMockCompetition({
        id: "perps-1",
        name: "Perps Competition 1",
        type: "perpetual_futures",
      });
      const perpsComp2 = createMockCompetition({
        id: "perps-2",
        name: "Perps Competition 2",
        type: "perpetual_futures",
      });
      const paperComp1 = createMockCompetition({
        id: "paper-1",
        name: "Paper Trading Competition 1",
        type: "trading",
      });
      const paperComp2 = createMockCompetition({
        id: "paper-2",
        name: "Paper Trading Competition 2",
        type: "trading",
      });

      vi.mocked(mockAgentRepo.findAgentCompetitions).mockResolvedValue({
        competitions: [perpsComp1, perpsComp2, paperComp1, paperComp2],
        total: 4,
        isComputedSort: true,
      });

      vi.mocked(mockCompetitionRepo.getBulkBoundedSnapshots).mockResolvedValue(
        new Map([
          [
            "perps-1",
            {
              oldest: {
                totalValue: "1000",
              } as unknown as SelectPortfolioSnapshot,
              newest: {
                totalValue: "1200",
              } as unknown as SelectPortfolioSnapshot,
            },
          ],
          [
            "perps-2",
            {
              oldest: {
                totalValue: "1000",
              } as unknown as SelectPortfolioSnapshot,
              newest: {
                totalValue: "1150",
              } as unknown as SelectPortfolioSnapshot,
            },
          ],
          [
            "paper-1",
            {
              oldest: {
                totalValue: "1000",
              } as unknown as SelectPortfolioSnapshot,
              newest: {
                totalValue: "1300",
              } as unknown as SelectPortfolioSnapshot,
            },
          ],
          [
            "paper-2",
            {
              oldest: {
                totalValue: "1000",
              } as unknown as SelectPortfolioSnapshot,
              newest: {
                totalValue: "1250",
              } as unknown as SelectPortfolioSnapshot,
            },
          ],
        ]),
      );
      vi.mocked(
        mockTradeRepo.countBulkAgentTradesInCompetitions,
      ).mockResolvedValue(
        new Map([
          ["paper-1", 20],
          ["paper-2", 15],
        ]),
      );
      vi.mocked(
        mockPerpsRepo.countBulkAgentPositionsInCompetitions,
      ).mockResolvedValue(
        new Map([
          ["perps-1", 12],
          ["perps-2", 5],
        ]),
      );
      vi.mocked(
        mockCompetitionRepo.getAgentRankingsInCompetitions,
      ).mockResolvedValue(new Map());
      vi.mocked(mockPerpsRepo.getBulkAgentRiskMetrics).mockResolvedValue(
        new Map(),
      );

      const filters: AgentCompetitionsFilters = {};
      const paging: PagingParams = {
        sort: "-totalPositions",
        limit: 10,
        offset: 0,
      };

      const result = await agentService.getCompetitionsForAgent(
        agentId,
        filters,
        paging,
      );

      expect(result.competitions).toHaveLength(4);
      expect(result.total).toBe(4);
      expect(result.competitions[0]!.id).toBe("perps-1");
      expect(result.competitions[1]!.id).toBe("perps-2");
      expect(result.competitions[2]!.id).toBe("paper-1");
      expect(result.competitions[3]!.id).toBe("paper-2");

      for (const comp of result.competitions) {
        expect(comp.totalPositions).toBeDefined();
        expect(comp.totalTrades).toBeDefined();
      }
    });

    it("should sort mixed competitions by totalTrades", async () => {
      const agentId = "test-agent-id";
      const perpsComp1 = createMockCompetition({
        id: "perps-1",
        name: "Perps Competition 1",
        type: "perpetual_futures",
      });
      const perpsComp2 = createMockCompetition({
        id: "perps-2",
        name: "Perps Competition 2",
        type: "perpetual_futures",
      });
      const paperComp1 = createMockCompetition({
        id: "paper-1",
        name: "Paper Trading Competition 1",
        type: "trading",
      });
      const paperComp2 = createMockCompetition({
        id: "paper-2",
        name: "Paper Trading Competition 2",
        type: "trading",
      });

      vi.mocked(mockAgentRepo.findAgentCompetitions).mockResolvedValue({
        competitions: [perpsComp1, perpsComp2, paperComp1, paperComp2],
        total: 4,
        isComputedSort: true,
      });

      vi.mocked(mockCompetitionRepo.getBulkBoundedSnapshots).mockResolvedValue(
        new Map([
          [
            "perps-1",
            {
              oldest: {
                totalValue: "1000",
              } as unknown as SelectPortfolioSnapshot,
              newest: {
                totalValue: "1200",
              } as unknown as SelectPortfolioSnapshot,
            },
          ],
          [
            "perps-2",
            {
              oldest: {
                totalValue: "1000",
              } as unknown as SelectPortfolioSnapshot,
              newest: {
                totalValue: "1150",
              } as unknown as SelectPortfolioSnapshot,
            },
          ],
          [
            "paper-1",
            {
              oldest: {
                totalValue: "1000",
              } as unknown as SelectPortfolioSnapshot,
              newest: {
                totalValue: "1300",
              } as unknown as SelectPortfolioSnapshot,
            },
          ],
          [
            "paper-2",
            {
              oldest: {
                totalValue: "1000",
              } as unknown as SelectPortfolioSnapshot,
              newest: {
                totalValue: "1250",
              } as unknown as SelectPortfolioSnapshot,
            },
          ],
        ]),
      );
      vi.mocked(
        mockTradeRepo.countBulkAgentTradesInCompetitions,
      ).mockResolvedValue(
        new Map([
          ["paper-1", 25],
          ["paper-2", 18],
        ]),
      );
      vi.mocked(
        mockPerpsRepo.countBulkAgentPositionsInCompetitions,
      ).mockResolvedValue(
        new Map([
          ["perps-1", 10],
          ["perps-2", 7],
        ]),
      );
      vi.mocked(
        mockCompetitionRepo.getAgentRankingsInCompetitions,
      ).mockResolvedValue(new Map());
      vi.mocked(mockPerpsRepo.getBulkAgentRiskMetrics).mockResolvedValue(
        new Map(),
      );

      const filters: AgentCompetitionsFilters = {};
      const paging: PagingParams = {
        sort: "-totalTrades",
        limit: 10,
        offset: 0,
      };

      const result = await agentService.getCompetitionsForAgent(
        agentId,
        filters,
        paging,
      );

      expect(result.competitions).toHaveLength(4);
      expect(result.total).toBe(4);
      expect(result.competitions[0]!.id).toBe("paper-1");
      expect(result.competitions[1]!.id).toBe("paper-2");
      expect(result.competitions[2]!.id).toBe("perps-1");
      expect(result.competitions[3]!.id).toBe("perps-2");

      for (const comp of result.competitions) {
        expect(comp.totalTrades).toBeDefined();
        expect(comp.totalPositions).toBeDefined();
      }
    });
  });

  describe("deactivateAgent", () => {
    it("should successfully deactivate an agent", async () => {
      const agentId = "test-agent-id";
      const reason = "Terms of service violation";
      const mockDeactivatedAgent = {
        id: agentId,
        name: "Test Agent",
        status: "inactive",
        deactivationReason: reason,
        deactivationDate: new Date(),
      } as unknown as SelectAgent;

      vi.mocked(mockAgentRepo.deactivateAgent).mockResolvedValue(
        mockDeactivatedAgent,
      );

      const result = await agentService.deactivateAgent(agentId, reason);

      expect(result).toEqual(mockDeactivatedAgent);
      expect(mockAgentRepo.deactivateAgent).toHaveBeenCalledWith(
        agentId,
        reason,
      );
    });

    it("should throw error when agent not found", async () => {
      const agentId = "nonexistent-agent-id";
      const reason = "Test reason";

      vi.mocked(mockAgentRepo.deactivateAgent).mockRejectedValue(
        new Error("Failed to deactivate agent - no result returned"),
      );

      await expect(
        agentService.deactivateAgent(agentId, reason),
      ).rejects.toThrow("Failed to deactivate agent");
    });
  });

  describe("reactivateAgent", () => {
    it("should successfully reactivate an agent", async () => {
      const agentId = "test-agent-id";
      const mockReactivatedAgent = {
        id: agentId,
        name: "Test Agent",
        status: "active",
        deactivationReason: null,
        deactivationDate: null,
      } as unknown as SelectAgent;

      vi.mocked(mockAgentRepo.reactivateAgent).mockResolvedValue(
        mockReactivatedAgent,
      );

      const result = await agentService.reactivateAgent(agentId);

      expect(result).toEqual(mockReactivatedAgent);
      expect(mockAgentRepo.reactivateAgent).toHaveBeenCalledWith(agentId);
    });

    it("should throw error when agent not found", async () => {
      const agentId = "nonexistent-agent-id";

      vi.mocked(mockAgentRepo.reactivateAgent).mockRejectedValue(
        new Error("Failed to reactivate agent - no result returned"),
      );

      await expect(agentService.reactivateAgent(agentId)).rejects.toThrow(
        "Failed to reactivate agent",
      );
    });
  });

  describe("deleteAgent", () => {
    it("should successfully delete an agent and return true", async () => {
      const agentId = "test-agent-id";
      const mockAgent = {
        id: agentId,
        name: "Test Agent",
        apiKey: "encrypted-key",
      } as unknown as SelectAgent;

      vi.mocked(mockAgentRepo.findById).mockResolvedValue(mockAgent);
      vi.mocked(mockAgentRepo.deleteAgent).mockResolvedValue(true);

      const result = await agentService.deleteAgent(agentId);

      expect(result).toBe(true);
      expect(mockAgentRepo.findById).toHaveBeenCalledWith(agentId);
      expect(mockAgentRepo.deleteAgent).toHaveBeenCalledWith(agentId);
    });

    it("should return false when agent not found", async () => {
      const agentId = "nonexistent-agent-id";

      vi.mocked(mockAgentRepo.findById).mockResolvedValue(undefined);

      const result = await agentService.deleteAgent(agentId);

      expect(result).toBe(false);
      expect(mockAgentRepo.findById).toHaveBeenCalledWith(agentId);
      expect(mockAgentRepo.deleteAgent).not.toHaveBeenCalled();
    });

    it("should return false when deletion fails", async () => {
      const agentId = "test-agent-id";
      const mockAgent = {
        id: agentId,
        name: "Test Agent",
        apiKey: "encrypted-key",
      } as unknown as SelectAgent;

      vi.mocked(mockAgentRepo.findById).mockResolvedValue(mockAgent);
      vi.mocked(mockAgentRepo.deleteAgent).mockResolvedValue(false);

      const result = await agentService.deleteAgent(agentId);

      expect(result).toBe(false);
    });

    it("should throw error when deletion encounters unexpected error", async () => {
      const agentId = "test-agent-id";
      const mockAgent = {
        id: agentId,
        name: "Test Agent",
        apiKey: "encrypted-key",
      } as unknown as SelectAgent;

      vi.mocked(mockAgentRepo.findById).mockResolvedValue(mockAgent);
      vi.mocked(mockAgentRepo.deleteAgent).mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(agentService.deleteAgent(agentId)).rejects.toThrow(
        "Failed to delete agent",
      );
    });
  });

  describe("getAgentPerformanceForComp", () => {
    it("should calculate performance metrics with profit", async () => {
      const agentId = "test-agent-id";
      const competitionId = "test-comp-id";

      vi.mocked(mockCompetitionRepo.getBoundedSnapshots).mockResolvedValue({
        oldest: { totalValue: "1000" } as unknown as SelectPortfolioSnapshot,
        newest: { totalValue: "1500" } as unknown as SelectPortfolioSnapshot,
      });

      const result = await agentService.getAgentPerformanceForComp(
        agentId,
        competitionId,
      );

      expect(result.portfolioValue).toBe(1500);
      expect(result.startingValue).toBe(1000);
      expect(result.pnl).toBe(500);
      expect(result.pnlPercent).toBe(50);
    });

    it("should calculate performance metrics with loss", async () => {
      const agentId = "test-agent-id";
      const competitionId = "test-comp-id";

      vi.mocked(mockCompetitionRepo.getBoundedSnapshots).mockResolvedValue({
        oldest: { totalValue: "1000" } as unknown as SelectPortfolioSnapshot,
        newest: { totalValue: "800" } as unknown as SelectPortfolioSnapshot,
      });

      const result = await agentService.getAgentPerformanceForComp(
        agentId,
        competitionId,
      );

      expect(result.portfolioValue).toBe(800);
      expect(result.startingValue).toBe(1000);
      expect(result.pnl).toBe(-200);
      expect(result.pnlPercent).toBe(-20);
    });

    it("should handle zero starting value", async () => {
      const agentId = "test-agent-id";
      const competitionId = "test-comp-id";

      vi.mocked(mockCompetitionRepo.getBoundedSnapshots).mockResolvedValue({
        oldest: { totalValue: "0" } as unknown as SelectPortfolioSnapshot,
        newest: { totalValue: "500" } as unknown as SelectPortfolioSnapshot,
      });

      const result = await agentService.getAgentPerformanceForComp(
        agentId,
        competitionId,
      );

      expect(result.portfolioValue).toBe(500);
      expect(result.startingValue).toBe(0);
      expect(result.pnl).toBe(500);
      expect(result.pnlPercent).toBe(0);
    });

    it("should handle no snapshots", async () => {
      const agentId = "test-agent-id";
      const competitionId = "test-comp-id";

      vi.mocked(mockCompetitionRepo.getBoundedSnapshots).mockResolvedValue(
        null,
      );

      const result = await agentService.getAgentPerformanceForComp(
        agentId,
        competitionId,
      );

      expect(result.portfolioValue).toBe(0);
      expect(result.startingValue).toBe(0);
      expect(result.pnl).toBe(0);
      expect(result.pnlPercent).toBe(0);
    });
  });
});
