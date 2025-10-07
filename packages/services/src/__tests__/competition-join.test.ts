import { randomUUID } from "crypto";
import { Logger } from "pino";
import { beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { AgentRepository } from "@recallnet/db/repositories/agent";
import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import type { SelectAgent } from "@recallnet/db/schema/core/types";
import { SelectCompetition } from "@recallnet/db/schema/core/types";
import { Database } from "@recallnet/db/types";

import type { AgentService } from "../agent.service.js";
import type { AgentRankService } from "../agentrank.service.js";
import type { BalanceService } from "../balance.service.js";
import type { CompetitionRewardService } from "../competition-reward.service.js";
import { CompetitionService } from "../competition.service.js";
import type { PerpsDataProcessor } from "../perps-data-processor.service.js";
import type { PortfolioSnapshotterService } from "../portfolio-snapshotter.service.js";
import type { TradeSimulatorService } from "../trade-simulator.service.js";
import type { TradingConstraintsService } from "../trading-constraints.service.js";
import {
  ApiError,
  type SpecificChain,
  type SpecificChainBalances,
} from "../types/index.js";
import type { VoteService } from "../vote.service.js";

describe("CompetitionService - joinCompetition", () => {
  let competitionService: CompetitionService;
  let balanceService: MockProxy<BalanceService>;
  let tradeSimulatorService: MockProxy<TradeSimulatorService>;
  let portfolioSnapshotterService: MockProxy<PortfolioSnapshotterService>;
  let agentService: MockProxy<AgentService>;
  let agentRankService: MockProxy<AgentRankService>;
  let voteService: MockProxy<VoteService>;
  let tradingConstraintsService: MockProxy<TradingConstraintsService>;
  let competitionRewardService: MockProxy<CompetitionRewardService>;
  let perpsDataProcessor: MockProxy<PerpsDataProcessor>;
  let agentRepo: MockProxy<AgentRepository>;
  let agentScoreRepo: MockProxy<AgentScoreRepository>;
  let perpsRepo: MockProxy<PerpsRepository>;
  let competitionRepo: MockProxy<CompetitionRepository>;
  let mockDb: MockProxy<Database>;
  let logger: MockProxy<Logger>;

  const mockCompetitionId = randomUUID();
  const mockUserId = randomUUID();
  const mockAgent: SelectAgent = {
    id: randomUUID(),
    ownerId: mockUserId,
    walletAddress: "0x1234567890123456789012345678901234567890",
    name: "Test Agent",
    handle: "test-agent",
    email: null,
    description: null,
    imageUrl: null,
    apiKey: "test-api-key",
    apiKeyHash: "test-hash",
    metadata: null,
    status: "active",
    deactivationReason: null,
    deactivationDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock competition with all required fields for trading competitions
  const mockCompetition: SelectCompetition & {
    crossChainTradingType: "allow";
  } = {
    id: mockCompetitionId,
    name: "Test Competition",
    description: "Test Description",
    type: "trading",
    status: "pending",
    startDate: new Date(),
    endDate: new Date(),
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
    crossChainTradingType: "allow",
  };

  beforeEach(() => {
    // Create mocks
    balanceService = mock<BalanceService>();
    tradeSimulatorService = mock<TradeSimulatorService>();
    portfolioSnapshotterService = mock<PortfolioSnapshotterService>();
    agentService = mock<AgentService>();
    agentRankService = mock<AgentRankService>();
    voteService = mock<VoteService>();
    tradingConstraintsService = mock<TradingConstraintsService>();
    competitionRewardService = mock<CompetitionRewardService>();
    perpsDataProcessor = mock<PerpsDataProcessor>();
    agentRepo = mock<AgentRepository>();
    agentScoreRepo = mock<AgentScoreRepository>();
    perpsRepo = mock<PerpsRepository>();
    competitionRepo = mock<CompetitionRepository>();
    mockDb = mock<Database>();
    logger = mock<Logger>();

    // Mock config
    const mockConfig = {
      evmChains: [
        "eth",
        "polygon",
        "bsc",
        "arbitrum",
        "base",
        "optimism",
      ] as SpecificChain[],
      specificChainBalances: {
        eth: { eth: 1 },
      } as SpecificChainBalances,
      maxTradePercentage: 1,
      rateLimiting: {
        maxRequests: 100,
        windowMs: 60000,
      },
    };

    // Create service instance
    competitionService = new CompetitionService(
      balanceService,
      tradeSimulatorService,
      portfolioSnapshotterService,
      agentService,
      agentRankService,
      voteService,
      tradingConstraintsService,
      competitionRewardService,
      perpsDataProcessor,
      agentRepo,
      agentScoreRepo,
      perpsRepo,
      competitionRepo,
      mockDb,
      mockConfig,
      logger,
    );
  });

  describe("one agent per user limit", () => {
    it("should allow user to register their first agent successfully", async () => {
      // Setup mocks
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(mockCompetition);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      competitionRepo.addAgentToCompetition.mockResolvedValue();

      // Execute
      await competitionService.joinCompetition(
        mockCompetition.id,
        mockAgent.id,
        mockUserId,
        undefined,
      );

      // Verify
      expect(competitionRepo.addAgentToCompetition).toHaveBeenCalledWith(
        mockCompetition.id,
        mockAgent.id,
      );
    });

    it("should reject when user already has another agent registered (user auth)", async () => {
      // Setup mocks
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(mockCompetition);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      competitionRepo.addAgentToCompetition.mockRejectedValue(
        new Error("User already has an agent registered in this competition"),
      );

      // Execute & Verify
      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow(ApiError);

      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow(
        "You already have an agent registered in this competition",
      );
    });

    it("should reject when user already has another agent registered (agent auth)", async () => {
      // Setup mocks
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(mockCompetition);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      competitionRepo.addAgentToCompetition.mockRejectedValue(
        new Error("User already has an agent registered in this competition"),
      );

      // Execute & Verify (using agent API key auth)
      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          undefined,
          mockAgent.id,
        ),
      ).rejects.toThrow(ApiError);

      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          undefined,
          mockAgent.id,
        ),
      ).rejects.toThrow(
        "You already have an agent registered in this competition",
      );
    });

    it("should return correct HTTP status code (409)", async () => {
      // Setup mocks
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(mockCompetition);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      competitionRepo.addAgentToCompetition.mockRejectedValue(
        new Error("User already has an agent registered in this competition"),
      );

      // Execute & Verify
      try {
        await competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        );
        expect.fail("Should have thrown ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(409);
      }
    });

    it("should check for participant limit errors", async () => {
      // Setup mocks
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(mockCompetition);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      competitionRepo.addAgentToCompetition.mockRejectedValue(
        new Error("Competition has reached maximum participant limit (10)"),
      );

      // Execute & Verify
      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow(ApiError);

      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow("maximum participant limit");

      try {
        await competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        );
        expect.fail("Should have thrown ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(409);
      }
    });

    it("should not call addAgentToCompetition if agent is already active", async () => {
      // Setup mocks
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(mockCompetition);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(true);

      // Execute & Verify
      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow("already actively registered");

      // Verify addAgentToCompetition was never called
      expect(competitionRepo.addAgentToCompetition).not.toHaveBeenCalled();
    });

    it("should reject if competition is not in pending status", async () => {
      // Setup mocks
      const activeCompetition = {
        ...mockCompetition,
        status: "active" as const,
      };
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(activeCompetition);

      // Execute & Verify
      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow("Cannot join competition that has already started");

      // Verify addAgentToCompetition was never called
      expect(competitionRepo.addAgentToCompetition).not.toHaveBeenCalled();
    });

    it("should allow re-adding same agent (idempotent)", async () => {
      // Setup mocks for first registration
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.findById.mockResolvedValue(mockCompetition);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(false);
      competitionRepo.addAgentToCompetition.mockResolvedValue();

      // First registration
      await competitionService.joinCompetition(
        mockCompetition.id,
        mockAgent.id,
        mockUserId,
        undefined,
      );

      // Setup mocks for second registration (same agent)
      agentService.getAgent.mockResolvedValue(mockAgent);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValue(true);

      // Second registration should be rejected by the "already active" check
      // (which happens before addAgentToCompetition is called)
      await expect(
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
      ).rejects.toThrow("already actively registered");

      // Verify addAgentToCompetition was called only once
      expect(competitionRepo.addAgentToCompetition).toHaveBeenCalledTimes(1);
    });

    it("should handle race condition when two agents register simultaneously", async () => {
      // Simulate race condition: first call succeeds, second call fails
      // because the transaction detects the user already has an agent
      const agent2Id = randomUUID();
      const agent2: SelectAgent = {
        ...mockAgent,
        id: agent2Id,
        name: "Test Agent 2",
        handle: "test-agent-2",
      };

      // First registration attempt
      agentService.getAgent.mockResolvedValueOnce(mockAgent);
      competitionRepo.findById.mockResolvedValue(mockCompetition);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValueOnce(false);
      competitionRepo.addAgentToCompetition.mockResolvedValueOnce();

      // Second registration attempt (simulating race condition)
      agentService.getAgent.mockResolvedValueOnce(agent2);
      competitionRepo.isAgentActiveInCompetition.mockResolvedValueOnce(false);
      competitionRepo.addAgentToCompetition.mockRejectedValueOnce(
        new Error("User already has an agent registered in this competition"),
      );

      // Execute both registrations
      const [result1, result2] = await Promise.allSettled([
        competitionService.joinCompetition(
          mockCompetition.id,
          mockAgent.id,
          mockUserId,
          undefined,
        ),
        competitionService.joinCompetition(
          mockCompetition.id,
          agent2Id,
          mockUserId,
          undefined,
        ),
      ]);

      // First should succeed
      expect(result1.status).toBe("fulfilled");

      // Second should fail with correct error
      expect(result2.status).toBe("rejected");
      if (result2.status === "rejected") {
        expect(result2.reason).toBeInstanceOf(ApiError);
        expect((result2.reason as ApiError).statusCode).toBe(409);
        expect((result2.reason as ApiError).message).toContain(
          "already have an agent registered in this competition",
        );
      }

      // Both should have attempted to call addAgentToCompetition
      expect(competitionRepo.addAgentToCompetition).toHaveBeenCalledTimes(2);
    });
  });
});
