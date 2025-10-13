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
import { SelectCompetition } from "@recallnet/db/schema/core/types";

import { AgentService } from "../agent.service.js";
import { BalanceService } from "../balance.service.js";
import { EmailService } from "../email.service.js";
import { PriceTrackerService } from "../price-tracker.service.js";
import { AgentCompetitionsFilters, PagingParams } from "../types/index.js";
import { UserService } from "../user.service.js";

function createMockCompetition(
  overrides: Partial<SelectCompetition>,
): SelectCompetition {
  return {
    id: "test-comp-id",
    name: "Test Competition",
    type: "trading",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    description: null,
    externalUrl: null,
    imageUrl: null,
    startDate: null,
    endDate: null,
    votingStartDate: null,
    votingEndDate: null,
    joinStartDate: null,
    joinEndDate: null,
    sandboxMode: false,
    maxParticipants: null,
    registeredParticipants: 0,
    ...overrides,
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
              oldest: { totalValue: "1000" } as never,
              newest: { totalValue: "1200" } as never,
            },
          ],
          [
            "perps-2",
            {
              oldest: { totalValue: "1000" } as never,
              newest: { totalValue: "1100" } as never,
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
              oldest: { totalValue: "1000" } as never,
              newest: { totalValue: "1500" } as never,
            },
          ],
          [
            "paper-2",
            {
              oldest: { totalValue: "1000" } as never,
              newest: { totalValue: "1300" } as never,
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
              oldest: { totalValue: "1000" } as never,
              newest: { totalValue: "1200" } as never,
            },
          ],
          [
            "perps-2",
            {
              oldest: { totalValue: "1000" } as never,
              newest: { totalValue: "1150" } as never,
            },
          ],
          [
            "paper-1",
            {
              oldest: { totalValue: "1000" } as never,
              newest: { totalValue: "1300" } as never,
            },
          ],
          [
            "paper-2",
            {
              oldest: { totalValue: "1000" } as never,
              newest: { totalValue: "1250" } as never,
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
              oldest: { totalValue: "1000" } as never,
              newest: { totalValue: "1200" } as never,
            },
          ],
          [
            "perps-2",
            {
              oldest: { totalValue: "1000" } as never,
              newest: { totalValue: "1150" } as never,
            },
          ],
          [
            "paper-1",
            {
              oldest: { totalValue: "1000" } as never,
              newest: { totalValue: "1300" } as never,
            },
          ],
          [
            "paper-2",
            {
              oldest: { totalValue: "1000" } as never,
              newest: { totalValue: "1250" } as never,
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
});
